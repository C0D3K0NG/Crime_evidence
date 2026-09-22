# Fabric Network — Crime Evidence System

This directory contains the full Hyperledger Fabric 2.5 network configuration for the Crime Evidence Management System.

## Network Topology

| Component | Address | Port |
| :--- | :--- | :--- |
| Orderer (Raft) | `orderer.evidence.com` | 7050 |
| Police Dept Peer | `peer0.police.evidence.com` | 7051 |
| Police Dept CA | `ca.police.evidence.com` | 7054 |
| Forensic Lab Peer | `peer0.forensic.evidence.com` | 9051 |
| Forensic Lab CA | `ca.forensic.evidence.com` | 8054 |
| CouchDB (Police) | `localhost` | 5984 |
| CouchDB (Forensic) | `localhost` | 6984 |

## Prerequisites

- **Docker Desktop** must be running with WSL2 backend enabled
- **WSL2 with Ubuntu** (or any Linux distro) for running the shell scripts
- **Go 1.20+** (installed inside the container — chaincode compiles inside Docker)

> **Windows users**: Open WSL2 terminal (Ubuntu), navigate to this directory, and run scripts from there.

## How to Start

```bash
# 1. Open WSL2 terminal and navigate to fabric-network/
cd /mnt/o/LaunchPad/PROJECTS/Crime_evidence/fabric-network

# 2. Make scripts executable (first time only)
chmod +x scripts/*.sh

# 3. Start the network (downloads Fabric binaries on first run ~5 min)
./scripts/start-network.sh

# 4. Enroll application users with Fabric CA
./scripts/enroll-users.sh

# 5. Deploy the evidence chaincode
./scripts/deploy-chaincode.sh
```

## How to Stop

```bash
# Stop containers (keep crypto material)
./scripts/stop-network.sh

# Stop AND wipe everything (full clean reset)
./scripts/stop-network.sh --clean
```

## Directory Structure

```
fabric-network/
├── crypto-config.yaml       # Org definitions for cryptogen
├── configtx.yaml            # Channel config, orderer, policies
├── docker-compose.yaml      # All Docker containers
├── scripts/
│   ├── start-network.sh     # Bootstrap script
│   ├── stop-network.sh      # Teardown script
│   ├── deploy-chaincode.sh  # Chaincode lifecycle script
│   └── enroll-users.sh      # Enroll app users with Fabric CA
├── organizations/           # Generated crypto material (gitignored)
├── channel-artifacts/       # Generated blocks & TXs (gitignored)
└── bin/                     # Fabric binaries (gitignored)
```

## Channel

- **Channel name**: `evidence-channel`
- **Organizations**: PoliceDeptMSP + ForensicLabMSP
- **Chaincode**: `evidence` (Go, deployed by deploy-chaincode.sh)
- **State DB**: CouchDB (enables rich JSON queries)

## Verifying the Network

```bash
# Check all containers are running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check peer0.police joined the channel
docker exec fabric_cli peer channel list \
  -e CORE_PEER_LOCALMSPID=PoliceDeptMSP ...

# CouchDB admin UI
open http://localhost:5984/_utils   # Police peer DB (admin/adminpw)
open http://localhost:6984/_utils   # Forensic peer DB (admin/adminpw)
```
