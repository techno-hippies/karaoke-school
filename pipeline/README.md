# Karaoke School Pipeline

Content pipeline for creating karaoke learning content with on-chain tracking.

## Setup

```bash
cd pipeline
bun install
cp .env.example .env  # Fill in credentials
```

## Quick Start

```bash
# Add a song (fetches artist from Spotify, uploads cover images to Grove)
bun src/scripts/add-song.ts --iswc=T0112199333 --title="Toxic" --spotify-id=717TY4sfgKQm4kFbYQIzgo

# Process audio (Demucs separation + FAL enhancement)
bun src/scripts/process-audio.ts --iswc=T0112199333

# Align lyrics (word-level timing via ElevenLabs)
bun src/scripts/align-lyrics.ts --iswc=T0112199333

# Add translated lyrics
bun src/scripts/add-lyrics.ts --iswc=T0112199333 --language=zh

# Generate exercises (writes to DB; emit with emit-exercises.ts)
# - Translation exercises are currently EN → ZH multiple choice
bun src/scripts/generate-exercises.ts --iswc=T0112199333 --type=translation
bun src/scripts/generate-exercises.ts --iswc=T0112199333 --type=sayitback

# Generate trivia (fetch facts first, then generate)
bun src/scripts/fetch-songfacts.ts --iswc=T0112199333
bun src/scripts/generate-trivia.ts --iswc=T0112199333

# Select and create clip (~60s segment)
bun src/scripts/select-clip.ts --iswc=T0112199333
bun src/scripts/create-clip.ts --iswc=T0112199333

# Emit to chain
bun src/scripts/emit-clip-full.ts --iswc=T0112199333
bun src/scripts/emit-exercises.ts --iswc=T0112199333
```

## Full Documentation

See **[AGENTS.md](../AGENTS.md)** for complete pipeline documentation including:
- Database schema and queries
- All available scripts with arguments
- Smart contract addresses
- Environment variables
- Cost estimates

## Pipeline Flow

```
1. add-song.ts          → Creates song + artist + EN lyrics in DB
2. process-audio.ts     → Demucs separation + FAL enhancement
3. align-lyrics.ts      → ElevenLabs word-level timing
4. add-lyrics.ts        → Add translated lyrics (zh, vi, id, ja, ko)
5. generate-exercises   → Translation + sayitback exercises (trivia is separate)
5b. generate-trivia.ts  → Trivia exercises (SongFacts + Genius)
6. select-clip.ts       → Auto-select ~60s clip boundary
7. create-clip.ts       → Crop enhanced instrumental
8. emit-clip-full.ts    → Emit ClipRegistered to KaraokeEvents
9. emit-exercises.ts    → Emit translation + trivia exercises to ExerciseEvents
10. emit-translation.ts → (Optional) Emit lyric translations via TranslationEvents
```

**Note:** Step 10 allows adding new languages without re-emitting clips.

## Directory Structure

```
pipeline/
├── songs/                    # Ignored in git (media files)
│   └── T0112199333/
│       ├── en-lyrics.txt     # English lyrics
│       ├── zh-lyrics.txt     # Chinese lyrics
│       ├── original.mp3      # Full audio (or .flac/.wav/.m4a)
│       ├── alignment.json    # Character timing from ElevenLabs
│       ├── background.mp4    # Raw video for covers
│       ├── vocals.mp3        # Audio clip with vocals
│       ├── clip.ass          # Generated subtitles
│       └── clip.mp4          # Final karaoke video
├── accounts/                 # Posting account avatars
└── src/
    ├── scripts/              # CLI commands
    ├── services/             # External APIs
    ├── db/                   # Database connection + queries
    ├── lib/                  # Utilities
    ├── config/               # Environment validation
    └── types/                # TypeScript definitions
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `add-song.ts` | Add song + artist + cover images to Grove |
| `process-audio.ts` | Demucs separation + FAL enhancement |
| `align-lyrics.ts` | Word-level timing via ElevenLabs |
| `generate-exercises.ts` | Create translation/sayitback questions |
| `generate-trivia.ts` | Generate trivia from SongFacts + Genius |
| `emit-clip-full.ts` | Emit clip with Zod validation |
| `emit-translation.ts` | Emit lyric translations (extensible, no re-emit needed) |
| `generate-karaoke-video.ts` | Generate karaoke video with highlighting |
| `post-clip.ts` | Post video to Lens feed |

## Contracts (Lens Testnet - Chain 37111)

| Contract | Address |
|----------|---------|
| KaraokeEvents | `0xd942eB51C86c46Db82678627d19Aa44630F901aE` |
| ExerciseEvents | `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832` |
| TranslationEvents | `0xB524A8A996CE416484eB4fd8f18D9c04a147FdeD` |

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

## Storage Layers

Primary storage is **Grove** (Lens IPFS). Redundancy via **Arweave** (metadata) and **Lighthouse** (large files). See [STORAGE-LAYERS.md](./STORAGE-LAYERS.md) for details.

## Cost per Song

| Operation | Cost |
|-----------|------|
| Demucs (RunPod) | ~$0.05 |
| FAL Enhancement | ~$0.10 |
| ElevenLabs Alignment | ~$0.20 |
| OpenRouter Translation | ~$0.05 |
| Grove/Chain | Free |
| **Total** | **~$0.40** |
