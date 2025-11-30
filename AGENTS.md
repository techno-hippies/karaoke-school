# Karaoke School - Agent Guide

Technical reference for AI agents running the content pipeline.

## Database

**Project**: `silent-rain-11383465` (karaoke-pipeline-v3)
**Connection**: Use `DATABASE_URL` env var

```sql
-- Check song status
SELECT iswc, title, stage FROM songs;

-- Check lyrics
SELECT line_index, language, text FROM lyrics WHERE song_id = '<uuid>' ORDER BY line_index, language;

-- Check exercises
SELECT exercise_type, language_code, emitted_at FROM exercises WHERE song_id = '<uuid>';

-- Check clips
SELECT id, start_ms, end_ms, emitted_at FROM clips WHERE song_id = '<uuid>';
```

### Tables

| Table | Purpose |
|-------|---------|
| `songs` | Core song data (ISWC, title, spotify_track_id, audio URLs, cover images) |
| `artists` | Artist metadata (name, slug, image_grove_url) |
| `lyrics` | Line-by-line lyrics (en, zh) with word-level timing |
| `clips` | Clip segments with start/end ms, emission status |
| `exercises` | Translation, trivia, sayitback questions |
| `accounts` | Posting accounts (scarlett) |
| `genius_referents` | Song annotations for trivia generation |

### Key Song Columns

| Column | Purpose |
|--------|---------|
| `cover_grove_url` | Full-size album art (640x640) on Grove |
| `thumbnail_grove_url` | Thumbnail (300x300) on Grove for lists |
| `spotify_images` | Original Spotify CDN URLs (reference only) |
| `clip_instrumental_url` | Free clip audio on Grove |
| `encrypted_full_url_testnet` | Lit-encrypted full audio |
| `lyric_tags` | AI-generated psychographic tags from lyrics (e.g., `["ambition", "resilience"]`) |

### Key Clip Columns

| Column | Purpose |
|--------|---------|
| `visual_tags` | Manual tags describing video visuals (e.g., `["anime", "streetwear"]`) |
| `lyric_tags` | Psychographic tags (can override song-level tags) |

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. add-song.ts         Creates song + artist + EN lyrics in DB         │
│                                                                         │
│  2. process-audio.ts    Demucs separation + FAL enhancement             │
│     └─► Creates: vocals_url, instrumental_url, enhanced_url             │
│                                                                         │
│  3. align-lyrics.ts     ElevenLabs forced alignment                     │
│     └─► Creates: word-level timing on lyrics table                      │
│                                                                         │
│  4. add-lyrics.ts       Add translated lyrics (zh, vi, id)              │
│                                                                         │
│  5. generate-exercises.ts  Create translation + sayitback questions     │
│                                                                         │
│  6. insert-clip.ts      Create clip record in DB                        │
│                                                                         │
│  7. emit-clip.ts        Emit ClipRegistered to KaraokeEvents            │
│                                                                         │
│  8. emit-exercises.ts   Emit TranslationQuestionRegistered              │
│                                                                         │
│  9. generate-video.ts   FFmpeg with ASS subtitles (optional)            │
│                                                                         │
│ 10. post-clip.ts        Post to Lens feed (optional)                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
cd pipeline-new

# 1. Create song folder and add lyrics
mkdir -p songs/T0112199333
# Add en-lyrics.txt and zh-lyrics.txt to folder

# 2. Add song to database
bun src/scripts/add-song.ts --iswc=T0112199333 --title="Toxic" --artist="Britney Spears" --spotify-id=717TY4sfgKQm4kFbYQIzgo

# 3. Process audio (optional - if original.mp3 available)
bun src/scripts/process-audio.ts --iswc=T0112199333

# 4. Align lyrics
bun src/scripts/align-lyrics.ts --iswc=T0112199333

# 5. Add ZH lyrics
bun src/scripts/add-lyrics.ts --iswc=T0112199333 --language=zh

# 6. Generate exercises
bun src/scripts/generate-exercises.ts --iswc=T0112199333

