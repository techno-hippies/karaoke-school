# Artist Profile Integration Guide

## Overview

This guide documents the integration of on-demand artist profile generation into the frontend, eliminating the static `artist-mapping.ts` file in favor of dynamic contract lookups.

## Architecture

### Current System (Before)

```
User visits /u/gracieabrams
    ↓
Static mapping lookup: GENIUS_TO_LENS_USERNAME[631746] = "tehegracietehe"
    ↓
Fetch Lens account by username
    ↓
Extract genius_artist_id from metadata
    ↓
Show profile
```

**Problem**: Static mapping file requires manual updates for each new artist.

### New System (After)

```
User visits /u/gracieabrams
    ↓
Contract lookup: getGeniusIdByLensHandle("tehegracietehe") → 631746
    ↓
Fetch Lens account by username
    ↓
Extract genius_artist_id from metadata
    ↓
Show profile

---

User visits /u/newartist (doesn't exist yet)
    ↓
Contract lookup: getGeniusIdByLensHandle("newartist") → 0 (not found)
    ↓
Lens account lookup fails
    ↓
Show "Artist not available" message
    ↓
[FUTURE] Add search to find artist + generate profile button
```

## Files Created

### 1. `app/src/lib/genius/artist-lookup.ts`

**Purpose**: Replace static mapping with contract-based lookups

**Key Functions**:

```typescript
// Check if artist has a registered profile
async function hasLensProfile(geniusArtistId: number): Promise<boolean>

// Get Lens username for artist
async function getLensUsername(geniusArtistId: number): Promise<string | null>

// Get best route for artist
async function getArtistRoute(geniusArtistId: number): Promise<string>

// Reverse lookup: username → geniusId
async function getGeniusIdByUsername(username: string): Promise<number>

// Get full artist data from contract
async function getArtistByGeniusId(geniusArtistId: number)

// Batch check multiple artists
async function batchCheckArtists(geniusArtistIds: number[]): Promise<Map<number, boolean>>
```

**Contract**: `ArtistRegistryV2` at `0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7` (Base Sepolia)

**Example Usage**:

```typescript
import { hasLensProfile, getLensUsername, getArtistRoute } from '@/lib/genius/artist-lookup'

// Check if artist has profile
const hasProfile = await hasLensProfile(447) // true (Lady Gaga)

// Get username
const username = await getLensUsername(447) // "ladygaga"

// Get route
const route = await getArtistRoute(447) // "/u/ladygaga"

// Reverse lookup
const geniusId = await getGeniusIdByUsername("ladygaga") // 447
```

### 2. `app/src/lib/lit/actions/generate-profile.ts`

**Purpose**: Execute Lit Action to generate artist profiles on-demand

**Function**:

```typescript
async function executeGenerateProfile(
  geniusArtistId: number,
  authContext: PKPAuthContext
): Promise<GenerateProfileResult>
```

**Example Usage**:

```typescript
import { executeGenerateProfile } from '@/lib/lit/actions'
import { useAuth } from '@/contexts/AuthContext'

const { pkpAuthContext } = useAuth()

// Generate profile for Gracie Abrams
const result = await executeGenerateProfile(631746, pkpAuthContext)

if (result.success) {
  console.log('Profile ready:', result.lensHandle) // "tehegracietehe"
  console.log('PKP address:', result.pkpAddress)
  console.log('Has content:', result.hasContent)

  if (result.contentGenerating) {
    console.log('Videos processing in background...')
    // Listen for ContentFlagUpdated(631746, true) event
  }
}
```

### 3. Updated Type Definitions

**File**: `app/src/lib/lit/actions/types.ts`

**New Type**: `GenerateProfileResult`

```typescript
interface GenerateProfileResult {
  success: boolean
  source: 'CACHED' | 'GENERATED'
  profileReady: boolean
  contentGenerating: boolean
  geniusArtistId?: number
  artistName?: string
  pkpAddress?: string
  pkpTokenId?: string
  lensHandle?: string
  lensAccountAddress?: string
  hasContent?: boolean
  registryTxHash?: string
  message?: string
  nextSteps?: string[]
  // ... more fields
}
```

### 4. Updated Config

**File**: `app/src/config/lit-actions.ts`

**New Entry**:

