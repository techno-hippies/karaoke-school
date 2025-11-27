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
# Add a song
bun src/scripts/add-song.ts --iswc=T0112199333 --title="Toxic" --artist="Britney Spears" --spotify-id=717TY4sfgKQm4kFbYQIzgo

# Add translated lyrics
bun src/scripts/add-lyrics.ts --iswc=T0112199333 --language=zh

# Generate exercises
bun src/scripts/generate-exercises.ts --iswc=T0112199333

# Create and emit clip
bun src/scripts/insert-clip.ts --iswc=T0112199333 --start=93548 --end=103548
bun src/scripts/emit-clip.ts --clip-id=<uuid>

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
├── songs/              # Song data organized by ISWC
│   └── T0112199333/
│       ├── en-lyrics.txt
│       ├── zh-lyrics.txt
│       └── original.mp3
├── accounts/           # Posting account configs
└── src/
    ├── scripts/        # CLI commands
    ├── services/       # External API integrations
    ├── db/             # Database queries
    └── lib/            # Utilities
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `add-song.ts` | Add song to database |
| `add-lyrics.ts` | Add translated lyrics |
| `generate-exercises.ts` | Create translation/sayitback questions |
| `insert-clip.ts` | Create clip record |
| `emit-clip.ts` | Emit ClipRegistered event |
| `emit-exercises.ts` | Emit exercise questions |

## Contracts (Lens Testnet)

- **KaraokeEvents**: `0x51aA6987130AA7E4654218859E075D8e790f4409`
- **ExerciseEvents**: `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832`
