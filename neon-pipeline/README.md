# Neon DB Catalog-First Pipeline

**Simplified, catalog-first approach for building karaoke song database**

## Philosophy

Instead of scraping TikTok → identifying songs → processing:

1. **Build catalog foundation** (Karafun 67k songs, English-only)
2. **Match to local files** (~8k files in `/home/t42/Music`)
3. **Enrich metadata** (Genius, MusicBrainz, ISNI, MLC)
4. **Store in Neon DB** (clean, canonical schema)
5. **Hunt TikToks** that match catalog (not the other way around)

## Benefits

- ✅ Clean separation: canonical data vs vendor data
- ✅ Reusable catalog across all features
- ✅ Reduced API calls (batch operations)
- ✅ Better data quality (multi-source validation)
- ✅ Scalable to 100k+ songs

## Architecture

```
Karafun CSV (67k) → Filter English → Neon DB (karaoke_sources)
                           ↓
                    Match to local files
                           ↓
                    Enrich (Genius/MB/MLC)
                           ↓
                    Store (artists, works, recordings)
                           ↓
                    Hunt TikToks for catalog
```

## Database Schema

### Core Tables
- **artists** - MusicBrainz-inspired with ISNI/IPI/Genius IDs
- **works** - Musical compositions (ISWC, composers, PRO registrations)
- **recordings** - Specific performances (ISRC, Spotify, local files, lyrics)
- **segments** - Karaoke clips (TikTok, vocals/instrumental, Story Protocol)

### Metadata Tables
- **karaoke_sources** - Vendor-specific data (Karafun, SingKing, Smule, etc.)
- **tiktok_scrapes** - Track TikTok scraping progress

## Quick Start

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Fill in NEON_PROJECT_ID and API keys

# Create DB schema
bun run create:schema

# Import Karafun catalog (English-only)
bun run import:karafun

# Match to local files
bun run match:local

# Enrich metadata
bun run enrich:metadata
```

## Workflows

### 1. Import Karafun Catalog
```bash
bun src/import/01-import-karafun.ts
```
- Filters English-only songs (~40-50k)
- Creates entries in `karaoke_sources` table
- Assigns popularity scores

### 2. Match Local Files
```bash
bun src/import/02-match-local-files.ts
```
- Scans `/home/t42/Music`
- Fuzzy matches to Karafun catalog
- AI fallback for edge cases
- Updates `recordings` with local file paths

### 3. Enrich Metadata
```bash
bun src/import/03-enrich-metadata.ts
```
- Fetches Genius metadata
- Queries MusicBrainz for ISNI/IPI
- Gets MLC licensing data
- Fetches LRCLib lyrics

## Data Quality

**Tiered Validation** (MusicBrainz-inspired):
- **Tier 1**: Required (MBID, ISNI, Title)
- **Tier 2**: Enrichment (External IDs, lyrics, MLC)
- **Tier 3**: Skip (ratings, popularity)

**Confidence Levels**:
- `high` - 2+ sources agree
- `medium` - 1 source validated
- `low` - Unvalidated/inferred

## Project Structure

```
neon-pipeline/
├── src/
│   ├── schemas/          # Zod schemas (artist, work, recording)
│   ├── import/           # Import scripts
│   ├── workflows/        # Multi-step workflows
│   ├── services/         # External API clients
│   └── lib/              # Shared utilities
├── sql/                  # SQL migrations
├── data/                 # Output data (gitignored)
└── README.md
```

## Next Steps

After catalog is built:
- Create artist accounts (Lens + PKP)
- Hunt TikToks for popular songs
- Process videos into segments
- Post to Lens with metadata