```typescript
generateProfile: {
  cid: 'PLACEHOLDER_NOT_DEPLOYED_YET',
  name: 'Generate Artist Profile v2',
  source: 'lit-actions/src/artist/generate-profile-v2.js',
  deployedAt: undefined,
}
```

**Status**: ⚠️ **NOT YET DEPLOYED** - Will throw error until Lit Action is deployed to IPFS

## Deployment Steps

### Step 1: Deploy Lit Action to IPFS

```bash
cd lit-actions

# Deploy generate-profile-v2.js
DOTENV_PRIVATE_KEY=<your-key> dotenvx run -- \
  node scripts/upload-lit-action.mjs \
  src/artist/generate-profile-v2.js \
  "Generate Artist Profile v2"

# Output:
# ✅ Uploaded to IPFS: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Step 2: Update Frontend Config

Edit `app/src/config/lit-actions.ts`:

```typescript
generateProfile: {
  cid: 'QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // Replace with actual CID
  name: 'Generate Artist Profile v2',
  source: 'lit-actions/src/artist/generate-profile-v2.js',
  deployedAt: '2025-10-19',
}
```

### Step 3: Test End-to-End

```bash
# Test with existing artist (cached)
cd lit-actions
DOTENV_PRIVATE_KEY=<key> dotenvx run -- \
  bun run src/test/test-generate-profile-v2.mjs 447

# Expected: Returns cached data immediately

# Test with new artist (generation)
DOTENV_PRIVATE_KEY=<key> dotenvx run -- \
  bun run src/test/test-generate-profile-v2.mjs <new-artist-id>

# Expected: Generates new profile (~15-30s)
```

## Migration Plan

### Phase 1: Deploy Contract Lookups ✅ COMPLETE

- ✅ Created `artist-lookup.ts` with contract integration
- ✅ Created `executeGenerateProfile()` Lit Action wrapper
- ✅ Added type definitions
- ✅ Updated config (placeholder CID)

### Phase 2: Deploy Lit Action (NEXT)

```bash
# 1. Deploy to IPFS
cd lit-actions
./scripts/deploy-lit-action.sh \
  src/artist/generate-profile-v2.js \
  "Generate Artist Profile v2"

# 2. Add PKP permission
bun run scripts/add-pkp-permission.mjs <CID>

# 3. Update app/src/config/lit-actions.ts with real CID

# 4. Test with existing artists (cached path)
bun run src/test/test-generate-profile-v2.mjs 447
bun run src/test/test-generate-profile-v2.mjs 1177

# 5. Test with new artist (generation path) - requires valid Genius artist ID
```

### Phase 3: Update Frontend Code

**Files to Update**:

1. **Anywhere using `artist-mapping.ts`**:

   Replace:
   ```typescript
   import { getLensUsername } from '@/lib/genius/artist-mapping'
   const username = getLensUsername(geniusArtistId)
   ```

   With:
   ```typescript
   import { getLensUsername } from '@/lib/genius/artist-lookup'
   const username = await getLensUsername(geniusArtistId)
   ```

2. **Song cards, artist links, navigation**:

   Replace:
   ```typescript
   import { getArtistRoute } from '@/lib/genius/artist-mapping'
   navigate(getArtistRoute(geniusArtistId))
   ```

   With:
   ```typescript
   import { getArtistRoute } from '@/lib/genius/artist-lookup'
   const route = await getArtistRoute(geniusArtistId)
   navigate(route)
   ```

3. **ProfilePage.tsx** (Future Enhancement):

   Add profile generation capability:
   ```typescript
   const [isGenerating, setIsGenerating] = useState(false)

   // Check contract when Lens account not found
   useEffect(() => {
     if (!accountLoading && !account && username) {
       getGeniusIdByUsername(username).then(geniusId => {
         if (geniusId > 0) {
           // Artist registered but Lens not synced - retry
           setTimeout(() => accountResult.refetch?.(), 2000)
         } else {
           // Not registered - could add "Generate Profile" button
         }
       })
     }
   }, [accountLoading, account, username])
   ```

### Phase 4: Delete Static Mapping

```bash
# Once all usages updated, delete the file
rm app/src/lib/genius/artist-mapping.ts

