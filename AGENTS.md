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
| `artists` | Artist metadata (name, slug, image_grove_url, genres) |
| `lyrics` | Line-by-line lyrics (en, zh) with word-level timing |
| `clips` | Clip segments with start/end ms, emission status |
| `exercises` | Translation, trivia, sayitback questions |
| `accounts` | Posting accounts (scarlett) |
| `genius_referents` | Song annotations for trivia generation (interpretive) |
| `songfacts` | Curated song trivia from songfacts.com (factual) |

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
│  4. add-lyrics.ts       Add translated lyrics (zh, vi, id, ja, ko)      │
│     └─► Or use fetch-and-translate.ts to auto-translate                 │
│                                                                         │
│  4b. translate-names.ts  AI-translate song/artist names (12 languages)  │
│     └─► Languages: zh, vi, id, ja, ko, es, pt, ar, tr, ru, hi, th       │
│                                                                         │
│  5. generate-exercises.ts  Create translation + sayitback questions     │
│                                                                         │
│  6. select-clip.ts      Auto-select ~60s clip boundary (after intro)    │
│     └─► Sets: clip_end_ms on song                                       │
│                                                                         │
│  7. create-clip.ts      Crop FAL enhanced instrumental to clip_end_ms   │
│     └─► Creates: clip_instrumental_url on Grove                         │
│                                                                         │
│  8. emit-clip-full.ts   Emit ClipRegistered to KaraokeEvents            │
│                                                                         │
│  9. emit-exercises.ts   Emit TranslationQuestionRegistered              │
│                                                                         │
│ OPTIONAL - Cover video for Lens feed:                                   │
│ 10. generate-karaoke-video.ts  FFmpeg with ASS subtitles                │
│ 11. post-clip.ts        Post cover video to Lens feed                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Clip vs Cover (Important Distinction)

| Term | What it is | Purpose |
|------|-----------|---------|
| **Clip** | ~60s of FAL enhanced **instrumental** | Free preview for non-subscribers (emitted to chain) |
| **Cover** | Video + cover audio (`cover.mp3` + `cover.mp4`) | Posted to Lens feed for engagement |

- Clips are created from the **original song's instrumental** (processed via Demucs + FAL)
- Covers are separate recordings/videos for social media posting

## Quick Start

```bash
cd pipeline

# 1. Create song folder and add lyrics
mkdir -p songs/T0112199333
# Add en-lyrics.txt and zh-lyrics.txt to folder

# 2. Add song to database (artist auto-fetched from Spotify)
bun src/scripts/add-song.ts --iswc=T0112199333 --title="Toxic" --spotify-id=717TY4sfgKQm4kFbYQIzgo

# 3. Process audio (optional - if original.mp3 available)
bun src/scripts/process-audio.ts --iswc=T0112199333

# 4. Align lyrics
bun src/scripts/align-lyrics.ts --iswc=T0112199333

# 5. Add ZH lyrics
bun src/scripts/add-lyrics.ts --iswc=T0112199333 --language=zh

# 6. Generate exercises (translation + sayitback)
bun src/scripts/generate-exercises.ts --iswc=T0112199333

# 6b. Generate trivia (fetch facts first, then generate)
bun src/scripts/fetch-songfacts.ts --iswc=T0112199333
bun src/scripts/generate-trivia.ts --iswc=T0112199333

# 7. Select clip boundary (~60s, auto-finds section break)
bun src/scripts/select-clip.ts --iswc=T0112199333

# 8. Create clip audio (crops FAL enhanced instrumental)
bun src/scripts/create-clip.ts --iswc=T0112199333

# 9. Emit clip to chain (with Zod validation)
bun src/scripts/emit-clip-full.ts --iswc=T0112199333

# 10. Emit exercises to chain
bun src/scripts/emit-exercises.ts --iswc=T0112199333

# 11. (Optional) Emit additional translations via TranslationEvents
# This allows adding new languages without re-emitting the clip
bun src/scripts/emit-translation.ts --iswc=T0112199333 --language=ja  # Single language
bun src/scripts/emit-translation.ts --iswc=T0112199333 --all          # All available
```

## Scripts Reference

### Core Pipeline

