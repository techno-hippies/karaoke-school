# GRC-20 Pre-Mint Validation

## Overview

Zod schemas enforce data quality **before minting to GRC-20**, preventing:
- ❌ Gas waste on incomplete entities
- ❌ Poor user experience from missing data
- ❌ Broken relations (orphaned entities)

## Validation Rules

### 🎤 Musical Artist

**Required:**
- Name
- Genius artist ID (primary source of truth)
- At least ONE social/streaming link
- Image URL (can be AI-generated via fal.ai Seedream from Genius/Wikipedia)

**Optional but Recommended:**
- Industry IDs: ISNI, IPI, MusicBrainz ID, Spotify ID, Wikidata
- Social links: Instagram, TikTok, Twitter, Facebook, YouTube, SoundCloud
- Biographical: Country, gender, birth/death dates, type (person/group)
- Popularity metrics: Followers, genres, verification status
- App-specific: Lens account (social layer)

**Format Validation:**
- ISNI: `0000 0001 2150 090X` (16 digits)
- IPI: `00052210040` (9-11 digits)
- Social handles: Alphanumeric + underscore/dot, 1-30 chars
- Ethereum addresses: `0x` + 40 hex chars

### 🎵 Musical Work

**Required:**
- Title
- Genius song ID (primary source of truth)
- Genius URL (derived from ID)
- At least ONE composer (MusicBrainz ID)

**Optional:**
- External IDs: Apple Music, Wikidata
- Metadata: Language, release date
- Engagement: Genius annotation count, pyongs

**Format Validation:**
- ISWC: `T-345246800-1` (T-DDDDDDDDD-D)

### 🎧 Audio Recording

**Required:**
- Title
- Link to Musical Work entity (UUID)
- Duration in milliseconds
- Either ISRC **OR** MusicBrainz ID **OR** Spotify ID

**Optional:**
- Performer links (MBIDs)
- Release info: Album, date
- Popularity: Spotify popularity score
- Streaming URLs

**Format Validation:**
- ISRC: `USRC17607839` (2 letters + 3 alphanumeric + 7 digits)

### 🎤 Karaoke Segment *(if minting to GRC-20)*

**Required:**
- Title
- Link to Audio Recording entity (UUID)
- Timing: startMs, endMs, durationMs
- Instrumental audio URI (Grove/Irys)
- Word alignment URI (Grove/Irys)

**Business Rules:**
- `endMs > startMs`
- `durationMs = endMs - startMs`

## Usage Examples

### Validate Single Entity

```typescript
import { MusicalArtistMintSchema, formatValidationError } from './types/validation-schemas';

const artistData = {
  name: 'Taylor Swift',
  mbid: '20244d07-534f-4eff-b4d4-930878889970',
  spotifyId: '06HL4z0CvFAxyc27GXpf02',
  instagramHandle: 'taylorswift',
  imageUrl: 'https://i.scdn.co/image/...',
  geniusUrl: 'https://genius.com/artists/Taylor-swift',
};

try {
  const validated = MusicalArtistMintSchema.parse(artistData);
  console.log('✅ Ready to mint:', validated.name);
} catch (error) {
  console.error('❌ Validation failed:');
  console.error(formatValidationError(error));
}
```

### Validate Database Batch

```typescript
import { validateBatch, MusicalArtistMintSchema } from './types/validation-schemas';

const artists = await sql`SELECT * FROM musicbrainz_artists LIMIT 1000`;

const result = validateBatch(artists.map(mapDBToSchema), MusicalArtistMintSchema);

console.log(`✅ ${result.stats.validPercent}% ready to mint`);
console.log(`⚠️  ${result.stats.invalidCount} need enrichment`);

// Only mint valid entities
await mintToGRC20(result.valid);
```

### Progressive Quality Levels

```typescript
import { getValidationLevel } from './types/validation-examples';

const level = getValidationLevel(artistData);

switch (level) {
  case 'premium':
    // 3+ external IDs, 3+ social links, ISNI
    console.log('🌟 Premium quality - mint immediately');
    break;
  case 'standard':
    // 2+ external IDs, 2+ social links
    console.log('✅ Standard quality - mint with priority');
    break;
  case 'minimal':
    // Barely passes validation
    console.log('⚠️  Minimal quality - enrich before minting');
    break;
}
```

## Integration with Scripts

### Option 1: Block Invalid Mints

```typescript
// scripts/03-import-works.ts
import { MusicalWorkMintSchema } from '../types/validation-schemas';

const tracks = await sql`SELECT * FROM spotify_tracks...`;

const validatedTracks = tracks
  .map(mapTrackToWork)
  .filter(work => {
    const result = MusicalWorkMintSchema.safeParse(work);
    if (!result.success) {
      console.warn(`Skipping ${work.title}: incomplete data`);
    }
    return result.success;
  });

console.log(`Minting ${validatedTracks.length} of ${tracks.length} tracks`);
```

