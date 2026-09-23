# Phase 2: Smart Contracts (Chaincode) Development & Deployment

## 📌 Overview

**Phase 2** builds the smart contract layer (known as **Chaincode** in Hyperledger Fabric) for the Crime Evidence Management System.

While Phase 1 established the underlying permissioned ledger network (peers, orderer, channels, CouchDB, and Certificate Authorities), **Phase 2 deploys the business logic, state schema, RBAC policies, and cryptographic verification mechanisms directly onto the blockchain ledger**.

The smart contract is written in **Go (Golang)** using the official `fabric-contract-api-go v1.2.2` SDK and compiled to execute inside isolated Docker chaincode containers managed by Hyperledger Fabric peer nodes.

---

## 🏗️ What Phase 2 Accomplished

Phase 2 implemented, compiled, deployed, and verified the multi-contract chaincode suite on `evidence-channel`:

1. **Go Chaincode Architecture (`github.com/evidence-chain/chaincode`)**:
   - Developed a modular smart contract suite comprising four dedicated contract modules: `EvidenceContract`, `CustodyContract`, `LifecycleContract`, and `AccessControlContract`.
   - Utilized Go struct tagging for JSON serialization, CouchDB indexable document typing (`docType`), and timestamp validation.

2. **Attribute & Role-Based Access Control (ABAC/RBAC)**:
   - Extracted identity certificates (X.509 MSP credentials) at runtime using Fabric's `ClientIdentity` API.
   - Enforced strict organizational (`PoliceDeptMSP`, `ForensicLabMSP`) and functional role (`officer`, `custodian`, `analyst`, `prosecutor`, `admin`) constraints across every ledger transaction.

3. **Tamper-Evident Evidence & Custody Management**:
   - Implemented immutable registration of evidence metadata linked to off-chain IPFS storage hashes (SHA-256 / IPFS CIDs).
   - Engineered atomic chain-of-custody transfer workflows with peer-to-peer approval and rejection states.
   - Built full ledger key history retrieval (`GetHistoryForKey`) enabling prosecutors to inspect the exact state mutation timeline of any item.

4. **Forensic Analysis & Audit Reporting**:
   - Built analytical recording for forensic results including tamper checks, laboratory summary, and test parameters.
   - Implemented state-wide evidence statistics aggregation and rich CouchDB JSON query capabilities.

5. **Successful Network Deployment**:
   - Packaged, installed, approved across both `PoliceDeptMSP` and `ForensicLabMSP`, committed with an `AND('PoliceDeptMSP.peer', 'ForensicLabMSP.peer')` endorsement policy, and initialized (`InitLedger`) on `evidence-channel`.

---

## 🏛️ Smart Contract Architecture & Directory Structure

All chaincode source files reside in the `chaincode/evidence/` directory:

```
chaincode/
└── evidence/
    ├── go.mod                     # Go module definition (fabric-contract-api-go v1.2.2)
    ├── go.sum                     # Go checksum manifest
    ├── main.go                    # Main entry point registering all 3 contract classes
    ├── models/
    │   └── types.go               # Struct definitions (EvidenceRecord, CustodyRecord, etc.)
    └── contracts/
        ├── access.go              # Identity & RBAC helper methods (GetCallerIdentity, RequireRole)
        ├── evidence.go            # Evidence lifecycle, queries & SHA-256 hash verification
        ├── custody.go             # Chain of custody transfers & Fabric key history audit
        └── lifecycle.go           # Genesis init, forensic lab results & aggregate statistics
```

---

## 📦 Data Models & World State Key Schema

Hyperledger Fabric stores state in a key-value store (backed by CouchDB). To prevent key collisions across contract domains, state keys use structured prefixes, and documents include a `docType` discriminator field for CouchDB rich JSON queries.

### Key Prefixing & Document Types

| Domain | World State Key Format | `docType` Value | Description |
| :--- | :--- | :--- | :--- |
| **Evidence** | `EVIDENCE:{evidenceID}` | `EVIDENCE` | Primary record containing evidence metadata, SHA-256 hash, location, and current custodian |
| **Custody Transfer** | `CUSTODY:{evidenceID}:{custodyEventID}` | `CUSTODY` | Log of custody transfer requests between officers/custodians |
| **Lab Result** | `LABRESULT:{evidenceID}:{resultID}` | `LAB_RESULT` | Forensic lab test result attached to an evidence item |
| **System Metadata** | `META:genesis` | `SYSTEM_META` | Chaincode genesis initialization record |

