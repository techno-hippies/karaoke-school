# PKP-Signed Lens Account Creation

**Status**: ✅ Working (2025-11-13)

## Overview

PKPs (Programmable Key Pairs) from Lit Protocol now properly sign and control Lens Protocol accounts in the karaoke pipeline. This enables gasless, decentralized identity management where PKPs own social accounts without requiring gas funds.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ PKP Minting (Chronicle Yellowstone - nagaDev)                   │
│ - Free execution network                                        │
│ - EOA pays minting gas (one-time cost)                          │
│ - Returns: PKP address, public key, token ID                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PKP Wallet Client (Lit Protocol)                                │
│ - Auth Manager + executeJs() pattern                            │
│ - Custom viem LocalAccount with PKP signing                     │
│ - No gas funds needed (signs messages only)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Lens Account Creation (Lens Testnet)                            │
│ 1. PKP signs SIWE authentication message                        │
│ 2. SessionClient authenticated with PKP                         │
│ 3. PKP authorizes account creation (signature)                  │
│ 4. Lens relayer submits transaction (gasless)                   │
│ 5. PKP owns Lens account via signed authorization               │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Lit Protocol Service

**File**: `src/services/lit-protocol.ts`

**Network**: `nagaDev` (Chronicle Yellowstone testnet)
- Free execution for Lit Actions
- RPC: `https://yellowstone-rpc.litprotocol.com/`
- Chain ID: 175188

**Authentication**: Auth Manager pattern
```typescript
const authManager = createAuthManager({
  storage: storagePlugins.localStorageNode({
    appName: 'karaoke-pipeline',
    networkName: 'naga-dev',
    storagePath: './.lit-auth-storage',
  }),
});

const litAuthContext = await authManager.createEoaAuthContext({
  config: { account },
  authConfig: {
    statement: 'Lit Protocol Session for Karaoke Pipeline',
    domain: 'localhost',
    resources: [
      ['lit-action-execution', '*'],
      ['pkp-signing', '*'],
    ],
    expiration: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  litClient,
});
```

**PKP Wallet Client**: Custom viem LocalAccount
- `signMessage()`: Uses `Lit.Actions.ethPersonalSignMessageEcdsa()`
- `signTransaction()`: Uses `Lit.Actions.signEcdsa()`
- `signTypedData()`: Uses `Lit.Actions.signEcdsa()` with EIP-712 hash

### 2. Lens Protocol Service

**File**: `src/services/lens-protocol.ts`

**Network**: Lens Testnet (staging environment)
- RPC: `https://rpc.testnet.lens.xyz`
- Chain ID: 37111

**Custom Namespace**: kschool2
- Address: `0xa304467aD0C296C2bb11079Bc2748223568D463e`
- Handles: `{username}-ks1`, `{username}-ks2`, etc.

**Authentication Flow**:
```typescript
// 1. Create authenticated Lens client with PKP wallet's authContext
const client = await createAuthenticatedLensClient(pkpWalletClient);

// 2. Login with PKP wallet (PKP signs SIWE message)
const authenticated = await client.login({
  onboardingUser: {
    app: evmAddress(LENS_APP_ADDRESS),
    wallet: evmAddress(pkpWalletClient.account.address),
  },
  signMessage: async (message: string) => {
    return await pkpWalletClient.signMessage({ message });
  },
});

// 3. Create account (sponsorship handled automatically)
const operationResult = await createAccountWithUsername(sessionClient, {
  username: { localName: handle, namespace: LENS_NAMESPACE_ADDRESS },
  metadataUri: uploadResult.uri,
});
```

**Sponsorship Handling**: Manual response handling
- **Direct hash**: Fully sponsored, no signature needed
- **TypedData**: PKP signs, broadcast via `executeTypedData()`
- **Raw transaction**: Fallback (requires gas, should not happen)

## Gasless Transactions

### How It Works

Lens Protocol uses a relayer service to submit transactions on behalf of users:

1. **PKP Authorization**: PKP signs SIWE message and account creation data
2. **Lens Relayer**: Submits transaction with address `0x4cc91180ea275453c82096d9f8d201e6fad96b98`
3. **On-Chain Result**: Transaction FROM is relayer, but PKP's signature proves ownership
4. **PKP Balance**: Remains at 0 GRASS (no gas consumed)

### Why Transaction FROM ≠ PKP Address

This is **correct behavior**. The transaction sender is the Lens relayer, but the PKP's cryptographic signature authorizes the account creation. Ownership is determined by the signature, not the transaction sender.

**Analogy**: Like a notary (relayer) submitting a document you signed (PKP). The notary's name is on the submission, but your signature proves your authorization.

## Testing

### Standalone Test