# 7. Create clip (start/end in ms)
bun src/scripts/insert-clip.ts --iswc=T0112199333 --start=93548 --end=103548

# 8. Emit clip to chain (with Zod validation)
bun src/scripts/emit-clip-full.ts --iswc=T0112199333

# 9. Emit exercises to chain
bun src/scripts/emit-exercises.ts --iswc=T0112199333
```

## Scripts Reference

### Core Pipeline

| Script | Purpose | Args |
|--------|---------|------|
| `add-song.ts` | Create song + artist + EN lyrics + cover images | `--iswc`, `--title`, `--spotify-id` |
| `add-lyrics.ts` | Add translated lyrics | `--iswc`, `--language` |
| `align-lyrics.ts` | ElevenLabs word alignment | `--iswc` |
| `process-audio.ts` | Demucs + FAL | `--iswc` |
| `generate-exercises.ts` | Translation/trivia/sayitback | `--iswc` |
| `insert-clip.ts` | Create clip record | `--iswc`, `--start`, `--end` |
| `emit-clip.ts` | Emit ClipRegistered (simple) | `--iswc` or `--clip-id` |
| `emit-clip-full.ts` | Full emit with Zod validation | `--iswc`, `--upload-images`, `--dry-run` |
| `emit-exercises.ts` | Emit exercises to chain | `--iswc`, `--limit` |

### Video Generation & Posting

| Script | Purpose | Args |
|--------|---------|------|
| `generate-karaoke-video.ts` | Generate karaoke video with char-by-char highlighting | `--iswc` or `--song-dir` |
| `generate-lyric-tags.ts` | AI-generate psychographic tags from lyrics (Gemini 2.5 Flash) | `--iswc`, `--dry-run` |
| `post-clip.ts` | Post to Lens (requires visual + lyric tags) | `--video-id`, `--account`, `--visual-tags` |

### Account Management

| Script | Purpose | Args |
|--------|---------|------|
| `create-account.ts` | Create posting account | `--handle`, `--name` |
| `create-lens-account.ts` | Lens account for posting | `--handle` |
| `mint-pkp.ts` | PKP for signing | `--handle` |

### Subscription Locks

| Script | Purpose | Args |
|--------|---------|------|
| `deploy-artist-lock.ts` | Deploy Unlock Protocol lock for artist | `--artist-id` or `--spotify-id` |
| `sync-lock-config.ts` | Sync lock addresses from DB → frontend config | (none) |

**Workflow for adding artist subscription:**

```bash
# 1. Deploy lock (updates database automatically)
bun src/scripts/deploy-artist-lock.ts --artist-id=<uuid>

# 2. Sync to frontend config (auto-updates addresses.ts)
bun src/scripts/sync-lock-config.ts

# 3. Rebuild frontend if needed
cd ../app && bun run build
```

The `sync-lock-config.ts` script reads all artist lock addresses from the database and updates `app/src/lib/contracts/addresses.ts` automatically.

### Utilities

| Script | Purpose | Args |
|--------|---------|------|
| `fetch-and-translate.ts` | LRCLIB + auto-translate | `--iswc` |
| `insert-referents.ts` | Add Genius referents | `--iswc`, `--genius-id` |
| `fix-scarlett-account.ts` | Fix account issues | n/a |

## Lyrics Format

**en-lyrics.txt** / **zh-lyrics.txt**:
```
[Intro]
Baby, can't you see

[Verse 1]
A guy like you should wear a warning
It's dangerous, I'm falling

[Chorus]
With a taste of your lips I'm on a ride
```

Rules:
- Section markers: `[Intro]`, `[Verse 1]`, `[Chorus]`, `[Bridge]`, etc.
- One lyric line per line
- Line counts must match between languages
- Empty lines are ignored

## Smart Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| KaraokeEvents | `0x51aA6987130AA7E4654218859E075D8e790f4409` | Clip lifecycle + karaoke grading |
| ExerciseEvents | `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832` | FSRS study cards |
| TranslationEvents | `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6` | Translation additions |
| AccountEvents | `0x3709f41cdc9E7852140bc23A21adCe600434d4E8` | User accounts |

**Network**: Lens Testnet (Chain ID: 37111)
**RPC**: `https://rpc.testnet.lens.xyz`
**Explorer**: `https://block-explorer.testnet.lens.dev`

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
PRIVATE_KEY=0x...

