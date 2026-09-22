#!/bin/bash
# Setup script for Fabric 2.5 Channel Participation API
# Run inside the fabric_cli container via: docker exec fabric_cli bash /tmp/channel_setup_v2.sh
set -euo pipefail

CHANNEL='evidence-channel'
ORG='/etc/hyperledger/fabric/organizations'
ARTS='/etc/hyperledger/fabric/channel-artifacts'

# Orderer admin connection (TLS)
ORDERER_ADMIN='orderer.evidence.com:7053'
ORDERER_CA_TLS="${ORG}/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/tls/ca.crt"
ORDERER_ADMIN_TLS_CERT="${ORG}/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/tls/server.crt"
ORDERER_ADMIN_TLS_KEY="${ORG}/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/tls/server.key"

# Peer orderer connection (for peer channel join)
ORDERER_PEER_TLS="${ORG}/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/msp/tlscacerts/tlsca.evidence.com-cert.pem"
ORDERER_PEER='orderer.evidence.com:7050'

P_MSP='PoliceDeptMSP'
P_PEER='peer0.police.evidence.com:7051'
P_TLS="${ORG}/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt"
P_ADM="${ORG}/peerOrganizations/police.evidence.com/users/Admin@police.evidence.com/msp"

F_MSP='ForensicLabMSP'
F_PEER='peer0.forensic.evidence.com:9051'
F_TLS="${ORG}/peerOrganizations/forensic.evidence.com/peers/peer0.forensic.evidence.com/tls/ca.crt"
F_ADM="${ORG}/peerOrganizations/forensic.evidence.com/users/Admin@forensic.evidence.com/msp"

echo "[1/5] Creating channel via osnadmin (Fabric 2.5 Channel Participation API)..."
osnadmin channel join \
  --channelID "${CHANNEL}" \
  --config-block "${ARTS}/${CHANNEL}-genesis.block" \
  -o "${ORDERER_ADMIN}" \
  --ca-file "${ORDERER_CA_TLS}" \
  --client-cert "${ORDERER_ADMIN_TLS_CERT}" \
  --client-key "${ORDERER_ADMIN_TLS_KEY}"
echo "  -> Orderer joined channel."

echo "[2/5] Joining peer0.police..."
CORE_PEER_LOCALMSPID="${P_MSP}" \
CORE_PEER_TLS_ROOTCERT_FILE="${P_TLS}" \
CORE_PEER_MSPCONFIGPATH="${P_ADM}" \
CORE_PEER_ADDRESS="${P_PEER}" \
  peer channel fetch 0 "${ARTS}/${CHANNEL}.block" \
    -o "${ORDERER_PEER}" -c "${CHANNEL}" \
    --tls --cafile "${ORDERER_PEER_TLS}"

CORE_PEER_LOCALMSPID="${P_MSP}" \
CORE_PEER_TLS_ROOTCERT_FILE="${P_TLS}" \
CORE_PEER_MSPCONFIGPATH="${P_ADM}" \
CORE_PEER_ADDRESS="${P_PEER}" \
  peer channel join -b "${ARTS}/${CHANNEL}.block"
echo "  -> peer0.police joined."

echo "[3/5] Joining peer0.forensic..."
CORE_PEER_LOCALMSPID="${F_MSP}" \
CORE_PEER_TLS_ROOTCERT_FILE="${F_TLS}" \
CORE_PEER_MSPCONFIGPATH="${F_ADM}" \
CORE_PEER_ADDRESS="${F_PEER}" \
  peer channel join -b "${ARTS}/${CHANNEL}.block"
echo "  -> peer0.forensic joined."

echo "[4/5] Anchor peer update PoliceDeptMSP..."
CORE_PEER_LOCALMSPID="${P_MSP}" \
CORE_PEER_TLS_ROOTCERT_FILE="${P_TLS}" \
CORE_PEER_MSPCONFIGPATH="${P_ADM}" \
CORE_PEER_ADDRESS="${P_PEER}" \
  peer channel update \
    -o "${ORDERER_PEER}" -c "${CHANNEL}" \
    -f "${ARTS}/PoliceDeptMSPanchors.tx" \
    --tls --cafile "${ORDERER_PEER_TLS}"
echo "  -> PoliceDept anchor updated."

echo "[5/5] Anchor peer update ForensicLabMSP..."
CORE_PEER_LOCALMSPID="${F_MSP}" \
CORE_PEER_TLS_ROOTCERT_FILE="${F_TLS}" \
CORE_PEER_MSPCONFIGPATH="${F_ADM}" \
CORE_PEER_ADDRESS="${F_PEER}" \
  peer channel update \
    -o "${ORDERER_PEER}" -c "${CHANNEL}" \
    -f "${ARTS}/ForensicLabMSPanchors.tx" \
    --tls --cafile "${ORDERER_PEER_TLS}"
echo "  -> ForensicLab anchor updated."

echo ""
echo "SUCCESS: evidence-channel is live. Both peers joined and anchors updated."
peer channel list \
  --peerAddress "${P_PEER}" \
  --tls --cafile "${P_TLS}" 2>/dev/null || true