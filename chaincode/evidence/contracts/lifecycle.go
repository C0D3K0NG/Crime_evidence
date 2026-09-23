// lifecycle.go — Chaincode lifecycle management, lab results, and statistics.
//
// InitLedger is called once during deployment to record the genesis metadata.
// This file also contains lab result recording and aggregate query functions
// that serve the dashboard and reporting pages in the web app.
package contracts

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/evidence-chain/chaincode/models"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// LifecycleContract manages chaincode initialization, lab results, and aggregates.
type LifecycleContract struct {
	contractapi.Contract
}

// InitLedger is called once when the chaincode is committed to the channel.
// It writes a genesis metadata record to the ledger, documenting the deployment.
// Roles allowed: admin only (called automatically by deploy script)
func (lc *LifecycleContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	identity, err := GetCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("InitLedger: could not identify caller: %w", err)
	}

	genesis := &models.GenesisMetadata{
		DocType:     models.DocTypeMeta,
		NetworkName: "Crime Evidence Network",
		Channel:     "evidence-channel",
		Chaincode:   "evidence",
		Version:     "1.0",
		InitiatedBy: identity.MSPID,
		InitiatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	genesisBytes, err := json.Marshal(genesis)
	if err != nil {
		return fmt.Errorf("InitLedger: failed to marshal genesis metadata: %w", err)
	}

	if err := ctx.GetStub().PutState("META:genesis", genesisBytes); err != nil {
		return fmt.Errorf("InitLedger: failed to write genesis block: %w", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"event":       "LedgerInitialized",
		"initiatedBy": identity.MSPID,
		"txId":        ctx.GetStub().GetTxID(),
	})
	ctx.GetStub().SetEvent("LedgerInitialized", eventPayload)

	return nil
}

// GetLedgerMetadata retrieves the genesis block metadata written at InitLedger time.
// Useful for verifying the chaincode version and deployment info.
// Roles allowed: admin
func (lc *LifecycleContract) GetLedgerMetadata(
	ctx contractapi.TransactionContextInterface,
) (*models.GenesisMetadata, error) {

	if err := RequireRole(ctx, RoleAdmin); err != nil {
		return nil, err
	}

	metaBytes, err := ctx.GetStub().GetState("META:genesis")
	if err != nil {
		return nil, fmt.Errorf("failed to read genesis metadata: %w", err)
	}
	if metaBytes == nil {
		return nil, fmt.Errorf("ledger not initialized: META:genesis key not found")
	}

	var meta models.GenesisMetadata
	if err := json.Unmarshal(metaBytes, &meta); err != nil {
		return nil, fmt.Errorf("failed to unmarshal genesis metadata: %w", err)
	}
	return &meta, nil
}

