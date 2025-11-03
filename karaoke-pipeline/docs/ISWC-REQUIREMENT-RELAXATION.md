# ISWC Requirement Relaxation for GRC-20 Work Minting

**Date**: 2025-11-03
**Status**: Ready for deployment

## Problem

3 musical works in `grc20_works` lack ISWCs, blocking their minting to GRC-20:

| ID | Title | Artist | Genius ID | ISWC |
|----|-------|--------|-----------|------|
| 52 | Life Is Good | Kenny Chesney | 195483 | ❌ NULL |
| 63 | Sarà perché ti amo | Ricchi E Poveri | 887880 | ❌ NULL |
| 69 | THATS WHAT I WANT | Lil Nas X | 7105950 | ❌ NULL |

**Current State**: 36/39 works minted (92.3%)
**Target**: 39/39 works minted (100%)

## Solution

Use `genius_song_id` as fallback identifier when ISWC unavailable.

### Design Principles

1. **ISWC Preferred**: Industry standard, use when available
2. **Genius ID Fallback**: Stable alternative for works without ISWC
3. **Mutual Exclusivity**: At least one identifier required, both can coexist
4. **Future-Proof**: Can add ISWC later via GRC-20 Edit operation

## Changes

### 1. Database Migration

**File**: `schema/migrations/051-relax-iswc-requirement-for-minting.sql`

```sql
-- Make iswc nullable
ALTER TABLE grc20_work_mints
ALTER COLUMN iswc DROP NOT NULL;

-- Add genius_song_id as alternative join key
ALTER TABLE grc20_work_mints
ADD COLUMN genius_song_id INTEGER;

-- Require at least one identifier
ALTER TABLE grc20_work_mints
ADD CONSTRAINT grc20_work_mints_identifier_required
CHECK (iswc IS NOT NULL OR genius_song_id IS NOT NULL);

-- Unique indexes (partial, only when present)
CREATE UNIQUE INDEX grc20_work_mints_iswc_unique
ON grc20_work_mints (iswc)
WHERE iswc IS NOT NULL;

CREATE UNIQUE INDEX grc20_work_mints_genius_unique
ON grc20_work_mints (genius_song_id)
WHERE genius_song_id IS NOT NULL;
```

### 2. Minting Script Updates

**File**: `grc20-v2/scripts/04-mint-works.ts`

**Query Changes** (line 42-56):
```typescript
// OLD: Only ISWC works
LEFT JOIN grc20_work_mints gwm ON gw.iswc = gwm.iswc
WHERE gwm.grc20_entity_id IS NULL
  AND gw.iswc IS NOT NULL

// NEW: ISWC or Genius ID works
LEFT JOIN grc20_work_mints gwm ON (
  (gw.iswc IS NOT NULL AND gw.iswc = gwm.iswc) OR
  (gw.iswc IS NULL AND gw.genius_song_id = gwm.genius_song_id)
)
WHERE gwm.grc20_entity_id IS NULL
  AND (gw.iswc IS NOT NULL OR gw.genius_song_id IS NOT NULL)
```

**INSERT Changes** (line 138-174):
```typescript
// Use ISWC if available, otherwise genius_song_id
if (work.iswc) {
  await query(`
    INSERT INTO grc20_work_mints (iswc, genius_song_id, grc20_entity_id, ...)
    VALUES ($1, $2, $3, ...)
    ON CONFLICT (iswc) WHERE iswc IS NOT NULL DO UPDATE ...
  `, [work.iswc, work.genius_song_id || null, entityId]);
  console.log(`✅ ${work.title} - ISWC: ${work.iswc}`);
} else {
  await query(`
    INSERT INTO grc20_work_mints (iswc, genius_song_id, grc20_entity_id, ...)
    VALUES ($1, $2, $3, ...)
    ON CONFLICT (genius_song_id) WHERE genius_song_id IS NOT NULL DO UPDATE ...
  `, [null, work.genius_song_id, entityId]);
  console.log(`✅ ${work.title} - Genius ID: ${work.genius_song_id} (no ISWC)`);
}
```

### 3. Emission Script Updates

**File**: `src/schemas/segment-event-emission.ts`

**Query Changes** (line 313-316):
```sql
-- OLD: Only join by ISWC
INNER JOIN grc20_work_mints gwm ON gw.iswc = gwm.iswc

-- NEW: Join by ISWC or genius_song_id
INNER JOIN grc20_work_mints gwm ON (
  (gw.iswc IS NOT NULL AND gw.iswc = gwm.iswc) OR
  (gw.iswc IS NULL AND gw.genius_song_id = gwm.genius_song_id)
)
```

## Deployment Steps

1. **Apply migration**:
   ```bash
   cd karaoke-pipeline
   dotenvx run -f .env -- psql -f schema/migrations/051-relax-iswc-requirement-for-minting.sql
   ```

2. **Verify schema**:
   ```sql
   SELECT column_name, is_nullable, data_type
   FROM information_schema.columns
   WHERE table_name = 'grc20_work_mints';
   ```

3. **Mint 3 works without ISWCs**:
   ```bash
   cd grc20-v2
   dotenvx run -f .env -- bun scripts/04-mint-works.ts
   ```

4. **Verify minting**:
   ```sql
   SELECT
     gwm.grc20_entity_id,
     gwm.iswc,
     gwm.genius_song_id,
     gw.title,
     gw.primary_artist_name
   FROM grc20_work_mints gwm
   JOIN grc20_works gw ON (
     (gwm.iswc IS NOT NULL AND gw.iswc = gwm.iswc) OR
     (gwm.genius_song_id IS NOT NULL AND gw.genius_song_id = gwm.genius_song_id)
   )
   WHERE gwm.iswc IS NULL;
   ```

## Expected Results

After deployment:
- ✅ 3 additional works minted to GRC-20
- ✅ 39/39 works minted (100% coverage)
- ✅ 10 additional segments eligible for emission (if they have recordings)

## GRC-20 Entity Structure

Works minted without ISWC will have:

```json
{
  "type": "musicalWork",
  "properties": {
    "title": "THATS WHAT I WANT",
    "geniusId": "7105950",
    "mbid": null,
    "iswc": null,
    "language": "en",
    "genres": "pop"
  }
}
```

**Note**: ISWC can be added later via GRC-20 Edit operation when discovered.

## Rollback Plan

If issues arise, revert with:

```sql
-- Remove constraint
ALTER TABLE grc20_work_mints
DROP CONSTRAINT grc20_work_mints_identifier_required;

-- Make ISWC required again
ALTER TABLE grc20_work_mints
ALTER COLUMN iswc SET NOT NULL;

-- Drop genius_song_id column
ALTER TABLE grc20_work_mints
DROP COLUMN genius_song_id;

-- Restore original unique constraint
ALTER TABLE grc20_work_mints
ADD CONSTRAINT grc20_work_mints_iswc_key UNIQUE (iswc);
```

## Testing

Run emission script after minting to verify end-to-end flow:

```bash
cd karaoke-pipeline
dotenvx run -f .env -- bun scripts/contracts/emit-segment-events.ts --dry-run
```

Expect to see works with `genius_song_id` included in eligible segments.

## Future Enhancements

1. **ISWC Discovery**: Backfill ISWCs for Genius-only works via BMI/MLC APIs
2. **Additional Fallbacks**: Consider Spotify track IDs or MusicBrainz MBIDs
3. **Composite Identifiers**: Use (title + artist) hash as last resort
4. **GRC-20 Edits**: Update minted entities when ISWCs discovered