### Core Data Structs (`models/types.go`)

#### 1. `EvidenceRecord`
```go
type EvidenceRecord struct {
	DocType             string   `json:"docType"`             // "EVIDENCE"
	ID                  string   `json:"id"`                  // Unique Evidence ID (e.g. EV-2026-001)
	CaseID              string   `json:"caseId"`              // Associated Case ID
	Title               string   `json:"title"`               // Brief description title
	Description         string   `json:"description"`         // Detailed evidence description
	Type                string   `json:"type"`                // Weapon, Document, Digital, Physical, Biological, Other
	Status              string   `json:"status"`              // collected, under_review, in_lab, analyzed, in_court, archived, disposed
	LocationFound       string   `json:"locationFound"`       // Incident location where collected
	CollectedBy         string   `json:"collectedBy"`         // Officer user ID / MSP Client ID
	CollectedByOrg      string   `json:"collectedByOrg"`      // MSP ID of collecting org (PoliceDeptMSP)
	CollectedAt         string   `json:"collectedAt"`         // RFC3339 Timestamp
	FileHash            string   `json:"fileHash"`            // SHA-256 / IPFS CID of evidence digital payload
	StoragePath         string   `json:"storagePath"`         // IPFS URI or storage pointer
	CurrentCustodianID  string   `json:"currentCustodianId"`  // Current user holding physical/digital evidence
	CurrentCustodianOrg string   `json:"currentCustodianOrg"` // MSP ID of current custodian
	MetadataJSON        string   `json:"metadataJson"`        // Arbitrary JSON string for extended properties
	TxID                string   `json:"txId"`                // Fabric transaction ID of last mutation
	UpdatedAt           string   `json:"updatedAt"`           // RFC3339 timestamp of last update
}
```

#### 2. `CustodyRecord`
```go
type CustodyRecord struct {
	DocType        string `json:"docType"`        // "CUSTODY"
	CustodyEventID string `json:"custodyEventId"` // Unique Custody Transfer Event ID
	EvidenceID     string `json:"evidenceId"`     // Target Evidence ID
	FromUserID     string `json:"fromUserId"`     // Relinquishing user ID
	FromUserOrg    string `json:"fromUserOrg"`    // Relinquishing organization MSP
	ToUserID       string `json:"toUserId"`       // Recipient user ID
	ToUserName     string `json:"toUserName"`     // Recipient human name
	ToUserOrg      string `json:"toUserOrg"`      // Recipient organization MSP
	Reason         string `json:"reason"`         // Reason for custody transfer (e.g., Forensic Analysis)
	Location       string `json:"location"`       // Destination storage location / vault
	Status         string `json:"status"`         // PENDING, APPROVED, REJECTED
	InitiatedAt    string `json:"initiatedAt"`    // RFC3339 initiation timestamp
	ResolvedAt     string `json:"resolvedAt"`     // RFC3339 resolution timestamp
	Notes          string `json:"notes"`          // Approval / rejection notes
	TxID           string `json:"txId"`           // Fabric transaction ID
}
```

#### 3. `LabResultRecord`
```go
type LabResultRecord struct {
	DocType            string `json:"docType"`            // "LAB_RESULT"
	ResultID           string `json:"resultId"`           // Unique Lab Result ID
	EvidenceID         string `json:"evidenceId"`         // Associated Evidence ID
	AnalystID          string `json:"analystId"`          // Forensic Analyst ID
	AnalystName        string `json:"analystName"`        // Forensic Analyst Name
	AnalystOrg         string `json:"analystOrg"`         // MSP ID (ForensicLabMSP)
	Summary            string `json:"summary"`            // Executive analytical summary
	DetailedReport     string `json:"detailedReport"`     // Detailed findings / IPFS report URI
	TestParametersJSON string `json:"testParametersJson"` // JSON test parameters (e.g. spectroscope findings)
	IsTampered         bool   `json:"isTampered"`         // Indicator if evidence shows tampering
	Timestamp          string `json:"timestamp"`          // RFC3339 timestamp
	TxID               string `json:"txId"`               // Fabric transaction ID
}
```

---

## 🔒 Access Control & Role-Based Security (ABAC/RBAC)

