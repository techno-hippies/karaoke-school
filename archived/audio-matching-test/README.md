# Audio Matching Test

Test librosa-based audio matching to find where a TikTok clip appears in a full song.

## Setup

```bash
# Install dependencies
pip3 install librosa numpy

# Verify ffmpeg is installed (for video → audio extraction)
ffmpeg -version
```

## Usage

Place your test files in this directory:
- `tiktok_clip.mp4` (or .mp3) - TikTok video or audio clip
- `full_song.mp3` - Complete song file

Then run:

```bash
python3 match-audio.py tiktok_clip.mp4 full_song.mp3
```

## Example Output

```
============================================================
🎯 LIBROSA AUDIO MATCHING TEST
============================================================

📹 Extracting audio from video: tiktok_clip.mp4
✓ Extracted to: tiktok_clip.mp3

🎵 Loading audio files...
   Clip: tiktok_clip.mp3
   Full: full_song.mp3

📊 Audio loaded:
   Clip duration: 15.3s
   Full duration: 227.4s
   Sample rate: 22050 Hz

🔍 Extracting chroma features...
   Clip chroma shape: (12, 661)
   Full chroma shape: (12, 9821)

⚙️  Computing cross-correlation...
✓ Found peak correlation: 8.4532
   Normalized confidence: 0.7044

============================================================
📍 MATCH RESULTS
============================================================

✅ Match found!
   Time range: 0:45 - 1:00
   Start time: 45.23s
   End time: 60.58s
   Duration: 15.3s
   Confidence: 70.4%

✅ HIGH CONFIDENCE - Very likely accurate match

============================================================

JSON OUTPUT:
{
  "start": 45.23,
  "end": 60.58,
  "confidence": 0.7044,
  "duration": 15.3,
  "peak_correlation": 8.4532,
  "total_positions_checked": 9161
}
```

## How It Works

1. **Load audio**: Loads both clip and full song (downsampled to 22kHz for speed)
2. **Extract chroma features**: Pitch-based fingerprint robust to volume/effects
3. **Cross-correlation**: Slide clip pattern across full song to find best match
4. **Peak detection**: Highest correlation = best match position
5. **Confidence score**: Normalized to 0-1 scale

## Confidence Levels

- **>70%**: High confidence - Very likely accurate
- **50-70%**: Medium confidence - Probably correct
- **<50%**: Low confidence - Match uncertain

## Testing Strategy

1. Start with a clear, obvious match (studio version → same studio version)
2. Test with TikTok video (compressed, effects, background noise)
3. Test with remix/live version (harder case)
4. Test with wrong song entirely (should have low confidence)

## Next Steps

If testing shows good results, integrate into `local/19b-match-tiktok-segment.ts` in main pipeline.
