// custody.go — Chain-of-custody transfer smart contract functions.
//
// The custody workflow mirrors the web app's 3-step process:
//   1. InitiateCustodyTransfer  → creates a pending CustodyRecord + locks evidence
//   2. ApproveCustodyTransfer   → finalizes transfer, updates CurrentCustodianID in EvidenceRecord
//   3. RejectCustodyTransfer    → marks event rejected, evidence remains with current custodian
//
// All custody events are permanently written to the ledger and can never be deleted.
// GetCustodyHistory returns the complete, auditable chain-of-custody trail.
package contracts

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/evidence-chain/chaincode/models"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// CustodyContract manages chain-of-custody transfer events.
type CustodyContract struct {
	contractapi.Contract
}

// InitiateCustodyTransfer creates a new pending custody transfer event on the ledger.
// This mirrors the web app's "initiate transfer" which sets evidence.locked = true.
// On-chain, we create the pending CustodyRecord — the actual custodian update
// only happens when ApproveCustodyTransfer is called.
//
// Roles allowed: officer, custodian, admin
// Key format: CUSTODY:{evidenceID}:{custodyEventID}
func (cc *CustodyContract) InitiateCustodyTransfer(
	ctx contractapi.TransactionContextInterface,
	custodyEventID string,
	evidenceID string,
	fromUserID string,
	toUserID string,
	eventType string,
	reason string,
) (*models.CustodyRecord, error) {

	if err := RequireRole(ctx, RoleOfficer, RoleCustodian, RoleAdmin); err != nil {
		return nil, err
	}

	if custodyEventID == "" || evidenceID == "" || fromUserID == "" || toUserID == "" || reason == "" {
		return nil, fmt.Errorf("missing required fields: custodyEventID, evidenceID, fromUserID, toUserID, reason")
	}

	// Verify the evidence exists before creating a custody event
	evidenceKey := fmt.Sprintf("%s:%s", models.DocTypeEvidence, evidenceID)
	existingBytes, err := ctx.GetStub().GetState(evidenceKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read evidence '%s': %w", evidenceID, err)
	}
	if existingBytes == nil {
		return nil, fmt.Errorf("evidence '%s' does not exist on the ledger", evidenceID)
	}

	// Check for duplicate custody event ID
	custodyKey := fmt.Sprintf("%s:%s:%s", models.DocTypeCustody, evidenceID, custodyEventID)
	existingEvent, err := ctx.GetStub().GetState(custodyKey)
	if err != nil {
		return nil, fmt.Errorf("failed to check for duplicate custody event: %w", err)
	}
	if existingEvent != nil {
		return nil, fmt.Errorf("custody event '%s' already exists on-chain", custodyEventID)
	}

	if eventType == "" {
		eventType = "transfer"
	}

	now := time.Now().UTC().Format(time.RFC3339)
	txID := ctx.GetStub().GetTxID()

	record := &models.CustodyRecord{
		DocType:    models.DocTypeCustody,
		ID:         custodyEventID,
		EvidenceID: evidenceID,
		FromUserID: fromUserID,
		ToUserID:   toUserID,
		EventType:  eventType,
		Reason:     reason,
		Status:     "pending",
		Timestamp:  now,
		TxID:       txID,
	}

	recordBytes, err := json.Marshal(record)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal custody record: %w", err)
	}

	if err := ctx.GetStub().PutState(custodyKey, recordBytes); err != nil {
		return nil, fmt.Errorf("failed to write custody record to ledger: %w", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"custodyEventId": custodyEventID,
		"evidenceId":     evidenceID,
		"fromUserId":     fromUserID,
		"toUserId":       toUserID,
		"txId":           txID,
	})
	ctx.GetStub().SetEvent("CustodyTransferInitiated", eventPayload)

	return record, nil
}

