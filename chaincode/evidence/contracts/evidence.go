// evidence.go — Core evidence management smart contract functions.
//
// Functions in this file handle registering new evidence, updating status,
// and querying evidence records from the CouchDB world state.
//
// Key design decisions:
//   - Evidence records are IMMUTABLE after registration (the hash anchors integrity).
//   - Status updates are append-only and role-restricted.
//   - CouchDB rich queries use selector syntax (requires CouchDB state DB in docker-compose).
//   - All writes record the Fabric Transaction ID (TxID) so the API can return it to the frontend.
package contracts

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/evidence-chain/chaincode/models"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// EvidenceContract implements evidence registration, queries, and hash verification.
type EvidenceContract struct {
	contractapi.Contract
}

// RegisterEvidence creates a new immutable evidence record on the ledger.
// This is called by the Express backend after the SQLite row is created,
// anchoring the evidence hash permanently on-chain.
//
// Roles allowed: officer, admin
// Key format: EVIDENCE:{id}
func (ec *EvidenceContract) RegisterEvidence(
	ctx contractapi.TransactionContextInterface,
	id string,
	caseID string,
	evidenceType string,
	description string,
	collectionDate string,
	location string,
	fileHash string,
	ipfsCID string,
	collectedByID string,
	currentCustodianID string,
	tags string,
	officerNotes string,
) (*models.EvidenceRecord, error) {

	// ── Access control ──
	if err := RequireRole(ctx, RoleOfficer, RoleAdmin); err != nil {
		return nil, err
	}

	// ── Validate required fields ──
	if id == "" || caseID == "" || evidenceType == "" || fileHash == "" || collectedByID == "" {
		return nil, fmt.Errorf("missing required fields: id, caseID, type, fileHash, collectedByID")
	}

	// ── Check for duplicate (idempotency guard) ──
	key := fmt.Sprintf("%s:%s", models.DocTypeEvidence, id)
	existing, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("failed to read world state: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("evidence with ID '%s' already exists on-chain. Duplicate registration rejected", id)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	txID := ctx.GetStub().GetTxID()

	record := &models.EvidenceRecord{
		DocType:            models.DocTypeEvidence,
		ID:                 id,
		CaseID:             caseID,
		Type:               evidenceType,
		Description:        description,
		CollectionDate:     collectionDate,
		Location:           location,
		FileHash:           fileHash,
		IPFSCID:            ipfsCID,
		Status:             models.StatusCollected,
		CollectedByID:      collectedByID,
		CurrentCustodianID: currentCustodianID,
		Tags:               tags,
		OfficerNotes:       officerNotes,
		CreatedAt:          now,
		UpdatedAt:          now,
		TxID:               txID,
	}

	recordBytes, err := json.Marshal(record)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal evidence record: %w", err)
	}

	if err := ctx.GetStub().PutState(key, recordBytes); err != nil {
		return nil, fmt.Errorf("failed to write evidence record to ledger: %w", err)
	}

	// Emit a chaincode event so the Node.js SDK listener can react in real-time
	eventPayload, _ := json.Marshal(map[string]string{
		"id":     id,
		"caseId": caseID,
		"txId":   txID,
	})
	ctx.GetStub().SetEvent("EvidenceRegistered", eventPayload)

	return record, nil
}

// UpdateEvidenceStatus updates the status of an existing evidence record.
// Only allowed roles can transition to specific statuses (e.g. only analysts can set "analyzed").
//
// Roles allowed:
//   - officer → collected, under_review
//   - custodian → in_lab, in_court, archived
//   - analyst → analyzed
//   - admin → any status
func (ec *EvidenceContract) UpdateEvidenceStatus(
	ctx contractapi.TransactionContextInterface,
	id string,
	newStatus string,
) (*models.EvidenceRecord, error) {

	identity, err := GetCallerIdentity(ctx)
	if err != nil {
		return nil, err
	}

	// Role-to-status permission matrix
	allowedStatuses := map[string][]string{
		RoleOfficer:    {models.StatusCollected, models.StatusUnderReview},
		RoleCustodian:  {models.StatusInLab, models.StatusInCourt, models.StatusArchived},
		RoleAnalyst:    {models.StatusAnalyzed},
		RoleProsecutor: {models.StatusInCourt},
		RoleAdmin:      {models.StatusCollected, models.StatusInLab, models.StatusAnalyzed, models.StatusInCourt, models.StatusArchived, models.StatusDestroyed, models.StatusUnderReview},
	}

	allowed := false
	if statuses, ok := allowedStatuses[identity.Role]; ok {
		for _, s := range statuses {
			if s == newStatus {
				allowed = true
				break
			}
		}
	}
	if !allowed {
		return nil, fmt.Errorf("role '%s' cannot set evidence status to '%s'", identity.Role, newStatus)
	}

	record, err := ec.getEvidenceRecord(ctx, id)
	if err != nil {
		return nil, err
	}

	record.Status = newStatus
	record.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	key := fmt.Sprintf("%s:%s", models.DocTypeEvidence, id)
	recordBytes, err := json.Marshal(record)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal updated record: %w", err)
	}

	if err := ctx.GetStub().PutState(key, recordBytes); err != nil {
		return nil, fmt.Errorf("failed to write updated record: %w", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"id":        id,
		"newStatus": newStatus,
		"updatedBy": identity.CN,
		"txId":      ctx.GetStub().GetTxID(),
	})
	ctx.GetStub().SetEvent("EvidenceStatusUpdated", eventPayload)

	return record, nil
}