Identity and access control in the chaincode is governed by `AccessControlContract` (`contracts/access.go`).

### Identity Extraction Mechanics
Fabric identity certificates contain MSP attributes (`hf.Affiliation`, `role`, `email`). The helper method `GetCallerIdentity(ctx)` extracts:
- **MSP ID**: Client's Organization (e.g., `PoliceDeptMSP`, `ForensicLabMSP`)
- **Subject / Client ID**: X.509 Distinguished Name (DN)
- **Role**: Custom attribute `role` embedded in the X.509 certificate.

### Supported System Roles

| Role | Permitted Organizations | Key Privileges |
| :--- | :--- | :--- |
| `officer` | `PoliceDeptMSP` | Register evidence, update evidence status (`collected`, `under_review`), initiate custody transfers |
| `custodian` | `PoliceDeptMSP`, `ForensicLabMSP` | Approve/reject custody transfers, update evidence status (`in_lab`, `in_court`, `archived`) |
| `analyst` | `ForensicLabMSP` | Record lab analysis results, update status (`analyzed`) |
| `prosecutor` | `PoliceDeptMSP` / Judicial | View ledger evidence history, inspect full key history audit trails, update status (`in_court`) |
| `admin` | `PoliceDeptMSP`, `ForensicLabMSP` | Unrestricted ledger query, contract genesis init, override state status |

### Evidence Status Matrix Enforcement (`UpdateEvidenceStatus`)

| Target Status | Permitted Roles | Notes |
| :--- | :--- | :--- |
| `collected` | `officer`, `admin` | Initial state upon registration |
| `under_review` | `officer`, `admin` | Evidence under supervisor review |
| `in_lab` | `custodian`, `admin` | Transferred to forensic vault |
| `analyzed` | `analyst`, `admin` | Forensic examination complete |
| `in_court` | `custodian`, `prosecutor`, `admin` | Submitted as trial evidence |
| `archived` | `custodian`, `admin` | Case closed, moved to long-term archive |
| `disposed` | `admin` | Destroyed / returned under court order |

---

## 📜 Complete Smart Contract Method Reference

The chaincode exposes **18 smart contract transactions and queries** across 3 registered contract classes:

### 1. `EvidenceContract` (`contracts/evidence.go`)

#### `RegisterEvidence` (Transaction)
- **Parameters**: `id`, `caseId`, `title`, `description`, `evidenceType`, `locationFound`, `fileHash`, `storagePath`, `metadataJson`
- **Required Role**: `officer` or `admin`
- **Org Restrict**: `PoliceDeptMSP` (or `admin`)
- **Action**: Verifies `EVIDENCE:{id}` does not exist, constructs `EvidenceRecord`, sets `Status` to `collected`, sets current custodian to caller ID, writes state to ledger, and emits `EvidenceRegistered` event.
- **Returns**: JSON `EvidenceRecord`

#### `UpdateEvidenceStatus` (Transaction)
- **Parameters**: `id`, `newStatus`, `notes`
- **Required Role**: Checked against status permission matrix
- **Action**: Reads `EvidenceRecord`, validates state transition authority, updates status and timestamp, writes back to state, and emits `EvidenceStatusUpdated` event.
- **Returns**: Updated JSON `EvidenceRecord`

#### `GetEvidence` (Query)
- **Parameters**: `id`
- **Action**: Fetches `EVIDENCE:{id}` from state store. Returns error if not found.
- **Returns**: JSON `EvidenceRecord`

#### `GetEvidenceByCase` (Query - Rich CouchDB)
- **Parameters**: `caseId`
- **Action**: Executes selector query `{"selector":{"docType":"EVIDENCE","caseId":"<caseId>"}}`.
- **Returns**: JSON Array of `EvidenceRecord`

#### `GetEvidenceByOfficer` (Query - Rich CouchDB)
- **Parameters**: `officerId`
- **Action**: Executes selector query `{"selector":{"docType":"EVIDENCE","collectedBy":"<officerId>"}}`.
- **Returns**: JSON Array of `EvidenceRecord`

#### `GetEvidenceByStatus` (Query - Rich CouchDB)
- **Parameters**: `status`
- **Action**: Executes selector query `{"selector":{"docType":"EVIDENCE","status":"<status>"}}`.
- **Returns**: JSON Array of `EvidenceRecord`

