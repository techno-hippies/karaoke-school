# PKP and Lens Account Integration

## Overview

This implementation adds **Lit Protocol PKP** (Programmable Key Pairs) and **Lens Protocol accounts** for both artists and TikTok creators, enabling Web3 identity and account claiming via TikTok OAuth.

## Key Design Decisions

### 1. Polymorphic Account Tables

Instead of separate tables for artists and creators, we use **polymorphic tables** with an `account_type` discriminator:

**Tables**:
- `pkp_accounts` - Stores PKP data for both artists and TikTok creators
- `lens_accounts` - Stores Lens account data for both artists and TikTok creators

**Benefits**:
- Single source of truth for all PKP/Lens accounts
- Easier to query all accounts regardless of type
- Consistent data structure

### 2. Source Tables vs Aggregation Tables

**Source Tables** (write PKP/Lens data here):
- `pkp_accounts` - PKP minting results
- `lens_accounts` - Lens account creation results
- `tiktok_creators` - Direct references to PKP/Lens for quick access

**Aggregation Table** (compiled from sources):
- `grc20_artists` - Populated via JOIN from `pkp_accounts` and `lens_accounts`

This separation ensures:
- `grc20_artists` remains a pure aggregation view
- PKP/Lens data has its own permanent home
- Re-running population scripts updates grc20_artists automatically

### 3. Lens Handle as Immutable Identifier

The Lens handle is now a **required identifier** in GRC-20 because:
- It's **immutable** (can't be changed once created)
- It's **human-readable** (@ariana-grande vs 0xABCD...)
- It follows **social media conventions** (Instagram, Twitter style)
- It's **claimable** via TikTok OAuth through the PKP

## Database Schema

### Migration 026: `pkp_accounts`

```sql
CREATE TABLE pkp_accounts (
  id SERIAL PRIMARY KEY,
  account_type TEXT CHECK (account_type IN ('artist', 'tiktok_creator')),

  -- Polymorphic join keys
  spotify_artist_id TEXT,     -- For artists
  tiktok_handle TEXT,         -- For creators
  genius_artist_id INTEGER,

  -- PKP data
  pkp_address TEXT NOT NULL UNIQUE,
  pkp_token_id TEXT NOT NULL,
  pkp_public_key TEXT NOT NULL,
  pkp_owner_eoa TEXT NOT NULL,

  transaction_hash TEXT,
  minted_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration 027: `lens_accounts`

```sql
CREATE TABLE lens_accounts (
  id SERIAL PRIMARY KEY,
  account_type TEXT CHECK (account_type IN ('artist', 'tiktok_creator')),

  -- Polymorphic join keys
  spotify_artist_id TEXT,
  tiktok_handle TEXT,

  -- Foreign key to PKP
  pkp_address TEXT REFERENCES pkp_accounts(pkp_address),

  -- Lens data
  lens_handle TEXT NOT NULL UNIQUE,
  lens_account_address TEXT NOT NULL UNIQUE,
  lens_metadata_uri TEXT NOT NULL,  -- Grove URI

  transaction_hash TEXT,
  created_at_chain TIMESTAMPTZ
);
```

### Migration 028: `tiktok_creators` updates

```sql
ALTER TABLE tiktok_creators
  ADD COLUMN pkp_address TEXT REFERENCES pkp_accounts(pkp_address),
  ADD COLUMN lens_handle TEXT REFERENCES lens_accounts(lens_handle),
  ADD COLUMN lens_account_address TEXT;
```

### Migration 029: `grc20_artists` updates

```sql
ALTER TABLE grc20_artists
  ADD COLUMN pkp_address TEXT,
  ADD COLUMN pkp_token_id TEXT,
  ADD COLUMN pkp_public_key TEXT,
  ADD COLUMN pkp_minted_at TIMESTAMPTZ,

  ADD COLUMN lens_handle TEXT,
  ADD COLUMN lens_account_address TEXT,
  ADD COLUMN lens_account_id TEXT,
  ADD COLUMN lens_metadata_uri TEXT,
  ADD COLUMN lens_created_at TIMESTAMPTZ;
