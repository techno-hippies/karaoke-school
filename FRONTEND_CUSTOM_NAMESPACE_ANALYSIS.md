# Frontend Custom Namespace Analysis

**Goal**: Enable kschool2 custom namespace in the main app (app/) using lessons from lens-sandbox and pipeline

**Date**: 2025-11-13

---

## Current State Comparison

| Component | lens-sandbox/ | app/ | Pipeline |
|-----------|--------------|------|----------|
| **Namespace** | ✅ kschool2 (active) | ❌ global lens/* (kschool2 commented out) | ✅ kschool2 (working) |
| **Account Creation** | SDK `createAccountWithUsername()` | 3-step GraphQL (create → switch → username) | SDK `createAccountWithUsername()` |
| **Sponsorship** | ✅ `handleOperationWith()` | ❌ Manual typedData signing | ✅ Manual handling (no handleOperationWith) |
| **PKP Integration** | ❌ No PKP (uses Wagmi wallets) | ✅ PKP wallets | ✅ PKP wallets |
| **Environment** | Next.js + Wagmi | Vite + React | Bun + Node.js |

---

## Key Findings

### 1. lens-sandbox Implementation (Reference)

**File**: `lens-sandbox/app/components/CreateLensAccount.tsx`

**Pattern**: Uses Lens Protocol SDK with `handleOperationWith()`
```typescript
const { data: walletClient } = useWalletClient();
const { execute: createAccount } = useCreateAccountWithUsername({
  handler: handleOperationWith(walletClient),  // ⚠️ This is the key!
});

const accountData = {
  username: {
    localName: username.trim(),
    namespace: namespaces[selectedNamespace],  // kschool2 or undefined (global)
  },
  metadataUri: uploadResult.uri,
};

const result = await createAccount(accountData);
```

**Environment Variables**:
```bash
NEXT_PUBLIC_NAMESPACE_NAME=kschool2
NEXT_PUBLIC_NAMESPACE_ADDRESS=0xa304467aD0C296C2bb11079Bc2748223568D463e
NEXT_PUBLIC_LENS_APP_ADDRESS=0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0
NEXT_PUBLIC_LENS_ENVIRONMENT=testnet
```

**Namespace Mapping**:
```typescript
const namespaces = {
  lens: undefined,  // Global namespace (no address)
  [env.NEXT_PUBLIC_NAMESPACE_NAME]: env.NEXT_PUBLIC_NAMESPACE_ADDRESS,
};
```

**Key Observations**:
- ✅ Uses SDK's `createAccountWithUsername()` directly
- ✅ Passes namespace address explicitly
- ✅ Uses `handleOperationWith(walletClient)` for transaction handling
- ⚠️ **No PKP integration** (uses standard Wagmi wallets)
- ✅ Allows namespace selection in UI (dropdown)

---

### 2. app/ Implementation (Main Frontend)

**File**: `app/src/lib/lens/config.ts`

**Current State**:
```typescript
// Using global lens/* namespace (custom namespace disabled for now)
// Custom Namespace (kschool2/*) - commented out until sponsorship issues resolved
// export const LENS_CUSTOM_NAMESPACE: EvmAddress = (import.meta.env.VITE_LENS_CUSTOM_NAMESPACE ||
//   '0xa304467aD0C296C2bb11079Bc2748223568D463e') as EvmAddress
```

**File**: `app/src/lib/lens/account-creation.ts`

**Current Pattern**: 3-step GraphQL mutations (NOT using SDK helper)
```typescript
// Step 1: Create account (no username)
const createAccountResult = await executeMutationWithSession<{ createAccount: CreateAccountResponse }>(
  CREATE_ACCOUNT_MUTATION,
  { request: { metadataUri } }
);

// Step 2: Switch to account owner role
await switchToAccountOwner(sessionClient, account.address);

// Step 3: Create username in global namespace
const createUsernameResult = await executeMutationWithSession<{ createUsername: CreateUsernameResponse }>(
  CREATE_USERNAME_MUTATION,
  {
    request: {
      username: {
        localName: username,
        // namespace omitted = global lens/* namespace  ⬅️ THIS IS THE PROBLEM
      },
    },
  }
);
```

**Why 3-Step Flow?**
- Originally implemented for global namespace (no namespace address)
- Comment suggests sponsorship issues with custom namespace
- Manually handles typedData signing with PKP wallet

**Key Observations**:
- ✅ **Has PKP integration** (signs with PKP wallet)
- ❌ **No namespace address** in username creation (line 170)
- ❌ **Commented out custom namespace constant**
- ✅ Manual typedData handling (correct for PKP)
- ⚠️ More complex than lens-sandbox (3-step vs 1-step)

---

### 3. Pipeline Implementation (Reference - Now Working!)

**File**: `new-karaoke-pipeline/src/services/lens-protocol.ts`

**Pattern**: SDK with manual sponsorship handling (NO `handleOperationWith()`)
```typescript
const operationResult = await createAccountWithUsername(sessionClient, {
  username: {
    localName: handle,
    namespace: LENS_NAMESPACE_ADDRESS,  // kschool2
  },
  metadataUri: uploadResult.uri,
});

// Manual sponsorship handling
const sponsorshipData = operationResult.value;
let txHash: Hex;

if (typeof sponsorshipData === 'string') {
  txHash = sponsorshipData as Hex;
} else if ((sponsorshipData as any).hash) {
  txHash = (sponsorshipData as any).hash as Hex;
} else if ((sponsorshipData as any).typedData) {
  // Sign with PKP wallet
  const signature = await pkpWalletClient.signTypedData({
    account: pkpWalletClient.account,
    domain: { ... },
    types: typedData.types,
    primaryType: 'CreateAccountWithUsername',
    message: typedData.value,
  });

  // Broadcast via SessionClient
  const broadcastResult = await (sessionClient as any).executeTypedData({
    id: (sponsorshipData as any).id,
    signature,
  });

  txHash = broadcastResult.value as Hex;
}
```

**Key Observations**:
- ✅ **Uses SDK's `createAccountWithUsername()`** (simpler than 3-step)
- ✅ **Passes namespace address explicitly**
- ✅ **Manual sponsorship handling** (correct for PKP)
- ✅ **PKP signs typedData** when required
- ❌ **Does NOT use `handleOperationWith()`** (doesn't work with PKP)

---

## The Critical Issue: `handleOperationWith()` vs PKP

### Why lens-sandbox uses `handleOperationWith()`:
```typescript
handler: handleOperationWith(walletClient)  // Works with Wagmi EOA wallets
```
- Wagmi wallet client is a standard viem WalletClient
- `handleOperationWith()` can send transactions directly
- Works fine for EOA wallets with gas funds

### Why app/ and pipeline CANNOT use `handleOperationWith()`:
```typescript
// ❌ This doesn't work with PKP wallets:
handler: handleOperationWith(pkpWalletClient)

// ✅ Must manually handle sponsorship instead:
const result = await createAccountWithUsername(sessionClient, request);
if (result.value.typedData) {
  const signature = await pkpWalletClient.signTypedData(...);
  const txHash = await sessionClient.executeTypedData({ id, signature });
}
```

**Reason**: PKP wallets can only SIGN, they cannot SEND transactions (no gas funds). The `handleOperationWith()` helper assumes the wallet can send raw transactions, which fails for PKPs.

---

## Implementation Plan for app/

### Option A: Keep 3-Step Flow + Add Namespace ⭐ **RECOMMENDED**

**Advantages**:
- ✅ Minimal code changes
- ✅ Already handles PKP signing correctly
- ✅ Already has manual typedData flow
- ✅ Lower risk

**Changes Required**:

1. **Uncomment namespace constant** (`app/src/lib/lens/config.ts`):
```typescript
export const LENS_CUSTOM_NAMESPACE: EvmAddress = (import.meta.env.VITE_LENS_CUSTOM_NAMESPACE ||
  '0xa304467aD0C296C2bb11079Bc2748223568D463e') as EvmAddress
```

2. **Add namespace to username creation** (`app/src/lib/lens/account-creation.ts:169`):
```typescript
request: {
  username: {
    localName: username,
    namespace: LENS_CUSTOM_NAMESPACE,  // ⬅️ ADD THIS LINE
  },
}
```

3. **Update environment variable** (`.env` or runtime config):
```bash
VITE_LENS_CUSTOM_NAMESPACE=0xa304467aD0C296C2bb11079Bc2748223568D463e
```

**That's it!** The existing PKP signing flow should handle everything else.

---

### Option B: Migrate to SDK Pattern (like pipeline)

**Advantages**:
- ✅ Simpler code (1-step instead of 3-step)
- ✅ Matches pipeline implementation
- ✅ Better long-term maintainability

**Disadvantages**:
- ❌ Larger code change
- ❌ More testing required
- ❌ May break existing flows

**Changes Required**:

1. Add SDK import to `account-creation.ts`:
```typescript
import { createAccountWithUsername } from '@lens-protocol/client/actions';
```

2. Replace 3-step flow with single SDK call:
```typescript
export async function createAccountInCustomNamespace(
  sessionClient: SessionClient,
  walletClient: WalletClient,
  username: string,
  metadataUri: string
): Promise<Account> {
  const operationResult = await createAccountWithUsername(sessionClient, {
    username: {
      localName: username,
      namespace: LENS_CUSTOM_NAMESPACE,
    },
    metadataUri,
  });

  if (operationResult.isErr()) {
    throw new Error(`Account creation failed: ${operationResult.error.message}`);
  }

  // Handle sponsorship response (copy from pipeline)
  const sponsorshipData = operationResult.value;
  let txHash: Hex;

  // ... (copy manual sponsorship handling from pipeline)
}
```

3. Remove GraphQL mutations (no longer needed)

---

## Testing Plan

### Phase 1: Verify Configuration
- [ ] Check `.env` has `VITE_LENS_CUSTOM_NAMESPACE`
- [ ] Verify lens-sandbox works with kschool2 namespace
- [ ] Run lens-sandbox locally to confirm reference implementation

### Phase 2: Implement Changes (Option A)
- [ ] Uncomment `LENS_CUSTOM_NAMESPACE` in config.ts
- [ ] Add namespace to username creation (line 171)
- [ ] Add environment variable to .env

### Phase 3: Browser Testing
- [ ] Create PKP via WebAuthn
- [ ] Attempt account creation with custom namespace
- [ ] Verify sponsorship works (no gas required)
- [ ] Check handle format: `{username}-ks1`
- [ ] Verify metadata includes pkpAddress attribute

### Phase 4: Verification
- [ ] Check PKP balance (should remain 0 GRASS)
- [ ] Verify transaction on Lens Explorer
- [ ] Confirm relayer submission (FROM ≠ PKP)
- [ ] Test account functionality (posts, etc.)

---

## Expected Behavior After Implementation

### Before (Global Namespace)
```
Username: johndoe
Full Handle: lens/johndoe
Namespace: undefined (global)
```

### After (Custom Namespace)
```
Username: johndoe
Full Handle: kschool2/johndoe-ks1
Namespace: 0xa304467aD0C296C2bb11079Bc2748223568D463e
```

**Handle Collision Handling**:
- First attempt: `johndoe-ks1`
- If taken: `johndoe-ks2`
- If taken: `johndoe-ks3`
- etc.

---

## Risk Assessment

### Option A (Minimal Changes) - **LOW RISK** ⭐
- Single line change to add namespace
- Existing PKP signing flow handles everything
- Pipeline proves sponsorship works with kschool2
- Fast to implement and test

### Option B (SDK Migration) - **MEDIUM RISK**
- Larger refactor of core account creation flow
- Risk of breaking existing functionality
- More testing required
- Better long-term but not urgent

---

## Recommendation

**Implement Option A first**:
1. It's the minimal viable change
2. Pipeline proves the approach works
3. Low risk of breaking existing flows
4. Can always migrate to SDK pattern later (Option B) if needed

**Why the original comment was wrong**:
> "Custom Namespace (kschool2/*) - commented out until sponsorship issues resolved"

The pipeline test proves there are **no sponsorship issues** with kschool2. The real issue was likely:
1. Using `handleOperationWith()` with PKP wallets (doesn't work)
2. Not manually handling typedData signing (now fixed in app)

Since the app already has manual typedData handling (lines 186-219), adding the namespace should "just work".

---

## Next Steps

1. **Review this analysis** with user
2. **Test lens-sandbox** to confirm reference works
3. **Implement Option A** (add namespace to username creation)
4. **Test in browser** with PKP wallet
5. **Document results** and update status

---

**Last Updated**: 2025-11-13