// ApproveCustodyTransfer finalizes a pending custody transfer.
// This updates the CustodyRecord status to "approved" AND updates the
// CurrentCustodianID in the EvidenceRecord — the definitive on-chain
// record of who holds the evidence.
//
// Roles allowed: custodian, admin
func (cc *CustodyContract) ApproveCustodyTransfer(
	ctx contractapi.TransactionContextInterface,
	custodyEventID string,
	evidenceID string,
	signature string,
) (*models.CustodyRecord, error) {

	if err := RequireRole(ctx, RoleCustodian, RoleAdmin); err != nil {
		return nil, err
	}

	// ── Load custody event ──
	custodyRecord, err := cc.getCustodyRecord(ctx, evidenceID, custodyEventID)
	if err != nil {
		return nil, err
	}

	if custodyRecord.Status != "pending" {
		return nil, fmt.Errorf("custody event '%s' is not in 'pending' state (current: '%s')", custodyEventID, custodyRecord.Status)
	}

	// ── Update custody event to approved ──
	custodyRecord.Status = "approved"
	custodyRecord.Signature = signature

	custodyKey := fmt.Sprintf("%s:%s:%s", models.DocTypeCustody, evidenceID, custodyEventID)
	custodyBytes, err := json.Marshal(custodyRecord)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal updated custody record: %w", err)
	}
	if err := ctx.GetStub().PutState(custodyKey, custodyBytes); err != nil {
		return nil, fmt.Errorf("failed to update custody record: %w", err)
	}

	// ── Update the EvidenceRecord's CurrentCustodianID ──
	evidenceKey := fmt.Sprintf("%s:%s", models.DocTypeEvidence, evidenceID)
	evidenceBytes, err := ctx.GetStub().GetState(evidenceKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read evidence record: %w", err)
	}
	if evidenceBytes == nil {
		return nil, fmt.Errorf("evidence '%s' not found on ledger", evidenceID)
	}

	var evidenceRecord models.EvidenceRecord
	if err := json.Unmarshal(evidenceBytes, &evidenceRecord); err != nil {
		return nil, fmt.Errorf("failed to unmarshal evidence record: %w", err)
	}

	// Transfer custody
	evidenceRecord.CurrentCustodianID = custodyRecord.ToUserID
	evidenceRecord.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	updatedEvidenceBytes, err := json.Marshal(evidenceRecord)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal updated evidence record: %w", err)
	}
	if err := ctx.GetStub().PutState(evidenceKey, updatedEvidenceBytes); err != nil {
		return nil, fmt.Errorf("failed to update evidence record with new custodian: %w", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"custodyEventId":    custodyEventID,
		"evidenceId":        evidenceID,
		"newCustodianId":    custodyRecord.ToUserID,
		"previousCustodian": custodyRecord.FromUserID,
		"txId":              ctx.GetStub().GetTxID(),
	})
	ctx.GetStub().SetEvent("CustodyTransferApproved", eventPayload)

	return custodyRecord, nil
}

// RejectCustodyTransfer marks a pending custody transfer as rejected.
// The evidence remains with the current custodian (no change to EvidenceRecord).
//
// Roles allowed: custodian, admin
func (cc *CustodyContract) RejectCustodyTransfer(
	ctx contractapi.TransactionContextInterface,
	custodyEventID string,
	evidenceID string,
	rejectionNotes string,
) (*models.CustodyRecord, error) {

	if err := RequireRole(ctx, RoleCustodian, RoleAdmin); err != nil {
		return nil, err
	}

	custodyRecord, err := cc.getCustodyRecord(ctx, evidenceID, custodyEventID)
	if err != nil {
		return nil, err
	}

	if custodyRecord.Status != "pending" {
		return nil, fmt.Errorf("cannot reject: custody event '%s' is not pending (current: '%s')", custodyEventID, custodyRecord.Status)
	}

	custodyRecord.Status = "rejected"
	custodyRecord.Notes = rejectionNotes

	custodyKey := fmt.Sprintf("%s:%s:%s", models.DocTypeCustody, evidenceID, custodyEventID)
	custodyBytes, err := json.Marshal(custodyRecord)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal rejected custody record: %w", err)
	}

	if err := ctx.GetStub().PutState(custodyKey, custodyBytes); err != nil {
		return nil, fmt.Errorf("failed to write rejected custody record: %w", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"custodyEventId": custodyEventID,
		"evidenceId":     evidenceID,
		"txId":           ctx.GetStub().GetTxID(),
	})
	ctx.GetStub().SetEvent("CustodyTransferRejected", eventPayload)

	return custodyRecord, nil
}

