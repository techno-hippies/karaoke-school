# Lens Protocol V3 Custom Namespace Sponsorship Issues

## Summary

Custom namespaces in Lens Protocol V3 do not support fully gasless transactions via `typedData` relay. Username creation operations return only `raw` transactions, which require the PKP wallet to have gas funds to submit to the RPC, even when the transaction gas is sponsored by Lens.

**Decision**: Use global Lens namespace instead of custom namespace until a proper gasless solution is found.

## Background

- **Custom Namespace**: `kschool2` (0xa304467aD0C296C2bb11079Bc2748223568D463e)
- **Lens App**: 0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0
- **PKP System**: Lit Protocol Programmable Key Pairs for wallet management
- **Goal**: Create Lens accounts using PKPs without requiring users to fund wallets

## Key Issues Discovered

### 1. Custom Namespace Only Returns `raw` Transactions

**Problem**: When creating usernames in a custom namespace, Lens API returns `SponsoredTransactionRequest` with only `raw` transaction data, NOT `typedData`.

**GraphQL Schema**:
```typescript
type SponsoredTransactionRequest {
  reason: String
  sponsoredReason: String
  raw: RawTransaction
  # NO "id" field
  # NO "typedData" field
}
```

**Error When Requesting typedData**:
```
[GraphQL] Unknown field "id" on type "SponsoredTransactionRequest".
[GraphQL] Unknown field "typedData" on type "SponsoredTransactionRequest".
```

**Implication**: PKP wallets must have gas funds to submit raw transactions to the RPC, even though Lens sponsors the gas execution.

### 2. Funding PKPs is a Security Risk

**Attempted Solution**: Create `/api/fund-pkp` endpoint to send 0.01 GRASS to PKP wallets before username creation.

**Why This is Wrong**:
- Bot networks can exploit this by creating unlimited PKP-based accounts
- Each account creation would drain funds from the funding wallet
- Defeats the purpose of sponsorship (preventing spam/bot exploitation)
- Creates financial attack vector

**Correct Sponsorship Flow**:
1. User wallet pays for account creation transaction
2. Sponsorship API authorizes Lens to cover gas
3. Lens covers gas via smart contract sponsorship
4. User wallet still needs funds to submit transaction

**Problem**: PKPs are generated on-demand and have 0 balance. Cannot pay for transaction submission.

### 3. TypedData Relay Not Supported for Custom Namespaces

**Desired Flow** (works for global namespace):
1. Lens API returns `typedData` + `id`
2. PKP signs the typedData (no gas needed)
3. Signature + ID sent to Lens relay API via `sessionClient.executeTypedData()`
4. Lens submits transaction to RPC (truly gasless for user)

**Actual Flow** (custom namespace):
1. Lens API returns only `raw` transaction
2. PKP must sign AND submit transaction to RPC
3. PKP needs gas funds to submit to RPC
4. Not gasless - requires PKP funding

### 4. Database Performance Issues

**Problem**: Sponsorship API database queries took 820ms, exceeding Lens SDK's 1000ms timeout.

**Wrangler Log**:
```
[Lens Auth] DB query took 820ms
App authorization request timed out after 1000 milliseconds
```

**Temporary Fix**: Bypassed all DB operations to respond instantly.

**Side Effect**: Lost quota tracking - no sponsorship limits enforced.

**Proper Solution Needed**: Optimize database queries or use caching.

### 5. PKP Verification Implementation Bug

**Current Code** (WRONG):
```typescript
const pkpBalance = await publicClient.readContract({
  address: PKP_NFT_CONTRACT,
  abi: pkpNftAbi,
  functionName: 'balanceOf',
  args: [pkpWalletAddress], // ❌ Wrong - PKP wallet address
})
```

**Why This is Wrong**:
- PKP wallet addresses are derived FROM NFT token IDs (public keys)
- The NFT is owned by the minter (EOA), not the derived wallet
- `balanceOf(pkpWallet)` always returns 0

**Correct Implementation**:
```typescript
// 1. Get PKP token ID from wallet address (need tokenId mapping)
// 2. Get NFT owner
const nftOwner = await publicClient.readContract({
  address: PKP_NFT_CONTRACT,
  abi: pkpNftAbi,
  functionName: 'ownerOf',
  args: [tokenId],
})
// 3. Verify owner matches expected minter
```

**Current Status**: PKP verification disabled entirely.

## Transaction Flow Analysis

### Account Creation Phases

1. **Create Account** (works with sponsorship):
   - User: ONBOARDING_USER role
   - Returns `hash` (fully sponsored, no signature needed)
   - ✅ Works perfectly

