# ArtistRegistry

**Authoritative registry mapping Genius artist IDs to PKP addresses and Lens profiles**

## Versions

### V2 (Current) - `0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7`
**Improvements**:
- ✅ Fixed `updateArtist()` to check for mapping collisions before updating
- ✅ Added `lensAccountAddress != address(0)` validation
- ✅ Improved NatSpec documentation

**Use this version for all new integrations.**

### V1 (Deprecated) - `0x8370c98114B52ea294ABd65ACF113414B38525d0`
**Status**: ⚠️ **DEPRECATED** - Use V2 instead
**Bug**: `updateArtist()` doesn't validate new PKP/handle aren't already in use, causing mapping collisions

## Overview

ArtistRegistry creates parity between:
- **Genius artist pages** (`/artist/:geniusId`) - Basic metadata via Lit Action
- **PKP-Lens pipeline profiles** (`/u/:lensHandle`) - Full profiles with videos, subscriptions, etc.

The registry acts as a bridge, redirecting users from Genius artist pages to rich Lens profiles when available.

## Design Philosophy

### Minimal On-Chain Storage
Store only the **mapping** on-chain:
```solidity
struct Artist {
    uint32 geniusArtistId;      // Primary key
    address pkpAddress;          // PKP Ethereum address
    string lensHandle;           // Lens username (e.g. "taylorswifttiktok")
    address lensAccountAddress;  // Lens account contract address
    ProfileSource source;        // MANUAL or GENERATED
    bool verified;               // Platform verification
    bool hasContent;             // Has posts on Lens
    uint64 createdAt;
    uint64 updatedAt;
}
```

**Gas cost:** ~150k gas per artist = **$1-2 on Base mainnet** (vs $50k-100k for full on-chain)

### Rich Metadata in Lens Account Metadata

Store comprehensive artist data in **Lens Account Metadata** (on Grove):

```typescript
attributes: [
  // Industry Identifiers
  { key: "genius_artist_id", type: MetadataAttributeType.NUMBER, value: "1177" },
  { key: "isni", type: MetadataAttributeType.STRING, value: "0000000078519858" },
  { key: "ipi", type: MetadataAttributeType.STRING, value: "00454808243" },
  { key: "ipn", type: MetadataAttributeType.STRING, value: "..." },
  { key: "spotify_id", type: MetadataAttributeType.STRING, value: "06HL4z0CvFAxyc27GXpf02" },
  { key: "apple_music_id", type: MetadataAttributeType.STRING, value: "159260351" },
  { key: "amazon_music_id", type: MetadataAttributeType.STRING, value: "B002CKCNPQ" },
  { key: "deezer_id", type: MetadataAttributeType.STRING, value: "..." },
  { key: "musicbrainz_id", type: MetadataAttributeType.STRING, value: "..." },
  { key: "wikidata_id", type: MetadataAttributeType.STRING, value: "Q26876" },
  { key: "discogs_id", type: MetadataAttributeType.STRING, value: "..." },

  // Social Handles
  { key: "tiktok_handle", type: MetadataAttributeType.STRING, value: "@taylorswift" },
  { key: "twitter_handle", type: MetadataAttributeType.STRING, value: "@taylorswift13" },
  { key: "instagram_handle", type: MetadataAttributeType.STRING, value: "@taylorswift" },
  { key: "soundcloud_handle", type: MetadataAttributeType.STRING, value: "..." },

  // Personal Information
  { key: "date_of_birth", type: MetadataAttributeType.DATE, value: "1989-12-13T00:00:00Z" },
  { key: "nationality", type: MetadataAttributeType.STRING, value: "United States" },
  { key: "birthplace", type: MetadataAttributeType.STRING, value: "..." },
]
```

**Queryable via:** Lens GraphQL API
**Storage:** Grove (decentralized, permanent)
**Cost:** Free (part of Lens account creation)

## Architecture

### V1: Manual Pipeline (Current)

```
1. Mint PKP (01-mint-pkp.ts)
2. Create Lens account (06-create-lens-account.ts)
3. Register in contract (08-register-in-contract.ts) ← NEW
```

Artists manually onboarded through `pkp-lens-flow` pipeline.

### V2: Generative/On-Demand (Future)

```
User visits /artist/1177
    ↓
Check registry contract
    ↓
NOT FOUND → Trigger Lit Action
    ↓
Lit Action → POST webhook
    ↓
Backend job:
  - Mint PKP
  - Create Lens account with rich metadata
  - Register in contract
    ↓
Return Lens handle
    ↓
Redirect to /u/:lensHandle
```

Scales to **10,000+ artists** without manual work.

## Deployment

### 1. Deploy Contract (V2)

