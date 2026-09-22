#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy-chaincode.sh
# Packages, installs, approves, and commits the evidence chaincode onto the
# evidence-channel using the Fabric 2.x Lifecycle.
#
# Compatible with: Git Bash (MINGW64/Windows), WSL2, Linux, macOS
#
# Prerequisites:
#   - start-network.sh must have completed successfully
#   - chaincode source in ../../chaincode/evidence/
#
# Usage:
#   ./scripts/deploy-chaincode.sh
# ---------------------------------------------------------------------------

set -euo pipefail

# Disable MINGW/MSYS path conversion
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(dirname "$SCRIPT_DIR")"
CLI_CONTAINER="fabric_cli"
CHANNEL_NAME="evidence-channel"
CHAINCODE_NAME="evidence"
CHAINCODE_VERSION="1.0"
CHAINCODE_SEQUENCE="1"

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

cd "$FABRIC_DIR"

docker inspect "$CLI_CONTAINER" --format "{{.State.Status}}" | grep -q "running" \
  || error "CLI container is not running. Run start-network.sh first."

info "Injecting chaincode deployment script into CLI container..."

docker exec "$CLI_CONTAINER" bash -c "cat > /tmp/deploy-cc.sh" << INNER_SCRIPT
#!/bin/bash
set -euo pipefail

CHANNEL="${CHANNEL_NAME}"
CC_NAME="${CHAINCODE_NAME}"
CC_VERSION="${CHAINCODE_VERSION}"
CC_SEQ="${CHAINCODE_SEQUENCE}"
CC_SRC="/opt/gopath/src/github.com/hyperledger/fabric-samples/chaincode/evidence"

ORG_DIR="/etc/hyperledger/fabric/organizations"
ORDERER_CA="\$ORG_DIR/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/msp/tlscacerts/tlsca.evidence.com-cert.pem"
ORDERER="orderer.evidence.com:7050"

POLICE_MSP="PoliceDeptMSP"
POLICE_PEER="peer0.police.evidence.com:7051"
POLICE_TLS="\$ORG_DIR/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt"
POLICE_ADMIN="\$ORG_DIR/peerOrganizations/police.evidence.com/users/Admin@police.evidence.com/msp"

FORENSIC_MSP="ForensicLabMSP"
FORENSIC_PEER="peer0.forensic.evidence.com:9051"
FORENSIC_TLS="\$ORG_DIR/peerOrganizations/forensic.evidence.com/peers/peer0.forensic.evidence.com/tls/ca.crt"
FORENSIC_ADMIN="\$ORG_DIR/peerOrganizations/forensic.evidence.com/users/Admin@forensic.evidence.com/msp"

GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "\${GREEN}[INFO]\${NC}  \$*"; }

# ── 1. Package chaincode ──
info "Packaging chaincode '\$CC_NAME' v\$CC_VERSION..."
CORE_PEER_LOCALMSPID=\$POLICE_MSP \
CORE_PEER_MSPCONFIGPATH=\$POLICE_ADMIN \
  peer lifecycle chaincode package /tmp/\${CC_NAME}.tar.gz \\
    --path "\$CC_SRC" \\
    --lang golang \\
    --label \${CC_NAME}_\${CC_VERSION}
info "Package created: /tmp/\${CC_NAME}.tar.gz ✓"

# ── 2. Install on police peer ──
info "Installing on peer0.police..."
CORE_PEER_LOCALMSPID=\$POLICE_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=\$POLICE_TLS \
CORE_PEER_MSPCONFIGPATH=\$POLICE_ADMIN \
CORE_PEER_ADDRESS=\$POLICE_PEER \
  peer lifecycle chaincode install /tmp/\${CC_NAME}.tar.gz
info "Installed on peer0.police ✓"

# ── 3. Install on forensic peer ──
info "Installing on peer0.forensic..."
CORE_PEER_LOCALMSPID=\$FORENSIC_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=\$FORENSIC_TLS \
CORE_PEER_MSPCONFIGPATH=\$FORENSIC_ADMIN \
CORE_PEER_ADDRESS=\$FORENSIC_PEER \
  peer lifecycle chaincode install /tmp/\${CC_NAME}.tar.gz
info "Installed on peer0.forensic ✓"