#### `VerifyEvidenceHash` (Query)
- **Parameters**: `id`, `clientComputedHash`
- **Action**: Fetches `EvidenceRecord` from ledger, compares `ledgerRecord.FileHash` with `clientComputedHash`. Returns structured verification report.
- **Returns**: JSON `HashVerificationResult` (`{ isMatched: bool, ledgerHash: string, computedHash: string, timestamp: string }`)

---

### 2. `CustodyContract` (`contracts/custody.go`)

#### `InitiateCustodyTransfer` (Transaction)
- **Parameters**: `custodyEventId`, `evidenceId`, `toUserId`, `toUserName`, `toUserOrg`, `reason`, `location`
- **Required Role**: `officer`, `custodian`, or `admin`
- **Action**: Verifies target evidence exists, creates `CustodyRecord` with status `PENDING`, writes `CUSTODY:{evidenceId}:{custodyEventId}`, and emits `CustodyTransferInitiated` event.
- **Returns**: JSON `CustodyRecord`

#### `ApproveCustodyTransfer` (Transaction)
- **Parameters**: `custodyEventId`, `evidenceId`, `notes`
- **Required Role**: `custodian` or `admin`
- **Action**: 
  1. Fetches `CustodyRecord`, verifies status is `PENDING`.
  2. Updates `CustodyRecord.Status` to `APPROVED`, sets `ResolvedAt` timestamp.
  3. Atomic update to `EvidenceRecord`: updates `CurrentCustodianID` to `ToUserID`, `CurrentCustodianOrg` to `ToUserOrg`, and updates evidence timestamp.
  4. Emits `CustodyTransferApproved` event.
- **Returns**: Updated JSON `CustodyRecord`

#### `RejectCustodyTransfer` (Transaction)
- **Parameters**: `custodyEventId`, `evidenceId`, `reason`
- **Required Role**: `custodian` or `admin`
- **Action**: Updates `CustodyRecord.Status` to `REJECTED`, sets `Notes` and `ResolvedAt`, emits `CustodyTransferRejected` event. Does NOT modify target evidence custodian.
- **Returns**: Updated JSON `CustodyRecord`

#### `GetCustodyHistory` (Query - Rich CouchDB)
- **Parameters**: `evidenceId`
- **Action**: Executes selector query `{"selector":{"docType":"CUSTODY","evidenceId":"<evidenceId>"}}`.
- **Returns**: JSON Array of `CustodyRecord`

#### `GetLedgerCustodyHistory` (Query - Fabric Blockchain History)
- **Parameters**: `evidenceId`
- **Action**: Calls Fabric API `GetHistoryForKey("EVIDENCE:" + evidenceId)`. Iterates over raw blockchain state modifications, returning every past state revision, transaction ID, timestamp, and deletion flag.
- **Returns**: JSON Array of `LedgerHistoryQueryResult`

---

### 3. `LifecycleContract` (`contracts/lifecycle.go`)

#### `InitLedger` (Transaction - Initializer)
- **Parameters**: None
- **Action**: Writes system genesis metadata to key `META:genesis`, including network name, chaincode version, initialization timestamp, and initializer identity. Emits `LedgerInitialized` event.
- **Returns**: String message

#### `GetLedgerMetadata` (Query)
- **Parameters**: None
- **Action**: Reads `META:genesis` from ledger.
- **Returns**: JSON `GenesisMetadata`

#### `RecordLabResult` (Transaction)
- **Parameters**: `resultId`, `evidenceId`, `analystId`, `analystName`, `summary`, `detailedReport`, `testParametersJson`, `isTampered`
- **Required Role**: `analyst` or `admin`
- **Required Org**: `ForensicLabMSP` (or `admin`)
- **Action**: Verifies evidence exists, creates `LabResultRecord` at `LABRESULT:{evidenceId}:{resultId}`, updates target `EvidenceRecord.Status` to `analyzed`, and emits `LabResultRecorded` event.
- **Returns**: JSON `LabResultRecord`

#### `GetLabResults` (Query - Rich CouchDB)
- **Parameters**: `evidenceId`
- **Action**: Executes selector query `{"selector":{"docType":"LAB_RESULT","evidenceId":"<evidenceId>"}}`.
- **Returns**: JSON Array of `LabResultRecord`

#### `GetAllEvidence` (Query - Rich CouchDB)
- **Parameters**: None
- **Action**: Executes selector query `{"selector":{"docType":"EVIDENCE"}}`.
- **Returns**: JSON Array of `EvidenceRecord`

