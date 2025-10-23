# Creator Pipeline Guide

Complete guide to the robust, translation-enabled creator onboarding and video processing pipeline.

## 🎯 What's New

### ✅ Multilingual Support
- **Bio Translation**: Creator bios automatically translated to Vietnamese and Mandarin
- **Description Translation**: Video descriptions translated to multiple languages
- **Caption Translation**: Video audio transcribed and translated (STT with Voxtral)
- All translations stored in Lens metadata for frontend access

### ✅ Progress Tracking & Resume
- Automatic progress tracking for batch operations
- Resume from last successful video on failure
- Retry failed videos with configurable attempts
- Detailed progress reports and statistics

### ✅ Enhanced Error Handling
- Checkpoint-based recovery for onboarding
- Exponential backoff and retry logic
- Non-fatal optional steps (Story Protocol, Lens posting)
- Comprehensive error logging

### ✅ Performance Improvements
- Parallel video processing (configurable concurrency)
- Rate limiting to avoid API throttling
- Efficient resource management

---

## 📋 Complete Workflows

### Workflow 1: Onboard New Creator

**Single command for complete creator setup:**

```bash
# Basic onboarding (PKP + Lens + Scrape + Identify)
bun modules/creators/00-onboard-creator.ts --tiktok-handle @idazeile

# With custom Lens handle
bun modules/creators/00-onboard-creator.ts \
  --tiktok-handle @idazeile \
  --lens-handle idazeile

# Limit video scraping
bun modules/creators/00-onboard-creator.ts \
  --tiktok-handle @idazeile \
  --video-limit 50

# Resume after failure
bun modules/creators/00-onboard-creator.ts \
  --tiktok-handle @idazeile \
  --resume

# Skip optional steps
bun modules/creators/00-onboard-creator.ts \
  --tiktok-handle @idazeile \
  --skip-scrape \
  --skip-identify
```

**What it does:**
1. ✅ Mints PKP wallet (Lit Protocol)
2. ✅ Creates Lens account with **translated bio** (en, vi, zh)
3. ✅ Scrapes TikTok videos (copyrighted + copyright-free)
4. ✅ Identifies songs via Spotify/Genius
5. ✅ Checkpoint-based resume on failure

**Output:**
- `data/creators/{handle}/pkp.json` - PKP wallet info
- `data/creators/{handle}/lens.json` - Lens account info
- `data/creators/{handle}/manifest.json` - Creator manifest with translated bio
- `data/creators/{handle}/identified_videos.json` - Identified songs
- `data/creators/{handle}/checkpoints.json` - Recovery checkpoints

---

### Workflow 2: Process Single Video

**Process one video with full pipeline:**

```bash
# Basic processing (download + STT + translate + Grove + manifest)
bun modules/creators/05-process-video.ts \
  --tiktok-handle @idazeile \
  --video-id 7545183541190053142

# With Story Protocol minting
bun modules/creators/06-mint-derivative.ts \
  --tiktok-handle @idazeile \
  --video-hash abc123def456

# With Lens posting
bun modules/creators/07-post-lens.ts \
  --tiktok-handle @idazeile \
  --video-hash abc123def456
```

**What it does:**
1. ✅ Downloads video + thumbnail from TikTok
2. ✅ Extracts audio
3. ✅ Transcribes audio (Voxtral STT)
4. ✅ **Translates captions** (en → vi, zh)
5. ✅ **Translates description** (en → vi, zh)
6. ✅ Uploads to Grove storage
7. ✅ Creates manifest with all translations
8. ✅ (Optional) Mints on Story Protocol
9. ✅ (Optional) Posts to Lens with translations

**Output:**
- `data/creators/{handle}/videos/{hash}/video.mp4` - Downloaded video
- `data/creators/{handle}/videos/{hash}/audio.mp3` - Extracted audio
- `data/creators/{handle}/videos/{hash}/manifest.json` - Video manifest with:
  - `captions: { en, vi, zh }` - Transcribed and translated captions
  - `descriptionTranslations: { vi, zh }` - Translated descriptions
  - `grove.video` - Grove video URI
  - `grove.thumbnail` - Grove thumbnail URI
  - `storyProtocol` - Story Protocol IP Asset info (if minted)
  - `lensPost` - Lens post info (if posted)

---

### Workflow 3: Batch Process Videos

**Process multiple videos with resume and retry:**