2. **Switch to Account Owner** (works after DB bypass):
   - User: Switch from ONBOARDING_USER to ACCOUNT_OWNER
   - Returns `hash` (fully sponsored)
   - ✅ Works after removing DB operations

3. **Create Username** (FAILS for custom namespace):
   - User: ACCOUNT_OWNER role
   - Returns `SponsoredTransactionRequest` with ONLY `raw` (requires PKP funds)
   - ❌ Cannot proceed without funding PKPs

### Transaction Type Comparison

| Transaction Type | Signature Required | PKP Funds Required | Use Case |
|-----------------|-------------------|-------------------|----------|
| `hash` | ❌ No | ❌ No | Simple operations (account creation, role switch) |
| `typedData` + `id` | ✅ Yes | ❌ No | Gasless relay via Lens API (global namespace) |
| `raw` | ✅ Yes | ✅ YES | Direct RPC submission (custom namespace) |

## Failed Approaches

### Approach 1: Fund PKPs
- **Idea**: Send 0.01 GRASS to PKP before username creation
- **Problem**: Security risk - bot networks can exploit
- **Result**: Abandoned ❌

### Approach 2: Submit with Admin Wallet
- **Idea**: Backend admin wallet submits transaction on behalf of PKP
- **Problem**: Transaction to account address must be signed BY account owner (PKP)
- **Result**: Transaction failed with status 0x0 ❌

### Approach 3: Request typedData from Lens API
- **Idea**: Add `id` and `typedData` to GraphQL query
- **Problem**: `SponsoredTransactionRequest` type doesn't have these fields
- **Result**: GraphQL schema error ❌

## Open Questions

1. **Does global namespace support typedData for username creation?**
   - Need to test: Create account in global namespace and check `createUsername` response
   - If yes, this solves the problem entirely

2. **Is there a way to enable typedData for custom namespaces?**
   - May require Lens API configuration
   - May require different app setup
   - May not be supported at all

3. **How do other apps handle custom namespace sponsorship?**
   - Research needed: Check Lens docs, Discord, GitHub discussions
   - Are custom namespaces expected to require funded wallets?

4. **Can we sponsor via smart contract directly?**
   - Instead of Lens relay, could we use ERC-2771 forwarder?
   - Would this work with custom namespaces?

## Recommendations

### Immediate Action
✅ **Switch to global Lens namespace** for account creation (COMPLETED 2025-10-23)
- Simpler flow, likely supports typedData
- No custom namespace complexity
- Can add custom namespace later if needed

**Changes Made**:
- Updated `app/src/lib/lens/account-creation.ts` to omit `namespace` parameter (defaults to global `lens/*`)
- Commented out `LENS_CUSTOM_NAMESPACE` in `app/src/lib/lens/config.ts`
- Updated `sponsorship-api/wrangler.toml` to comment out custom namespace env var
- All username creation now uses global `lens/*` namespace

### Future Investigation
1. Test if global namespace supports typedData for all operations
2. Research proper custom namespace sponsorship approaches
3. Fix PKP verification implementation (use `ownerOf` instead of `balanceOf`)
4. Optimize database queries in sponsorship API
5. Re-enable quota tracking once DB performance is fixed

## Technical Details

### Files Modified During Investigation

- `/sponsorship-api/src/routes/lens-auth.ts` - Added onboarding detection, disabled PKP check, bypassed DB
- `/sponsorship-api/wrangler.toml` - Updated namespace from kschool1 to kschool2
- `/app/src/lib/lens/config.ts` - Updated namespace configuration
- `/app/src/lib/lens/mutations.ts` - Attempted to add typedData fields (reverted)
- `/app/src/lib/lens/account-creation.ts` - Removed PKP funding, updated error handling

### Abandoned Files

- `/sponsorship-api/src/routes/fund-pkp.ts` - PKP funding endpoint (never deployed)

## References

- [Lens Protocol V3 Docs](https://docs.lens.xyz)
- [Lit Protocol PKP Docs](https://developer.litprotocol.com/sdk/wallets/quick-start)
- [ERC-2771 Meta-Transactions](https://eips.ethereum.org/EIPS/eip-2771)

## Timeline

- Initial working: Account creation worked earlier in the day
- First failure: Sponsorship API rejecting requests (PKP verification bug)
- Second failure: Switch account timeout (DB performance)
- Third failure: Username creation requires PKP funds (raw transactions only)
- Decision: Switch to global namespace (2025-10-23)
