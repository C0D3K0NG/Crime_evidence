# Phase 1: Hyperledger Fabric Infrastructure Setup

## 📌 Overview

**Phase 1** establishes the core **permissioned blockchain infrastructure** for the Crime Evidence Management System using **Hyperledger Fabric v2.5**. 

Unlike public blockchains (e.g., Ethereum requiring MetaMask), Hyperledger Fabric is an enterprise-grade, permissioned DLT (Distributed Ledger Technology). It uses **X.509 digital certificates** managed by **Certificate Authorities (CAs)** for identity and access control, ensuring high throughput, privacy, and immutability tailored for law enforcement and judicial evidence chain-of-custody.

---

## 🏗️ What Phase 1 Accomplished

Phase 1 constructed the multi-organization network infrastructure, Certificate Authorities, consensus service, state databases, and channel topology:

1. **Multi-Organization Network Architecture**:
   - **PoliceDept (`police.evidence.com`)**: Primary organization responsible for registering evidence, logging seizures, and initiating custody transfers.
   - **ForensicLab (`forensic.evidence.com`)**: Secondary organization responsible for analyzing evidence, adding laboratory reports, and updating evidence status.
   - **OrdererOrg (`evidence.com`)**: Raft consensus ordering service managing block creation and distribution across organizations.

2. **CouchDB State Database Integration**:
   - Integrated CouchDB instance per peer node to support rich JSON queries (querying evidence by case number, status, officer ID, date range, etc.) alongside the default key-value state store.

3. **Fabric v2.5 Channel Setup**:
   - Configured `evidence-channel` using the **Channel Participation API** (`osnadmin`), adhering to modern Fabric 2.x standards.
   - Both `peer0.police.evidence.com` and `peer0.forensic.evidence.com` are joined to the channel.

4. **Automated Scripts & CLI Containers**:
   - Shell scripts for generating cryptographic material, creating channels, enrolling admin users, and verifying network integrity cleanly on Windows (Git Bash) and Linux.

---

## 🏛️ Network Topology & Docker Container Breakdown

Phase 1 provisions **8 Docker containers** running under a dedicated network bridge (`evidence-network`):

| Container Name | Port Mappings | Purpose |
| :--- | :--- | :--- |
| `ca.police.evidence.com` | `7054:7054` | Certificate Authority for Police Dept (Issues X.509 certs) |
| `ca.forensic.evidence.com` | `8054:8054` | Certificate Authority for Forensic Lab |
| `orderer.evidence.com` | `7050:7050`, `7053:7053` | Raft Orderer Node + Admin OSN Port (`7053`) |
| `peer0.police.evidence.com` | `7051:7051` | Peer Node for Police Dept (Stores ledger & executes chaincode) |
| `peer0.forensic.evidence.com` | `9051:9051` | Peer Node for Forensic Lab |
| `couchdb0` | `5984:5984` | Rich State Database for Police Peer |
| `couchdb1` | `6984:6984` | Rich State Database for Forensic Peer |
| `cli` | N/A | Fabric CLI Container for administrative channel/chaincode commands |

---

## 📁 Added Files & Directory Structure