```

## Workflow

### For Artists (Original Music Creators)

```bash
# Step 1: Mint PKPs for artists
bun src/processors/mint-artist-pkps.ts --limit=20

# Step 2: Create Lens accounts for artists
bun src/processors/create-artist-lens.ts --limit=20

# Step 3: Populate grc20_artists (pulls in PKP/Lens data)
bun scripts/migration/populate-grc20-artists.ts

# Step 4: Validate readiness for GRC-20
bun scripts/migration/validate-grc20-mint-readiness.ts

# Step 5: Mint to GRC-20 (lens_handle now required)
cd ../grc20-integration
bun import-artists.ts
```

### For TikTok Creators (Video Creators)

```bash
# Step 1: Mint PKPs for creators
bun src/processors/mint-creator-pkps.ts --limit=20

# Step 2: Create Lens accounts for creators
bun src/processors/create-creator-lens.ts --limit=20

# Step 3: Mint TikTok videos to Story Protocol
# (uses creator PKP/Lens accounts for 18% revenue split)
bun src/processors/mint-story-ip-assets.ts
```

## Processors

### `mint-artist-pkps.ts`

**Input**: Artists from `spotify_artists` without PKPs
**Process**:
1. Query artists without PKPs
2. Initialize Lit Protocol client (Chronicle Yellowstone)
3. Mint PKP for each artist
4. Insert into `pkp_accounts` table
5. Log PKP address and transaction hash

**Output**: PKP data in `pkp_accounts` table

### `create-artist-lens.ts`

**Input**: Artists with PKPs but no Lens accounts
**Process**:
1. Query artists with PKP but no Lens
2. Generate Lens handle from artist name (sanitized)
3. Build metadata JSON with all identifiers (ISNI, Spotify, MBID, social handles)
4. Upload metadata to Grove/IPFS
5. Create Lens account with username
6. Insert into `lens_accounts` table
7. Log Lens handle, address, and metadata URI

**Output**: Lens account data in `lens_accounts` table

### `mint-creator-pkps.ts`

**Input**: TikTok creators from `tiktok_creators` without PKPs
**Process**: Same as artist PKPs, but uses `tiktok_handle` as join key
**Output**: PKP data in `pkp_accounts` + update to `tiktok_creators.pkp_address`

### `create-creator-lens.ts`

**Input**: TikTok creators with PKPs but no Lens
**Process**: Same as artist Lens, but uses TikTok handle directly as Lens handle
**Output**: Lens data in `lens_accounts` + updates to `tiktok_creators`

## Updated Population Script

`scripts/migration/populate-grc20-artists.ts` now includes:

```typescript
// 6. PKP - Lit Protocol PKP data
const pkp = await query(`
  SELECT pkp_address, pkp_token_id, pkp_public_key, minted_at
  FROM pkp_accounts
  WHERE spotify_artist_id = $1 AND account_type = 'artist'
`);

if (pkp[0]) {
  agg.pkpAddress = pkp[0].pkp_address;
  agg.pkpTokenId = pkp[0].pkp_token_id;
  console.log(`   ✅ PKP: ${agg.pkpAddress}`);
}

// 7. LENS - Lens Protocol account data
const lens = await query(`
  SELECT lens_handle, lens_account_address, lens_metadata_uri
  FROM lens_accounts
  WHERE spotify_artist_id = $1 AND account_type = 'artist'
`);

if (lens[0]) {
  agg.lensHandle = lens[0].lens_handle;
  agg.lensAccountAddress = lens[0].lens_account_address;
  console.log(`   ✅ Lens: @${agg.lensHandle}`);
}
```

**Summary Stats**:
```
Web3 Accounts:
  PKP: 106 (100%)
  Lens: 106 (100%)