#### `GetEvidenceStats` (Query)
- **Parameters**: None
- **Action**: Queries all evidence records and calculates aggregate counts per status (`collected`, `under_review`, `in_lab`, `analyzed`, `in_court`, `archived`, `disposed`) and total overall evidence count.
- **Returns**: JSON `EvidenceStats`

---

## 🔔 Chaincode Events Reference

Every state mutation transaction emits an immutable Fabric chaincode event. Off-chain services (such as Express.js backend event listeners) can subscribe to these events:

| Event Name | Emitting Function | Payload Fields |
| :--- | :--- | :--- |
| `EvidenceRegistered` | `RegisterEvidence` | `id`, `caseId`, `txId` |
| `EvidenceStatusUpdated` | `UpdateEvidenceStatus` | `id`, `newStatus`, `updatedBy`, `txId` |
| `CustodyTransferInitiated` | `InitiateCustodyTransfer` | `custodyEventId`, `evidenceId`, `fromUserId`, `toUserId`, `txId` |
| `CustodyTransferApproved` | `ApproveCustodyTransfer` | `custodyEventId`, `evidenceId`, `newCustodianId`, `previousCustodian`, `txId` |
| `CustodyTransferRejected` | `RejectCustodyTransfer` | `custodyEventId`, `evidenceId`, `txId` |
| `LabResultRecorded` | `RecordLabResult` | `labResultId`, `evidenceId`, `txId` |
| `LedgerInitialized` | `InitLedger` | `event`, `initiatedBy`, `txId` |

---

## 🚀 Step-by-Step Chaincode Deployment Guide

The deployment follows the **Hyperledger Fabric v2.x Chaincode Lifecycle** standard.

### Prerequisites Check
Ensure the Phase 1 network is running:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Step 1: Prepare & Copy Deployment Script
Because running multi-line bash scripts with heredocs directly inside Docker via PowerShell on Windows can fail silently, copy the execution script into the `cli` container:

```bash
# Copy deploy script into CLI container
docker cp scratch/deploy-cc.sh cli:/tmp/deploy-cc.sh
```

### Step 2: Package Chaincode
Inside the CLI container, vendor dependencies and package into `.tar.gz`:
```bash
docker exec cli bash -c "
  cd /opt/gopath/src/github.com/chaincode/evidence && \
  go mod tidy && \
  peer lifecycle chaincode package evidence.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/evidence \
    --lang golang \
    --label evidence_1.0
"
```

### Step 3: Install Chaincode on Both Peers
```bash
# Install on Police Peer (peer0.police.evidence.com)
docker exec \
  -e CORE_PEER_LOCALMSPID=PoliceDeptMSP \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/users/Admin@police.evidence.com/msp \
  -e CORE_PEER_ADDRESS=peer0.police.evidence.com:7051 \
  cli peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/evidence/evidence.tar.gz

# Install on Forensic Peer (peer0.forensic.evidence.com)
docker exec \
  -e CORE_PEER_LOCALMSPID=ForensicLabMSP \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/forensic.evidence.com/users/Admin@forensic.evidence.com/msp \
  -e CORE_PEER_ADDRESS=peer0.forensic.evidence.com:9051 \
  cli peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/evidence/evidence.tar.gz
```

### Step 4: Query Installed Package ID
```bash
docker exec cli peer lifecycle chaincode queryinstalled
```
*Expected Output:*
```
Installed chaincodes on peer:
Package ID: evidence_1.0:78232dd47d01a4d0a66b81795b25aaadf40cb70edb07c0f55c7a80c892fcb986, Label: evidence_1.0
```

