# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Song uploader tool for uploading karaoke songs to Grove (Lens Chain decentralized storage) with word-level timestamp generation using ElevenLabs API. Songs are managed in an immutable registry stored on Grove (new URI created on each update due to Grove platform limitations).

## Key Commands

### Development Commands
```bash
bun install                      # Install dependencies
bun run process                  # Enhanced processing with ElevenLabs word-level timestamps
bun run upload                   # Upload using existing metadata.json files
bun run add-song                 # Only upload new songs not in registry
bun run sync                     # Sync registry with local songs (handles failures)
bun run create-registry          # Initialize empty registry
```

### Environment Setup
```bash
cp .env.example .env            # Copy example environment file
# Edit .env with your PRIVATE_KEY, ELEVENLABS_API_KEY, and REGISTRY_URI
```

**Important Environment Variables:**
- `PRIVATE_KEY`: Wallet private key for signing Grove operations (encrypted via dotenvx)
- `ELEVENLABS_API_KEY`: API key for ElevenLabs word-level timestamp generation (encrypted via dotenvx)
- `REGISTRY_URI`: Current registry URI (update this after each upload that adds songs)

Note: This project uses `@dotenvx/dotenvx` for encrypted environment variables.

## Architecture

### Core Components

**Main Upload Pipeline (src/upload.ts:322)**
- Entry point that orchestrates the upload workflow
- Supports multiple modes: `--process`, `--add`, `--init`, `--sync`
- Handles wallet initialization, registry management, and song processing
- Uses Grove storage via `@lens-chain/storage-client`

**Registry System (src/registry.ts)**
- **createRegistry**: Creates initial empty registry on Grove (immutable)
- **loadRegistry**: Fetches registry from Grove gateway
- **addSongToRegistry**: Adds song entry to registry data structure
- **updateRegistry**: Creates new registry with updated songs (returns new URI)
- Registry structure: `{ version, lastUpdated, songs[] }`
- Each song entry contains: id, title, artist, duration, audioUri, timestampsUri, thumbnailUri, addedAt
- **IMPORTANT**: Uses immutable uploads - each update creates a NEW registry URI

**Wallet Management (src/wallet.ts)**
- Creates viem wallet client from private key
- Configured for Lens Chain mainnet
- Note: Wallet is initialized but not used for ACL (using immutable uploads instead)
- Validates private key format (0x prefix, 64 hex chars)

**ElevenLabs Processor (src/processors/elevenlabs.ts)**
- Calls ElevenLabs forced-alignment API for word-level timestamps
- Implements caching system using localStorage (7-day TTL)
- Generates SHA-256 hashes for audio files and lyrics for cache keys
- Filters whitespace-only tokens from API response (line 163)

**Metadata Generator (src/processors/metadata.ts)**
- Converts ElevenLabs word timestamps into structured metadata
- Maps words to lyric lines using similarity matching (line 33)
- Generates EnhancedSongMetadata v2 format with line/word structure
- Validates timing consistency and metadata completeness (line 216)

### Data Flow