```

## Updated GRC-20 Mint Requirements

`src/schemas/grc20-artist-mint.ts` now requires:

```typescript
export const GRC20ArtistMintSchema = z.object({
  // ... existing fields ...

  // NEW: Required for Web3 integration
  pkp_address: z.string().min(1, 'PKP address required'),
  lens_handle: z.string().min(1, 'Lens handle required'),
  lens_account_address: z.string().min(1, 'Lens account address required'),

  // ... rest of schema ...
});
```

**Mint Readiness Query**:
```sql
WHERE grc20_entity_id IS NULL  -- Not yet minted
  AND image_url IS NOT NULL     -- Has Grove image (REQUIRED)
  AND pkp_address IS NOT NULL   -- Has PKP (REQUIRED)
  AND lens_handle IS NOT NULL   -- Has Lens account (REQUIRED)
```

**Mint Stats**:
```sql
COUNT(*) FILTER (WHERE pkp_address IS NULL) as blocked_missing_pkp,
COUNT(*) FILTER (WHERE lens_handle IS NULL) as blocked_missing_lens
```

## Utility Libraries

### `src/lib/lit-protocol.ts`

**Functions**:
- `initLitClient()` - Initialize Lit Protocol client (Naga Dev network)
- `createLitWalletClient()` - Create wallet client from PRIVATE_KEY
- `mintPKP()` - Mint a new PKP on Chronicle Yellowstone

**Returns**:
```typescript
{
  pkpAddress: Address;
  pkpTokenId: string;
  pkpPublicKey: string;
  ownerEOA: Address;
  transactionHash: Hex;
}
```

### `src/lib/lens-protocol.ts`

**Functions**:
- `initLensClient()` - Initialize Lens SDK client (testnet)
- `initGroveClient()` - Initialize Grove storage client
- `createLensWalletClient()` - Create wallet client for Lens
- `sanitizeHandle(name)` - Convert name to valid Lens handle
- `createLensAccount(params)` - Create Lens account with metadata

**Returns**:
```typescript
{
  lensHandle: string;
  lensAccountAddress: Address;
  lensAccountId: Hex;
  metadataUri: string;  // Grove URI
  transactionHash: Hex;
}
```

## Grove Metadata Structure

### Artist Lens Metadata (`lens://...`) - MINIMAL APPROACH

**Philosophy**: Lens metadata only stores the **reference to GRC-20**, not the identifiers themselves. This maintains a single source of truth and avoids data duplication.

```json
{
  "name": "Ariana Grande",
  "bio": "Official Karaoke School profile for Ariana Grande",
  "picture": "https://api.grove.storage/QmXYZ...",
  "attributes": [
    { "type": "String", "key": "pkpAddress", "value": "0x1234..." },
    { "type": "String", "key": "accountType", "value": "music-artist" },
    { "type": "String", "key": "grc20EntityId", "value": "f1d7f4c7-ca47-4ba3-9875-a91720459ab4" }
  ]
}
```

**How to get full artist data:**
1. Query Lens account → get `grc20EntityId` from attributes
2. Query GRC-20 Graph → get ALL identifiers (ISNI, ISRC, ISWC, Spotify, MusicBrainz, social handles, etc.)

**Benefits:**
- **~85% smaller metadata files** (3 attributes vs 8+)
- **Single source of truth** (GRC-20 has all identifiers)
- **No sync issues** (ISNI changes? Update GRC-20 only)
- **Standards-based** (GRC-20 is the industry metadata layer)

### TikTok Creator Lens Metadata - MINIMAL APPROACH

**Note**: TikTok creators don't have GRC-20 entities (only artists do), so metadata is even simpler.

```json
{
  "name": "gioscottii",
  "bio": "TikTok creator @gioscottii on Karaoke School",
  "attributes": [
    { "type": "String", "key": "pkpAddress", "value": "0x5678..." },
    { "type": "String", "key": "accountType", "value": "tiktok-creator" },
    { "type": "String", "key": "tiktokHandle", "value": "gioscottii" }
  ]
}
```