# Search for any remaining references
grep -r "artist-mapping" app/src/
```

## Edge Cases Handled

### 1. **Race Condition: Profile Registered but Lens Not Synced**

**Scenario**: User visits `/u/newartist` → Lit Action creates profile → Contract updated → But Lens account not yet propagated

**Solution**:
- ProfilePage checks contract: `getGeniusIdByUsername("newartist")` returns `geniusId > 0`
- Retry fetching Lens account after 2s delay
- Show loading state: "Profile being created..."

### 2. **Duplicate Generation: Multiple Users Visit Simultaneously**

**Scenario**: 5 users visit `/u/newartist` at same time

**Solution**:
- Lit Action checks contract FIRST (lines 56-111 in generate-profile-v2.js)
- Render service also checks contract before creating PKP
- `Lit.Actions.runOnce()` ensures only ONE Lit node calls Render
- Idempotent: Re-running returns cached data

### 3. **Invalid Artist: User Visits `/u/doesntexist`**

**Scenario**: User types random URL

**Solution**:
- Contract lookup: `getGeniusIdByUsername("doesntexist")` returns `0`
- Lens account lookup fails
- Show error: "Artist profile not available"
- Future: Add search to find correct artist

### 4. **Profile Exists but No Content: `hasContent = false`**

**Scenario**: Profile created but videos still processing

**Solution**:
- Show profile immediately (name, photo, top songs from Genius)
- Display banner: "Videos coming soon..."
- Listen for `ContentFlagUpdated(geniusId, true)` event
- When event received, refresh page to load videos

### 5. **Generation Fails: Render Service Error**

**Scenario**: Genius API down, network error, etc.

**Solution**:
- Lit Action returns `success: false` with error message
- Show error to user with retry button
- Log to console for debugging

## Benefits

### Before (Static Mapping)

- ❌ Manual updates required for each artist
- ❌ Separate pipeline script must be run
- ❌ No on-demand profile creation
- ❌ Static file grows indefinitely
- ❌ No version control of artist list

### After (Contract Lookups + On-Demand)

- ✅ Fully automated - no manual updates
- ✅ On-demand profile generation via Lit Action
- ✅ Contract is single source of truth
- ✅ Scalable - supports unlimited artists
- ✅ Transparent - all registrations on-chain
- ✅ Future-proof - can add Genius search UI

## Performance

### Contract Lookup Performance

```typescript
// Single lookup
await getLensUsername(447) // ~100ms (Base Sepolia RPC)

// Batch lookup (better for lists)
const results = await batchCheckArtists([447, 1177, 18722]) // ~150ms
```

**Optimization**: Frontend should cache results in React Query or similar

### Profile Generation Performance

```
Cached profile (already exists):  <1s
New profile generation:           15-30s
├─ PKP mint:                     ~5s
├─ Lens account creation:        ~5s
├─ Contract registration:        ~3s
└─ Background video pipeline:    5-10 minutes (async)
```

## Next Steps

1. **Deploy Lit Action** (see Step 1 above)
2. **Update config** with real CID (see Step 2 above)
3. **Test end-to-end** (see Step 3 above)
4. **Update frontend code** to use `artist-lookup.ts` instead of `artist-mapping.ts`
5. **Add search UI** for finding new artists (future enhancement)
6. **Add profile generation button** in ProfilePage (future enhancement)
7. **Delete** `artist-mapping.ts` when all references updated

## Testing Checklist

- [ ] Deploy Lit Action to IPFS
- [ ] Add PKP permission for CID
- [ ] Update `lit-actions.ts` config with real CID
- [ ] Test with existing artist (447 - Lady Gaga) → Returns cached
- [ ] Test with existing artist (1177 - Taylor Swift) → Returns cached
- [ ] Test with invalid artist ID → Returns error
- [ ] Update song cards to use async `getArtistRoute()`
- [ ] Update navigation links to use async lookups
- [ ] Test ProfilePage with registered artist → Works
- [ ] Test ProfilePage with unregistered username → Shows error
- [ ] Add contract lookup retry logic to ProfilePage
- [ ] Delete `artist-mapping.ts`
- [ ] Verify no references to `artist-mapping` remain

## Questions?

- **Where is the Render service?** `https://artist-profile-service.onrender.com`
- **How to check Render logs?** MCP Render tool: `mcp__render__list_logs`
- **How to test locally?** Use test script: `bun run src/test/test-generate-profile-v2.mjs`
- **What if generation fails?** Check Render logs, Genius API status, contract state
- **Can I force regenerate?** No - profiles are immutable once created. Can update via `updateArtist()` owner function.
