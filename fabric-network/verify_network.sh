#!/bin/bash
set -euo pipefail
ORG='/etc/hyperledger/fabric/organizations'
P_MSP='PoliceDeptMSP'
P_PEER='peer0.police.evidence.com:7051'
P_TLS="${ORG}/peerOrganizations/police.evidence.com/peers/peer0.police.evidence.com/tls/ca.crt"
P_ADM="${ORG}/peerOrganizations/police.evidence.com/users/Admin@police.evidence.com/msp"
F_MSP='ForensicLabMSP'
F_PEER='peer0.forensic.evidence.com:9051'
F_TLS="${ORG}/peerOrganizations/forensic.evidence.com/peers/peer0.forensic.evidence.com/tls/ca.crt"
F_ADM="${ORG}/peerOrganizations/forensic.evidence.com/users/Admin@forensic.evidence.com/msp"

echo '=== Channels on peer0.police ==='
CORE_PEER_LOCALMSPID=$P_MSP CORE_PEER_TLS_ROOTCERT_FILE=$P_TLS CORE_PEER_MSPCONFIGPATH=$P_ADM CORE_PEER_ADDRESS=$P_PEER peer channel list 2>&1 | grep -Ev 'WARN|DEBU'

echo '=== Channels on peer0.forensic ==='
CORE_PEER_LOCALMSPID=$F_MSP CORE_PEER_TLS_ROOTCERT_FILE=$F_TLS CORE_PEER_MSPCONFIGPATH=$F_ADM CORE_PEER_ADDRESS=$F_PEER peer channel list 2>&1 | grep -Ev 'WARN|DEBU'

echo '=== Orderer channel status ==='
osnadmin channel list \
  -o orderer.evidence.com:7053 \
  --ca-file "$ORG/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/tls/ca.crt" \
  --client-cert "$ORG/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/tls/server.crt" \
  --client-key "$ORG/ordererOrganizations/evidence.com/orderers/orderer.evidence.com/tls/server.key"
