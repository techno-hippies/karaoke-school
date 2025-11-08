# GRC-20 Population Scripts - Usage Guide

**IMPORTANT:** These scripts must be run in order after wiping and adding constraints.

## Quick Start

```bash
# 1. Wipe existing data (optional, for fresh start)
bun scripts/migration/wipe-grc20-tables.ts

# 2. Add constraints (REQUIRED before population)
bun scripts/migration/add-grc20-constraints.ts

# 3. Populate in order
bun scripts/migration/populate-grc20-artists.ts
bun scripts/migration/populate-grc20-works.ts
bun scripts/migration/populate-grc20-recordings.ts

# 4. Validate data integrity
bun scripts/migration/validate-grc20-data.ts
```

## Script Responsibilities

### 1. `wipe-grc20-tables.ts`
- Deletes ALL data from grc20_* tables
- Resets ID sequences
- Use for fresh start

### 2. `add-grc20-constraints.ts`
- Adds NULL-safe unique constraints
- Prevents duplicate works per ISWC
- Prevents duplicate works per Genius song
- **MUST run before population**

### 3. `populate-grc20-artists.ts` (582 lines)
- Creates artists from multiple sources
- No dependencies

### 4. `populate-grc20-works.ts` (567 lines)
- **WORK-LEVEL DATA ONLY**
- Creates works from karaoke_segments
- Sources: Quansic → MusicBrainz → MLC → Spotify → Genius
- **Does NOT create recordings** (removed for clean separation)
- Depends on: grc20_artists

### 5. `populate-grc20-recordings.ts` (NEW - refactored)
- **RECORDING-LEVEL DATA**
- Creates one recording per work
- Populates titles, streaming URLs
- Depends on: grc20_works

### 6. `validate-grc20-data.ts`
- Checks for orphaned records
- Validates foreign keys
- Confirms 1:1 work-recording relationship

## Data Flow

```
karaoke_segments (source)
  ↓
grc20_artists (populate-grc20-artists.ts)
  ↓
grc20_works (populate-grc20-works.ts)
  ↓
grc20_work_recordings (populate-grc20-recordings.ts)
```

## ISWC Priority (Maintained in populate-grc20-works.ts)

1. **Quansic** (95% coverage, gold standard)
2. **MusicBrainz** (authoritative, community-maintained)
3. **MLC** (NEW! mechanical licensing, fallback)

## Constraints Added

- `grc20_artists.genius_artist_id` - UNIQUE (NULL-safe, partial index)
- `grc20_works.genius_song_id` - UNIQUE (NULL-safe, partial index)
- `grc20_works.iswc` - UNIQUE (NULL-safe, partial index)
- `grc20_work_recordings.spotify_track_id` - UNIQUE (NULL-safe, partial index)
- All foreign keys with CASCADE DELETE

## Known Issues Fixed

❌ **Before:** `ON CONFLICT (genius_song_id)` failed when NULL → duplicates
✅ **After:** NULL-safe partial unique indexes + ISWC-based deduplication

❌ **Before:** Recording creation mixed into works script
✅ **After:** Clean separation - works script ONLY creates works

❌ **Before:** No transaction safety → orphaned records possible
✅ **After:** Transaction wrappers ensure atomicity

❌ **Before:** No validation between scripts
✅ **After:** validateDependencies() checks integrity

## MLC Integration Status

✅ **Verified:** MLC fallback working in populate-grc20-works.ts
✅ **Lines 389-419:** MLC ISWC discovery integrated
✅ **Priority:** Quansic → MusicBrainz → MLC
✅ **Test data:** 2 tracks with `iswc_source = 'mlc'`

## Troubleshooting

**Error: "could not create unique index"**
- Duplicate data exists
- Run `wipe-grc20-tables.ts` first

**Error: "works without recordings"**
- Run `populate-grc20-recordings.ts`
- Check validation output

**Duplicate works appearing**
- Constraints not added before population
- Re-run with wipe → constraints → populate

## Production Usage

For automated pipelines, wrap in a single script:

```typescript
// scripts/migration/populate-all-grc20.ts
import { execSync } from 'child_process';

const scripts = [
  'wipe-grc20-tables.ts',
  'add-grc20-constraints.ts',
  'populate-grc20-artists.ts',
  'populate-grc20-works.ts',
  'populate-grc20-recordings.ts',
  'validate-grc20-data.ts'
];

for (const script of scripts) {
  console.log(`\n🚀 Running: ${script}\n`);
  execSync(`bun scripts/migration/${script}`, { stdio: 'inherit' });
}
```