// GetEvidence retrieves a single evidence record by ID.
// Roles allowed: officer, custodian, analyst, prosecutor, admin
func (ec *EvidenceContract) GetEvidence(
	ctx contractapi.TransactionContextInterface,
	id string,
) (*models.EvidenceRecord, error) {

	if err := RequireRole(ctx, RoleOfficer, RoleCustodian, RoleAnalyst, RoleProsecutor, RoleAdmin); err != nil {
		return nil, err
	}

	return ec.getEvidenceRecord(ctx, id)
}

// GetEvidenceByCase retrieves all evidence records for a given caseID using
// a CouchDB rich query. Requires CouchDB state database (configured in docker-compose).
//
// Roles allowed: officer, custodian, analyst, prosecutor, admin
func (ec *EvidenceContract) GetEvidenceByCase(
	ctx contractapi.TransactionContextInterface,
	caseID string,
) ([]*models.EvidenceQueryResult, error) {

	if err := RequireRole(ctx, RoleOfficer, RoleCustodian, RoleAnalyst, RoleProsecutor, RoleAdmin); err != nil {
		return nil, err
	}

	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "%s",
			"caseId": "%s"
		},
		"sort": [{"createdAt": "asc"}]
	}`, models.DocTypeEvidence, caseID)

	return ec.queryEvidenceRecords(ctx, queryString)
}

// GetEvidenceByOfficer retrieves all evidence records collected by a given officer.
// Roles allowed: officer (own records), admin (all)
func (ec *EvidenceContract) GetEvidenceByOfficer(
	ctx contractapi.TransactionContextInterface,
	officerID string,
) ([]*models.EvidenceQueryResult, error) {

	identity, err := GetCallerIdentity(ctx)
	if err != nil {
		return nil, err
	}

	// Officers can only see their own evidence; admins can see anyone's
	if identity.Role == RoleOfficer && identity.UserID != officerID {
		return nil, fmt.Errorf("access denied: officers can only query their own evidence records")
	}
	if identity.Role != RoleOfficer && identity.Role != RoleAdmin {
		return nil, fmt.Errorf("access denied: only officers and admins can query by officer ID")
	}

	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "%s",
			"collectedById": "%s"
		},
		"sort": [{"createdAt": "desc"}]
	}`, models.DocTypeEvidence, officerID)

	return ec.queryEvidenceRecords(ctx, queryString)
}

// GetEvidenceByStatus retrieves all evidence records with a given status.
// Roles allowed: custodian, analyst, admin
func (ec *EvidenceContract) GetEvidenceByStatus(
	ctx contractapi.TransactionContextInterface,
	status string,
) ([]*models.EvidenceQueryResult, error) {

	if err := RequireRole(ctx, RoleCustodian, RoleAnalyst, RoleProsecutor, RoleAdmin); err != nil {
		return nil, err
	}

	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "%s",
			"status": "%s"
		},
		"sort": [{"updatedAt": "desc"}]
	}`, models.DocTypeEvidence, status)

	return ec.queryEvidenceRecords(ctx, queryString)
}

// VerifyEvidenceHash checks whether a provided SHA-256 hash matches the hash
// stored on the ledger for the given evidence ID. Returns a verification result
// that the frontend can display as a "Chain of Integrity" badge.
//
// Roles allowed: any authenticated user
func (ec *EvidenceContract) VerifyEvidenceHash(
	ctx contractapi.TransactionContextInterface,
	id string,
	hashToVerify string,
) (*models.HashVerificationResult, error) {

	if err := RequireRole(ctx, RoleOfficer, RoleCustodian, RoleAnalyst, RoleProsecutor, RoleAdmin); err != nil {
		return nil, err
	}

	record, err := ec.getEvidenceRecord(ctx, id)
	if err != nil {
		return nil, err
	}

	matches := record.FileHash == hashToVerify
	return &models.HashVerificationResult{
		EvidenceID:   id,
		StoredHash:   record.FileHash,
		ProvidedHash: hashToVerify,
		HashesMatch:  matches,
		Verified:     matches,
		VerifiedAt:   time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// ──────────────────────────────────────────────
// Internal helpers (unexported)
// ──────────────────────────────────────────────

// getEvidenceRecord is a shared internal helper to fetch and unmarshal an evidence record.
func (ec *EvidenceContract) getEvidenceRecord(
	ctx contractapi.TransactionContextInterface,
	id string,
) (*models.EvidenceRecord, error) {
	key := fmt.Sprintf("%s:%s", models.DocTypeEvidence, id)
	recordBytes, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("failed to read evidence '%s' from world state: %w", id, err)
	}
	if recordBytes == nil {
		return nil, fmt.Errorf("evidence '%s' does not exist on the ledger", id)
	}

	var record models.EvidenceRecord
	if err := json.Unmarshal(recordBytes, &record); err != nil {
		return nil, fmt.Errorf("failed to unmarshal evidence record: %w", err)
	}
	return &record, nil
}

// queryEvidenceRecords executes a CouchDB rich query and returns results.
func (ec *EvidenceContract) queryEvidenceRecords(
	ctx contractapi.TransactionContextInterface,
	queryString string,
) ([]*models.EvidenceQueryResult, error) {

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("CouchDB rich query failed: %w", err)
	}
	defer resultsIterator.Close()

	var results []*models.EvidenceQueryResult
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error iterating query results: %w", err)
		}

		var record models.EvidenceRecord
		if err := json.Unmarshal(queryResponse.Value, &record); err != nil {
			return nil, fmt.Errorf("failed to unmarshal query result: %w", err)
		}
		results = append(results, &models.EvidenceQueryResult{
			Key:    queryResponse.Key,
			Record: &record,
		})
	}

	if results == nil {
		results = []*models.EvidenceQueryResult{} // return empty slice, not nil
	}
	return results, nil
}