| Script | Purpose | Args |
|--------|---------|------|
| `add-song.ts` | Create song + artist + EN lyrics + cover images | `--iswc`, `--title`, `--spotify-id` |
| `add-lyrics.ts` | Add translated lyrics from file | `--iswc`, `--language` |
| `translate-names.ts` | AI-translate song/artist names (12 languages) | `--iswc`, `--all`, `--dry-run`, `--limit` |
| `fetch-and-translate.ts` | Auto-fetch from LRCLIB + translate | `--iswc` |
| `align-lyrics.ts` | ElevenLabs word alignment | `--iswc` |
| `process-audio.ts` | Demucs + FAL (supports .mp3/.flac/.wav/.m4a, auto-converts to MP3) | `--iswc` |
| `generate-exercises.ts` | Translation/sayitback exercises | `--iswc`, `--type`, `--limit` |
| `fetch-songfacts.ts` | Scrape trivia from songfacts.com | `--iswc`, `--all`, `--dry-run` |
| `generate-trivia.ts` | Generate trivia from SongFacts + Genius | `--iswc`, `--all`, `--limit`, `--dry-run` |
| `select-clip.ts` | Auto-select ~60s clip boundary | `--iswc`, `--dry-run` |
| `create-clip.ts` | Crop enhanced instrumental to clip | `--iswc`, `--dry-run` |
| `emit-clip-full.ts` | Full emit with Zod validation | `--iswc`, `--upload-images`, `--dry-run` |
| `emit-exercises.ts` | Emit exercises to chain | `--iswc`, `--limit` |
| `emit-translation.ts` | Emit lyric translations (extensible, no re-emit) | `--iswc`, `--language`, `--all`, `--update`, `--dry-run` |

### Video Generation & Posting

| Script | Purpose | Args |
|--------|---------|------|
| `generate-karaoke-video.ts` | Generate karaoke video with char-by-char highlighting (uses alignment.json) | `--iswc` or `--song-dir` |
| `generate-video.ts` | Generate video from DB lyrics with time range (more complex) | `--iswc`, `--start`, `--end` |
| `generate-lyric-tags.ts` | AI-generate psychographic tags from lyrics (Gemini 2.5 Flash) | `--iswc`, `--dry-run` |
| `post-clip.ts` | Post to Lens (requires visual + lyric tags) | `--video-id`, `--account`, `--visual-tags` |

### Account Management

| Script | Purpose | Args |
|--------|---------|------|
| `create-account.ts` | Create posting account | `--handle`, `--name` |
| `create-lens-account.ts` | Lens account for posting | `--handle` |
| `mint-pkp.ts` | PKP for signing | `--handle` |

**Lens Account Naming Convention:**
- Custom namespace: `kschool2` (`0x6Cf6bC01D51aF736Cd34bC3a682B7b081eA77B07`)
- Lens handle format: `{handle}-ks` (e.g., `scarlett` → `scarlett-ks`)
- The `-ks` suffix is added automatically by `create-lens-account.ts`

```bash
# Full account creation flow:
bun src/scripts/create-account.ts --handle=newaccount --name="Display Name"
bun src/scripts/mint-pkp.ts --handle=newaccount
bun src/scripts/create-lens-account.ts --handle=newaccount
# Result: Lens account newaccount-ks in kschool2 namespace
```

### Song Purchase (SongAccess Contract)

Songs are purchased via the **SongAccess** custom ERC-721 contract on Base Sepolia.
- Price: ~0.000033 ETH (~$0.10) one-time purchase
- Contract: `0x7856C6121b3Fb861C31cb593a65236858d789bDB`
- Lit Protocol checks `ownsSongByTrackId()` for decryption access

No deployment scripts needed - the contract is already deployed and handles all songs.

### AI Chat Premium (Global Lock)

AI tutor chat premium (better model, better TTS) uses a global Unlock Protocol lock on Base Sepolia.
- Lock: `0xfec85fbc62ca614097b0952b2088442295b269af`
- Price: 0.001 ETH / 30 days
- Used by: ChatContainer.tsx (`PREMIUM_AI_LOCK`)

### Utilities

