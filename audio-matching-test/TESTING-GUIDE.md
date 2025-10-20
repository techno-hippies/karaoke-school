# Audio Matching Test Suite

Organized testing structure for validating the hybrid matcher on multiple songs.

## Folder Structure

```
audio-matching-test/
├── scripts/                      # All matching scripts
│   ├── match-audio-hybrid.py     # Main hybrid matcher
│   ├── match-audio-dtw.py        # DTW-only matcher
│   ├── match-audio.py            # Original correlation matcher
│   ├── match-audio-stt.mjs       # STT-based matcher
│   ├── parse-lrc-to-segments.mjs # LRC lyrics parser
│   └── run-test-suite.py         # Batch test runner
│
├── test-cases/                   # Test cases (one folder per song)
│   ├── beyonce-levis-jeans/
│   │   ├── metadata.json         # Test metadata
│   │   ├── original.flac         # Original song (gitignored)
│   │   ├── tiktok_clip.mp4       # TikTok clip to match
│   │   ├── lyrics.txt            # LRC-format lyrics (optional)
│   │   ├── segments.json         # Parsed segments (optional)
│   │   └── crop_instructions.json # Test results
│   │
│   ├── test-2/
│   └── test-3/
│
├── results/                      # Test run results
│   └── test-results-YYYYMMDD-HHMMSS.json
│
├── README.md                     # Original README
├── TESTING-GUIDE.md             # This file
└── HYBRID-MATCHER-README.md     # Integration guide
```

## Adding a New Test Case

### 1. Create Test Folder

```bash
mkdir test-cases/YOUR-TEST-NAME
```

### 2. Add Files

**Required:**
- `original.flac` or `original.mp3` - Full original song
- `tiktok_clip.mp4` - TikTok video clip to match
- `metadata.json` - Test metadata (see template below)

**Optional:**
- `lyrics.txt` - LRC format lyrics
- `segments.json` - Pre-parsed segments

### 3. Create metadata.json

```json
{
  "testId": "your-test-name",
  "artist": "Artist Name",
  "songTitle": "Song Title",
  "album": "Album Name",
  "isrc": "USXXX1234567",
  "spotifyId": "spotify_track_id",
  "geniusId": 123456,
  "tiktokCreator": "@username",
  "tiktokPostId": "1234567890",
  "expectedMatch": {
    "startTime": 45.0,
    "endTime": 75.0,
    "section": "chorus",
    "notes": "Description of expected match"
  },
  "files": {
    "original": "original.flac",
    "clip": "tiktok_clip.mp4",
    "lyrics": "lyrics.txt",
    "segments": "segments.json"
  }
}
```

### 4. Get Original Song File

You need the full original song file. Options:

**From existing data:**
```bash
# Check if you have it in pkp-lens-flow
ls ../pkp-lens-flow/data/videos/CREATOR/segments/SONG_ID/
```

**Download from streaming:**
- Spotify (via spotify-downloader or similar)
- YouTube Music (via yt-dlp)
- Apple Music, Tidal, etc.

**Quick helper script:**
```bash
#!/bin/bash
# scripts/download-song.sh
SPOTIFY_ID=$1
OUTPUT_DIR=$2

spotify-dl --url "https://open.spotify.com/track/$SPOTIFY_ID" \
           --output "$OUTPUT_DIR/original.mp3"
```

## Running Tests

### Run All Tests

```bash
python3 scripts/run-test-suite.py
```

### Run Specific Test

```bash
python3 scripts/run-test-suite.py beyonce-levis-jeans
```

### Run Multiple Tests

```bash
python3 scripts/run-test-suite.py test-1 test-2 test-3
```

## Test Output

Each test generates:

1. **crop_instructions.json** in test case folder
   - Crop boundaries for pipeline
   - Confidence scores
   - Method details

2. **test-results-*.json** in results/ folder
   - Summary of all test runs
   - Comparison with expected matches
   - Statistics

## Example Test Run