```bash
cd contracts/evm/base-sepolia/ArtistRegistry

# Deploy V2 to Base Sepolia
DOTENV_PRIVATE_KEY=<key> dotenvx run -f ../../../.env -- \
  forge script script/DeployArtistRegistryV2.s.sol:DeployArtistRegistryV2 \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
```

**Latest Deployment:**
- **V2 Address:** `0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7`
- **Verified:** https://sepolia.basescan.org/address/0x81ce49c16d2bf384017c2bca7fddacb8a15decc7

### 2. Set Environment Variable (Optional)

Contract addresses are hardcoded in code with fallback to env vars:

```bash
# In contracts/.env (optional override)
ARTIST_REGISTRY_ADDRESS=0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7

# In app/.env (optional override)
VITE_ARTIST_REGISTRY_ADDRESS=0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7
```

### 3. Register Existing Artists

```bash
cd pkp-lens-flow

# For each manually onboarded artist
bun run local/08-register-in-contract.ts --creator @taylorswift
bun run local/08-register-in-contract.ts --creator @billieeilish
bun run local/08-register-in-contract.ts --creator @selenagomez
bun run local/08-register-in-contract.ts --creator @beyonce
bun run local/08-register-in-contract.ts --creator @grimes
# ... etc
```

### 4. Deploy Frontend

Frontend will automatically check registry and redirect to Lens profiles.

## Frontend Integration

### Automatic Redirect

`ClassArtistPage.tsx` now checks the registry on mount:

```typescript
const lensProfileUrl = useArtistProfileUrl(artistId)

useEffect(() => {
  if (lensProfileUrl) {
    // Artist has full Lens profile - redirect
    navigate(lensProfileUrl, { replace: true })
  }
}, [lensProfileUrl, navigate])
```

