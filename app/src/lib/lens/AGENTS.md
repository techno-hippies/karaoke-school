# Lens Integration - Agent Guide

## Core Commands

• **Lens Testnet**: `0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7`
• **Lens Mainnet**: `0x8A5Cc31180c37078e1EbA2A23c861Acf351a97cE`

## Authentication Architecture

**Dual-Layer Auth System**:
1. **PKP (Lit)**: Passkey wallet identity - handles transactions
2. **Lens**: Social username & profile - handles social features

**Current Implementation**:
- **Global namespace** (not custom `kschool1/*`) due to sponsorship issues
- **2-step account creation**: Create account → Switch to owner → Create username
- **WebAuthn required** for PKP authentication flows

## Key Patterns

**Account Creation Flow**:
```typescript
// 1. Login as onboarding user
const session = await loginAsOnboardingUser(walletClient, walletAddress)

// 2. Create account metadata (upload to Grove)
const metadata = accountMetadata({ name, bio, picture })
const uploadResult = await storageClient.uploadAsJson(metadata, { acl })

// 3. Create account
const account = await createAccount(session, walletClient, uploadResult.uri)

// 4. Switch to account owner
await session.switchAccount({ account: account.address })

// 5. Create username (if using custom namespace)
await createUsername(session, walletClient, username, uploadResult.uri)
```

**Authentication State**:
- **Auto-resume** on mount if session exists
- **Storage**: Browser localStorage for persistence
- **Error handling**: Network errors don't clear PKP session

## Required Environment

```bash
VITE_LENS_ENVIRONMENT=testnet
VITE_LENS_APP_ADDRESS=0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7
```

## Critical Files

**Authentication Context**: `src/contexts/AuthContext.tsx`
- Manages both PKP + Lens state
- Handles WebAuthn flows
- Auto-initializes sessions

**Lens Client**: `src/lib/lens/config.ts`
- Public client setup
- Environment configuration

**Auth Flows**: `src/lib/auth/flows.ts`
- PKP → Lens registration
- PKP → Lens login
- Username validation

## Common Issues

**WebAuthn Requirements**:
- Must be triggered by user gesture
- Only works over HTTPS (except localhost)
- Requires compatible browser

**Session Persistence**:
- PKP sessions auto-restore
- Lens sessions require explicit login
- Check `useAuth()` context before assuming connection

**Namespace Issues**:
- Currently using global namespace (not custom `kschool2/*`)
- Custom namespaces only return `raw` transactions, requiring PKP wallet gas funds
- Global namespace supports typedData relay for gasless operations
- Username validation format: lowercase, alphanumeric, underscores, 6+ chars

## Custom Namespace Implementation History

### Key Discovery: Transaction Types

**Custom Namespace Limitation**:
Custom namespaces in Lens Protocol V3 return only `raw` transactions for username creation, not `typedData`. This means PKP wallets must have gas funds to submit transactions, defeating the gasless sponsorship goal.

```typescript
// Custom namespace returns:
type SponsoredTransactionRequest {
  reason: String
  sponsoredReason: String
  raw: RawTransaction  // Requires PKP gas funds
  // NO "id" field for relay
  // NO "typedData" field for gasless relay
}
```

**Global Namespace Advantage**:
Global namespace returns `typedData` + `id`, enabling gasless relay via Lens API:

```typescript
// Global namespace returns:
{
  id: "transaction_id",
  typedData: { ... },  // Can be signed by PKP without gas
}
// Gasless execution via sessionClient.executeTypedData()
```

### Failed Approaches

**1. Funding PKPs (Security Risk)**:
```typescript
// Attempted solution: Send 0.01 GRASS to PKP before username creation
// Problem: Bot networks can exploit, draining funding wallet
// Result: Abandoned - creates financial attack vector
```

**2. Admin Wallet Submission**:
```typescript
// Attempted solution: Backend admin submits transaction on behalf of PKP
// Problem: Transaction must be signed BY account owner (PKP)
// Result: Failed with status 0x0 - requires PKP signature
```

**3. PKP Verification Bug**:
```typescript
// WRONG (current implementation):
const pkpBalance = await publicClient.readContract({
  address: PKP_NFT_CONTRACT,
  functionName: 'balanceOf',
  args: [pkpWalletAddress], // ❌ Always returns 0
})

// Correct approach: Verify NFT owner matches expected minter
```

### Technical Implementation Details

**Transaction Flow Analysis**:

1. **Create Account** (✅ Fully sponsored)
   - User role: ONBOARDING_USER
   - Returns `hash` (no signature needed)
   - Works perfectly with sponsorship

2. **Switch to Account Owner** (✅ Works after DB optimization)
   - User role: Switch ONBOARDING_USER → ACCOUNT_OWNER
   - Returns `hash` (fully sponsored)
   - Previously failed due to 820ms DB queries exceeding 1000ms timeout

3. **Create Username** (❌ Requires PKP funds in custom namespace)
   - User role: ACCOUNT_OWNER
   - Custom namespace: Returns `raw` only (needs PKP gas)
   - Global namespace: Returns `typedData` + `id` (gasless relay)

**Transaction Type Comparison**:

| Type | Signature | PKP Funds | Use Case |
|------|-----------|-----------|----------|
| `hash` | ❌ No | ❌ No | Simple operations (account creation) |
| `typedData` + `id` | ✅ Yes | ❌ No | Gasless relay (global namespace) |
| `raw` | ✅ Yes | ✅ **YES** | Direct RPC submission (custom namespace) |

## Recommendations

**Current Implementation** (✅ Completed 2025-10-23):
- **Switched to global Lens namespace** for gasless account creation
- Simplified flow: no custom namespace complexity
- Full sponsorship support via typedData relay

**Files Modified**:
- `src/lib/lens/account-creation.ts` - Removed namespace parameter
- `src/lib/lens/config.ts` - Disabled custom namespace config
- Sponsorship API optimized (DB bypass for performance)

**Future Investigation**:
1. Fix PKP verification (use `ownerOf` instead of `balanceOf`)
2. Optimize sponsorship API database queries
3. Re-enable quota tracking once DB performance resolved
4. Research if custom namespaces can support typedData in future

## Data Flow

**New User Registration**:
```
WebAuthn Passkey → PKP Wallet → Lens Onboarding → Lens Account → Username Creation
```

**Existing User Login**:
```
WebAuthn Passkey → PKP Wallet → Lens Session Resume → Account Owner Role
```

## Architecture Notes

**Storage Integration**:
- Grove uploads for account metadata
- ACL: Lens account ownership for metadata editing
- Indexed folders for profile pictures

**Error Patterns**:
- Network errors during auto-init → Keep PKP session, skip Lens
- Invalid blockhash → Clear stale session data
- CORS errors → Check origin configuration

## Testing

**Test Credentials**:
- Use Lens testnet (`37111` chain)
- Global namespace usernames (free)
- Test PKP wallets for authentication

**Debug Steps**:
1. Check browser WebAuthn support
2. Verify environment variables (`bun run lint`)
3. Test with 6+ character username
4. Monitor Lens API responses
