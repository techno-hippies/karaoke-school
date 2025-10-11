# Spleeter Modal API - Performance Results

## Test Results (2025-10-10)

### Short Segment Test (5s audio)
```
Duration: 5 seconds
Total time: 15.6s (includes cold start)
Internal timing:
  - Download: 1.35s
  - Trim: 0.17s
  - Separation: 7.27s
  - Total: 8.79s
Realtime ratio: 0.57x (slower, includes overhead)
```

### Full Segment Test (23s audio - typical karaoke verse)
```
Duration: 23 seconds
Total time: 6.5s
Internal timing:
  - Download: 1.75s
  - Trim: 0.24s
  - Separation: 1.51s
  - Total: 3.50s
Realtime ratio: 6.57x (much faster!)
Output sizes:
  - Vocals: ~532 KB
  - Accompaniment: ~534 KB
```

**✅ Conclusion: 23s segment processed in 3.5s = 6.57x realtime**

## Lit Action Timeout Analysis

For audio-processor-v2.js complete pipeline (23s segment):

| Step | Time | Notes |
|------|------|-------|
| Ownership verification | ~0.5s | On-chain read |
| Decrypt fal.ai key | ~0.5s | Lit Protocol |
| Check maid.zone page | ~0.5s | GET request |
| **Spleeter Modal** | **~3.5s** | Download + trim + separate |
| **fal.ai enhancement** | **~5-10s** | Audio-to-audio (estimated) |
| Grove upload prep | ~0.5s | Metadata only |
| Contract read | ~0.5s | getSegmentHash |
| **Total** | **~15s** | **50% of 30s timeout** |

**Margin: 15s remaining (50% buffer)**

## Performance vs Demucs (v1)

| Metric | Demucs (v1) | Spleeter (v2) | Improvement |
|--------|-------------|---------------|-------------|
| Model | htdemucs 4-stem | Spleeter 2-stem | Simpler |
| GPU | B200 | B200 | Same |
| Processing time | ~10s | ~3.5s | **2.9x faster** |
| Stems | 4 (vocals, drums, bass, other) | 2 (vocals, accompaniment) | Focused |
| Enhanced track | Drums only | Full instrumental | Better |
| Total pipeline | ~45s (w/ ElevenLabs) | ~15s (no ElevenLabs) | **3x faster** |
| Timeout risk | ⚠️ Tight | ✅ Comfortable | Safe |

## Key Findings

1. **Spleeter is faster than expected**: 6.57x realtime (not just 2x)
2. **Scales well with duration**: Overhead is minimal, mostly linear
3. **Well within 30s timeout**: 15s total leaves 15s margin
4. **Warm containers are fast**: 1.51s to separate 23s of audio on B200
5. **No ElevenLabs needed**: Alignment already done in match-and-segment-v5

## maid.zone Integration Notes

✅ **Working correctly** - Issue was test script error

- **Correct URL format**: `https://sc.maid.zone/_/restream/siamusic/sia-chandelier`
- **Incorrect format**: `https://sc.maid.zone/_/restream/https://soundcloud.com/...` ❌
- **Important**: maid.zone **does not support HEAD requests** (returns 405)
- **Use GET requests**: Download works perfectly with GET

## Recommendations

1. ✅ **Deploy audio-processor-v2.js** - Code is correct, URLs are right
2. ✅ **Use Spleeter instead of Demucs** - 3x faster overall pipeline
3. ✅ **Keep B200 GPU** - Processing is fast enough, no need to downgrade
4. ✅ **Remove ElevenLabs from audio processor** - Already done in match-and-segment-v5
5. ✅ **Enhance full instrumental** - Better than drums-only enhancement