### Step 5: Approve Chaincode Definition for Both Orgs
```bash
CC_PACKAGE_ID="evidence_1.0:78232dd47d01a4d0a66b81795b25aaadf40cb70edb07c0f55c7a80c892fcb986"

# Approve for PoliceDeptMSP
docker exec \
  -e CORE_PEER_LOCALMSPID=PoliceDeptMSP \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/users/Admin@police.evidence.com/msp \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt \
  -e CORE_PEER_ADDRESS=peer0.police.evidence.com:7051 \
  cli peer lifecycle chaincode approveformyorg \
    -o orderer.evidence.com:7050 \
    --ordererTLSHostnameOverride orderer.evidence.com \
    --channelID evidence-channel \
    --name evidence \
    --version 1.0 \
    --package-id $CC_PACKAGE_ID \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/msp/tlscacerts/tlsca.evidence.com-cert.pem \
    --init-required

# Approve for ForensicLabMSP
docker exec \
  -e CORE_PEER_LOCALMSPID=ForensicLabMSP \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/forensic.evidence.com/users/Admin@forensic.evidence.com/msp \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/forensic.evidence.com/peers/peer0.forensic.evidence.com/tls/ca.crt \
  -e CORE_PEER_ADDRESS=peer0.forensic.evidence.com:9051 \
  cli peer lifecycle chaincode approveformyorg \
    -o orderer.evidence.com:7050 \
    --ordererTLSHostnameOverride orderer.evidence.com \
    --channelID evidence-channel \
    --name evidence \
    --version 1.0 \
    --package-id $CC_PACKAGE_ID \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/msp/tlscacerts/tlsca.evidence.com-cert.pem \
    --init-required
```

### Step 6: Commit Chaincode Definition to Channel
```bash
docker exec \
  -e CORE_PEER_LOCALMSPID=PoliceDeptMSP \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/users/Admin@police.evidence.com/msp \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt \
  -e CORE_PEER_ADDRESS=peer0.police.evidence.com:7051 \
  cli peer lifecycle chaincode commit \
    -o orderer.evidence.com:7050 \
    --ordererTLSHostnameOverride orderer.evidence.com \
    --channelID evidence-channel \
    --name evidence \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/msp/tlscacerts/tlsca.evidence.com-cert.pem \
    --peerAddresses peer0.police.evidence.com:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt \
    --peerAddresses peer0.forensic.evidence.com:9051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/forensic.evidence.com/peers/peer0.forensic.evidence.com/tls/ca.crt \
    --init-required
```

### Step 7: Initialize Chaincode (`InitLedger`)
```bash
docker exec \
  -e CORE_PEER_LOCALMSPID=PoliceDeptMSP \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/users/Admin@police.evidence.com/msp \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt \
  -e CORE_PEER_ADDRESS=peer0.police.evidence.com:7051 \
  cli peer chaincode invoke \
    -o orderer.evidence.com:7050 \
    --ordererTLSHostnameOverride orderer.evidence.com \
    --channelID evidence-channel \
    --name evidence \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/msp/tlscacerts/tlsca.evidence.com-cert.pem \
    --peerAddresses peer0.police.evidence.com:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt \
    --peerAddresses peer0.forensic.evidence.com:9051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/forensic.evidence.com/peers/peer0.forensic.evidence.com/tls/ca.crt \
    --isInit \
    -c '{"Args":["LifecycleContract:InitLedger"]}'
```

---

## 🧪 How to Test & Verify Phase 2 via CLI

### 1. Register a Test Evidence Item
```bash
docker exec \
  -e CORE_PEER_LOCALMSPID=PoliceDeptMSP \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/users/Admin@police.evidence.com/msp \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt \
  -e CORE_PEER_ADDRESS=peer0.police.evidence.com:7051 \
  cli peer chaincode invoke \
    -o orderer.evidence.com:7050 \
    --ordererTLSHostnameOverride orderer.evidence.com \
    --channelID evidence-channel \
    --name evidence \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/msp/tlscacerts/tlsca.evidence.com-cert.pem \
    --peerAddresses peer0.police.evidence.com:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt \
    --peerAddresses peer0.forensic.evidence.com:9051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/forensic.evidence.com/peers/peer0.forensic.evidence.com/tls/ca.crt \
    -c '{"Args":["EvidenceContract:RegisterEvidence","EV-TEST-001","CASE-2026-99","Blood Stained Weapon","9mm Pistol with residue","Weapon","Crime Scene A","e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","ipfs://QmTestHash123","{\"caliber\":\"9mm\"}"]}'
```

### 2. Query Evidence by ID
```bash
docker exec cli peer chaincode query \
  -C evidence-channel \
  -n evidence \
  -c '{"Args":["EvidenceContract:GetEvidence","EV-TEST-001"]}'
```

### 3. Verify SHA-256 Hash
```bash
docker exec cli peer chaincode query \
  -C evidence-channel \
  -n evidence \
  -c '{"Args":["EvidenceContract:VerifyEvidenceHash","EV-TEST-001","e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"]}'
```
*Expected Output:*
```json
{"isMatched":true,"ledgerHash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","computedHash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","timestamp":"..."}
```