**User experience:**
- User visits `/artist/1177` (Taylor Swift's Genius ID)
- Registry found → Redirect to `/u/taylorswifttiktok`
- User sees full Lens profile with videos, subscriptions, etc.

### Hooks

**`useArtistExists(geniusId)`**
- Check if artist is registered
- Returns: `boolean`

**`useArtistLensHandle(geniusId)`**
- Get Lens handle for artist
- Returns: `string | null`

**`useArtistRegistry(geniusId)`**
- Get full artist data from contract
- Returns: `RegistryArtist | null`

**`useArtistProfileUrl(geniusId)`**
- Get Lens profile URL
- Returns: `string | null` (e.g. "/u/taylorswifttiktok")

## Contract Functions

### Registration

```solidity
function registerArtist(
    uint32 geniusArtistId,
    address pkpAddress,
    string calldata lensHandle,
    address lensAccountAddress,
    ProfileSource source  // MANUAL or GENERATED
) external onlyRegistrar
```

### Queries

```solidity
function getArtist(uint32 geniusArtistId) external view returns (Artist memory)
function artistExists(uint32 geniusArtistId) external view returns (bool)
function getLensHandle(uint32 geniusArtistId) external view returns (string memory)
function getPKPAddress(uint32 geniusArtistId) external view returns (address)

// Reverse lookups
function getGeniusIdByPKP(address pkpAddress) external view returns (uint32)
function getGeniusIdByLensHandle(string calldata lensHandle) external view returns (uint32)

// Batch queries
function artistsExist(uint32[] calldata geniusArtistIds) external view returns (bool[] memory)
```

### Admin

```solidity
function setVerified(uint32 geniusArtistId, bool verified) external onlyOwner
function setHasContent(uint32 geniusArtistId, bool hasContent) external onlyRegistrar
function setRegistrar(address registrar, bool authorized) external onlyOwner
```

## Events (Subgraph-Ready)

```solidity
event ArtistRegistered(
    uint32 indexed geniusArtistId,
    address indexed pkpAddress,
    string lensHandle,
    address lensAccountAddress,
    ProfileSource source
)

event ArtistUpdated(uint32 indexed geniusArtistId, address indexed pkpAddress, string lensHandle)
event ArtistVerified(uint32 indexed geniusArtistId, bool verified)
event ContentFlagUpdated(uint32 indexed geniusArtistId, bool hasContent)
```

## Data Sources

### MusicBrainz
Primary source for industry identifiers:
- ISNI (International Standard Name Identifier)
- IPI (Interested Parties Information)
- IPN (International Performer Number)
- Spotify ID
- Apple Music ID
- Amazon Music ID
- Deezer ID
- Discogs ID
- Wikidata ID

Example: [Taylor Swift on MusicBrainz](https://musicbrainz.org/artist/20244d07-534f-4eff-b4d4-930878889970)

### Genius API
- Artist name, bio, image
- Top songs
- Song metadata

### TikTok/Social APIs
- Profile photos
- Handles
- Bio/description

## Future Enhancements

### V2: Generative Profiles

1. **Lit Action Trigger**
   - User visits `/artist/:geniusId`
   - Registry check fails
   - Call Lit Action with `geniusId`

2. **Webhook Server**
   - Receive webhook from Lit Action
   - Start background job (non-GPU server)

3. **Background Job**
   - Fetch data from MusicBrainz, Genius, etc.
   - Mint PKP (using Master PKP)
   - Create Lens account with rich metadata
   - Register in contract
   - Return Lens handle

4. **Frontend Polling**
   - Poll registry every 5 seconds
   - Redirect to `/u/:lensHandle` when ready

**Estimated time:** 30-60 seconds (similar to song processing)

### The Graph Subgraph

Deploy subgraph to index registry events for advanced queries:

```graphql
query GetArtists($limit: Int!, $source: ProfileSource) {
  artists(
    first: $limit
    where: { source: $source }
    orderBy: createdAt
    orderDirection: desc
  ) {
    geniusArtistId
    pkpAddress
    lensHandle
    verified
    hasContent
    createdAt
  }
}
```

## Cost Analysis

### On-Chain Storage (Current Design)

- **Per artist:** ~150k gas
- **Base mainnet @ 0.1 gwei:** ~$0.015
- **10,000 artists:** ~$150

### Alternative: Full On-Chain Storage

If we stored all identifiers on-chain:
- **Per artist:** ~3M gas (20+ string storage slots)
- **Base mainnet @ 0.1 gwei:** ~$3
- **10,000 artists:** ~$30,000

**Savings: 200x cheaper with Lens metadata approach**

### Lens Account Metadata

- **Storage cost:** $0 (included in Lens account)
- **Query cost:** $0 (GraphQL API)
- **Scalability:** Unlimited attributes

## Changelog

### V2 (2025-01-19) - Current
**Deployed:** `0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7`

**Bug Fixes:**
- Fixed critical bug in `updateArtist()` that didn't check for mapping collisions
  - **Issue:** Updating artist A to use PKP/handle already owned by artist B would overwrite B's reverse lookup, orphaning their data
  - **Fix:** Added collision checks before setting new reverse lookups
- Added validation that `lensAccountAddress != address(0)` in both `registerArtist()` and `updateArtist()`

**Improvements:**
- Enhanced NatSpec comments to document collision prevention
- Added explicit validation error messages

### V1 (2025-01-19) - Deprecated
**Deployed:** `0x8370c98114B52ea294ABd65ACF113414B38525d0`
**Status:** ⚠️ **DEPRECATED** - Do not use for new integrations

**Known Issues:**
- `updateArtist()` allows mapping collisions (see V2 fix above)

## File Structure

```
contracts/evm/base-sepolia/ArtistRegistry/
  ├── ArtistRegistryV1.sol           # Deprecated - bug in updateArtist()
  ├── ArtistRegistryV2.sol           # Current - collision fix
  ├── script/
  │   ├── DeployArtistRegistryV1.s.sol
  │   └── DeployArtistRegistryV2.s.sol
  └── README.md                      # This file

pkp-lens-flow/local/
  └── 08-register-in-contract.ts     # Registration script (uses V2)

app/src/hooks/
  └── useArtistRegistry.ts           # Frontend hooks (uses V2)

app/src/pages/
  └── ClassArtistPage.tsx            # Redirect logic
```

## Testing

### 1. Deploy Contract

```bash
forge script script/DeployArtistRegistryV1.s.sol:DeployArtistRegistryV1 \
  --rpc-url https://sepolia.base.org \
  --broadcast
```

### 2. Register Test Artist

```bash
bun run local/08-register-in-contract.ts --creator @taylorswift
```

### 3. Test Frontend

Visit `http://localhost:5173/#/artist/1177`

Should redirect to `http://localhost:5173/#/u/taylorswifttiktok`

### 4. Verify Registry

```bash
cast call $ARTIST_REGISTRY_ADDRESS \
  "artistExists(uint32)" 1177 \
  --rpc-url https://sepolia.base.org
```

## Contributing

### Adding New Identifiers

To add new identifier types (e.g. Beatport ID):

1. **Add to Lens metadata** in `06-create-lens-account.ts`:
```typescript
attributes.push({
  type: 'String',
  key: 'beatport_id',
  value: profileData.beatportId,
});
```

2. **No contract changes needed** - data lives in Lens metadata

3. Query via Lens GraphQL:
```graphql
query {
  account(request: { username: { localName: "taylorswifttiktok" } }) {
    metadata {
      attributes {
        key
        value
      }
    }
  }
}
```

## License

MIT