**Benefits:**
- **Only 3 attributes** (vs 5+ before)
- **No redundant data** (follower count, sec_uid stored in Neon DB only)
- **Clean creator identity** for Story Protocol revenue splits

## Benefits

### For Artists
- **Immutable identity** via Lens handle (can't be changed by Spotify, etc.)
- **Claimable account** via TikTok OAuth (artists can claim their PKP)
- **Cross-platform identity** (same Lens handle across all Web3 apps)
- **Metadata preservation** (all identifiers stored in Grove/IPFS)

### For TikTok Creators
- **Revenue splits** via Story Protocol (18% for derivative works)
- **Account ownership** via PKP (not controlled by TikTok)
- **Cross-platform presence** (Lens account works everywhere)
- **Monetization** (automatic royalties when videos are used)

### For the Platform
- **Decentralized identity** (not dependent on Web2 platforms)
- **Future-proof** (identifiers work even if Spotify/Genius shut down)
- **Interoperable** (Lens accounts work across all Lens apps)
- **Programmable** (PKPs enable advanced features like multi-sig, automation)

## Dependencies Required

Add to `karaoke-pipeline/package.json`:

```json
{
  "dependencies": {
    "@lens-chain/sdk": "^1.0.3",
    "@lens-chain/storage-client": "^1.0.6",
    "@lens-protocol/client": "^0.0.0-canary-20250430134539",
    "@lens-protocol/metadata": "^2.1.0",
    "@lit-protocol/lit-client": "8.0.2",
    "@lit-protocol/networks": "8.0.2",
    "viem": "^2.21.54"
  }
}
```

## Environment Variables

Required in `.env`:

```bash
# Lit Protocol (Chronicle Yellowstone)
PRIVATE_KEY=0x...  # EOA private key for minting PKPs and creating Lens accounts

# Lens Protocol
# (Uses PRIVATE_KEY above)
```

## Future Enhancements

1. **TikTok OAuth Claiming**: Allow artists/creators to claim their PKP via TikTok login
2. **Multi-sig PKPs**: Enable multiple signers for shared accounts (bands, etc.)
3. **Automated metadata updates**: Sync social handles from Lens to grc20_artists
4. **Lens posts**: Publish karaoke segments as Lens posts
5. **Story Protocol integration**: Mint TikTok videos as derivative IP assets

## Troubleshooting

**Missing PKPs**:
```bash
# Check how many artists need PKPs
SELECT COUNT(*) FROM spotify_artists sa
LEFT JOIN pkp_accounts pkp ON sa.spotify_artist_id = pkp.spotify_artist_id
WHERE pkp.pkp_address IS NULL;

# Mint them
bun src/processors/mint-artist-pkps.ts --limit=50
```

**Missing Lens Accounts**:
```bash
# Check how many artists have PKP but no Lens
SELECT COUNT(*) FROM pkp_accounts pkp
LEFT JOIN lens_accounts lens ON pkp.spotify_artist_id = lens.spotify_artist_id
WHERE pkp.account_type = 'artist' AND lens.lens_handle IS NULL;

# Create them
bun src/processors/create-artist-lens.ts --limit=50
```

**Validation**:
```bash
# Check GRC-20 mint readiness
bun scripts/migration/validate-grc20-mint-readiness.ts

# Should show:
# Ready to mint: <count>
# Blocked (missing PKP): 0
# Blocked (missing Lens): 0
```

## Notes

- PKP minting costs gas on Chronicle Yellowstone (get test tokens from faucet)
- Lens account creation costs gas on Lens testnet
- Grove uploads are ~$0.01 per MB (metadata is typically <1KB)
- Lens handles are permanent and cannot be changed
- PKPs can be transferred but current implementation uses fixed EOA owner
