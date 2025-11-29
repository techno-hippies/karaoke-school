# Karaoke School Pipeline

Content pipeline for creating karaoke learning content with on-chain tracking.

## Setup

```bash
cd pipeline-new
bun install
cp .env.example .env  # Fill in credentials
```

## Quick Start

```bash
# Add a song (uploads cover images to Grove automatically)
bun src/scripts/add-song.ts --iswc=T0112199333 --title="Toxic" --spotify-id=717TY4sfgKQm4kFbYQIzgo

# Add translated lyrics
bun src/scripts/add-lyrics.ts --iswc=T0112199333 --language=zh

# Generate exercises
bun src/scripts/generate-exercises.ts --iswc=T0112199333

# Create and emit clip (with Zod validation)
bun src/scripts/insert-clip.ts --iswc=T0112199333 --start=93548 --end=103548
bun src/scripts/emit-clip-full.ts --iswc=T0112199333

# Emit exercises
bun src/scripts/emit-exercises.ts --iswc=T0112199333
```

## Full Documentation

See [AGENTS.md](../AGENTS.md) for complete pipeline documentation including:
- Database schema and queries
- All available scripts with arguments
- Smart contract addresses
- Environment variables
- Cost estimates

## Directory Structure

```
pipeline-new/
├── songs/                    # Ignored in git (media files)
│   └── T0112199333/
│       ├── en-lyrics.txt     # English lyrics
│       ├── zh-lyrics.txt     # Chinese lyrics
│       ├── original.mp3      # Full audio
│       ├── alignment.json    # Character timing
│       ├── background.mp4    # Raw video
│       ├── vocals.mp3        # Audio clip
│       ├── clip.ass          # Subtitles
│       └── clip.mp4          # Final output
├── accounts/
└── src/
    ├── scripts/              # CLI commands
    ├── services/             # External APIs
    ├── db/                   # Database queries
    └── lib/                  # Utilities
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `add-song.ts` | Add song + upload cover images to Grove |
| `add-lyrics.ts` | Add translated lyrics |
| `generate-exercises.ts` | Create translation/sayitback questions |
| `generate-karaoke-video.ts` | Generate karaoke video with highlighting |
| `insert-clip.ts` | Create clip record |
| `emit-clip-full.ts` | Emit with Zod validation (`--upload-images`, `--dry-run`) |
| `emit-exercises.ts` | Emit exercise questions |
| `post-clip.ts` | Post video to Lens |

## Contracts (Lens Testnet)

- **KaraokeEvents**: `0x51aA6987130AA7E4654218859E075D8e790f4409`
- **ExerciseEvents**: `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832`