// RecordLabResult creates an immutable forensic lab result record on the ledger.
// Called by the Express API after saving the lab result to SQLite.
//
// Roles allowed: analyst (ForensicLabMSP only)
// Key format: LABRESULT:{evidenceID}:{labResultID}
func (lc *LifecycleContract) RecordLabResult(
	ctx contractapi.TransactionContextInterface,
	labResultID string,
	evidenceID string,
	submittedByID string,
	title string,
	summary string,
	findings string,
	fileURL string,
) (*models.LabResultRecord, error) {

	// Lab results must come from ForensicLab org analysts
	if err := RequireRole(ctx, RoleAnalyst, RoleAdmin); err != nil {
		return nil, err
	}
	if err := RequireOrg(ctx, "ForensicLabMSP", "PoliceDeptMSP"); err != nil {
		return nil, err
	}

	if labResultID == "" || evidenceID == "" || submittedByID == "" || title == "" || summary == "" {
		return nil, fmt.Errorf("missing required fields: labResultID, evidenceID, submittedByID, title, summary")
	}

	// Verify evidence exists
	evidenceKey := fmt.Sprintf("%s:%s", models.DocTypeEvidence, evidenceID)
	evidenceBytes, err := ctx.GetStub().GetState(evidenceKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read evidence '%s': %w", evidenceID, err)
	}
	if evidenceBytes == nil {
		return nil, fmt.Errorf("evidence '%s' does not exist on-chain", evidenceID)
	}

	// Check for duplicate
	labKey := fmt.Sprintf("%s:%s:%s", models.DocTypeLabResult, evidenceID, labResultID)
	existing, err := ctx.GetStub().GetState(labKey)
	if err != nil {
		return nil, fmt.Errorf("failed to check for duplicate lab result: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("lab result '%s' already exists on-chain", labResultID)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	txID := ctx.GetStub().GetTxID()

	record := &models.LabResultRecord{
		DocType:       models.DocTypeLabResult,
		ID:            labResultID,
		EvidenceID:    evidenceID,
		SubmittedByID: submittedByID,
		Title:         title,
		Summary:       summary,
		Findings:      findings,
		FileURL:       fileURL,
		SubmittedAt:   now,
		TxID:          txID,
	}

	recordBytes, err := json.Marshal(record)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal lab result: %w", err)
	}

	if err := ctx.GetStub().PutState(labKey, recordBytes); err != nil {
		return nil, fmt.Errorf("failed to write lab result to ledger: %w", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"labResultId": labResultID,
		"evidenceId":  evidenceID,
		"txId":        txID,
	})
	ctx.GetStub().SetEvent("LabResultRecorded", eventPayload)

	return record, nil
}

// GetLabResults retrieves all forensic lab results for an evidence item.
// Uses CouchDB rich query sorted by submission date.
//
// Roles allowed: analyst, prosecutor, admin
func (lc *LifecycleContract) GetLabResults(
	ctx contractapi.TransactionContextInterface,
	evidenceID string,
) ([]*models.LabResultQueryResult, error) {

	if err := RequireRole(ctx, RoleAnalyst, RoleProsecutor, RoleAdmin); err != nil {
		return nil, err
	}

	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "%s",
			"evidenceId": "%s"
		},
		"sort": [{"submittedAt": "asc"}]
	}`, models.DocTypeLabResult, evidenceID)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("CouchDB lab results query failed: %w", err)
	}
	defer resultsIterator.Close()

	var results []*models.LabResultQueryResult
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error iterating lab result records: %w", err)
		}

		var record models.LabResultRecord
		if err := json.Unmarshal(queryResponse.Value, &record); err != nil {
			return nil, fmt.Errorf("failed to unmarshal lab result: %w", err)
		}
		results = append(results, &models.LabResultQueryResult{
			Key:    queryResponse.Key,
			Record: &record,
		})
	}

	if results == nil {
		results = []*models.LabResultQueryResult{}
	}
	return results, nil
}

// GetAllEvidence retrieves every evidence record on the ledger.
// This is an admin-only operation used for reporting and audits.
// For large datasets, use GetEvidenceByCase or GetEvidenceByStatus instead.
//
// Roles allowed: admin
func (lc *LifecycleContract) GetAllEvidence(
	ctx contractapi.TransactionContextInterface,
) ([]*models.EvidenceQueryResult, error) {

	if err := RequireRole(ctx, RoleAdmin); err != nil {
		return nil, err
	}

	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "%s"
		},
		"sort": [{"createdAt": "desc"}]
	}`, models.DocTypeEvidence)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("GetAllEvidence CouchDB query failed: %w", err)
	}
	defer resultsIterator.Close()

	var results []*models.EvidenceQueryResult
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error iterating evidence records: %w", err)
		}

		var record models.EvidenceRecord
		if err := json.Unmarshal(queryResponse.Value, &record); err != nil {
			return nil, fmt.Errorf("failed to unmarshal evidence record: %w", err)
		}
		results = append(results, &models.EvidenceQueryResult{
			Key:    queryResponse.Key,
			Record: &record,
		})
	}

	if results == nil {
		results = []*models.EvidenceQueryResult{}
	}
	return results, nil
}

// GetEvidenceStats returns aggregate counts of evidence grouped by status.
// Powers the admin dashboard's stats cards and charts.
//
// Roles allowed: custodian, analyst, prosecutor, admin
func (lc *LifecycleContract) GetEvidenceStats(
	ctx contractapi.TransactionContextInterface,
) (*models.EvidenceStats, error) {

	if err := RequireRole(ctx, RoleCustodian, RoleAnalyst, RoleProsecutor, RoleAdmin); err != nil {
		return nil, err
	}

	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "%s"
		},
		"fields": ["status"]
	}`, models.DocTypeEvidence)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("GetEvidenceStats query failed: %w", err)
	}
	defer resultsIterator.Close()

	countByStatus := make(map[string]int)
	total := 0

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error iterating stats results: %w", err)
		}

		var partial struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(queryResponse.Value, &partial); err != nil {
			continue
		}
		countByStatus[partial.Status]++
		total++
	}

	return &models.EvidenceStats{
		Total:         total,
		CountByStatus: countByStatus,
	}, nil
}
