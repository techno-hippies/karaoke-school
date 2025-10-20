# Segment Registration

Register karaoke segments on the SegmentRegistryV1 contract (Base Sepolia).

## Prerequisites

1. Contract addresses in `.env`:
   ```bash
   SEGMENT_REGISTRY_ADDRESS=0xB49837126e035a653636E6f7e49EE1BD626d3F83
   SONG_REGISTRY_ADDRESS=0xd9c4D0354a4490Ca4db825CD21870042b8217393
   ARTIST_REGISTRY_ADDRESS=0x205BB7398A00620a36e7fd7982e7703b94aCa45C
   PRIVATE_KEY=your_private_key_here
   ```

2. Song must be registered in SongRegistry first
3. Wallet must be authorized in SegmentRegistry

## Usage

### 01-register-segment.ts

Registers a segment with audio assets (Grove URIs).

**Example:**
```bash
DOTENV_PRIVATE_KEY='...' dotenvx run -f .env -- \
  bun segments/01-register-segment.ts \
  --genius-id 3002580 \
  --tiktok-id 7334542274145454891 \
  --start-time 0 \
  --end-time 60.56 \
  --vocals-uri lens://2256470dad91ec02a04cc9901858946ec001ecbc99ac375aae5ea0093d4e4d93 \
  --instrumental-uri lens://b67eaf6beaae29b8d09b4c4992f72dc0bed21c963e34cdb20b563d13a78587d6
```

**Parameters:**
- `--genius-id`: Genius song ID (must exist in SongRegistry)
- `--tiktok-id`: TikTok music ID (use "manual" for custom segments)
- `--start-time`: Start time in seconds
- `--end-time`: End time in seconds
- `--vocals-uri`: Grove URI for vocals (lens://...)
- `--instrumental-uri`: Grove URI for enhanced instrumental (lens://...)
- `--alignment-uri`: (Optional) Grove URI for forced alignment JSON
- `--cover-uri`: (Optional) Grove URI for cover art

**Two-step process:**
1. `registerSegment()`: Creates segment with metadata
2. `processSegment()`: Adds audio assets (Grove URIs)

## Finding Genius IDs

Use Genius API or search:
```bash
curl "https://api.genius.com/search?q=TEXAS%20HOLD%20EM%20beyonce&access_token=$GENIUS_API_KEY"
```

Or check the song URL on genius.com - the ID is in the path:
```
https://genius.com/Beyonce-texas-hold-em-lyrics
                          ↓
ID: Look up in database or extract from API
```

## Contract Info

- **Chain**: Base Sepolia (chainId: 84532)
- **Segment Registry**: 0xB49837126e035a653636E6f7e49EE1BD626d3F83
- **Song Registry**: 0xd9c4D0354a4490Ca4db825CD21870042b8217393

**Block Explorer:**
https://sepolia.basescan.org/address/0xB49837126e035a653636E6f7e49EE1BD626d3F83
