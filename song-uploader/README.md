# Clip-Based Karaoke Uploader

TikTok-style clip-based karaoke system with modular processing pipeline. Slices songs into learnable sections with word-level timestamps, learning metrics, and instrumental backing tracks.

## Architecture

**Clip-Based Design:**
- Songs sliced into sections (Verse, Chorus, Bridge, etc.)
- Each clip: 15-60 seconds, self-contained, standalone
- Perfect for bite-sized learning and TikTok-style consumption

**Storage:**
- **Grove**: Decentralized storage (Lens Chain)
- **ClipRegistry Contract**: On-chain metadata registry
- **Contract Address**: `0x59fCAe6753041C7b2E2ad443e4F2342Af46b81bf` (Lens Chain Testnet)

## Setup

### 1. Install Dependencies
```bash
bun install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with:
# - PRIVATE_KEY: Your wallet private key
# - ELEVENLABS_API_KEY: ElevenLabs API key for word alignment
```

### 3. Add Songs
```bash
mkdir -p "songs/Artist - Song Title"
# Add required files (see Song Folder Structure below)
```

## Song Folder Structure

```
songs/
└── Ethel Waters - Down Home Blues/
    ├── Ethel Waters - Down Home Blues.mp3              # Required: Full audio
    ├── Ethel Waters - Down Home Blues (Vocals).mp3     # Optional: Isolated vocals (better ElevenLabs accuracy)
    ├── Ethel Waters - Down Home Blues (Instrumental).mp3  # Optional: Backing track for karaoke practice
    ├── lyrics.txt                                       # Required: Lyrics with section markers
    ├── thumbnail.jpg                                    # Optional: Cover art
    ├── karaoke-alignment.json                          # Auto-generated: ElevenLabs cache
    ├── translations/                                    # Optional: Translation files
    │   ├── cn.txt                                      # Chinese translation
    │   └── vi.txt                                      # Vietnamese translation
    └── clips/                                          # Auto-generated: Sliced clips
        ├── verse.mp3
        ├── verse-instrumental.mp3
        ├── verse.json
        ├── chorus.mp3
        ├── chorus-instrumental.mp3
        └── chorus.json
```

### Filename Requirements

**Audio files must follow format:** `Artist - Title.mp3`
- ✅ `Ethel Waters - Down Home Blues.mp3`
- ✅ `Ethel Waters - Down Home Blues (Vocals).mp3`
- ✅ `Ethel Waters - Down Home Blues (Instrumental).mp3`
- ❌ `Ethel Waters Down Home Blues.mp3` (missing hyphen)

### Lyrics Format

**Section markers:** Use `[SectionName]` format
```
[Verse]
I never felt so lonesome before
My friend has quit me, he's gone for sure

[Chorus]
Woke up this mornin', the day was dawnin'
And I was feelin' all sad and blue

[Instrumental]

[Chorus]
Woke up this mornin', the day was dawnin'
...
```

**Standard section names:**
- `[Intro]`, `[Verse]`, `[Verse 1]`, `[Verse 2]`
- `[Pre-chorus]`, `[Chorus]`, `[Post-chorus]`
- `[Bridge]`, `[Breakdown]`, `[Instrumental]`, `[Interlude]`, `[Outro]`

**Translation files:** Same structure, English markers, translated lyrics

## Modular Pipeline

### Step 1: Validate Lyrics Format
```bash
bun run validate --song "Artist - Song Title"
bun run validate --all
```

**Checks:**
- ✅ Correct bracket usage `[]` (not `()`)
- ✅ Standard section names
- ✅ Proper capitalization
- ✅ Translation alignment (sections match across all languages)

### Step 2: Generate Word-Level Timestamps
```bash
bun run elevenlabs --song "Artist - Song Title"
bun run elevenlabs --all
```

**Process:**
- Calls ElevenLabs Forced Alignment API
- Uses vocal stems if available (better accuracy)
- Caches results in `karaoke-alignment.json`
- Skips songs with existing alignment files

### Step 3: Slice Into Clips
```bash
bun run slice --song "Artist - Song Title"
bun run slice --all
```

**Features:**
- Detects section boundaries from markers
- Adds **0.25s buffer before** and **0.3s buffer after** each section
- Trims long gaps (e.g., instrumental breaks)
- Slices both vocal and instrumental tracks (if available)
- Generates metadata with learning metrics
- Saves to `songs/{songId}/clips/`

**Clip naming:**
- `verse.mp3`, `verse-instrumental.mp3`, `verse.json`
- `chorus.mp3`, `chorus-instrumental.mp3`, `chorus.json`
- `chorus-2.mp3`, `chorus-2-instrumental.mp3`, `chorus-2.json`

### Step 4: Upload to Grove + Contract
```bash
bun run upload-clips --song "Artist - Song Title"
bun run upload-clips --all
bun run upload-clips --dry-run --song "Artist - Song Title"  # Test first
```

**Process:**
- Uploads each clip folder to Grove (vocal + instrumental + metadata + thumbnail)
- Registers in ClipRegistry contract
- Checks for duplicates before uploading
- Returns Grove URIs for each resource

## Clip Metadata Structure

Each clip includes comprehensive metadata:

