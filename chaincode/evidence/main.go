// main.go — Chaincode entry point for the Crime Evidence Management System.
//
// This file wires together all three contract structs and starts the chaincode
// shim, which connects to the peer node via gRPC and waits for transaction invocations.
//
// Contracts registered:
//   - EvidenceContract  → evidence registration, status, queries, hash verification
//   - CustodyContract   → chain-of-custody transfer workflow
//   - LifecycleContract → InitLedger, lab results, aggregate stats
//
// Deploy with:
//   cd fabric-network && MSYS_NO_PATHCONV=1 ./scripts/deploy-chaincode.sh
package main

import (
	"fmt"
	"os"

	"github.com/evidence-chain/chaincode/contracts"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	// Create the chaincode, registering all three contract implementations.
	// Each contract's functions are namespaced by the struct name:
	//   e.g. EvidenceContract:RegisterEvidence, CustodyContract:InitiateCustodyTransfer
	cc, err := contractapi.NewChaincode(
		&contracts.EvidenceContract{},
		&contracts.CustodyContract{},
		&contracts.LifecycleContract{},
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating evidence chaincode: %v\n", err)
		os.Exit(1)
	}

	// LifecycleContract.InitLedger is the function called on first instantiation.
	// This writes the genesis metadata record to the ledger.
	cc.Info.Title = "Crime Evidence Chaincode"
	cc.Info.Version = "1.0.0"

	if err := cc.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "Error starting evidence chaincode: %v\n", err)
		os.Exit(1)
	}
}
