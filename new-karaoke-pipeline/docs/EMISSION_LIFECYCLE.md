# Clip Emission Lifecycle Documentation

## Overview

This document defines the requirements and stage progression for emitting clips to the blockchain. Proper emission ensures the subgraph has complete metadata, including encryption data required for subscription features.

## Critical Rule: Encryption Before Emission

**Clips MUST be fully encrypted before blockchain emission.**

Emitting clips before encryption creates permanent data gaps where:
- Database has complete encryption metadata
- Subgraph only has partial metadata (missing lock addresses)
- Subscribe buttons don't appear for artists who should have them

## Stage Progression

Tracks flow through these stages in `tracks.stage`:

```
pending → enriched → audio_ready → aligned → translated → enhanced → encrypted → ready → emitted
```

### Key Stages

1. **encrypted** - Full track encrypted with Lit Protocol, lock address stored
2. **ready** - All processing complete, ready for emission
3. **emitted** - Blockchain events published, subgraph indexed

## Emission Requirements Checklist

Before emitting a clip, ALL of the following must be true:

### 1. Clip Processing Complete
- ✅ `karaoke_segments.clip_start_ms` IS NOT NULL
- ✅ `karaoke_segments.clip_end_ms` IS NOT NULL
- ✅ `karaoke_segments.fal_enhanced_grove_url` IS NOT NULL

### 2. Encryption Complete (CRITICAL)
- ✅ `karaoke_segments.encrypted_full_url` IS NOT NULL
- ✅ `karaoke_segments.encryption_accs` IS NOT NULL
- ✅ `encryption_accs.unlock.lockAddress` exists
- ✅ `encryption_accs.unlock.chainId` exists

### 3. GRC-20 Integration
- ✅ `grc20_works.grc20_entity_id` IS NOT NULL
- ✅ `grc20_artists.lens_handle` IS NOT NULL (for artist navigation)

### 4. Supporting Data
- ✅ Word alignments exist (`elevenlabs_word_alignments`)
- ✅ Translations exist (`lyrics_translations`)
- ✅ Karaoke lines exist (`karaoke_lines`)

## Pre-Flight Validation

The `validateEmissionReadiness()` function in `emit-clip-events.ts` checks:

```typescript
function validateEmissionReadiness(clip: ClipCandidate): { ready: boolean; reason?: string } {
  // Validate clip timing (0 is valid!)
  if (clip.clip_start_ms === null || clip.clip_start_ms === undefined ||
      clip.clip_end_ms === null || clip.clip_end_ms === undefined) {
    return { ready: false, reason: 'Missing clip timing' };
  }

  // Validate instrumental audio
  if (!clip.fal_enhanced_grove_url) {
    return { ready: false, reason: 'Missing enhanced instrumental audio' };
  }

  // Validate GRC-20 integration
  if (!clip.grc20_entity_id) {
    return { ready: false, reason: 'Missing GRC-20 entity ID' };
  }

  // CRITICAL: Validate encryption completion
  if (!clip.encrypted_full_url) {
    return { ready: false, reason: 'Missing encrypted full track URL' };
  }

  if (!clip.encryption_accs) {
    return { ready: false, reason: 'Missing encryption access conditions' };
  }

  // Validate encryption_accs structure
  try {
    const accs = typeof clip.encryption_accs === 'string'
      ? JSON.parse(clip.encryption_accs)
      : clip.encryption_accs;

    if (!accs.unlock?.lockAddress) {
      return { ready: false, reason: 'Missing Unlock lock address in encryption_accs' };
    }

    if (!accs.unlock?.chainId) {
      return { ready: false, reason: 'Missing Unlock chain ID in encryption_accs' };
    }
  } catch (error) {
    return { ready: false, reason: 'Invalid encryption_accs JSON structure' };
  }

  return { ready: true };
}
```

## Blockchain Events Emitted