```json
{
  "version": 3,
  "id": "down-home-blues-verse",
  "title": "Down Home Blues",
  "artist": "Ethel Waters",
  "sectionType": "Verse",
  "sectionIndex": 0,
  "duration": 42.69,
  "format": "word-and-line-timestamps",
  "lines": [
    {
      "lineIndex": 1,
      "originalText": "I never felt so lonesome before",
      "translations": {
        "cn": "我从未感到如此孤单",
        "vi": "Tôi chưa bao giờ cảm thấy cô đơn đến thế trước đây"
      },
      "start": 0.25,
      "end": 7.351,
      "words": [
        { "text": "I", "start": 0.25, "end": 1.17 },
        { "text": "never", "start": 1.75, "end": 2.19 }
      ]
    }
  ],
  "availableLanguages": ["en", "cn", "vi"],
  "learningMetrics": {
    "difficultyLevel": 2,
    "vocabularyCoverage": {
      "top1kPercent": 78.26,
      "difficultWords": ["lonesome", "quit", "worried"]
    },
    "pace": {
      "wordsPerSecond": 1.08,
      "classification": "slow"
    },
    "pronunciation": {
      "syllablesPerWord": 1.13,
      "complexity": "simple"
    }
  }
}
```

## Learning Metrics

**Automatic difficulty scoring** for English learners:

**Difficulty Levels (1-5):**
- **Level 1**: Simple vocabulary, slow pace, easy pronunciation
- **Level 5**: Advanced vocabulary, fast pace, complex pronunciation

**Calculated from:**
- **Vocabulary Coverage (40%)**: Top 1k English words
- **Speaking Pace (40%)**: Words per second
- **Pronunciation Complexity (20%)**: Syllables per word

**Used for:**
- Filtering clips by difficulty in karaoke app
- Recommending appropriate content for learners
- Progressive learning paths

## Contract Integration

**ClipRegistry Contract:** `0x59fCAe6753041C7b2E2ad443e4F2342Af46b81bf`

**Stored on-chain:**
- Clip ID, title, artist, section type/index
- Duration, difficulty level, words per second
- Grove URIs (audio, instrumental, metadata, thumbnail)
- Languages, enabled flag

**Query methods:**
```solidity
getClip(string id) → Clip
getAllClips() → Clip[]
getClipsByDifficulty(uint8 min, uint8 max) → Clip[]
getClipsByPace(uint8 minWps, uint8 maxWps) → Clip[]
```

## Complete Workflow Example

```bash
# 1. Validate lyrics format
bun run validate --song "Ethel Waters - Down Home Blues"
# ✅ All validations passed

# 2. Generate ElevenLabs alignment
bun run elevenlabs --song "Ethel Waters - Down Home Blues"
# ✅ Alignment saved (373 words)

# 3. Slice into clips
bun run slice --song "Ethel Waters - Down Home Blues"
# ✅ Sliced 3/3 clips (verse, chorus, chorus-2)

# 4. Upload to Grove + contract
bun run upload-clips --song "Ethel Waters - Down Home Blues"
# ✅ All clips uploaded successfully
```

## Output Structure

After processing, each song has:
```
songs/Artist - Song Title/
├── [original audio files]
├── lyrics.txt
├── karaoke-alignment.json
├── translations/
│   └── *.txt
└── clips/
    ├── verse.mp3                    # 42s vocal clip
    ├── verse-instrumental.mp3       # 42s backing track
    ├── verse.json                   # Metadata with learning metrics
    ├── chorus.mp3
    ├── chorus-instrumental.mp3
    └── chorus.json
```

## Commands Reference

### Pipeline Commands
- `bun run validate --song <id>` / `--all` - Validate lyrics format
- `bun run elevenlabs --song <id>` / `--all` - Generate word timestamps
- `bun run slice --song <id>` / `--all` - Slice into clips
- `bun run upload-clips --song <id>` / `--all` - Upload to Grove + contract

### Legacy Commands (Full Song Upload)
- `bun run process` - Enhanced processing with ElevenLabs
- `bun run upload` - Upload full songs
- `bun run add-song` - Only upload new songs
- `bun run sync` - Sync registry
- `bun run create-registry` - Initialize registry

## Benefits

**For Learners:**
- ✨ Bite-sized learning (15-60s clips)
- ✨ Difficulty-based filtering
- ✨ Word-by-word highlighting
- ✨ Instrumental backing tracks for practice
- ✨ Multilingual translations
- ✨ Progressive difficulty curves

**For Developers:**
- 🔧 Modular, independent pipeline steps
- 🔧 Dry-run testing before upload
- 🔧 Automatic validation and error checking
- 🔧 Cached ElevenLabs results
- 🔧 On-chain metadata registry
- 🔧 Decentralized storage (Grove)

## Development

**Technologies:**
- Bun runtime
- TypeScript
- Viem (Ethereum interactions)
- ElevenLabs API (word alignment)
- FFmpeg (audio slicing)
- Grove Storage (@lens-chain/storage-client)
- Solidity 0.8.19 (zkSync compatible)

**Contract Deployment:**
```bash
cd contract
FOUNDRY_PROFILE=zksync forge create src/ClipRegistryV1.sol:ClipRegistryV1 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --zksync --gas-limit 10000000 --broadcast
```

## Project Structure

```
song-uploader/
├── src/
│   ├── commands/          # Modular pipeline commands
│   │   ├── validate.ts    # Lyrics format validation
│   │   ├── process-elevenlabs.ts  # ElevenLabs alignment
│   │   ├── slice.ts       # Audio slicing
│   │   └── upload.ts      # Grove + contract upload
│   ├── processors/        # Core processing logic
│   │   ├── elevenlabs.js
│   │   ├── metadata.js
│   │   ├── section-detector.ts
│   │   ├── audio-slicer.ts
│   │   ├── learning-metrics.ts
│   │   └── lyrics-validator.ts
│   ├── utils/
│   │   └── filename-parser.ts
│   ├── abi/
│   │   └── ClipRegistryV1.json
│   └── types.ts
├── contract/
│   └── src/
│       └── ClipRegistryV1.sol
├── songs/                 # Song source files
└── output/               # Generated outputs
```

## License

MIT