# Audio processing
ELEVENLABS_API_KEY=...
RUNPOD_API_KEY=...
RUNPOD_DEMUCS_ENDPOINT_ID=...
FAL_API_KEY=...

# Metadata
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
GENIUS_API_KEY=...

# AI
OPENROUTER_API_KEY=...
```

**Note**: Grove storage doesn't require an API key.

## Directory Structure

```
pipeline-new/
├── songs/                       # Ignored in git (media files)
│   └── T0112199333/             # ISWC folder
│       ├── en-lyrics.txt        # English lyrics
│       ├── zh-lyrics.txt        # Chinese lyrics
│       ├── original.mp3         # Full original audio
│       ├── original.flac        # Full original (high quality)
│       ├── cover.mp3            # Cover version audio
│       ├── cover.png            # Album cover image
│       ├── thumbnail.jpg        # Video thumbnail
│       ├── alignment.json       # Character-level timing (ElevenLabs)
│       ├── background.mp4       # Raw video clip (no subtitles)
│       ├── vocals.mp3           # Audio clip with vocals
│       ├── clip.ass             # Generated subtitles
│       └── clip.mp4             # Final output video
├── accounts/
│   └── scarlett/
│       └── avatar.png
└── src/
    ├── scripts/                 # CLI commands
    ├── services/                # External APIs (grove, elevenlabs, etc.)
    ├── db/                      # Database queries
    └── lib/                     # Utilities
```

## Common Tasks

### Add a New Song
```bash
# 1. Create folder with lyrics
mkdir -p songs/T0123456789
echo "Line 1\nLine 2" > songs/T0123456789/en-lyrics.txt

# 2. Add to DB
bun src/scripts/add-song.ts --iswc=T0123456789 --title="Song Name" --artist="Artist" --spotify-id=xyz

# 3. Add translations
echo "翻译1\n翻译2" > songs/T0123456789/zh-lyrics.txt
bun src/scripts/add-lyrics.ts --iswc=T0123456789 --language=zh

# 4. Generate exercises
bun src/scripts/generate-exercises.ts --iswc=T0123456789
```

### Create and Emit a Clip
```bash
# Insert clip record (start/end in milliseconds)
bun src/scripts/insert-clip.ts --iswc=T0123456789 --start=30000 --end=40000

# Emit to chain
bun src/scripts/emit-clip.ts --clip-id=<uuid>
```

### Emit Exercises
```bash
# Emit translation exercises (5 at a time)
bun src/scripts/emit-exercises.ts --iswc=T0123456789 --limit=5

# Dry run to preview
bun src/scripts/emit-exercises.ts --iswc=T0123456789 --dry-run
```

### Generate Karaoke Video
```bash
# Requires in songs/{ISWC}/:
#   - background.mp4   (raw video)
#   - vocals.mp3       (audio clip with vocals)
#   - alignment.json   (character-level timing from ElevenLabs)

# Generate video with char-by-char highlighting
bun src/scripts/generate-karaoke-video.ts --iswc=T0123456789