### 1. ClipRegistered
```solidity
event ClipRegistered(
    bytes32 indexed clipHash,
    string grc20WorkId,
    string spotifyTrackId,
    uint32 clipStartMs,
    uint32 clipEndMs,
    string metadataUri,
    address indexed registeredBy,
    uint64 timestamp
);
```

### 2. ClipProcessed
```solidity
event ClipProcessed(
    bytes32 indexed clipHash,
    string instrumentalUri,
    string alignmentUri,
    uint8 translationCount,
    string metadataUri,
    uint64 timestamp
);
```

### 3. SongEncrypted (CRITICAL for Subscriptions)
```solidity
event SongEncrypted(
    bytes32 indexed clipHash,
    string spotifyTrackId,
    string encryptedFullUri,
    string encryptedManifestUri,
    address unlockLockAddress,
    uint32 unlockChainId,
    string metadataUri,
    uint64 timestamp
);
```

**Without the SongEncrypted event, the subgraph will not index:**
- `unlockLockAddress`
- `unlockChainId`
- `encryptedFullUri`
- `encryptedManifestUri`

This breaks the subscription flow because the React app cannot fetch lock addresses for the Unlock Protocol.

## Grove Metadata Structure

The metadata uploaded to Grove includes encryption data in the payload:

```json
{
  "version": "2.0.0",
  "type": "karaoke-clip",
  "clip_hash": "0x...",
  "grc20_work_id": "uuid",
  "spotify_track_id": "...",
  "title": "Song Title",
  "artist": "Artist Name",
  "artistLensHandle": "artist-ks1",
  "encryption": {
    "encryptedFullUri": "https://api.grove.storage/...",
    "unlockLockAddress": "0x...",
    "unlockChainId": 84532
  },
  "assets": {
    "instrumental": "https://api.grove.storage/...",
    "alignment": "https://api.grove.storage/..."
  },
  "translations": [...],
  "karaoke_lines": [...]
}
```

## Subgraph Integration

The subgraph indexes encryption data from the `SongEncrypted` event:

```typescript
export function handleSongEncrypted(event: SongEncrypted): void {
  let clipId = event.params.clipHash.toHexString();
  let clip = Clip.load(clipId);

  if (clip != null) {
    clip.encryptedFullUri = event.params.encryptedFullUri;
    clip.encryptedManifestUri = event.params.encryptedManifestUri;
    clip.unlockLockAddress = event.params.unlockLockAddress;
    clip.unlockChainId = event.params.unlockChainId.toI32();

    updateClipProcessingStatus(clip);
    clip.save();
  }
}
```

## React App Subscription Flow

1. **Profile Page** (`AccountPageContainer.tsx`)
   - Fetches artist's songs via `useArtistSongsByLensHandle`
   - Extracts Spotify track IDs from songs

2. **Fetch Lock Address** (`useCreatorSubscriptionLock.ts`)
   - Queries subgraph for clips matching track IDs
   - Filters for clips with `unlockLockAddress_not: null`
   - Returns first matching lock address and chain ID

3. **Conditional Rendering**
   - Subscribe button only appears if:
     - Artist has songs (`songs.length > 0`)
     - Lock address exists (`!!subscriptionLockData?.unlockLockAddress`)

4. **Subscription Purchase** (`useUnlockSubscription.ts`)
   - Uses Unlock Protocol SDK to purchase NFT key
   - Validates lock address before purchase

## Common Issues and Fixes

### Issue: Subscribe Button Not Appearing

**Symptom**: Artist has encrypted songs in database but no subscribe button on profile.

**Diagnosis**:
```sql
-- Check database encryption status
SELECT
  t.spotify_track_id,
  ks.encrypted_full_url IS NOT NULL as has_encrypted,
  ks.encryption_accs IS NOT NULL as has_lock,
  line_state.has_hash
FROM tracks t
JOIN karaoke_segments ks ON ks.spotify_track_id = t.spotify_track_id
JOIN grc20_works gw ON gw.spotify_track_id = t.spotify_track_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) > 0 AS has_hash
  FROM karaoke_lines kl
  WHERE kl.spotify_track_id = t.spotify_track_id
    AND segment_hash IS NOT NULL
) AS line_state ON TRUE
WHERE gw.primary_artist_name = 'Pitbull';
```

