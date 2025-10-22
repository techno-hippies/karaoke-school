# Unified Account Creation

**Replaces:** `modules/artists/` + `modules/creators/` (separate flows)

**Architecture:** Single unified account type for everyone (artists + regular users)

## Overview

This module creates complete self-custodial accounts with:

1. **PKP (Lit Protocol)** - Programmable Key Pair for trustless operations
2. **Lens Account** - On-chain social identity with custom handle
3. **Grove Metadata** - Validated account data using `AccountMetadataSchema` (Zod)
4. **Optional Event** - `AccountCreated` emission for The Graph indexing

## Key Design: No Hierarchy

**V1 Problem:**
- Separate `ArtistRegistryV1` and `StudentProfileV2` contracts
- Different flows for artists vs users
- Artificial hierarchy (artists = creators, users = consumers)

**V2 Solution:**
- Single `AccountMetadata` schema for everyone
- Optional `geniusArtistId` field for verified artists
- Same capabilities for all users (perform, create, remix)

## Usage

### Regular User

```bash
bun run modules/accounts/01-create-account.ts --username brookemonk
```

### Verified Artist

```bash
bun run modules/accounts/01-create-account.ts \
  --username taylorswift \
  --genius-artist-id 498
```

### With Custom Metadata

```bash
bun run modules/accounts/01-create-account.ts \
  --username charlidamelio \
  --display-name "Charli D'Amelio" \
  --avatar lens://... \
  --bio "Professional dancer and content creator"
```

### Emit Event (Optional)

```bash
bun run modules/accounts/01-create-account.ts \
  --username brookemonk \
  --emit-event
```

## Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `--username` | ✅ | Lens handle (lowercase, alphanumeric + `-_`) | `taylorswift` |
| `--genius-artist-id` | ❌ | Genius artist ID (for verified artists) | `498` |
| `--display-name` | ❌ | Custom display name (defaults to username) | `"Taylor Swift"` |
| `--avatar` | ❌ | Avatar URI on Grove storage | `lens://...` |
| `--bio` | ❌ | Custom bio | `"Singer-songwriter"` |
| `--emit-event` | ❌ | Emit `AccountCreated` event to contract | (flag) |

## Output

Creates `data/accounts/{username}.json`:

```json
{
  "username": "taylorswift",
  "displayName": "Taylor Swift",
  "lensAccountAddress": "0x...",
  "pkpAddress": "0x...",
  "geniusArtistId": 498,
  "network": "lens-testnet",
  "createdAt": "2025-01-20T10:00:00.000Z",
  "metadataUri": "lens://account-metadata-uri",
  "transactionHashes": {
    "pkpMint": "0x...",
    "lensCreate": "0x..."
  }
}
```

## Account Metadata Schema

Uses `AccountMetadataSchema` from `lib/schemas/grove/account.ts`:

```typescript
{
  version: '1.0.0',
  type: 'account',
  username: 'taylorswift',
  displayName: 'Taylor Swift',
  lensAccountAddress: '0x...',
  pkpAddress: '0x...',
  geniusArtistId: 498, // Optional - only for verified artists
  avatar: 'lens://...',
  bio: 'Singer-songwriter',
  stats: {
    totalPerformances: 0,
    bestScore: 0,
    // ... (initialized to zero)
  },
  achievements: [],
  socialLinks: [],
  createdAt: '2025-01-20T10:00:00.000Z',
  updatedAt: '2025-01-20T10:00:00.000Z'
}
```

## Environment Variables

Required in `.env`:

```bash
# Master EOA (controls PKPs and Lens accounts)
PRIVATE_KEY=your_private_key_here

# Networks
LIT_NETWORK=chronicle-yellowstone
LENS_NETWORK=lens-testnet

# Optional: Contract addresses (for event emission)
ACCOUNT_EVENTS_ADDRESS=  # If using --emit-event
```

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                 Unified Account Creation                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Mint PKP (Lit Protocol)                             │
│     → Chronicle Yellowstone chain                        │
│     → Returns: pkpAddress, pkpTokenId                    │
│                                                          │
│  2. Create Lens Account                                  │
│     → Upload Lens metadata to Grove (immutable)          │
│     → Create account with username                       │
│     → Returns: lensAccountAddress                        │
│                                                          │
│  3. Create Account Metadata (Zod validated)              │
│     → Build AccountMetadata object                       │
│     → Validate with AccountMetadataSchema                │
│     → Upload to Grove (immutable for now)                │
│     → TODO: Add mutable ACL with PKP signature           │
│                                                          │
│  4. Optionally Emit Event (--emit-event)                 │
│     → Call accountEvents.emitAccountCreated()            │
│     → The Graph indexes for queries                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Artist vs User: Same Flow

