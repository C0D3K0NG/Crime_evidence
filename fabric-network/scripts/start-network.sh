#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# start-network.sh
# Bootstraps the full Hyperledger Fabric network for the Crime Evidence System.
#
# Compatible with: Git Bash (MINGW64/Windows), WSL2, Linux, macOS
#
# Steps:
#   1. Download Fabric binaries via install-fabric.sh (first run only)
#   2. Generate crypto material (cryptogen)
#   3. Generate channel artifacts (configtxgen)
#   4. Start all containers (docker compose)
#   5. Copy setup scripts into CLI container (avoids MINGW path mangling)
#   6. Execute channel creation, peer join, anchor update — all inside CLI
# ---------------------------------------------------------------------------

set -euo pipefail

# Disable MINGW/MSYS path conversion — critical for Git Bash on Windows
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(dirname "$SCRIPT_DIR")"
CHANNEL_NAME="evidence-channel"
FABRIC_VERSION="2.5.12"
FABRIC_CA_VERSION="1.5.12"
CLI_CONTAINER="fabric_cli"

# Colour helpers
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

cd "$FABRIC_DIR"

# ---------------------------------------------------------------------------
# 0. Pre-checks
# ---------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || error "Docker is not installed or not in PATH"
docker info >/dev/null 2>&1 || error "Docker daemon is not running. Start Docker Desktop first."
info "Docker is running ✓"

