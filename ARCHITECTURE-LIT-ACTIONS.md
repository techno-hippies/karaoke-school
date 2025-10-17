# Lit Actions Architecture: Config vs Environment Variables

## Problem

Previously, Lit Action CIDs were stored **only** in `.env.local`:
- ❌ Not version controlled (gitignored)
- ❌ Easy to lose/corrupt
- ❌ Deploy script modifies one var at a time
- ❌ No type safety
- ❌ No IDE autocomplete
- ❌ Incomplete `.env.example` (only 3 of 8 CIDs)

## Solution

Moved to **TypeScript config file** (`src/config/lit-actions.ts`):
- ✅ Version controlled (committed to git)
- ✅ Single source of truth
- ✅ Type-safe access
- ✅ IDE autocomplete
- ✅ Deployment history tracked
- ✅ Environment variable overrides still supported

## Architecture Decision

### Config File (Recommended)
Use for **deployment artifacts** that rarely change:
- Contract addresses
- Lit Action CIDs (IPFS hashes)
- Network configurations
- Feature flags

### Environment Variables
Use for **secrets** and **per-developer overrides**:
- API keys (Genius, OpenRouter, ElevenLabs)
- Private keys
- Local development overrides

## Migration Status

### ✅ Completed
1. Created `src/config/lit-actions.ts` with centralized CID management
2. Updated `search.ts` to use config instead of env vars
3. Updated `.env.example` to document new pattern
4. Updated `.env.local` with all required vars (using placeholders)

### ⚠️  TODO: Deploy Missing Lit Actions

These need to be deployed to get their CIDs:

```bash
cd lit-actions

# 1. Song metadata (Genius API)
./scripts/deploy-lit-action.sh \
  src/genius/song.js \
  "Song Metadata v1" \
  VITE_LIT_ACTION_SONG

# 2. Artist metadata (Genius API)
./scripts/deploy-lit-action.sh \
  src/genius/artist.js \
  "Artist Metadata v1" \
  VITE_LIT_ACTION_ARTIST

# 3. Base alignment (Karaoke)
./scripts/deploy-lit-action.sh \
  src/karaoke/base-alignment-v2.js \
  "Base Alignment v2" \
  VITE_LIT_ACTION_BASE_ALIGNMENT

# 4. Audio processor (Karaoke)
./scripts/deploy-lit-action.sh \
  src/karaoke/audio-processor-v4.js \
  "Audio Processor v4" \
  VITE_LIT_ACTION_AUDIO_PROCESSOR

# 5. Translate lyrics (Karaoke)
./scripts/deploy-lit-action.sh \
  src/karaoke/translate-lyrics-v1.js \
  "Translate Lyrics v1" \
  VITE_LIT_ACTION_TRANSLATE
```

After each deployment:
1. Script uploads to IPFS → outputs CID
2. **Manually update `src/config/lit-actions.ts`** with the new CID
3. Commit the updated config file
4. Script also updates `.env.local` (for backward compatibility during migration)

### 📝 TODO: Update Remaining Files

Update these files to import from config instead of env vars:

```typescript
// ❌ OLD
import.meta.env.VITE_LIT_ACTION_SONG

// ✅ NEW
import { LIT_ACTIONS } from '@/config/lit-actions'
LIT_ACTIONS.song
```

Files to update:
- [ ] `app/src/lib/lit/actions/song-metadata.ts`
- [ ] `app/src/lib/lit/actions/artist-metadata.ts`
- [ ] `app/src/lib/lit/actions/base-alignment.ts`
- [ ] `app/src/lib/lit/actions/audio-processor.ts`
- [ ] `app/src/lib/lit/actions/translate.ts`
- [ ] `app/src/lib/lit/actions/match-and-segment.ts`
- [ ] Any other files using `import.meta.env.VITE_LIT_ACTION_*`

### 🔧 TODO: Update Deploy Script (Optional)

Update `lit-actions/scripts/deploy-lit-action.sh` to:
1. Upload to IPFS (keep existing)
2. Print instructions to manually update `src/config/lit-actions.ts`
3. Remove automatic `.env.local` updates (lines 77-93)

Or keep it as-is for backward compatibility during migration.

## Usage Examples

### Before (Environment Variables)
```typescript
// ❌ No type safety, undefined if missing from .env.local
const result = await litClient.executeJs({
  ipfsId: import.meta.env.VITE_LIT_ACTION_SEARCH,
  authContext,
  jsParams: { query, limit },
})
```

### After (Config File)
```typescript
// ✅ Type-safe, throws helpful error if not deployed
import { LIT_ACTIONS } from '@/config/lit-actions'

const result = await litClient.executeJs({
  ipfsId: LIT_ACTIONS.search,  // Autocomplete works!
  authContext,
  jsParams: { query, limit },
})
```

### Local Override (Development)
```bash
# .env.local
VITE_LIT_ACTION_SEARCH=QmMyLocalTestVersion
```

```typescript
// Automatically uses local override if set
const result = await litClient.executeJs({
  ipfsId: LIT_ACTIONS.search,  // Uses local override
  authContext,
  jsParams: { query, limit },
})
```

## Benefits

1. **No more lost CIDs**: Version controlled in git
2. **Type safety**: TypeScript catches missing CIDs at compile time
3. **Better DX**: IDE autocomplete, refactoring support
4. **Deployment history**: Git log shows when each CID was updated
5. **Clear errors**: Helpful messages if CID not deployed yet
6. **Still flexible**: Can override via env vars for local testing

## Pattern Matches Existing Architecture

This follows the same pattern as `src/config/contracts.ts`:

```typescript
// contracts.ts
export const BASE_SEPOLIA_CONTRACTS = {
  usdc: (import.meta.env.VITE_BASE_SEPOLIA_USDC || '0x036CbD...') as Address,
  // ...
}

// lit-actions.ts
export const LIT_ACTIONS = {
  search: getLitActionCID('search', 'VITE_LIT_ACTION_SEARCH'),
  // ...
}
```

Both use:
- Config file as default
- Environment variable overrides
- Single source of truth
- Type safety