### 4. Query System Metadata & Statistics
```bash
docker exec cli peer chaincode query \
  -C evidence-channel \
  -n evidence \
  -c '{"Args":["LifecycleContract:GetEvidenceStats"]}'
```

---

## 🛠️ Known Deployment Gotchas & Troubleshooting

> [!WARNING]
> ### 1. PowerShell Heredoc Issue on Windows
> **Symptom**: Running `docker exec cli bash -c "cat > script.sh << 'EOF' ... EOF"` creates an empty file silently.
> **Fix**: Write the script to a physical file locally (e.g. `scratch/deploy-cc.sh`), then use `docker cp scratch/deploy-cc.sh cli:/tmp/deploy-cc.sh` and execute `docker exec cli bash /tmp/deploy-cc.sh`.

> [!NOTE]
> ### 2. `go.mod` Indirect Dependency Issues
> **Symptom**: `go mod tidy` fails with `invalid version: unknown revision 2a863f19d5e3`.
> **Fix**: `go.mod` should **only** specify direct dependency `github.com/hyperledger/fabric-contract-api-go v1.2.2`. Let `go mod tidy` automatically download and resolve compatible indirect transitive dependencies.

> [!IMPORTANT]
> ### 3. `querycommitted` Failing with Default CLI Env
> **Symptom**: Running `peer lifecycle chaincode querycommitted -C evidence-channel` returns `error getting chaincode code: channel not found`.
> **Fix**: Always specify peer MSP environment variables when invoking CLI commands:
> `CORE_PEER_LOCALMSPID=PoliceDeptMSP`, `CORE_PEER_MSPCONFIGPATH=...`, `CORE_PEER_ADDRESS=peer0.police.evidence.com:7051`.

> [!NOTE]
> ### 4. Windows Path Separator Warnings (`MSP WARN`)
> **Symptom**: Logs show `MSP WARN 001 Loading file ca.police.evidence.com-cert.pem with backslash path`.
> **Impact**: Harmless log message caused by Windows backslashes in path mounts. Transactions still commit with status `VALID (200)`.

---

## 🔗 How Phase 2 Links to the Web Application (Bridge to Phase 3)

Phase 2 establishes the smart contract layer running inside Docker. To connect this to the Next.js / Express.js web application:

```
[ Next.js Frontend ]
        │
        ▼ (HTTP REST APIs)
[ Express.js Backend (src/routes/evidence-extras.ts) ]
        │
        ▼ (Hyperledger Fabric Node SDK Gateway - @hyperledger/fabric-gateway + @grpc/grpc-js)
[ X.509 Identity Wallet (Admin / Officer User Certs & Keys) ]
        │
        ▼ (gRPC / TLS over Port 7051 / 9051)
[ Fabric Peer Nodes (peer0.police.evidence.com & peer0.forensic.evidence.com) ]
        │
        ▼ (Chaincode Execution)
[ Evidence Smart Contract (github.com/evidence-chain/chaincode) ]
        │
        ▼ (State Mutations & Queries)
[ CouchDB State DB (couchdb0 / couchdb1) & Blockchain Ledger ]
```

---

## 🎯 Next Phase Roadmap: Phase 3 (IPFS Integration & Express SDK Gateway)

With Phase 1 (Infrastructure) and Phase 2 (Smart Contracts) complete, **Phase 3** will focus on:

1. **Express Backend Fabric Gateway Integration**:
   - Install `@hyperledger/fabric-gateway` and `@grpc/grpc-js` dependencies in Node.js.
   - Implement `src/lib/fabric.ts` to manage identity wallet loading, gRPC channel creation, and contract submission.

2. **IPFS Node Setup & Hash Integration**:
   - Provision IPFS daemon container or Pinata API integration for decentralized file storage.
   - Connect evidence upload endpoints (`POST /api/evidence`) to upload digital files to IPFS, compute SHA-256 hashes, and invoke `EvidenceContract:RegisterEvidence` on Fabric.

3. **RBAC JWT Authorization Middleware**:
   - Map Express JWT token roles (`OFFICER`, `ANALYST`, `CUSTODIAN`, `PROSECUTOR`, `ADMIN`) directly to Fabric client certificate identities.
