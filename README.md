# Karaoke School

**AI-powered language learning through music**

Learn languages by singing along to your favorite songs with word-level karaoke timing, AI pronunciation scoring, and spaced repetition.

## How It Works

1. **Listen** - Songs with dual-language subtitles (English + Chinese/Vietnamese/Indonesian)
2. **Practice** - Sing along with AI-enhanced instrumentals
3. **Learn** - FSRS spaced repetition schedules your reviews
4. **Score** - AI grades pronunciation and timing

## Architecture

```
Songs (ISWC) → Pipeline → Database → Lens Posts → App
                  ↓
            [Audio Processing]
            - Demucs separation (vocals/instrumental)
            - FAL enhancement
            - ElevenLabs word-level alignment
            - OpenRouter translations
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | SolidJS + Vite |
| Database | Neon PostgreSQL |
| Storage | Grove (IPFS) |
| Social | Lens Protocol |
| Identity | Lit Protocol PKPs |
| AI Scoring | Lit Actions + Voxtral |

### Smart Contracts (Lens Testnet)

| Contract | Purpose |
|----------|---------|
| ExerciseEvents | FSRS exercise grading |
| KaraokeEvents | Clip lifecycle + session tracking |
| AccountEvents | User accounts |
| TranslationEvents | Optional translation tracking |

## Project Structure

```
karaoke-school-v1/
├── app/              # React frontend (5173)
├── pipeline/         # Content processing pipeline
├── livestream-ai/    # AI livestreaming service
├── contracts/        # Solidity smart contracts
├── subgraph/         # The Graph indexer
└── lit-actions/      # AI scoring actions
```

## Quick Start

```bash
# Frontend
cd app && bun install && bun run dev

# Pipeline (process new songs)
cd pipeline && bun install
bun src/scripts/add-song.ts --help
```

## Documentation

- **[AGENTS.md](./AGENTS.md)** - Technical guide for running the pipeline
- **[app/docs/](./app/docs/)** - Frontend documentation

## License

MIT
