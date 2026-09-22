#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# stop-network.sh
# Tears down the Fabric network, removes containers, volumes, and generated
# crypto material + channel artifacts.
#
# Usage:
#   ./scripts/stop-network.sh             # Stop and remove containers only
#   ./scripts/stop-network.sh --clean     # Also wipe crypto + channel artifacts
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }

cd "$FABRIC_DIR"

info "Stopping Fabric containers..."
docker compose down --volumes --remove-orphans 2>/dev/null || true

info "Removing any dangling chaincode containers..."
docker rm -f $(docker ps -a --filter "name=dev-peer" -q) 2>/dev/null || true
docker rmi $(docker images --filter "reference=dev-peer*" -q) 2>/dev/null || true

if [[ "${1:-}" == "--clean" ]]; then
  warn "Cleaning generated artifacts (crypto material + channel artifacts)..."
  rm -rf "$FABRIC_DIR/organizations/ordererOrganizations"
  rm -rf "$FABRIC_DIR/organizations/peerOrganizations"
  rm -rf "$FABRIC_DIR/channel-artifacts"
  info "Clean complete. Run start-network.sh to re-bootstrap."
fi

info "✅ Fabric network stopped."