# ── 4. Get Package ID ──
info "Querying package ID..."
PKG_ID=\$(CORE_PEER_LOCALMSPID=\$POLICE_MSP \
          CORE_PEER_TLS_ROOTCERT_FILE=\$POLICE_TLS \
          CORE_PEER_MSPCONFIGPATH=\$POLICE_ADMIN \
          CORE_PEER_ADDRESS=\$POLICE_PEER \
          peer lifecycle chaincode queryinstalled 2>&1 \
          | grep "\${CC_NAME}_\${CC_VERSION}" | awk '{print \$3}' | sed 's/,\$//')
[ -z "\$PKG_ID" ] && { echo "ERROR: Could not determine package ID"; exit 1; }
info "Package ID: \$PKG_ID ✓"

# ── 5. Approve for PoliceDept ──
info "Approving for PoliceDeptMSP..."
CORE_PEER_LOCALMSPID=\$POLICE_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=\$POLICE_TLS \
CORE_PEER_MSPCONFIGPATH=\$POLICE_ADMIN \
CORE_PEER_ADDRESS=\$POLICE_PEER \
  peer lifecycle chaincode approveformyorg \\
    -C \$CHANNEL -n \$CC_NAME -v \$CC_VERSION \\
    --package-id "\$PKG_ID" --sequence \$CC_SEQ \\
    -o \$ORDERER --tls --cafile \$ORDERER_CA
info "Approved by PoliceDeptMSP ✓"

# ── 6. Approve for ForensicLab ──
info "Approving for ForensicLabMSP..."
CORE_PEER_LOCALMSPID=\$FORENSIC_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=\$FORENSIC_TLS \
CORE_PEER_MSPCONFIGPATH=\$FORENSIC_ADMIN \
CORE_PEER_ADDRESS=\$FORENSIC_PEER \
  peer lifecycle chaincode approveformyorg \\
    -C \$CHANNEL -n \$CC_NAME -v \$CC_VERSION \\
    --package-id "\$PKG_ID" --sequence \$CC_SEQ \\
    -o \$ORDERER --tls --cafile \$ORDERER_CA
info "Approved by ForensicLabMSP ✓"

# ── 7. Check commit readiness ──
info "Checking commit readiness..."
CORE_PEER_LOCALMSPID=\$POLICE_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=\$POLICE_TLS \
CORE_PEER_MSPCONFIGPATH=\$POLICE_ADMIN \
CORE_PEER_ADDRESS=\$POLICE_PEER \
  peer lifecycle chaincode checkcommitreadiness \\
    -C \$CHANNEL -n \$CC_NAME -v \$CC_VERSION --sequence \$CC_SEQ --output json

# ── 8. Commit chaincode definition ──
info "Committing chaincode to channel '\$CHANNEL'..."
CORE_PEER_LOCALMSPID=\$POLICE_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=\$POLICE_TLS \
CORE_PEER_MSPCONFIGPATH=\$POLICE_ADMIN \
CORE_PEER_ADDRESS=\$POLICE_PEER \
  peer lifecycle chaincode commit \\
    -C \$CHANNEL -n \$CC_NAME -v \$CC_VERSION --sequence \$CC_SEQ \\
    --peerAddresses \$POLICE_PEER   --tlsRootCertFiles \$POLICE_TLS \\
    --peerAddresses \$FORENSIC_PEER --tlsRootCertFiles \$FORENSIC_TLS \\
    -o \$ORDERER --tls --cafile \$ORDERER_CA
info "Committed ✓"

# ── 9. Verify ──
info "Verifying committed chaincode..."
CORE_PEER_LOCALMSPID=\$POLICE_MSP \
CORE_PEER_TLS_ROOTCERT_FILE=\$POLICE_TLS \
CORE_PEER_MSPCONFIGPATH=\$POLICE_ADMIN \
CORE_PEER_ADDRESS=\$POLICE_PEER \
  peer lifecycle chaincode querycommitted -C \$CHANNEL -n \$CC_NAME

echo ""
echo -e "\${GREEN}✅ Chaincode '\$CC_NAME' v\$CC_VERSION deployed to '\$CHANNEL'.\${NC}"
INNER_SCRIPT

docker exec "$CLI_CONTAINER" chmod +x /tmp/deploy-cc.sh

info "Running chaincode deployment inside CLI container..."
docker exec "$CLI_CONTAINER" bash /tmp/deploy-cc.sh

info "✅ Evidence chaincode deployed. The Express API can now submit blockchain transactions."