| Script | Purpose | Args |
|--------|---------|------|
| `insert-referents.ts` | Add Genius referents | `--iswc`, `--genius-id` |
| `fix-scarlett-account.ts` | Fix account issues | n/a |
| `fix-artist-images.ts` | Upload missing artist images to Grove | n/a |
| `delete-post.ts` | Delete a Lens post | `--post-id` |
| `disable-exercises.ts` | Disable exercises for a song | `--iswc` |
| `align-cover.ts` | Align cover audio with ElevenLabs | `--iswc` |
| `encrypt-audio.ts` | Encrypt full audio with Lit (hybrid AES + Lit) | `--iswc`, `--env`, `--dry-run` |

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
| KaraokeEvents | `0xd942eB51C86c46Db82678627d19Aa44630F901aE` | Clip lifecycle + karaoke grading (V6 - JSON 12-language localizations) |
| ExerciseEvents | `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832` | FSRS study cards |
| TranslationEvents | `0xB524A8A996CE416484eB4fd8f18D9c04a147FdeD` | Translation additions (extensible lyric translations) |
| AccountEvents | `0x3709f41cdc9E7852140bc23A21adCe600434d4E8` | User accounts |

**Network**: Lens Testnet (Chain ID: 37111)
**RPC**: `https://rpc.testnet.lens.xyz`
**Explorer**: `https://block-explorer.testnet.lens.dev`

Notes:
- **Lyric translations** come from two sources (in priority order):
  1. `TranslationEvents` via subgraph (`clip.translations[]`) - extensible, no re-emission needed
  2. Inline `*_text` fields in `metadataUri` (`karaoke_lines[].zh_text`, etc.) - legacy fallback
- Use `emit-translation.ts` to add new languages without re-emitting clips
- `ClipToggled` is an optional "hide this clip" switch for moderation; it is not required for the free-preview vs paid-unlock flow.

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
pipeline/
├── songs/                       # Ignored in git (media files)
│   └── T0112199333/             # ISWC folder
│       ├── en-lyrics.txt        # English lyrics
│       ├── zh-lyrics.txt        # Chinese lyrics
│       ├── original.mp3         # Full original audio (auto-converted from FLAC/WAV/M4A)
│       ├── original.flac        # FLAC source (auto-converts to MP3)
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

# 2. Add to DB (artist auto-fetched from Spotify)
bun src/scripts/add-song.ts --iswc=T0123456789 --title="Song Name" --spotify-id=xyz

# 3. Add translations
echo "翻译1\n翻译2" > songs/T0123456789/zh-lyrics.txt
bun src/scripts/add-lyrics.ts --iswc=T0123456789 --language=zh

# 4. Generate exercises
bun src/scripts/generate-exercises.ts --iswc=T0123456789

# 5. Generate trivia
bun src/scripts/fetch-songfacts.ts --iswc=T0123456789
bun src/scripts/generate-trivia.ts --iswc=T0123456789
```

### Create and Emit a Clip
```bash
# Use the full pipeline (recommended)
bun src/scripts/emit-clip-full.ts --iswc=T0123456789

# Or manually: insert clip then emit
bun src/scripts/insert-clip.ts --iswc=T0123456789 --start=30000 --end=40000
bun src/scripts/emit-clip-full.ts --iswc=T0123456789
```

### Emit Exercises
```bash
# Emit translation exercises (5 at a time)
bun src/scripts/emit-exercises.ts --iswc=T0123456789 --limit=5

# Dry run to preview
bun src/scripts/emit-exercises.ts --iswc=T0123456789 --dry-run
```

### Generate Karaoke Video (Chinese covers with char-level alignment)
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

### Generate Cover Video (English covers from DB word timing)

Use `generate-video.ts` when you have:
- A cover video file (with embedded audio or separate audio)
- Word-level timing already in the database (from `align-lyrics.ts`)
- A timestamp range indicating which portion of the song the video covers

**Language modes:**
| Mode | Description |
|------|-------------|
| `--language=zh` | Chinese karaoke only (default) |
| `--language=en` | English karaoke only |
| `--language=en-zh` | English karaoke + Chinese translation below |

**Workflow:**

```bash
# 1. Name your audio clip file with the timestamp range (e.g., 46.379-56.379.mp3)
#    This tells you which lyrics to pull from the DB

# 2. If video has embedded audio, extract it:
ffmpeg -i video.mp4 -vn -acodec libmp3lame -q:a 2 cover.mp3

# 3. Check which lyrics fall in your time range:
#    SELECT text, start_ms, end_ms FROM lyrics
#    WHERE song_id = '<uuid>' AND language = 'en'
#    AND start_ms >= 46379 AND start_ms < 56379;

