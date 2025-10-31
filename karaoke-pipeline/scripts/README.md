# Scripts Directory

Utility scripts, data migration tools, and operational commands for the karaoke pipeline, reorganized into functional categories.

## 🏗️ Organization

```
scripts/
├── monitoring/       # Status checking and pipeline monitoring
├── migration/        # Database migrations and schema updates
├── processing/       # Core pipeline processing operations
└── backfill/         # Data backfill and enrichment
```

## 📊 Monitoring Scripts

Scripts for checking pipeline health and status.

### `check-pipeline-status.ts`
Real-time pipeline status dashboard with:
- TikTok creators with most videos
- Pipeline status distribution
- Specific creator tracking (e.g., charleenweiss)

**Usage:**
```bash
# Check overall pipeline status
bun scripts:status

# Or directly
bun scripts/monitoring/check-pipeline-status.ts
```

### `find-flagged.ts`
Find tracks flagged for manual review (low confidence scores, missing lyrics).

**Usage:**
```bash
# Find tracks needing review
bun scripts:flagged

# Or directly  
bun scripts/monitoring/find-flagged.ts
```

## 🔄 Migration Scripts

Database migrations and schema updates.

### `migrate-karaoke-segments.ts`
Apply karaoke_segments table migration and indexes.

**Usage:**
```bash
# Apply karaoke segments migration
bun scripts:migration:karaoke-segments

# Or directly
bun scripts/migration/migrate-karaoke-segments.ts
```

### `cleanup-language-data.ts`
Clean up language_data JSON structure to remove percentage breakdowns.

**Usage:**
```bash
# Clean language data
bun scripts:migration:language-data

# Or directly
bun scripts/migration/cleanup-language-data.ts
```

### `update-track-images.ts`
Update all Spotify tracks with album image URLs via Spotify API.

**Usage:**
```bash
# Update track images
bun scripts:migration:update-images

# Or directly
bun scripts/migration/update-track-images.ts
```

## 🎵 Processing Scripts

Core pipeline processing operations.

### `process-all-separations.ts`
Submit all tracks with `audio_downloaded` status to Demucs for vocal/instrumental separation.

**Prerequisites:**
- Tracks must have `song_audio.grove_url` populated
- Demucs service running locally or remotely configured

**Environment Variables:**
```bash
# Required
DATABASE_URL=postgresql://...

# Optional - defaults to localhost
DEMUCS_LOCAL_ENDPOINT=http://localhost:8001
DEMUCS_WEBHOOK_URL=http://localhost:36949/webhooks/demucs-complete
```

**Usage:**
```bash
# Process all pending separations
bun scripts:processing:separations

# Or directly
bun scripts/processing/process-all-separations.ts
```

### `run-orchestrator.ts`
Run the unified pipeline orchestrator with environment configuration.

**Usage:**
```bash
# Run orchestrator (all steps, limit 50)
bun scripts:processing:orchestrator

# Run specific step
bun scripts:processing:orchestrator --step=8

# Custom limit
bun scripts:processing:orchestrator --step=2 --limit=10
```

## 📝 Backfill Scripts

Data backfill and enrichment operations.

### `backfill-genius-data.ts`
Backfill Genius data for tracks that already have `genius_song_id` in song_pipeline.

**Prerequisites:**
- `GENIUS_API_KEY` environment variable set
- Tracks must already have `genius_song_id` in `song_pipeline`

**Usage:**
```bash
# Backfill Genius annotations
bun scripts:backfill

# Or directly
bun scripts/backfill/backfill-genius-data.ts
```

## 📦 Package Scripts

Convenience scripts defined in `package.json`:

### Monitoring
```bash
bun scripts:status          # Pipeline status dashboard
bun scripts:flagged         # Find flagged tracks
bun scripts:monitor         # Same as scripts:status
```

### Migration
```bash
bun scripts:migration:karaoke-segments  # Apply karaoke segments migration
bun scripts:migration:language-data     # Clean language data
bun scripts:migration:update-images     # Update track images
```

### Processing
```bash
bun scripts:processing:separations  # Process audio separations
bun scripts:processing:orchestrator # Run pipeline orchestrator
```

### Backfill
```bash
bun scripts:backfill  # Backfill Genius data
```

## 🔧 Environment Setup

Most scripts require these environment variables:

**Required:**
- `DATABASE_URL` - Neon PostgreSQL connection string

**Optional:**
- `OPENROUTER_API_KEY` - For AI processing (Gemini)
- `ELEVENLABS_API_KEY` - For alignment processing
- `GENIUS_API_KEY` - For Genius integration
- `FAL_API_KEY` - For audio/image enhancement
- `DEMUCS_WEBHOOK_URL` - For separation webhook endpoint
- `IRYS_PRIVATE_KEY` - For Grove/IPFS uploads

## 🏃‍♂️ Quick Start

```bash
# 1. Set up environment
dotenvx run -f .env -- <command>

# 2. Check pipeline status
bun scripts:status

# 3. Process pending separations
bun scripts:processing:separations

# 4. Run full pipeline orchestrator
bun scripts:processing:orchestrator

# 5. Backfill any missing data
bun scripts:backfill
```

## ⚡ Common Operations

### Check Pipeline Health
```bash
bun scripts:status
```

### Process Audio Separations
```bash
bun scripts:processing:separations
```

### Run Specific Pipeline Steps
```bash
# Step 8: Audio separation
bun scripts:processing:orchestrator --step=8

# Steps 9-10 (use orchestrator directly)
bun run-unified.ts --step=9 --limit=10
```

### Backfill Data
```bash
bun scripts:backfill
```

### Migration Operations
```bash
# Apply latest migrations
bun scripts:migration:karaoke-segments

# Clean up data issues
bun scripts:migration:language-data

# Update track metadata
bun scripts:migration:update-images
```

## 🆕 Recent Changes (2025-10-30)

- ✅ **Fixed import paths** - All scripts now use correct relative imports
- ✅ **Reorganized into functional subdirectories** - Better organization by purpose
- ✅ **Updated database schema references** - Corrected table/field names to match current schema
- ✅ **Externalized configurations** - Hardcoded URLs now use environment variables
- ✅ **Updated package.json scripts** - Added convenience scripts for each category
- ✅ **Removed duplicates** - Eliminated outdated/duplicate scripts
- ✅ **Updated documentation** - Comprehensive guide for each script category

All scripts now work with the current database schema and follow consistent patterns.
