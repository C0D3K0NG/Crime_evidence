// Package contracts provides the Hyperledger Fabric smart contract implementations
// for the Crime Evidence Management System.
//
// access.go — Role-based access control (RBAC) helpers.
// Roles are embedded as attributes in the X.509 certificates issued by the
// Fabric CAs during the enrollment step (Phase 1 / enroll-users.sh).
// The caller's MSP ID and role attribute are extracted from every transaction
// context to enforce permission boundaries at the chaincode level.
package contracts

import (
	"fmt"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// Role constants match the role values stored in the web app's User.role column
// and embedded in the X.509 certificate attributes during CA enrollment.
const (
	RoleOfficer    = "officer"
	RoleCustodian  = "custodian"
	RoleAnalyst    = "analyst"
	RoleProsecutor = "prosecutor"
	RoleAdmin      = "admin"
)

// CallerIdentity holds the extracted identity information from the transaction client.
type CallerIdentity struct {
	MSPID    string // e.g. "PoliceDeptMSP" or "ForensicLabMSP"
	CN       string // Common Name from the certificate (usually the username)
	Role     string // Role attribute from the certificate (if present)
	UserID   string // Combination of CN — used to link back to SQLite User.id / username
}

// GetCallerIdentity extracts the MSP ID and certificate common name
// from the transaction's client identity.
func GetCallerIdentity(ctx contractapi.TransactionContextInterface) (*CallerIdentity, error) {
	clientID := ctx.GetClientIdentity()

	mspID, err := clientID.GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("failed to get MSP ID: %w", err)
	}

	// Extract role attribute — set during CA enrollment via enroll-users.sh
	// If not present (e.g. admin certs), defaults to "admin"
	role, found, err := clientID.GetAttributeValue("role")
	if err != nil {
		return nil, fmt.Errorf("failed to get role attribute: %w", err)
	}
	if !found || role == "" {
		// Fallback: admin-enrolled certs typically have no role attribute but
		// come from admin MSP. We treat them as admin.
		role = RoleAdmin
	}

	// Get the X.509 certificate to extract the CN
	cert, err := clientID.GetX509Certificate()
	if err != nil {
		return nil, fmt.Errorf("failed to get X.509 certificate: %w", err)
	}

	cn := cert.Subject.CommonName

	return &CallerIdentity{
		MSPID:  mspID,
		CN:     cn,
		Role:   strings.ToLower(role),
		UserID: cn,
	}, nil
}

// RequireRole checks that the caller has one of the specified roles.
// Returns an error if the caller's role is not in the allowed list.
// This should be called at the top of any contract function that requires
// permission control.
//
// Example:
//
//	if err := RequireRole(ctx, RoleOfficer, RoleAdmin); err != nil {
//	    return nil, err
//	}
func RequireRole(ctx contractapi.TransactionContextInterface, allowedRoles ...string) error {
	identity, err := GetCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("access control: could not identify caller: %w", err)
	}

	for _, r := range allowedRoles {
		if identity.Role == strings.ToLower(r) {
			return nil // caller is authorized
		}
	}

	return fmt.Errorf("access denied: role '%s' (MSP: %s) is not authorized for this operation. Required: [%s]",
		identity.Role, identity.MSPID, strings.Join(allowedRoles, ", "))
}

// RequireOrg checks that the caller belongs to a specific MSP organization.
// Useful for operations that must originate from a particular org (e.g. only
// PoliceDept can register evidence; only ForensicLab can submit lab results).
func RequireOrg(ctx contractapi.TransactionContextInterface, allowedMSPs ...string) error {
	identity, err := GetCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("access control: could not identify caller: %w", err)
	}

	for _, msp := range allowedMSPs {
		if identity.MSPID == msp {
			return nil
		}
	}

	return fmt.Errorf("access denied: organization '%s' is not authorized for this operation. Required: [%s]",
		identity.MSPID, strings.Join(allowedMSPs, ", "))
}

// RequireRoleOrOrg checks role OR org — useful when multiple conditions satisfy access.
func RequireRoleOrOrg(
	ctx contractapi.TransactionContextInterface,
	allowedRoles []string,
	allowedMSPs []string,
) error {
	roleErr := RequireRole(ctx, allowedRoles...)
	if roleErr == nil {
		return nil // role check passed
	}
	orgErr := RequireOrg(ctx, allowedMSPs...)
	if orgErr == nil {
		return nil // org check passed
	}
	return fmt.Errorf("access denied: neither role (%v) nor organization (%v) check passed", allowedRoles, allowedMSPs)
}
