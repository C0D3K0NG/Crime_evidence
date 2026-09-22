#!/bin/bash
# Phase 2 of channel setup: join peers (run after orderer has joined via osnadmin)
# The orderer needs ~5s to elect a Raft leader after channel creation.
set -euo pipefail

CHANNEL='evidence-channel'
ORG='/etc/hyperledger/fabric/organizations'
ARTS='/etc/hyperledger/fabric/channel-artifacts'
ORDERER_TLS="${ORG}/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/msp/tlscacerts/tlsca.evidence.com-cert.pem"
ORDERER='orderer.evidence.com:7050'

P_MSP='PoliceDeptMSP'
P_PEER='peer0.police.evidence.com:7051'
P_TLS="${ORG}/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt"
P_ADM="${ORG}/peerOrganizations/police.evidence.com/users/Admin@police.evidence.com/msp"

F_MSP='ForensicLabMSP'
F_PEER='peer0.forensic.evidence.com:9051'
F_TLS="${ORG}/peerOrganizations/forensic.evidence.com/peers/peer0.forensic.evidence.com/tls/ca.crt"
F_ADM="${ORG}/peerOrganizations/forensic.evidence.com/users/Admin@forensic.evidence.com/msp"

echo "Waiting 10s for Raft leader election..."
sleep 10

# Retry fetching genesis block up to 5 times
echo "[1/4] Fetching genesis block for evidence-channel..."
for i in $(seq 1 5); do
  CORE_PEER_LOCALMSPID="${P_MSP}" \
  CORE_PEER_TLS_ROOTCERT_FILE="${P_TLS}" \
  CORE_PEER_MSPCONFIGPATH="${P_ADM}" \
  CORE_PEER_ADDRESS="${P_PEER}" \
    peer channel fetch 0 "${ARTS}/${CHANNEL}.block" \
      -o "${ORDERER}" -c "${CHANNEL}" \
      --tls --cafile "${ORDERER_TLS}" 2>&1 && break || {
        echo "  Attempt $i failed, retrying in 5s..."
        sleep 5
      }
done

echo "[2/4] Joining peer0.police..."
CORE_PEER_LOCALMSPID="${P_MSP}" \
CORE_PEER_TLS_ROOTCERT_FILE="${P_TLS}" \
CORE_PEER_MSPCONFIGPATH="${P_ADM}" \
CORE_PEER_ADDRESS="${P_PEER}" \
  peer channel join -b "${ARTS}/${CHANNEL}.block"
echo "  -> peer0.police joined."

echo "[3/4] Joining peer0.forensic..."
CORE_PEER_LOCALMSPID="${F_MSP}" \
CORE_PEER_TLS_ROOTCERT_FILE="${F_TLS}" \
CORE_PEER_MSPCONFIGPATH="${F_ADM}" \
CORE_PEER_ADDRESS="${F_PEER}" \
  peer channel join -b "${ARTS}/${CHANNEL}.block"
echo "  -> peer0.forensic joined."

echo "[4/4] Anchor peer updates..."
CORE_PEER_LOCALMSPID="${P_MSP}" \
CORE_PEER_TLS_ROOTCERT_FILE="${P_TLS}" \
CORE_PEER_MSPCONFIGPATH="${P_ADM}" \
CORE_PEER_ADDRESS="${P_PEER}" \
  peer channel update \
    -o "${ORDERER}" -c "${CHANNEL}" \
    -f "${ARTS}/PoliceDeptMSPanchors.tx" \
    --tls --cafile "${ORDERER_TLS}"
echo "  -> PoliceDept anchor updated."

CORE_PEER_LOCALMSPID="${F_MSP}" \
CORE_PEER_TLS_ROOTCERT_FILE="${F_TLS}" \
CORE_PEER_MSPCONFIGPATH="${F_ADM}" \
CORE_PEER_ADDRESS="${F_PEER}" \
  peer channel update \
    -o "${ORDERER}" -c "${CHANNEL}" \
    -f "${ARTS}/ForensicLabMSPanchors.tx" \
    --tls --cafile "${ORDERER_TLS}"
echo "  -> ForensicLab anchor updated."

echo ""
echo "SUCCESS: Both peers joined evidence-channel!"
echo "Channels on peer0.police:"
CORE_PEER_LOCALMSPID="${P_MSP}" \
CORE_PEER_TLS_ROOTCERT_FILE="${P_TLS}" \
CORE_PEER_MSPCONFIGPATH="${P_ADM}" \
CORE_PEER_ADDRESS="${P_PEER}" \
  peer channel list 2>&1 | grep -v WARN || true
