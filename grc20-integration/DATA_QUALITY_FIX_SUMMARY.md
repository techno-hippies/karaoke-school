# Data Quality Fix Summary

## Issues Identified

### 1. **Dirty YouTube Channel Data**
- **Problem**: `youtube_channel` contained values like "channel", "user", "c" instead of actual channel IDs
- **Root Cause**: In `enrich-musicbrainz.ts` line 91, the regex `return match[1] || match[2]` was returning the first capture group ("channel") instead of the second group (actual ID)
- **Affected Records**: 93 artists in `grc20_artists`, 312+ in `musicbrainz_artists`

### 2. **Empty Platform URL Columns**
- **Problem**: `apple_music_url`, `deezer_url`, `tidal_url` columns exist but are always NULL
- **Root Cause**: No data source - these platforms require platform-specific IDs we don't collect
- **Status**: Expected behavior - columns exist for future enrichment

### 3. **Low MusicBrainz Coverage**
- **Finding**: Only 3 out of 235 artists in `grc20_artists` have matching `musicbrainz_artists` records
- **Impact**: Most social media handles come from Genius, not MusicBrainz

## Fixes Applied

### ✅ Fixed `enrich-musicbrainz.ts`
**File**: `scripts/enrich-musicbrainz.ts`

**Change**: Added dedicated `extractYouTubeChannel()` function that returns only `match[2]` (the actual ID)

```typescript
// Before (line 91)
if (match) return match[1] || match[2]; // Returns "channel" for YouTube

// After (lines 96-105)
const extractYouTubeChannel = (): string | undefined => {
  for (const rel of relations) {
    if (!rel.url) continue;
    const url = rel.url.resource || String(rel.url);
    const match = url.match(/youtube\.com\/(channel|c|user)\/([^/?]+)/);
    if (match) return match[2]; // Return only the ID
  }
  return undefined;
};
```

### ✅ Fixed `02-corroborate-artists.sql`
**File**: `sql/02-corroborate-artists.sql`

**Change**: Added validation to filter out broken values like "channel", "user", "c"

```sql
-- Before (line 108)
NULLIF(ma.youtube_channel, '') as youtube_channel,

// After (lines 108-114)
CASE 
    WHEN ma.youtube_channel IS NOT NULL AND ma.youtube_channel != '' 
         AND ma.youtube_channel NOT IN ('channel', 'user', 'c')
    THEN ma.youtube_channel
    ELSE NULL
END as youtube_channel,
```

### ✅ Cleaned `grc20_artists` Table
**SQL Executed**:
```sql
UPDATE grc20_artists
SET youtube_channel = NULL
WHERE youtube_channel IN ('channel', 'user', 'c');
```

**Result**: Nullified 93 broken records

## Current Status

| Table | Total | Has YouTube | Broken | Clean |
|-------|-------|-------------|--------|-------|
| `musicbrainz_artists` | 676 | 348 | 312 | 36 |
| `grc20_artists` | 235 | 29 | 0 | 29 |

| Platform URLs | Apple Music | Deezer | Tidal |
|--------------|-------------|--------|-------|
| Count | 0 | 0 | 0 |

## Next Steps

### 1. **Fix Remaining MusicBrainz Records** (Optional)
The `musicbrainz_artists` table still has 312 broken YouTube channels. These were enriched before the fix and need re-extraction from `raw_data` JSONB.

**Option A**: Re-enrich all artists
```bash
cd grc20-integration
# Backup first
bun run backup-musicbrainz  # (create this script)

# Delete and re-enrich
DELETE FROM musicbrainz_artists;
bun run enrich-mb 1000
```

**Option B**: Extract from existing `raw_data`
```sql
-- More complex - need to parse JSONB relations array
-- Left for future if needed
```

### 2. **Re-run Corroboration**
After fixing MusicBrainz source data:
```bash
cd grc20-integration
bun run corroborate
```

This will:
- Re-populate `grc20_artists` with fixed YouTube channels
- Apply the new validation logic from `02-corroborate-artists.sql`

### 3. **Platform URL Enrichment** (Future Enhancement)
To populate `apple_music_url`, `deezer_url`, `tidal_url`:

**Required**:
1. Add platform-specific ID columns: `apple_music_id`, `deezer_id`, `tidal_id`
2. Create enrichment scripts for each platform
3. Update corroboration SQL to construct URLs from IDs

**Potential Data Sources**:
- MusicBrainz URL relations (some artists have Apple Music/Deezer links)
- Platform APIs (Apple Music API, Deezer API, Tidal API)
- Spotify Web API (doesn't provide these, but could cross-reference)

## Files Modified

1. ✅ `scripts/enrich-musicbrainz.ts` - Fixed YouTube regex extraction
2. ✅ `sql/02-corroborate-artists.sql` - Added YouTube validation
3. ✅ `sql/fix-social-media-data.sql` - Initial fix attempt
4. ✅ `sql/fix-social-media-complete.sql` - Complete fix script

## Files Created

1. `inspect-data.ts` - Investigation script
2. `check-source.ts` - Source data verification
3. `debug-join.ts` - JOIN debugging
4. `run-fix.ts` - Fix execution script
5. `apply-fix.ts` - Final fix script
6. `DATA_QUALITY_FIX_SUMMARY.md` - This document

## Prevention

To prevent this issue in the future:

1. **Add regex tests** in `enrich-musicbrainz.ts`:
   ```typescript
   // Test extractYouTubeChannel()
   const testUrl = "https://youtube.com/channel/UCyqq-aiu3vEHuf5NhwmOJcw";
   const result = extractYouTubeChannel(); // Should return "UCyqq-aiu3vEHuf5NhwmOJcw"
   ```

2. **Add validation** in corroboration SQL:
   - Already added for YouTube
   - Consider adding for other platforms if similar issues arise

3. **Add data quality checks** as a separate script:
   ```bash
   bun run check-data-quality  # Verify no broken handles
   ```
