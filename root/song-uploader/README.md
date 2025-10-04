# Karaoke Song Uploader

CLI tool for preparing and uploading karaoke songs to the **SongCatalogV1** contract with ElevenLabs word-level timestamps.

## Architecture

This tool integrates with the SongCatalogV1 smart contract:

```
Local Songs → ElevenLabs API → Grove Storage → SongCatalogV1 Contract
```

### Data Model Alignment

Songs are uploaded with:
- **Primary ID**: Human-readable slug (e.g., `"heat-of-the-night-scarlett-x"`)
- **Optional Genius ID**: For cross-platform artist/song matching (default: `0`)
- **Optional Genius Artist ID**: For canonical artist identification (default: `0`)
- **Grove URIs**: Immutable storage on Lens Chain (mainnet)
- **Contract Storage**: Song metadata stored on Lens Testnet (chain ID: 37111)

## Quick Start

### 1. Setup

```bash
# Install dependencies
bun install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
PRIVATE_KEY=0x...                          # Your wallet private key
ELEVENLABS_API_KEY=...                     # ElevenLabs API key
SONG_CATALOG_ADDRESS=0x88996135809cc745E6d8966e3a7A01389C774910  # SongCatalogV1 on Lens Testnet
```

### 2. Prepare Songs

```bash
# Place songs in ./songs/ directory with this structure:
songs/
├── song-1/
│   ├── audio.mp3                    # Required: Full song
│   ├── audio (Vocals).mp3           # Optional: Isolated vocals (better timestamps)
│   ├── lyrics.txt                   # Required: One line per lyric line
│   ├── thumbnail.jpg                # Optional: Cover art
│   ├── metadata.json                # Optional: Song info with geniusId
│   └── translations/                # Optional: Translations
│       ├── cn.txt
│       ├── vi.txt
│       └── es.txt
```

### 3. Process & Upload

```bash
# Process songs with ElevenLabs and upload to Grove + contract
bun run process
```

## Song Metadata

### metadata.json Structure

```json
{
  "id": "heat-of-the-night-scarlett-x",
  "geniusId": 12345,
  "geniusArtistId": 67890,
  "title": "Heat of the Night",
  "artist": "Scarlett X",
  "segmentIds": ["verse-1", "chorus-1", "verse-2", "chorus-2"]
}
```

**Fields**:
- `id` (required): Slug-formatted unique identifier
- `geniusId` (optional): Genius API song ID (default: 0)
- `geniusArtistId` (optional): Genius API artist ID (default: 0)
- `title` (optional): Song title (auto-detected from lyrics if not provided)
- `artist` (optional): Artist name (auto-detected from lyrics if not provided)
- `segmentIds` (optional): Array of practice segments (e.g., ["verse-1", "chorus-1"])

**Auto-detected fields**:
- `duration`: Calculated from audio file
- `languages`: Detected from translations/ folder

### Genius ID Integration

If your song exists on Genius.com, add the `geniusId`:

```json
{
  "id": "down-home-blues-ethel-waters",
  "geniusId": 987654,
  "title": "Down Home Blues",
  "artist": "Ethel Waters"
}
```

**Benefits**:
- Unified artist matching across Native and Genius sources
- Cross-platform leaderboards (same artist, different sources)
- Optional - system works without it

**How to find Genius ID**:
1. Search song on Genius.com
2. URL format: `https://genius.com/{artist}-{song}-lyrics`
3. View page source, find `"song":{"id":123456,...}`
4. Or use Genius API search

## Commands

### Development Commands

```bash
# Process songs with ElevenLabs and upload to contract
bun run process

# Add only new songs not in contract
bun run add-song
```

## Features

### ElevenLabs Word-Level Timestamps

- Automatic forced-alignment for word-level timing
- Uses isolated vocals (if available) for better accuracy
- Caching system (7-day TTL) to avoid re-processing
- Cached in `karaoke-alignment.json` per song

### Grove Storage

- Immutable uploads to Lens Chain storage
- All URIs start with `lens://`
- Resolves via `https://gw.lens.xyz/grove/{hash}`
- Assets:
  - Full song audio
  - Word+line timestamp metadata
  - High-res cover
  - 300x300 thumbnail
  - Music video (optional)

### Contract Integration

Uploads directly to **SongCatalogV1** contract:

```solidity
function addSong(
    string calldata id,
    uint32 geniusId,
    uint32 geniusArtistId,
    string calldata title,
    string calldata artist,
    uint32 duration,
    string calldata audioUri,
    string calldata metadataUri,
    string calldata coverUri,
    string calldata thumbnailUri,
    string calldata musicVideoUri,
    string calldata segmentIds,
    string calldata languages
) external onlyOwner;
```

**Contract Address (Lens Testnet)**: `0x88996135809cc745E6d8966e3a7A01389C774910`

## Workflow

### 1. Processing Mode (`bun run process`)

1. Scan `./songs/` for song folders
2. Load audio, lyrics, metadata.json config, translations
3. Check for cached `karaoke-alignment.json`
4. If not cached:
   - Send vocals (or full audio) + lyrics to ElevenLabs API
   - Generate word-level timestamps
   - Cache results locally