| Account Type | Username | Genius ID | Capabilities |
|--------------|----------|-----------|--------------|
| Regular User | `brookemonk` | `undefined` | Perform, study, compete |
| Verified Artist | `taylorswift` | `498` | Perform, study, compete, **verify songs** |

**Note:** The only difference is the optional `geniusArtistId` field. All accounts have identical capabilities and storage structure.

## Examples

### Example 1: Create Regular User

```bash
$ bun run modules/accounts/01-create-account.ts --username brookemonk

═════════════════════════════════════════════════════════
Create Unified Account: @brookemonk
═════════════════════════════════════════════════════════
   Username: @brookemonk
   Display Name: brookemonk

[ 1/4 ] Minting PKP on Lit Protocol
✅ Lit client initialized
🔑 EOA Address: 0xYourAddress...
⏳ Minting PKP...
✅ PKP minted
   Address: 0xPKPAddress...
   Token ID: 12345
   Tx: 0xTxHash...

[ 2/4 ] Creating Lens account
🔐 Authenticating with Lens...
✅ Authenticated with Lens
☁️  Uploading Lens metadata to Grove...
✅ Lens metadata uploaded: lens://...
👤 Creating Lens account...
   Handle: @brookemonk
✅ Lens account created!
   Address: 0xLensAddress...

[ 3/4 ] Creating unified account metadata
☁️  Uploading account metadata to Grove...
✅ Account metadata uploaded: lens://...

[ 4/4 ] Skipping event emission
   Use --emit-event to emit to contract

✅ Account created successfully!
   Username: @brookemonk
   Lens Address: 0xLensAddress...
   PKP Address: 0xPKPAddress...
   Metadata: lens://...

✅ Account data saved to: data/accounts/brookemonk.json

🎉 Setup complete! Account is ready to use.
```

### Example 2: Create Verified Artist

```bash
$ bun run modules/accounts/01-create-account.ts \
    --username taylorswift \
    --genius-artist-id 498 \
    --display-name "Taylor Swift" \
    --emit-event

═════════════════════════════════════════════════════════
Create Unified Account: @taylorswift
═════════════════════════════════════════════════════════
   Username: @taylorswift
   Display Name: Taylor Swift
   ⭐ Verified Artist (Genius ID: 498)

[... same flow as above ...]

[ 4/4 ] Emitting AccountCreated event
⚠️  Event emission not yet implemented
   Will be added when AccountEvents contract is deployed

✅ Account created successfully!
   Username: @taylorswift
   Lens Address: 0xLensAddress...
   PKP Address: 0xPKPAddress...
   Metadata: lens://...
   Genius Artist ID: 498

🎉 Setup complete! Account is ready to use.
```

## Comparison with V1 Flows

### V1 (Separate Flows)

```bash
# Artists
modules/artists/01-mint-pkp.ts
modules/artists/02-create-lens.ts
modules/artists/03-register-artist.ts  # Calls ArtistRegistryV1

# Creators (TikTok users)
modules/creators/01-mint-pkp.ts
modules/creators/02-create-lens.ts
[no registry contract - just profiles]
```

### V2 (Unified Flow)

```bash
# Everyone (artists + users)
modules/accounts/01-create-account.ts  # All-in-one
```

## Migration Path

1. ✅ Write Zod schemas (done)
2. ✅ Write minimal event contracts (done)
3. ✅ Write unified account creation (done)
4. ⏳ Deploy `AccountEvents` contract (optional)
5. ⏳ Test with real accounts (artist + user)
6. ⏳ Update frontend to use Grove metadata
7. ⏳ Deprecate `modules/artists/` and `modules/creators/`

## TODOs

- [ ] Add mutable ACL for account metadata updates
- [ ] Implement `--emit-event` functionality (requires deployed contract)
- [ ] Add social verification (Twitter, TikTok, etc.)
- [ ] Add profile picture upload helper
- [ ] Write tests for account creation flow
- [ ] Update frontend to fetch from Grove instead of contracts

## Related Files

- Zod Schema: `lib/schemas/grove/account.ts`
- Contract: `v2-contracts/src/events/AccountEvents.sol`
- Tests: `v2-contracts/test/AccountEvents.t.sol`
- Frontend: `app/src/hooks/useAccount.ts` (to be updated)