**Root Cause**: Clip emitted BEFORE encryption completed. Database has data but subgraph doesn't.

**Fix**:
1. Clear segment_hash to allow re-emission:
   ```sql
   UPDATE karaoke_lines
   SET segment_hash = NULL, updated_at = NOW()
   WHERE spotify_track_id = '<track_id>';
   ```

2. Re-emit with updated script (includes SongEncrypted event):
   ```bash
   bun src/tasks/content/emit-clip-events.ts --limit=1
   ```

3. Verify subgraph indexed encryption data:
   ```graphql
   query {
     clips(where: { spotifyTrackId: "<track_id>" }) {
       unlockLockAddress
       unlockChainId
       encryptedFullUri
     }
   }
   ```

### Issue: Validation Failing on clip_start_ms = 0

**Symptom**: Pre-flight validation fails with "Missing clip timing" even though clip_start_ms exists in database.

**Root Cause**: JavaScript falsy check (`!clip.clip_start_ms`) treats `0` as falsy.

**Fix**: Check for `null`/`undefined` explicitly:
```typescript
if (clip.clip_start_ms === null || clip.clip_start_ms === undefined) {
  return { ready: false, reason: 'Missing clip timing' };
}
```

## Monitoring Queries

### Check Emission Readiness
```sql
SELECT
  COUNT(*) as ready_count
FROM tracks t
JOIN karaoke_segments ks ON ks.spotify_track_id = t.spotify_track_id
JOIN grc20_works gw ON gw.spotify_track_id = t.spotify_track_id
WHERE ks.clip_start_ms IS NOT NULL
  AND ks.clip_end_ms IS NOT NULL
  AND ks.fal_enhanced_grove_url IS NOT NULL
  AND ks.encrypted_full_url IS NOT NULL
  AND ks.encryption_accs IS NOT NULL
  AND gw.grc20_entity_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM karaoke_lines kl
    WHERE kl.spotify_track_id = t.spotify_track_id
      AND segment_hash IS NOT NULL
  );
```

### Check Subgraph Sync Status
```graphql
query {
  _meta {
    block {
      number
      timestamp
    }
    hasIndexingErrors
  }
}
```

### Find Missing Lock Addresses
```graphql
query {
  clips(
    where: {
      encryptedFullUri_not: null,
      unlockLockAddress: null
    }
  ) {
    id
    spotifyTrackId
    encryptedFullUri
  }
}
```

## Best Practices

1. **Always encrypt before emitting** - Use stage gates in supervisor.sh
2. **Run pre-flight validation** - Let `validateEmissionReadiness()` catch issues early
3. **Emit all three events** - ClipRegistered, ClipProcessed, SongEncrypted (in order)
4. **Monitor subgraph health** - Check for indexing errors regularly
5. **Test subscription flow** - Verify lock addresses queryable after emission
6. **Document data gaps** - If re-emission needed, track which clips were affected

## Future Improvements

1. **Atomic emission** - Wrap all three events in a single transaction
2. **Stage enforcement** - Prevent emission if track.stage != 'ready'
3. **Automatic retry** - Re-emit clips with missing lock addresses
4. **Health dashboard** - Monitor emission completeness metrics
5. **Dry-run mode** - Test emission without blockchain writes

## Related Files

- `/new-karaoke-pipeline/src/tasks/content/emit-clip-events.ts` - Emission script
- `/subgraph/src/mappings.ts` - Event handlers
- `/subgraph/schema.graphql` - Clip entity schema
- `/app/src/hooks/useCreatorSubscriptionLock.ts` - Lock address fetching
- `/app/src/hooks/useUnlockSubscription.ts` - Subscription purchase
- `/app/src/pages/AccountPageContainer.tsx` - Subscribe button logic