```bash
# Process all videos (serial)
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @idazeile

# Process first 10 videos
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @idazeile \
  --max 10

# Parallel processing (3 concurrent videos)
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @idazeile \
  --parallel 3

# Resume from last successful video
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @idazeile \
  --resume

# Retry only failed videos
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @idazeile \
  --retry-failed

# Skip optional steps
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @idazeile \
  --skip-story \
  --skip-lens

# Custom settings
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @idazeile \
  --parallel 2 \
  --max-retries 5 \
  --rate-limit 3000
```

**Features:**
- ✅ Progress tracking with `progress.json`
- ✅ Resume capability on failure
- ✅ Automatic retry with exponential backoff
- ✅ Parallel processing (configurable concurrency)
- ✅ Rate limiting (default: 2000ms between videos)
- ✅ Detailed progress reports
- ✅ Non-fatal optional steps (Story/Lens continue on error)

**Output:**
- `data/creators/{handle}/progress.json` - Real-time progress tracking
- Per-video manifests with full translation data
- Final processing report with statistics

---

## 📊 Progress Tracking

### Progress File Structure

`data/creators/{handle}/progress.json`:
```json
{
  "creatorHandle": "idazeile",
  "startedAt": "2025-10-23T20:00:00.000Z",
  "updatedAt": "2025-10-23T20:30:00.000Z",
  "totalVideos": 50,
  "completed": 45,
  "failed": 3,
  "skipped": 2,
  "videos": {
    "7545183541190053142": {
      "videoId": "7545183541190053142",
      "status": "completed",
      "videoHash": "2b0b7deaa241de09",
      "startedAt": "2025-10-23T20:05:00.000Z",
      "completedAt": "2025-10-23T20:08:00.000Z",
      "retryCount": 0,
      "steps": {
        "download": true,
        "stt": true,
        "translate": true,
        "grove": true,
        "story": true,
        "lens": true
      }
    }
  }
}
```

### Video Status States
- `pending` - Not yet started
- `processing` - Currently being processed
- `completed` - Successfully completed all steps
- `failed` - Failed after max retries
- `skipped` - Already processed (from previous run)

---

## 🔍 Translation Data Structure

### Creator Bio Translations

Stored in Lens account metadata:
```json
{
  "name": "Ida Zeile",
  "bio": "IG @idazeile 🧚🏼",
  "attributes": [
    {
      "type": "JSON",
      "key": "bioTranslations",
      "value": "{\"vi\":\"IG @idazeile 🧚🏼\",\"zh\":\"IG @idazeile 🧚🏼\"}"
    }
  ]
}
```

### Video Translations

Stored in video manifest:
```json
{
  "description": "🤝",
  "descriptionTranslations": {
    "vi": "🤝",
    "zh": "🤝"
  },
  "captions": {
    "en": "It was official. A new season had begun. After all, seasons change.",
    "vi": "Đã chính thức rồi. Một mùa mới đã bắt đầu. Rốt cuộc thì, các mùa vẫn thay đổi.",
    "zh": "这已成定局。新一季已经开始了。毕竟，季节总会更迭。"
  }
}
```

Stored in Lens post metadata:
```json
{
  "attributes": [
    {
      "type": "JSON",
      "key": "description_translations",
      "value": "{\"vi\":\"...\",\"zh\":\"...\"}"
    }
  ]
}
```

---

## 🎬 Example: Complete Creator Flow

### Step 1: Onboard Creator
```bash
bun modules/creators/00-onboard-creator.ts --tiktok-handle @newcreator
```

Output:
```
✨ Creator Onboarding Complete!

Creator: @newcreator
Lens Handle: @newcreator

✅ Next steps:
   1. Process videos: bun modules/creators/08-process-all-videos.ts --tiktok-handle newcreator
   2. Or process single video: bun modules/creators/05-process-video.ts --tiktok-handle newcreator --video-id <ID>
```

### Step 2: Process Videos
```bash
# Start with 5 videos for testing
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @newcreator \
  --max 5 \
  --parallel 2
```

Output:
```
📊 Current progress: 0 completed, 0 failed, 0 skipped

🎬 Processing videos...

[1/5] Video 7545183541190053142
  Song: after all seasons change by a.
  ✅ Completed successfully

...

════════════════════════════════════════════════════════════
📊 Batch Processing Report
════════════════════════════════════════════════════════════

Creator: @newcreator
Statistics:
  • Total videos: 5
  • Completed: 4
  • Skipped (already processed): 0
  • Failed: 1
  • Pending: 0
  • Success rate: 80.0%

💡 To retry failed videos:
   bun modules/creators/08-process-all-videos.ts --tiktok-handle newcreator --retry-failed
```