5. Build enhanced metadata with word+line structure
6. Upload to Grove: audio, metadata, thumbnail
7. Call `SongCatalogV1.addSong()` with all data
8. Wait for transaction confirmation
9. Display transaction hash and block number

### 2. Add Mode (`bun run add-song`)

1. Query SongCatalogV1 for existing song IDs
2. Only process/upload songs not in contract
3. Useful for incremental additions

## Metadata Format

### Enhanced Song Metadata (v2)

Generated by ElevenLabs processor:

```json
{
  "version": 2,
  "title": "Heat of the Night",
  "artist": "Scarlett X",
  "duration": 194,
  "format": "word-and-line-timestamps",
  "lines": [
    {
      "lineIndex": 0,
      "originalText": "Dancing in the moonlight",
      "translatedText": "在月光下跳舞",
      "start": 0.5,
      "end": 3.2,
      "words": [
        { "text": "Dancing", "start": 0.5, "end": 1.1 },
        { "text": "in", "start": 1.1, "end": 1.3 },
        { "text": "the", "start": 1.3, "end": 1.5 },
        { "text": "moonlight", "start": 1.5, "end": 3.2 }
      ]
    }
  ],
  "elevenLabsProcessed": true,
  "wordCount": 45,
  "lineCount": 12
}
```

## Environment Variables

```bash
# Required
PRIVATE_KEY=0x...                    # Wallet private key (owner of SongCatalog)
ELEVENLABS_API_KEY=...               # ElevenLabs API key
SONG_CATALOG_ADDRESS=0x...           # SongCatalog contract address

# Optional
PKP_ADDRESS=0x254AA...               # PKP address for trusted operations
```

## Contract Information

### SongCatalogV1 (Already Deployed)

**Network**: Lens Chain Testnet (Chain ID: 37111)
**Contract Address**: `0x88996135809cc745E6d8966e3a7A01389C774910`
**Explorer**: https://explorer.testnet.lens.xyz/address/0x88996135809cc745E6d8966e3a7A01389C774910
**Deployment Date**: 2025-10-03

The contract is already deployed and ready to use. Just add the address to your `.env` file.

## Common Issues

### 1. ElevenLabs API Errors

**Problem**: Lyrics formatting issues
**Solution**:
- Ensure `lyrics.txt` is clean (no excessive markup)
- Tool auto-removes `[Verse]`, `[Chorus]` tags but preserves in output
- Check line breaks match actual song structure

### 2. Voice Stems Recommended

**Problem**: Poor word alignment
**Solution**:
- Provide isolated vocals as `audio (Vocals).mp3`
- Much better accuracy than full mix
- Tool falls back to full audio if not available

### 3. Missing Genius ID

**Not a problem!** Genius ID is optional:
- System works perfectly without it
- Add later via `updateSong()` if needed
- Useful for cross-platform features only

### 4. Transaction Failures

**Problem**: Contract transaction reverts
**Solution**:
- Ensure wallet has sufficient ETH on Lens Testnet
- Check that song ID doesn't already exist in catalog
- Verify you're using the correct contract address
- Check wallet is the contract owner

## File Structure

```
song-uploader/
├── src/
│   ├── upload.ts              # Main entry point
│   ├── contract.ts            # SongCatalogV1 integration
│   ├── chains.ts              # Lens Testnet chain config
│   ├── types.ts               # TypeScript types
│   ├── wallet.ts              # Viem wallet setup
│   └── processors/
│       ├── elevenlabs.ts      # ElevenLabs API integration
│       └── metadata.ts        # Metadata generation
├── songs/                     # Song source files
│   └── {song-slug}/
│       ├── audio.mp3
│       ├── audio (Vocals).mp3 # Optional: Voice stems
│       ├── lyrics.txt
│       ├── metadata.json      # Song config
│       ├── karaoke-alignment.json  # Auto-generated cache
│       ├── thumbnail.jpg
│       └── translations/
│           ├── cn.txt
│           └── vi.txt
├── output/                    # Not used (legacy)
├── package.json
├── tsconfig.json
└── .env
```

## Integration with Other Contracts

Songs uploaded via this tool can be used with:

- **StudyProgressV1**: Practice sessions for native songs (`ContentSource.Native` + song `id`)
- **KaraokeScoreboardV4**: Karaoke scoring with native tracks (`ContentSource.Native` + track `id`)
- **TrendingTrackerV1**: Native song trending data
- **Future: ArtistQuizTracker**: Artist-specific quiz challenges (via `geniusArtistId`)

All contracts reference songs using the `id` field from SongCatalogV1.

## Next Steps

After uploading songs:

1. **Configure Tracks**: Add tracks to KaraokeScoreboardV4 with segment IDs
2. **Setup Lit Actions**: Configure karaoke-scorer-v3 to use native songs
3. **Update Frontend**: Query `SongCatalogV1.getAllSongs()` for catalog
4. **Test End-to-End**: Try karaoke scoring with uploaded songs

## License

MIT