### Option 2: Warn But Allow

```typescript
const result = MusicalWorkMintSchema.safeParse(workData);

if (!result.success) {
  console.warn(`⚠️  ${workData.title} has data quality issues:`);
  console.warn(formatValidationError(result.error));

  if (shouldMintAnyway) {
    console.log('   → Minting anyway with minimal data');
  } else {
    console.log('   → Skipping until enriched');
    return;
  }
}
```

### Option 3: Quality Gates

```typescript
const MINIMUM_QUALITY_PERCENT = 80;

const result = validateBatch(allArtists, MusicalArtistMintSchema);

if (result.stats.validPercent < MINIMUM_QUALITY_PERCENT) {
  throw new Error(
    `Only ${result.stats.validPercent}% of artists pass validation. ` +
    `Need ${MINIMUM_QUALITY_PERCENT}% before batch mint.`
  );
}

console.log('✅ Quality gate passed - proceeding with mint');
```

## Validation Error Examples

```
❌ Artist validation failed:
  - mbid: Required at least one external ID
  - instagramHandle: Artist should have at least one social link
  - imageUrl: Artist should have at least one image

❌ Work validation failed:
  - iswc: Work must have ISWC OR (Spotify ID + Genius URL)
  - composerMbids: Work must have at least one composer

❌ Recording validation failed:
  - isrc: Invalid ISRC format (e.g., USRC17607839)
  - durationMs: Duration must be positive
```

## Quality Gates: What Does "% of Catalog" Mean?

Before batch-minting to GRC-20, you want to ensure your data meets minimum quality standards. A "quality gate" is a threshold that must be passed.

**Example:**
```typescript
// Set quality gate: 80% of artists must pass validation
const MINIMUM_QUALITY_PERCENT = 80;

const allArtists = await sql`SELECT * FROM genius_artists LIMIT 1000`;
const result = validateBatch(allArtists.map(mapDB), MusicalArtistMintSchema);

console.log(`
📊 Catalog Readiness:
   Total Artists: ${result.stats.total}
   Pass Validation: ${result.stats.validCount} (${result.stats.validPercent}%)
   Need Enrichment: ${result.stats.invalidCount}

   Quality Gate: ${MINIMUM_QUALITY_PERCENT}%
   Status: ${result.stats.validPercent >= MINIMUM_QUALITY_PERCENT ? '✅ READY TO MINT' : '❌ ENRICH DATA FIRST'}
`);

if (result.stats.validPercent < MINIMUM_QUALITY_PERCENT) {
  throw new Error(`Only ${result.stats.validPercent}% pass validation. Need ${MINIMUM_QUALITY_PERCENT}% before minting.`);
}

// Proceed with minting only validated entities
await mintToGRC20(result.valid);
```

**Why This Matters:**
- **Cost control**: Don't waste gas on incomplete data
- **User experience**: Poor data = bad UX when querying GRC-20
- **Progressive launch**: Start with 100 high-quality artists, expand as you enrich data
- **Data quality metrics**: Track improvement over time

**Typical Quality Gates:**
- **Initial launch**: 90%+ (only best data)
- **Growth phase**: 80%+ (good balance)
- **Mature catalog**: 70%+ (after manual review)

## Benefits

### 1. Cost Savings
- Block incomplete mints before gas costs
- Batch validation identifies issues early

### 2. Data Quality Metrics
```typescript
const result = validateBatch(artists, MusicalArtistMintSchema);

console.log(`
📊 Catalog Quality Report:
   Total Artists: ${result.stats.total}
   Ready to Mint: ${result.stats.validCount} (${result.stats.validPercent}%)
   Need Enrichment: ${result.stats.invalidCount}

   Target: 80% quality for batch mint
   Status: ${result.stats.validPercent >= 80 ? '✅ READY' : '⚠️  ENRICH'}
`);
```

### 3. Progressive Enhancement
Start with strict rules, loosen as you improve data:

```typescript
// Week 1: Strict (require ISNI, 3+ social links)
// Week 4: Relaxed (only require 1 external ID)
// Week 8: Add new optional fields without breaking existing code
```

### 4. Clear Feedback Loop
Validation errors tell you exactly what to fix:

```
⚠️  Beyoncé: Missing ISNI (check MusicBrainz)
⚠️  Drake: No TikTok handle (check raw_data.tiktok)
⚠️  The Weeknd: Image URL 404 (needs refresh)
```

## Next Steps

1. **Run validation report**: Check current catalog quality
2. **Set quality targets**: e.g., "80% artists must pass validation"
3. **Enrich data**: Add missing social links, external IDs
4. **Batch mint**: Only validated entities to save gas
5. **Monitor quality**: Track validation pass rate over time
