// Package models defines the data structures stored on the Hyperledger Fabric ledger
// for the Crime Evidence Management System.
//
// Each struct corresponds to a world-state key prefix:
//   - EVIDENCE:{id}
//   - CUSTODY:{evidenceID}:{eventID}
//   - LABRESULT:{evidenceID}:{resultID}
//   - META:genesis
package models

// DocType constants used as prefixes and type discriminators in CouchDB.
const (
	DocTypeEvidence  = "EVIDENCE"
	DocTypeCustody   = "CUSTODY"
	DocTypeLabResult = "LABRESULT"
	DocTypeMeta      = "META"
)

// EvidenceStatus constants mirror the web app's demo_config.json statuses.
const (
	StatusCollected    = "collected"
	StatusInLab        = "in_lab"
	StatusAnalyzed     = "analyzed"
	StatusInCourt      = "in_court"
	StatusArchived     = "archived"
	StatusDestroyed    = "destroyed"
	StatusUnderReview  = "under_review"
)

// EvidenceRecord is the primary on-chain representation of a piece of evidence.
// It is stored under the composite key EVIDENCE:{ID}.
// The FileHash (SHA-256) is the integrity anchor — it must match the off-chain file
// stored in SQLite / IPFS. Tampered evidence will fail hash verification.
type EvidenceRecord struct {
	DocType           string `json:"docType"`           // Always "EVIDENCE"
	ID                string `json:"id"`                // UUID matching SQLite Evidence.id
	CaseID            string `json:"caseId"`            // UUID of the related case
	Type              string `json:"type"`              // e.g. "physical", "digital", "biological"
	Description       string `json:"description"`       // Human-readable description
	CollectionDate    string `json:"collectionDate"`    // RFC3339 timestamp
	Location          string `json:"location"`          // Where evidence was collected
	FileHash          string `json:"fileHash"`          // SHA-256 of the primary evidence file
	IPFSCID           string `json:"ipfsCid"`           // Optional IPFS content identifier
	Status            string `json:"status"`            // Current evidence status
	CollectedByID     string `json:"collectedById"`     // Officer user ID (from web app)
	CurrentCustodianID string `json:"currentCustodianId"` // Current holder's user ID
	Tags              string `json:"tags,omitempty"`    // Comma-separated tags
	OfficerNotes      string `json:"officerNotes,omitempty"` // Field notes
	CreatedAt         string `json:"createdAt"`         // RFC3339 timestamp of registration
	UpdatedAt         string `json:"updatedAt"`         // RFC3339 timestamp of last update
	TxID              string `json:"txId"`              // Fabric transaction ID of creation tx
}

// CustodyRecord represents a single chain-of-custody transfer event.
// Stored under composite key CUSTODY:{EvidenceID}:{ID}.
// All custody events are append-only — they are never modified after creation.
type CustodyRecord struct {
	DocType    string `json:"docType"`    // Always "CUSTODY"
	ID         string `json:"id"`         // UUID for this custody event
	EvidenceID string `json:"evidenceId"` // References EvidenceRecord.ID
	FromUserID string `json:"fromUserId"` // Transferring officer/custodian user ID
	ToUserID   string `json:"toUserId"`   // Receiving officer/custodian user ID
	EventType  string `json:"eventType"`  // "transfer", "check_out", "check_in"
	Reason     string `json:"reason"`     // Justification for the transfer
	Status     string `json:"status"`     // "pending", "approved", "rejected"
	Signature  string `json:"signature,omitempty"` // Digital signature (HMAC) at approval time
	Notes      string `json:"notes,omitempty"`     // Rejection notes or additional comments
	Timestamp  string `json:"timestamp"`  // RFC3339 when event was initiated
	TxID       string `json:"txId"`       // Fabric transaction ID
}

// LabResultRecord stores a forensic lab result linked to an evidence item.
// Stored under composite key LABRESULT:{EvidenceID}:{ID}.
type LabResultRecord struct {
	DocType      string `json:"docType"`      // Always "LABRESULT"
	ID           string `json:"id"`           // UUID for this lab result
	EvidenceID   string `json:"evidenceId"`   // References EvidenceRecord.ID
	SubmittedByID string `json:"submittedById"` // Analyst user ID
	Title        string `json:"title"`        // Short title for the result
	Summary      string `json:"summary"`      // Summary of findings
	Findings     string `json:"findings,omitempty"` // Detailed findings
	FileURL      string `json:"fileUrl,omitempty"`  // URL to lab report file
	SubmittedAt  string `json:"submittedAt"`  // RFC3339 timestamp
	TxID         string `json:"txId"`         // Fabric transaction ID
}

// GenesisMetadata is stored at key META:genesis on InitLedger.
// It documents when and by whom the chaincode was initialized.
type GenesisMetadata struct {
	DocType     string `json:"docType"` // Always "META"
	NetworkName string `json:"networkName"`
	Channel     string `json:"channel"`
	Chaincode   string `json:"chaincode"`
	Version     string `json:"version"`
	InitiatedBy string `json:"initiatedBy"` // MSP ID of the initializing identity
	InitiatedAt string `json:"initiatedAt"` // RFC3339 timestamp
}

// EvidenceQueryResult wraps an EvidenceRecord with its ledger key for query responses.
type EvidenceQueryResult struct {
	Key    string          `json:"key"`
	Record *EvidenceRecord `json:"record"`
}

// CustodyQueryResult wraps a CustodyRecord with its ledger key.
type CustodyQueryResult struct {
	Key    string         `json:"key"`
	Record *CustodyRecord `json:"record"`
}

// LabResultQueryResult wraps a LabResultRecord with its ledger key.
type LabResultQueryResult struct {
	Key    string           `json:"key"`
	Record *LabResultRecord `json:"record"`
}

// EvidenceStats contains aggregate counts by status for dashboard display.
type EvidenceStats struct {
	Total         int            `json:"total"`
	CountByStatus map[string]int `json:"countByStatus"`
}

// HashVerificationResult is returned by VerifyEvidenceHash.
type HashVerificationResult struct {
	EvidenceID    string `json:"evidenceId"`
	StoredHash    string `json:"storedHash"`
	ProvidedHash  string `json:"providedHash"`
	HashesMatch   bool   `json:"hashesMatch"`
	Verified      bool   `json:"verified"`
	VerifiedAt    string `json:"verifiedAt"`
}