**File**: `src/scripts/test-fresh-pkp-lens.ts`

**Steps**:
1. Mint fresh PKP on nagaDev
2. Create PKP wallet client
3. Create Lens account with kschool2 namespace
4. Verify PKP ownership (0 GRASS balance, signed authorization)

**Run**:
```bash
bun src/scripts/test-fresh-pkp-lens.ts
```

**Expected Output**:
```
✅ PKP minted on nagaDev
✅ PKP wallet client created
✅ Lens account created with kschool2 namespace
✅ PKP balance: 0 GRASS
✅ Transaction relayed by Lens sponsor
✅ PKP owns Lens account via signed authorization
```

### Database PKP Test

**File**: `src/scripts/test-pkp-lens-account.ts`

Tests with existing PKPs from database (requires migration to nagaDev if they're on nagaTest).

## Production Usage

### Creating Lens Accounts for Artists

```typescript
import { createLitService } from './services/lit-protocol';
import { createLensService } from './services/lens-protocol';

// 1. Mint PKP for artist
const litService = createLitService();
const pkp = await litService.mintPKP();

// 2. Create PKP wallet client
const pkpWallet = await litService.createPKPWalletClient(
  pkp.pkpPublicKey,
  pkp.pkpAddress,
  chains.testnet
);

// 3. Create Lens account
const lensService = createLensService();
const result = await lensService.createAccount({
  handle: 'artist-name',
  name: 'Artist Display Name',
  bio: 'Artist bio',
  pkpAddress: pkp.pkpAddress,
  walletClient: pkpWallet,  // Pass PKP wallet!
});

// 4. Store in database
await query(
  `INSERT INTO lens_accounts (lens_handle, lens_account_address, pkp_address, ...)
   VALUES ($1, $2, $3, ...)`,
  [result.lensHandle, result.lensAccountAddress, pkp.pkpAddress, ...]
);
```

## Database Schema

**Table**: `pkp_accounts`
```sql
CREATE TABLE pkp_accounts (
  pkp_address TEXT PRIMARY KEY,
  pkp_public_key TEXT NOT NULL,
  pkp_token_id TEXT NOT NULL,
  owner_eoa TEXT NOT NULL,
  account_type TEXT NOT NULL,  -- 'artist' | 'creator' | 'user'
  spotify_artist_id TEXT,
  transaction_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Table**: `lens_accounts`
```sql
CREATE TABLE lens_accounts (
  lens_account_address TEXT PRIMARY KEY,
  lens_handle TEXT NOT NULL UNIQUE,
  pkp_address TEXT REFERENCES pkp_accounts(pkp_address),
  metadata_uri TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Troubleshooting

### Error: "Payment failed" / "No capacity credits"

**Cause**: Using `nagaTest` network instead of `nagaDev`

**Fix**: Ensure Lit service uses `nagaDev`:
```typescript
const { nagaDev } = await import('@lit-protocol/networks');
litClient = await createLitClient({ network: nagaDev });
```

### Error: "NodeAuthSigScopeTooLimited"

**Cause**: PKP minted on wrong network (e.g., nagaTest PKP used on nagaDev client)

**Fix**: Mint fresh PKP on nagaDev or switch client to match PKP's network

### Error: "Resource id not found in auth_sig capabilities"

**Cause**: Manual SIWE implementation with incorrect ReCap resources

**Fix**: Use Auth Manager with proper resource format:
```typescript
resources: [
  ['lit-action-execution', '*'],
  ['pkp-signing', '*'],
]
```

### Transaction FROM doesn't match PKP

**This is correct!** Lens uses a relayer (`0x4cc91180...`) for gasless transactions. Check:
1. PKP signed SIWE authentication message ✅
2. PKP address in account metadata ✅
3. PKP balance remains 0 GRASS ✅
4. Transaction submitted by Lens relayer ✅

## References

- **Lit Protocol Docs**: https://developer.litprotocol.com/
- **Lens Protocol Docs**: https://docs.lens.xyz/
- **Auth Manager Guide**: https://developer.litprotocol.com/sdk/authentication/auth-manager
- **Chronicle Yellowstone Explorer**: https://yellowstone-explorer.litprotocol.com/
- **Lens Testnet Explorer**: https://explorer.testnet.lens.xyz/

## Status

- ✅ PKP minting on nagaDev
- ✅ PKP wallet client with Auth Manager
- ✅ PKP-signed Lens account creation
- ✅ Gasless transactions via Lens relayer
- ✅ Custom namespace (kschool2) integration
- ✅ Standalone test passing
- ⏳ Frontend integration (next step)
- ⏳ Production pipeline migration

**Last Updated**: 2025-11-13