# Outputs:
#   - clip.ass   (subtitle file)
#   - clip.mp4   (final video)
```

## Subgraph

**Endpoint**: `https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v0.0.8`

```graphql
query {
  clips(first: 10) {
    id
    spotifyTrackId
    clipStartMs
    clipEndMs
  }
  translationQuestions(first: 10) {
    id
    spotifyTrackId
    languageCode
    metadataUri
  }
}
```

## Clip Metadata Structure (v2.0.0)

Clip metadata is validated with Zod (`pipeline-new/src/lib/schemas.ts`) before upload to Grove.

### Key Fields

```typescript
{
  version: '2.0.0',
  type: 'karaoke-clip',

  // Identifiers
  clipHash: '0x...',              // bytes32 (64 hex chars)
  iswc: 'T0123456789',            // T + 10 digits
  spotifyTrackId: '22chars...',   // Exactly 22 characters

  // Images (must be Grove URLs)
  coverUri: 'https://api.grove.storage/...',      // 640x640
  thumbnailUri: 'https://api.grove.storage/...',  // 300x300

  // Audio assets
  assets: {
    clipInstrumental: '...',      // Free clip audio (~50s)
    fullInstrumental: '...',      // Full song audio (subscribers)
  },

  // Lyrics - FREE users (clip portion only)
  karaoke_lines: [...],           // 7-10 lines for clip

  // Lyrics - SUBSCRIBERS (full song)
  full_karaoke_lines: [...],      // All lines (e.g., 49 for Bohemian Rhapsody)

  // Stats
  stats: {
    clipLyricsLines: 7,
    fullLyricsLines: 49,
    totalLyricsLines: 49,
  }
}
```

### Subscriber vs Free User

| Feature | Free User | Subscriber |
|---------|-----------|------------|
| Audio | `clipInstrumental` (~50s) | `fullInstrumental` (full song) |
| Lyrics | `karaoke_lines` (clip only) | `full_karaoke_lines` (all lines) |
| Karaoke Practice | Clip portion only | Full song |

The frontend (`MediaPageContainer.tsx`) automatically selects the right lyrics based on subscription status:
- Checks NFT balance via Unlock Protocol on Base Sepolia
- Uses `full_karaoke_lines` if subscriber, `karaoke_lines` otherwise

### Validation

The `emit-clip-full.ts` script validates metadata before emitting:
- Use `--dry-run` to preview without emitting
- Use `--upload-images` to upload missing cover images from Spotify CDN to Grove
- Auto-generates Chinese translations via AI if missing

## Psychographic Tagging System

Posts include two types of tags for AI chat context and user profiling:

### Visual Tags (Manual)
Describe what's visually in the video. Provided via `--visual-tags` flag when posting.

Examples:
- `anime`, `death-note`, `cosplay` (visual style)
- `streetwear`, `gangster`, `urban` (fashion/aesthetic)
- `kinky`, `latex`, `submissive` (adult themes)

### Lyric Tags (AI-Generated)
Psychographic themes from song lyrics. Generated via `generate-lyric-tags.ts`.

Examples:
- Toxic: `self-destructive-desire`, `addictive-attraction`, `hedonistic-surrender`
- Lose Yourself: `ambition`, `perseverance`, `self-actualization`

### Workflow

```bash
# 1. Generate lyric tags (run once per song)
bun src/scripts/generate-lyric-tags.ts --iswc=T0112199333

# 2. Post with visual tags (required)
bun src/scripts/post-clip.ts --video-id=<uuid> --account=scarlett \
  --visual-tags="kinky,latex,submissive"
```

The `post-clip.ts` script will **fail** if:
- `--visual-tags` is not provided
- `lyric_tags` is not set in the database (run `generate-lyric-tags.ts` first)

### Usage in AI Chat

The frontend `useChatContext` hook reads these tags from Lens post metadata to build psychographic profiles:
- Users who watch videos tagged `anime`, `death-note` → interests in anime
- Users who engage with lyrics tagged `heartbreak`, `nostalgia` → emotional preferences

## Cost Estimates

| Operation | Cost |
|-----------|------|
| Demucs (RunPod) | ~$0.05 |
| FAL Enhancement | ~$0.10 |
| ElevenLabs Alignment | ~$0.20 |
| Grove Storage | Free |
| OpenRouter Translation | ~$0.05 |
| OpenRouter Lyric Tags | ~$0.01 |
| Chain Transaction | ~$0.001 |
| **Total per song** | **~$0.41** |