# 4. Generate video with karaoke subtitles from DB timing:
bun src/scripts/generate-video.ts \
  --iswc=T0123456789 \
  --start=46379 \
  --end=55000 \
  --background=songs/T0123456789/cover-video.mp4 \
  --instrumental=songs/T0123456789/cover.mp3 \
  --pretrimmed \
  --language=en-zh \
  --width=1080 \
  --height=1920

# Key flags:
#   --start/--end    Time range in ms (from original song timing)
#   --pretrimmed     Video/audio already trimmed, only offset lyrics
#   --language       zh | en | en-zh
#   --width/--height Match your video dimensions (check with ffprobe)
```

**Important notes:**
- The `--start` and `--end` values come from the **original song timing** in the DB
- Use `--pretrimmed` when your video/audio is already the clip length
- The script queries `lyrics` table for lines where `start_ms` falls in range
- Lyrics timing is offset to start at 0 for the clip
- Subtitles appear at TOP of screen (alignment 8)
- For `en-zh` mode: English has karaoke fill effect, Chinese is static translation below

## Subgraph

**Endpoint**: `https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v6-translation-events`

```graphql
query {
  clips(first: 10) {
    id
    spotifyTrackId
    clipStartMs
    clipEndMs
    translations {
      languageCode
      translationUri
    }
  }
  exerciseCards(first: 10) {
    id
    spotifyTrackId
    exerciseType
    languageCode
    metadataUri
  }
}
```

## Extensible Translation System

Lyric translations can be added without re-emitting clips using `TranslationEvents`.

### Why Use TranslationEvents?

| Scenario | Without TranslationEvents | With TranslationEvents |
|----------|---------------------------|------------------------|
| Add Japanese to 100 songs | Re-emit 100 `ClipProcessed` events | Emit 100 `TranslationAdded` events |
| Fix typo in Chinese line | Re-upload metadata, re-emit clip | Emit `TranslationUpdated` |
| Disable bad translation | Re-upload metadata without it | Emit `TranslationToggled(false)` |

### Translation Priority (App)

The app loads translations in this priority order:
1. **TranslationEvents** (`clip.translations[]` from subgraph) - highest priority
2. **Inline `*_text`** fields in `karaoke_lines` - legacy fallback

### Usage

```bash
# Add a new language translation
bun src/scripts/emit-translation.ts --iswc=T0112199333 --language=ja

# Emit all available translations for a song
bun src/scripts/emit-translation.ts --iswc=T0112199333 --all

# Update an existing translation (re-emit with new content)
bun src/scripts/emit-translation.ts --iswc=T0112199333 --language=ja --update

# Dry run to preview
bun src/scripts/emit-translation.ts --iswc=T0112199333 --all --dry-run
```

### Translation Metadata Structure

Stored on Grove, referenced by `TranslationAdded` event:

```typescript
{
  version: "1.0.0",
  clipHash: "0x...",
  spotifyTrackId: "...",
  iswc: "T0112199333",
  languageCode: "ja",
  languageName: "日本語",
  generatedAt: "2025-12-12T...",
  validated: false,
  lines: [
    { line_index: 0, text: "日本語の翻訳" },
    { line_index: 1, text: "..." },
  ],
  lineCount: 31
}
```

### Supported Languages

`zh`, `vi`, `id`, `ja`, `ko`, `es`, `pt`, `ar`, `tr`, `ru`, `hi`, `th`

## Clip Metadata Structure (v2.0.0)

Clip metadata is validated with Zod (`pipeline/src/lib/schemas.ts`) before upload to Grove.

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
    clipLyrics: '...',            // Optional: clip lyrics JSON
    alignment: null,              // Optional: alignment JSON (if uploaded)
  },

  // Premium audio access control + decryption info (required for full song)
  encryption: {
    encryptionMetadataUri: '...', // Hybrid AES-GCM + Lit metadata JSON (SongAccess gated)
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
| Audio | `clipInstrumental` (~50s) | Full song via `encryption.encryptionMetadataUri` |
| Lyrics | `karaoke_lines` (clip only) | `full_karaoke_lines` (all lines) |
| Karaoke Practice | Clip portion only | Full song |

The frontend automatically selects the right lyrics based on purchase status:
- Checks ownership via SongAccess contract on Base Sepolia
- Uses `full_karaoke_lines` if purchased, `karaoke_lines` otherwise

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