// GetCustodyHistory returns the complete, ordered chain-of-custody trail
// for a given evidence item. Uses a CouchDB rich query to retrieve all
// CUSTODY records for the evidence, sorted by timestamp.
//
// This is the auditable, tamper-proof record that courts and prosecutors rely on.
// Roles allowed: officer, custodian, analyst, prosecutor, admin
func (cc *CustodyContract) GetCustodyHistory(
	ctx contractapi.TransactionContextInterface,
	evidenceID string,
) ([]*models.CustodyQueryResult, error) {

	if err := RequireRole(ctx, RoleOfficer, RoleCustodian, RoleAnalyst, RoleProsecutor, RoleAdmin); err != nil {
		return nil, err
	}

	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "%s",
			"evidenceId": "%s"
		},
		"sort": [{"timestamp": "asc"}]
	}`, models.DocTypeCustody, evidenceID)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("CouchDB custody history query failed: %w", err)
	}
	defer resultsIterator.Close()

	var results []*models.CustodyQueryResult
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error iterating custody results: %w", err)
		}

		var record models.CustodyRecord
		if err := json.Unmarshal(queryResponse.Value, &record); err != nil {
			return nil, fmt.Errorf("failed to unmarshal custody record: %w", err)
		}
		results = append(results, &models.CustodyQueryResult{
			Key:    queryResponse.Key,
			Record: &record,
		})
	}

	if results == nil {
		results = []*models.CustodyQueryResult{}
	}
	return results, nil
}

// GetLedgerCustodyHistory uses Fabric's built-in key history (block-level audit)
// to return every version of the EvidenceRecord key, showing every time the
// custodian changed. This is a Fabric-native audit trail (not CouchDB).
// Returns raw JSON strings for each historical state.
//
// Roles allowed: prosecutor, admin
func (cc *CustodyContract) GetLedgerCustodyHistory(
	ctx contractapi.TransactionContextInterface,
	evidenceID string,
) ([]string, error) {

	if err := RequireRole(ctx, RoleProsecutor, RoleAdmin); err != nil {
		return nil, err
	}

	key := fmt.Sprintf("%s:%s", models.DocTypeEvidence, evidenceID)
	historyIterator, err := ctx.GetStub().GetHistoryForKey(key)
	if err != nil {
		return nil, fmt.Errorf("failed to get ledger history for evidence '%s': %w", evidenceID, err)
	}
	defer historyIterator.Close()

	var history []string
	for historyIterator.HasNext() {
		modification, err := historyIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error reading history: %w", err)
		}

		entry := map[string]interface{}{
			"txId":      modification.TxId,
			"timestamp": modification.Timestamp.AsTime().UTC().Format(time.RFC3339),
			"isDelete":  modification.IsDelete,
			"value":     string(modification.Value),
		}
		entryBytes, _ := json.Marshal(entry)
		history = append(history, string(entryBytes))
	}

	return history, nil
}

// ──────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────

func (cc *CustodyContract) getCustodyRecord(
	ctx contractapi.TransactionContextInterface,
	evidenceID string,
	custodyEventID string,
) (*models.CustodyRecord, error) {
	key := fmt.Sprintf("%s:%s:%s", models.DocTypeCustody, evidenceID, custodyEventID)
	recordBytes, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("failed to read custody event '%s': %w", custodyEventID, err)
	}
	if recordBytes == nil {
		return nil, fmt.Errorf("custody event '%s' for evidence '%s' does not exist on the ledger", custodyEventID, evidenceID)
	}

	var record models.CustodyRecord
	if err := json.Unmarshal(recordBytes, &record); err != nil {
		return nil, fmt.Errorf("failed to unmarshal custody record: %w", err)
	}
	return &record, nil
}
