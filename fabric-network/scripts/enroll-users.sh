#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# enroll-users.sh
# Enrolls the application users (officers, analysts) with their Fabric CAs.
# The generated certificates are used by the Node.js SDK (fabric-gateway)
# to submit transactions on behalf of real users.
#
# Output layout:
#   organizations/
#     peerOrganizations/
#       police.evidence.com/
#         application/
#           officer/    ← User1 of PoliceDept
#           headofficer/ ← User2 of PoliceDept
#       forensic.evidence.com/
#         application/
#           analyst/    ← User1 of ForensicLab
#           custodian/  ← User2 of ForensicLab
# ---------------------------------------------------------------------------

set -euo pipefail

# Disable MINGW/MSYS path conversion (required for Git Bash on Windows)
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(dirname "$SCRIPT_DIR")"

export PATH="$FABRIC_DIR/bin:$PATH"
export FABRIC_CA_CLIENT_HOME="$FABRIC_DIR/organizations"

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

cd "$FABRIC_DIR"

command -v fabric-ca-client >/dev/null 2>&1 || error "fabric-ca-client binary not found. Run start-network.sh first."

POLICE_CA_TLS="$FABRIC_DIR/organizations/fabric-ca/police/tls-cert.pem"
FORENSIC_CA_TLS="$FABRIC_DIR/organizations/fabric-ca/forensic/tls-cert.pem"

enroll_user() {
  local USERNAME="$1"
  local PASSWORD="$2"
  local CA_URL="$3"
  local TLS_CERT="$4"
  local MSP_DIR="$5"
  local MSP_ID="$6"

  info "Enrolling $USERNAME with CA at $CA_URL ..."
  fabric-ca-client enroll \
    -u "https://${USERNAME}:${PASSWORD}@${CA_URL}" \
    --caname "$MSP_ID" \
    --tls.certfiles "$TLS_CERT" \
    -M "$MSP_DIR"

  # Create config.yaml for NodeOUs
  cat >"$MSP_DIR/config.yaml" <<YAML
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: orderer
YAML
  info "$USERNAME enrolled → $MSP_DIR"
}

# ---------------------------------------------------------------------------
# PoliceDept users
# ---------------------------------------------------------------------------
info "=== Enrolling PoliceDept application users ==="
mkdir -p organizations/peerOrganizations/police.evidence.com/application/{officer,headofficer}

enroll_user "User1@police.evidence.com" "user1pw" \
  "localhost:7054" "$POLICE_CA_TLS" \
  "organizations/peerOrganizations/police.evidence.com/application/officer" \
  "ca-police"

enroll_user "User2@police.evidence.com" "user2pw" \
  "localhost:7054" "$POLICE_CA_TLS" \
  "organizations/peerOrganizations/police.evidence.com/application/headofficer" \
  "ca-police"

# ---------------------------------------------------------------------------
# ForensicLab users
# ---------------------------------------------------------------------------
info "=== Enrolling ForensicLab application users ==="
mkdir -p organizations/peerOrganizations/forensic.evidence.com/application/{analyst,custodian}

enroll_user "User1@forensic.evidence.com" "user1pw" \
  "localhost:8054" "$FORENSIC_CA_TLS" \
  "organizations/peerOrganizations/forensic.evidence.com/application/analyst" \
  "ca-forensic"

enroll_user "User2@forensic.evidence.com" "user2pw" \
  "localhost:8054" "$FORENSIC_CA_TLS" \
  "organizations/peerOrganizations/forensic.evidence.com/application/custodian" \
  "ca-forensic"

info "✅ All application users enrolled."
info "   Certificates are in organizations/peerOrganizations/<org>/application/<role>/"
info "   The Node.js SDK (src/lib/fabric.ts) will load these automatically."