# ---------------------------------------------------------------------------
# 1. Download Fabric binaries if missing
# ---------------------------------------------------------------------------
if [ ! -f "bin/cryptogen" ] || [ ! -f "bin/configtxgen" ]; then
  info "Downloading Fabric binaries (this takes ~3-5 minutes on first run)..."
  mkdir -p bin
  curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
  chmod +x install-fabric.sh
  ./install-fabric.sh --fabric-version "$FABRIC_VERSION" --ca-version "$FABRIC_CA_VERSION" binary
  # Move binaries into bin/
  if [ -d "fabric-samples/bin" ]; then
    cp fabric-samples/bin/* bin/
    rm -rf fabric-samples install-fabric.sh
  fi
  info "Fabric binaries ready in bin/"
else
  info "Fabric binaries already present ✓"
fi

export PATH="$FABRIC_DIR/bin:$PATH"

# ---------------------------------------------------------------------------
# 2. Clean previous run artifacts
# ---------------------------------------------------------------------------
info "Cleaning previous crypto material and channel artifacts..."
rm -rf organizations/ordererOrganizations organizations/peerOrganizations channel-artifacts
mkdir -p channel-artifacts organizations/fabric-ca/police organizations/fabric-ca/forensic

# ---------------------------------------------------------------------------
# 3. Generate crypto material
# ---------------------------------------------------------------------------
info "Generating crypto material with cryptogen..."
cryptogen generate \
  --config="$FABRIC_DIR/crypto-config.yaml" \
  --output="$FABRIC_DIR/organizations"
info "Crypto material → organizations/ ✓"

# ---------------------------------------------------------------------------
# 4. Generate channel artifacts
# ---------------------------------------------------------------------------
info "Generating genesis block (system-channel)..."
export FABRIC_CFG_PATH="$FABRIC_DIR"
configtxgen \
  -profile TwoOrgsOrdererGenesis \
  -channelID system-channel \
  -outputBlock "$FABRIC_DIR/channel-artifacts/genesis.block"

info "Generating channel creation TX ($CHANNEL_NAME)..."
configtxgen \
  -profile TwoOrgsChannel \
  -outputCreateChannelTx "$FABRIC_DIR/channel-artifacts/${CHANNEL_NAME}.tx" \
  -channelID "$CHANNEL_NAME"

info "Generating anchor peer TXs..."
configtxgen \
  -profile TwoOrgsChannel \
  -outputAnchorPeersUpdate "$FABRIC_DIR/channel-artifacts/PoliceDeptMSPanchors.tx" \
  -channelID "$CHANNEL_NAME" \
  -asOrg PoliceDeptMSP

configtxgen \
  -profile TwoOrgsChannel \
  -outputAnchorPeersUpdate "$FABRIC_DIR/channel-artifacts/ForensicLabMSPanchors.tx" \
  -channelID "$CHANNEL_NAME" \
  -asOrg ForensicLabMSP

info "Channel artifacts ready ✓"

# ---------------------------------------------------------------------------
# 5. Start Docker containers
# ---------------------------------------------------------------------------
info "Starting Docker containers..."
mkdir -p channel-artifacts
docker compose up -d

info "Waiting 12 seconds for peers and orderer to initialize..."
sleep 12

# Verify CLI container is up
docker inspect "$CLI_CONTAINER" --format "{{.State.Status}}" | grep -q "running" \
  || error "CLI container '$CLI_CONTAINER' is not running. Check docker compose logs."

# ---------------------------------------------------------------------------
# 6. Write channel setup script INTO the CLI container
#    This approach avoids ALL MINGW/MSYS path mangling issues since
#    the script runs purely inside Linux (the container).
# ---------------------------------------------------------------------------
info "Injecting channel setup script into CLI container..."

docker exec "$CLI_CONTAINER" bash -c "cat > /tmp/setup-channel.sh" << 'INNER_SCRIPT'
#!/bin/bash
set -euo pipefail

CHANNEL_NAME="evidence-channel"
ORG_DIR="/etc/hyperledger/fabric/organizations"
ORDERER_CA="$ORG_DIR/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/msp/tlscacerts/tlsca.evidence.com-cert.pem"
ARTIFACTS="/etc/hyperledger/fabric/channel-artifacts"
ORDERER_ADDR="orderer.evidence.com:7050"

GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC}  $*"; }

# ── Police Dept identity helpers ──
POLICE_MSP="PoliceDeptMSP"
POLICE_PEER="peer0.police.evidence.com:7051"
POLICE_TLS="$ORG_DIR/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt"
POLICE_ADMIN="$ORG_DIR/peerOrganizations/police.evidence.com/users/Admin@police.evidence.com/msp"

# ── Forensic Lab identity helpers ──
FORENSIC_MSP="ForensicLabMSP"
FORENSIC_PEER="peer0.forensic.evidence.com:9051"
FORENSIC_TLS="$ORG_DIR/peerOrganizations/forensic.evidence.com/peers/peer0.forensic.evidence.com/tls/ca.crt"
FORENSIC_ADMIN="$ORG_DIR/peerOrganizations/forensic.evidence.com/users/Admin@forensic.evidence.com/msp"

# ── Step 1: Create channel (as Police admin) ──
info "Creating channel '$CHANNEL_NAME'..."
CORE_PEER_LOCALMSPID=$POLICE_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=$POLICE_TLS \
CORE_PEER_MSPCONFIGPATH=$POLICE_ADMIN \
CORE_PEER_ADDRESS=$POLICE_PEER \
  peer channel create \
    -o $ORDERER_ADDR \
    -c $CHANNEL_NAME \
    -f $ARTIFACTS/${CHANNEL_NAME}.tx \
    --outputBlock $ARTIFACTS/${CHANNEL_NAME}.block \
    --tls --cafile $ORDERER_CA
info "Channel created ✓"

# ── Step 2: Join peer0.police ──
info "Joining peer0.police to channel..."
CORE_PEER_LOCALMSPID=$POLICE_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=$POLICE_TLS \
CORE_PEER_MSPCONFIGPATH=$POLICE_ADMIN \
CORE_PEER_ADDRESS=$POLICE_PEER \
  peer channel join -b $ARTIFACTS/${CHANNEL_NAME}.block
info "peer0.police joined ✓"

# ── Step 3: Join peer0.forensic ──
info "Joining peer0.forensic to channel..."
CORE_PEER_LOCALMSPID=$FORENSIC_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=$FORENSIC_TLS \
CORE_PEER_MSPCONFIGPATH=$FORENSIC_ADMIN \
CORE_PEER_ADDRESS=$FORENSIC_PEER \
  peer channel join -b $ARTIFACTS/${CHANNEL_NAME}.block
info "peer0.forensic joined ✓"

# ── Step 4: Update anchor peer for PoliceDept ──
info "Updating anchor peer for PoliceDeptMSP..."
CORE_PEER_LOCALMSPID=$POLICE_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=$POLICE_TLS \
CORE_PEER_MSPCONFIGPATH=$POLICE_ADMIN \
CORE_PEER_ADDRESS=$POLICE_PEER \
  peer channel update \
    -o $ORDERER_ADDR \
    -c $CHANNEL_NAME \
    -f $ARTIFACTS/PoliceDeptMSPanchors.tx \
    --tls --cafile $ORDERER_CA
info "PoliceDept anchor updated ✓"

# ── Step 5: Update anchor peer for ForensicLab ──
info "Updating anchor peer for ForensicLabMSP..."
CORE_PEER_LOCALMSPID=$FORENSIC_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=$FORENSIC_TLS \
CORE_PEER_MSPCONFIGPATH=$FORENSIC_ADMIN \
CORE_PEER_ADDRESS=$FORENSIC_PEER \
  peer channel update \
    -o $ORDERER_ADDR \
    -c $CHANNEL_NAME \
    -f $ARTIFACTS/ForensicLabMSPanchors.tx \
    --tls --cafile $ORDERER_CA
info "ForensicLab anchor updated ✓"

info "✅ Channel '$CHANNEL_NAME' is live. Both peers joined."
INNER_SCRIPT

# Make the script executable inside the container
docker exec "$CLI_CONTAINER" chmod +x /tmp/setup-channel.sh

# ---------------------------------------------------------------------------
# 7. Run the channel setup script inside the container
# ---------------------------------------------------------------------------
info "Running channel setup inside CLI container..."
docker exec "$CLI_CONTAINER" bash /tmp/setup-channel.sh

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
info ""
info "✅ Fabric network is UP!"
info "   Channel:          $CHANNEL_NAME"
info "   Orderer:          orderer.evidence.com:7050"
info "   Police Peer:      peer0.police.evidence.com:7051"
info "   Forensic Peer:    peer0.forensic.evidence.com:9051"
info "   CouchDB Police:   http://localhost:5984/_utils  (admin / adminpw)"
info "   CouchDB Forensic: http://localhost:6984/_utils  (admin / adminpw)"
info ""
info "Next steps:"
info "  1. ./scripts/enroll-users.sh     — Enroll app users with Fabric CA"
info "  2. ./scripts/deploy-chaincode.sh — Deploy evidence smart contract"