```bash
$ python3 scripts/run-test-suite.py

🧪 HYBRID MATCHER TEST SUITE
   Running 3 test(s)

======================================================================
🎵 TEST: Beyoncé - LEVII'S JEANS
======================================================================

🔍 [DTW] Running audio-based matching...
   ✓ DTW match: 45.1s - 75.2s (confidence: 91.3%)
🎤 [STT] Running transcript-based matching...
   ✓ STT match: segment 'intro' at 19.8s - 36.2s (confidence: 85.7%)

⚠️  [HYBRID] Methods disagree, using DTW
   DTW:  45.1s - 75.2s (confidence: 91.3%)
   STT:  19.8s - 36.2s (confidence: 85.7%)

✅ Match within 0.1s of expected!

======================================================================
📊 TEST SUMMARY
======================================================================

Song                                     Confidence   Time Range           Status
----------------------------------------------------------------------------------
Beyoncé - LEVII'S JEANS                  91.3%        45.1-75.2s           ✅ PASS
Taylor Swift - Anti-Hero                 87.4%        23.5-48.7s           ✅ PASS
Billie Eilish - BIRDS OF A FEATHER       92.1%        15.2-40.3s           ✅ PASS

Total tests:      3
Passed (>65%):    3
Need review:      0
Avg confidence:   90.3%

💾 Results saved to: results/test-results-20251020-105823.json
```

## Suggested Test Songs

Good diversity for validation:

1. **Beyoncé - LEVII'S JEANS** ✅ (already done)
   - Country/pop
   - Clear vocals
   - Chorus repetition

2. **Taylor Swift - Anti-Hero**
   - Pop
   - Storytelling vocals
   - Bridge variations

3. **Billie Eilish - BIRDS OF A FEATHER**
   - Soft pop
   - Whispered vocals
   - Dynamic range

4. **Bad Bunny - Monaco**
   - Spanish lyrics
   - Reggaeton beat
   - Tests language handling

5. **NewJeans - ETA**
   - K-pop
   - Korean/English mix
   - Fast tempo

6. **Charli XCX - 360**
   - Hyperpop
   - Heavy effects
   - Tests robustness

## Getting Test Files from Your Data

You already have TikTok clips! Just need original songs:

```bash
# 1. Find what TikTok clips you have
ls ../pkp-lens-flow/data/videos/*/video_*.mp4

# 2. Check metadata for song info
cat ../pkp-lens-flow/data/videos/beyonce/manifest.json | jq '.videos[0].music'

# 3. Get Spotify ID and download song
# spotify-dl --url "https://open.spotify.com/track/SPOTIFY_ID"

# 4. Copy to test case
cp downloaded_song.mp3 test-cases/YOUR-TEST/original.mp3
cp ../pkp-lens-flow/data/videos/CREATOR/video_*.mp4 test-cases/YOUR-TEST/tiktok_clip.mp4
```

## Quick Setup for Next 5 Tests

I can help you set up test cases from your existing data. Just tell me:

1. Which creators/songs to test (I see you have beyonce, taylorswift, billieeilish, etc.)
2. I'll create the test folders + metadata
3. You just need to add the original song files (I'll give you the download commands)

Example:
```bash
# You tell me: "Test taylorswift, billieeilish, newjeans_official"
# I create test folders and tell you:

# Download these songs:
spotify-dl --url "spotify:track:XXX" -o test-cases/taylor-antihero/original.mp3
spotify-dl --url "spotify:track:YYY" -o test-cases/billie-birds/original.mp3
spotify-dl --url "spotify:track:ZZZ" -o test-cases/newjeans-eta/original.mp3

# Then run:
python3 scripts/run-test-suite.py
```

## Integration with Main Pipeline

Once tests pass consistently (>85% avg confidence), integrate into main pipeline:

```typescript
// pkp-lens-flow/local/XX-match-tiktok-segment.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function matchSegment(
  tiktokClip: string,
  originalSong: string
): Promise<CropInstructions> {

  // Run hybrid matcher
  await execAsync(
    `python3 ../audio-matching-test/scripts/match-audio-hybrid.py ` +
    `"${tiktokClip}" "${originalSong}"`
  );

  // Read results
  const crop = JSON.parse(
    readFileSync('crop_instructions.json', 'utf-8')
  );

  if (crop.confidence < 0.65) {
    throw new Error('Low confidence match - manual review needed');
  }

  return crop;
}
```