All Phase 1 assets reside within the [`fabric-network/`](file:///o:/LaunchPad/PROJECTS/Crime_evidence/fabric-network) directory:

```
fabric-network/
├── bin/                          # Hyperledger Fabric binaries (cryptogen, configtxgen, peer, osnadmin)
├── channel-artifacts/            # Generated Genesis blocks & channel creation transactions
├── configtx.yaml                 # Network profile & channel configuration definitions
├── crypto-config.yaml            # Cryptographic identity structure definition
├── docker-compose.yaml           # Docker orchestration file for all 8 network containers
├── organizations/                # Generated cryptographic MSP certificates & private keys
├── scripts/
│   ├── start-network.sh          # Master network bootstrap script
│   ├── stop-network.sh           # Master teardown & clean script
│   ├── deploy-chaincode.sh       # Chaincode packaging, approval & commit script
│   └── enroll-users.sh           # Fabric CA identity enrollment script
├── channel_setup.sh              # Channel creation via osnadmin API
├── channel_join.sh               # Peer join orchestration script
├── verify_network.sh             # Verification utility for ledger & channel status
└── README.md                     # Local Fabric network reference guide
```

---

## 🚀 How to Run Phase 1

### Prerequisites
1. **Docker Desktop** installed and running on your machine.
2. **Git Bash** (or WSL2 / Linux Bash environment).

---

### Step-by-Step Execution Guide

#### 1️⃣ Open Terminal in Network Directory
Open Git Bash (or terminal) and navigate to the network directory:
```bash
cd fabric-network
```

#### 2️⃣ Bootstrap Network & Cryptographic Identities
Run the master start script to generate certificates, start Docker containers, build the genesis block, and create `evidence-channel`:
```bash
MSYS_NO_PATHCONV=1 ./scripts/start-network.sh
```

#### 3️⃣ Join Peers to the Channel
Execute the join script to attach both Police and Forensic peers to `evidence-channel`:
```bash
MSYS_NO_PATHCONV=1 bash channel_join.sh
```

#### 4️⃣ Enroll Identities via CAs
Register and enroll admin and client credentials using the Fabric CAs:
```bash
MSYS_NO_PATHCONV=1 ./scripts/enroll-users.sh
```

#### 5️⃣ Verify Network Health
Run the verification script to confirm both peers are active on the channel and synced with the orderer:
```bash
MSYS_NO_PATHCONV=1 bash verify_network.sh
```
*Expected Output*: Both `peer0.police` and `peer0.forensic` will report channel membership with height $\ge 1$.

---

### 🛑 How to Stop & Clean Up

To bring down all containers, remove networks, and purge generated cryptographic volumes/artifacts:
```bash
MSYS_NO_PATHCONV=1 ./scripts/stop-network.sh
```

---

## 🔗 How Phase 1 Links to the Web Application

Phase 1 provides the underlying ledger foundation. The complete end-to-end integration flow across all phases works as follows:

```mermaid
flowchart TD
    subgraph Web App Architecture
        UI[Next.js Frontend / UI] -->|HTTP REST API| Express[Express.js Backend API]
        Express -->|Prisma ORM| SQLite[(SQLite Database)]
        Express -->|Fabric Gateway Node SDK| SDK[@hyperledger/fabric-gateway]
    end

    subgraph Phase 1: Fabric Infrastructure
        SDK -->|gRPC / TLS| PeerPolice[peer0.police.evidence.com:7051]
        SDK -->|gRPC / TLS| PeerForensic[peer0.forensic.evidence.com:9051]
        PeerPolice -->|Executes| Chaincode[Go Chaincode / Smart Contracts]
        PeerForensic -->|Executes| Chaincode
        Chaincode -->|Reads/Writes| CouchDB[(CouchDB State DB)]
        PeerPolice -->|Syncs Blocks| Orderer[orderer.evidence.com:7050]
    end
```

### Integration Workflow:
1. **Dual Storage Model**:
   - **SQLite (Off-Chain Storage)**: Stores large metadata, UI state, session tokens, user profile information, and quick indexing data.
   - **Hyperledger Fabric (On-Chain Storage)**: Stores immutable SHA-256 evidence hashes, chain-of-custody transfer logs, audit trails, and cryptographically signed verification records.
2. **Gateway Bridge (Upcoming Phase 3)**:
   - The Express backend (`src/routes/evidence.ts`) invokes the Node.js Fabric Gateway SDK using X.509 user certificates enrolled in Phase 1.
3. **Transaction Execution**:
   - When evidence is created or custody is transferred via the Web App, Express updates SQLite *and* submits a transaction proposal to `peer0.police` and `peer0.forensic`.
   - The peers execute the Smart Contract (Phase 2), endorse the transaction, send it to `orderer.evidence.com`, and commit the immutable block to CouchDB.
   - The returned **Blockchain Transaction ID** is saved in SQLite and displayed on the Web App frontend.

---

## 🛠️ Key Troubleshooting & Windows (Git Bash) Gotchas

During Phase 1 implementation, several environment-specific challenges were identified and solved:

### 1. Git Bash Path Mangling (`MSYS_NO_PATHCONV=1`)
* **Issue**: Git Bash on Windows automatically translates Linux paths like `/etc/hyperledger/` into Windows file paths (`C:\Program Files\Git\etc\...`), breaking Docker commands.
* **Solution**: Always prefix commands with `MSYS_NO_PATHCONV=1` when executing Fabric scripts in Git Bash.

### 2. Fabric v2.5 Channel Creation (`osnadmin`)
* **Issue**: Fabric 2.5 removed the legacy `peer channel create` system channel workflow.
* **Solution**: We implemented the modern **Channel Participation API** via `osnadmin channel join` using an application genesis block generated with the `TwoOrgsApplicationGenesis` profile.

### 3. CouchDB Administration Web Interfaces
You can visually inspect the state databases directly in your browser:
* **Police Dept CouchDB GUI**: [http://localhost:5984/_utils](http://localhost:5984/_utils) (`admin` / `adminpw`)
* **Forensic Lab CouchDB GUI**: [http://localhost:6984/_utils](http://localhost:6984/_utils) (`admin` / `adminpw`)

---

## 📋 Next Phases Roadmap

- **Phase 2**: Go Smart Contracts (Chaincode) development for evidence creation, transfer of custody, and access control.
- **Phase 3**: Backend Fabric Gateway SDK integration (`@hyperledger/fabric-gateway`) inside Express REST endpoints.
- **Phase 4**: Frontend UI blockchain verification badge, transaction history viewer, and audit report generator.