1. **Processing Mode** (`--process`):
   - Scan `./songs/` directory for song folders
   - Load song files: audio (full song), voiceStems (optional), lyrics.txt, translations/*.txt (optional), thumbnail
   - Check for existing `karaoke-alignment.json` (skips ElevenLabs API if exists)
   - If no alignment file: Send voiceStems (or fallback to full audio) + lyrics to ElevenLabs API
   - Generate enhanced metadata with word-level timestamps
   - Upload to Grove: full audio + generated metadata.json + thumbnail
   - Add entry to registry with Grove URIs
   - Create new registry on Grove with all songs (returns new URI)
   - **IMPORTANT**: Saves new registry URI to `output/registry-uri.txt` and prints warning to update `.env`

2. **Legacy Upload Mode** (default):
   - Requires pre-existing metadata.json files
   - Uploads audio + metadata.json + thumbnail to Grove
   - Adds to registry
   - Creates new registry URI

3. **Grove Upload Structure**:
   - Files uploaded as folder with dynamic index
   - Index maps resources by order: [0]=audio, [1]=metadata, [2]=thumbnail
   - Returns folder URI and individual file URIs
   - Registry stores URIs for client consumption

### Important Implementation Details

**Audio File Handling (src/upload.ts:72-83)**
- Two audio file types supported:
  - Full song audio: Used for Grove upload and playback
  - Voice stems: Used ONLY for ElevenLabs processing (better accuracy), NOT uploaded to Grove
- Voice stems detected by filename containing "vocals" or "stems"
- If no voice stems, full audio used for both purposes

**Grove ACL Pattern**
```typescript
const acl = immutable(chains.mainnet.id)
```
All uploads are immutable on Lens Chain mainnet. No wallet signing required.

**Registry Update Behavior (src/registry.ts)**
- Creates new registry with `storage.uploadAsJson` on each update
- Returns new URI which must be saved to `.env` as `REGISTRY_URI`
- Old registry remains accessible but is superseded by new one
- This is a workaround for Grove's mutable update propagation issues

**Metadata Format v2** (Enhanced)
```typescript
{
  version: 2,
  title: string,
  artist: string,
  duration: number,
  format: "word-and-line-timestamps",
  lines: [{
    lineIndex: number,
    originalText: string,
    translatedText?: string,
    start: number,
    end: number,
    words: [{ text: string, start: number, end: number }]
  }],
  elevenLabsProcessed: true,
  wordCount: number,
  lineCount: number
}
```

**Song Folder Structure** (expected in `./songs/`)
```
songs/
├── song-1/
│   ├── audio.mp3                          # Required: Full song
│   ├── audio (Vocals).mp3                 # Optional: Isolated vocals for ElevenLabs
│   ├── lyrics.txt                         # Required for --process
│   ├── karaoke-alignment.json             # Auto-generated by ElevenLabs (cached)
│   ├── metadata.json                      # Auto-generated or pre-existing
│   ├── thumbnail.jpg                      # Optional: Cover art
│   └── translations/                      # Optional: Folder with translation files
│       ├── cn.txt                         # Chinese translation (one line per lyric line)
│       ├── vi.txt                         # Vietnamese translation
│       └── es.txt                         # Spanish translation (etc.)
```

## TypeScript Configuration

- Uses Bun runtime with ES modules (`"type": "module"`)
- Target: ES2022, Module: ESNext
- Strict mode enabled with noUncheckedIndexedAccess
- Module resolution: "bundler" (Bun-specific)
- Allows importing .ts extensions directly

## Output & Registry Management

- **Registry URI**: Saved to `./output/registry-uri.txt` after each upload
- **IMPORTANT WORKFLOW**: After adding songs, you MUST update `.env` with the new `REGISTRY_URI`
- The karaoke app should read the registry URI from your configuration to load the song catalog

### Registry Update Workflow
1. Run `bun run process` to add new songs
2. Script outputs new registry URI and saves to `output/registry-uri.txt`
3. **Manually update `.env`** with the new `REGISTRY_URI` value
4. Update your karaoke app configuration to use the new registry URI

Example:
```bash
# After upload completes:
# New Registry URI: lens://24cdef29730ca5e8fe18c1a39f5ce65225c8558d414810e88ad344ced296a87b

# Update .env:
REGISTRY_URI="lens://24cdef29730ca5e8fe18c1a39f5ce65225c8558d414810e88ad344ced296a87b"
```

## Common Issues

1. **Registry URI Changes**: Each upload creates a NEW registry URI. This is intentional due to Grove's mutable update limitations. Always update `.env` with the latest URI.

2. **ElevenLabs API Errors**: Check that lyrics.txt is clean (no excessive markup). The processor removes `[Verse]`, `[Chorus]` tags automatically but preserves them in output.

3. **ElevenLabs Caching**: The system caches alignment results in `karaoke-alignment.json`. Delete this file to force re-processing with the API.

4. **Word Mapping Mismatches**: The metadata generator uses fuzzy matching (first 3 chars for words >3 chars). If alignment is poor, check that lyrics match the actual audio.

5. **Missing Voice Stems**: Not required but significantly improves ElevenLabs accuracy. Full audio is used as fallback.

## Dependencies

- `@lens-chain/storage-client`: Grove storage operations
- `@lens-chain/sdk`: Lens Chain utilities and chains config
- `viem`: Ethereum wallet and signing operations
- `@dotenvx/dotenvx`: Encrypted environment variable management