### Step 3: Retry Failed Videos
```bash
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @newcreator \
  --retry-failed
```

### Step 4: Process Remaining Videos
```bash
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @newcreator \
  --resume \
  --parallel 3
```

---

## ⚙️ Configuration Options

### Environment Variables

Translation languages (default: vi,zh):
```bash
export TRANSLATION_LANGUAGES="vi,zh,ja,ko"
```

### Rate Limiting

Recommended settings:
- **Serial processing**: `--rate-limit 2000` (2 seconds)
- **Parallel (2-3)**: `--rate-limit 3000` (3 seconds)
- **Parallel (4+)**: `--rate-limit 5000` (5 seconds)

### Retry Configuration

- Default max retries: `3`
- Configurable: `--max-retries 5`
- Exponential backoff automatically applied

---

## 🐛 Troubleshooting

### Resume After Network Failure
```bash
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @creator \
  --resume
```

### Clear Progress and Start Fresh
```bash
rm data/creators/{handle}/progress.json
bun modules/creators/08-process-all-videos.ts --tiktok-handle @creator
```

### Check Progress Manually
```bash
cat data/creators/{handle}/progress.json | jq '.videos | to_entries[] | select(.value.status == "failed")'
```

### Retry Specific Video
```bash
bun modules/creators/05-process-video.ts \
  --tiktok-handle @creator \
  --video-id 7545183541190053142
```

---

## 📈 Best Practices

1. **Test with Small Batches**: Start with `--max 5` to verify setup
2. **Use Parallel Processing**: `--parallel 2-3` for optimal throughput
3. **Monitor Progress**: Check `progress.json` during long runs
4. **Resume on Failure**: Always use `--resume` for interrupted runs
5. **Retry Failed Videos**: Run `--retry-failed` after batch completion
6. **Rate Limiting**: Increase delays if hitting API limits

---

## 📝 Frontend Integration

To display translations on the frontend, fetch from Lens metadata:

```typescript
// Bio translations
const bioTranslations = JSON.parse(
  account.metadata.attributes.find(a => a.key === 'bioTranslations')?.value || '{}'
);

// Video description translations
const descTranslations = JSON.parse(
  post.metadata.attributes.find(a => a.key === 'description_translations')?.value || '{}'
);

// Display based on user's language preference
const userLang = 'vi'; // from context/browser
const translatedBio = bioTranslations[userLang] || account.metadata.bio;
```

---

## 🔄 Migration for Existing Creators

To add translations to existing creators:

### Re-translate Bios
```bash
# Re-run Lens creation (will skip if exists, or delete lens.json first)
rm data/creators/{handle}/lens.json
bun modules/creators/02-create-lens.ts --tiktok-handle @creator
```

### Re-process Videos
```bash
# Delete video manifests to reprocess with translations
rm -rf data/creators/{handle}/videos/*/manifest.json
bun modules/creators/08-process-all-videos.ts --tiktok-handle @creator
```

---

## ✅ Complete Pipeline Summary

```
┌─────────────────────────────────────────────────────────┐
│                    CREATOR PIPELINE                     │
└─────────────────────────────────────────────────────────┘

1. ONBOARDING (00-onboard-creator.ts)
   ├── Mint PKP wallet
   ├── Create Lens account + translate bio ✨
   ├── Scrape TikTok videos
   └── Identify songs via Spotify/Genius

2. VIDEO PROCESSING (05-process-video.ts)
   ├── Download video + thumbnail
   ├── Extract audio
   ├── Transcribe audio (STT) ✨
   ├── Translate captions (vi, zh) ✨
   ├── Translate description (vi, zh) ✨
   ├── Upload to Grove
   └── Create manifest with translations

3. OPTIONAL: Story Protocol (06-mint-derivative.ts)
   └── Mint as IP Asset (18/82 split)

4. OPTIONAL: Lens Posting (07-post-lens.ts)
   └── Post with translated metadata ✨

5. BATCH PROCESSING (08-process-all-videos.ts)
   ├── Progress tracking ✨
   ├── Resume capability ✨
   ├── Retry failed ✨
   ├── Parallel processing ✨
   └── Detailed reports ✨

✨ = New multilingual/robust features
```

---

All improvements are production-ready! 🚀
