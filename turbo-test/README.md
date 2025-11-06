# Turbo Arweave Upload Test

This directory contains a test setup for uploading immutable karaoke metadata to Arweave using the Turbo SDK.

## Overview

This test demonstrates uploading **immutable data** (lyrics, translations, alignments) to Arweave for permanent storage. This is perfect for:

- Karaoke lyrics that never change
- Translation data that should be permanent
- Timing alignments for audio segments
- Metadata that needs to be provably immutable

## Features

- ✅ Real Arweave wallet generation
- ✅ Turbo SDK integration 
- ✅ Free upload support (100KB limit)
- ✅ Sample data structure for karaoke metadata
- ✅ Both authenticated and unauthenticated modes
- ✅ Progress tracking and error handling

## Quick Start

### Prerequisites

```bash
# Install dependencies
bun install

# Or use npm
npm install
```

### 1. Test Service Connectivity (No Upload)

```bash
# Test that Turbo service is working
bun run test
```

This will:
- Verify Turbo SDK is installed
- Check service connectivity
- Show sample data structure
- No wallet or credits needed

### 2. Create Real Wallet

```bash
# Generate a real Arweave wallet
bun run create-wallet
```

This creates:
- Real Arweave RSA wallet (not placeholder)
- Wallet saved to `real-wallet.json`
- Wallet address displayed

### 3. Upload Real Data

```bash
# Upload sample metadata to Arweave
bun run upload-real-data
```

This performs:
- Real Arweave wallet authentication
- Upload sample karaoke metadata
- Returns real transaction ID
- Data permanently stored on Arweave

## Scripts

| Script | Purpose |
|--------|---------|
| `bun run test` | Test service connectivity only |
| `bun run create-wallet` | Generate real Arweave wallet |
| `bun run upload-real-data` | Upload sample data and get real hash |

## Sample Data Structure

The test uploads a sample karaoke metadata structure:

```json
{
  "spotify_track_id": "demo-track-123",
  "track_title": "Sample Song",
  "artist": "Demo Artist", 
  "lyrics": {
    "original": {
      "lines": [
        {
          "index": 0,
          "text": "This is a sample line of lyrics",
          "startTime": 0.0,
          "endTime": 2.5
        }
      ]
    },
    "translations": {
      "es": [
        {
          "index": 0,
          "text": "Esta es una línea de muestra de letras",
          "startTime": 0.0,
          "endTime": 2.5
        }
      ]
    }
  },
  "alignments": {
    "segment_id": "demo-segment-1",
    "segment_hash": "0xabc123...",
    "duration": 7.5,
    "word_timing": [
      { "word": "This", "startTime": 0.0, "endTime": 0.3 },
      { "word": "is", "startTime": 0.3, "endTime": 0.5 }
    ]
  },
  "created_at": "2025-11-06T00:00:00.000Z",
  "immutable": true
}
```

## What Gets Uploaded

The test uploads **immutable metadata** that should never change:

- **Track Information**: Spotify IDs, artist, title
- **Original Lyrics**: Line-by-line with timing
- **Translations**: Multi-language with timing
- **Audio Alignments**: Word-level timing data
- **Metadata**: Timestamps, hashes, flags

This type of data is perfect for Arweave because:
- It should never change once finalized
- Needs to be provably immutable
- Benefits from permanent storage
- Enables content verification

## Cost Structure

- **Free Tier**: 100KB per month uploads
- **Small Data**: Most metadata uploads are under 1KB
- **Turbo Credits**: For larger uploads beyond free tier
- **Payment**: Via Turbo (supports fiat, crypto, AR)

For this test:
- Sample data: ~1KB
- Upload cost: $0 (free tier)
- Permanent storage: Forever

## Security Notes

### Wallet Management
- **Demo Only**: Generated wallets are for testing
- **Production**: Use secure wallet generation and storage
- **Backup**: Always backup Arweave wallets securely
- **Private Keys**: Never share RSA private keys

### Test Data
- **Sample Only**: Uses fictional/demo data
- **No Copyright**: No real copyrighted lyrics
- **Safe Testing**: All data is test/sample content

## Integration with Karaoke Pipeline

This test setup can be integrated into the main karaoke-pipeline:

1. **Generate Metadata**: Create immutable data structures
2. **Upload via Turbo**: Use this same code pattern
3. **Store Transaction IDs**: Save Arweave hashes in database
4. **Reference in App**: Use `arweave://` URIs for immutable data

### Example Integration Points

```typescript
// In pipeline processing
const arweaveTxId = await uploadToTurbo({
  lyrics: processedLyrics,
  translations: processedTranslations, 
  alignments: processedAlignments
});

// Store in database
await db.karaoke_segments.update({
  id: segmentId,
  arweave_tx_id: arweaveTxId,
  immutable_url: `arweave://${arweaveTxId}`
});
```

## Troubleshooting

### Common Issues

**"turbo.upload is not a function"**
- Ensure you're using authenticated client
- Check that wallet is properly loaded

**"No credits available"**
- Use free uploads (< 100KB)
- Or get Turbo credits from turbo-topup.com

**"Wallet not found"**
- Run `bun run create-wallet` first
- Ensure `real-wallet.json` exists

### Debug Mode

To see detailed progress:

```typescript
events: {
  onProgress: ({ totalBytes, processedBytes, step }) => {
    console.log(`${step}: ${(processedBytes/totalBytes*100).toFixed(1)}%`);
  }
}
```

## Production Checklist

Before integrating into production:

- [ ] Use secure wallet generation (not demo scripts)
- [ ] Implement proper error handling and retries
- [ ] Set up Turbo Credits purchasing workflow
- [ ] Add database schema for Arweave transaction IDs
- [ ] Implement arweave:// URI resolution in app
- [ ] Add monitoring for upload success/failure
- [ ] Set up backup/recovery for Arweave data

## Files Structure

```
turbo-test/
├── README.md                 # This file
├── package.json              # Dependencies and scripts
├── test-upload.ts            # Basic connectivity test
├── create-wallet.ts          # Wallet generation
├── upload-real-data.ts       # Real upload test
├── real-wallet.json          # Generated wallet (auto-created)
└── test-wallet.json          # Legacy/test wallet
```

## Next Steps

1. **Test the Setup**: Run all scripts to verify functionality
2. **Review Data Structure**: Customize for your specific needs
3. **Integrate into Pipeline**: Add Turbo upload steps to karaoke-pipeline
4. **Production Setup**: Implement proper wallet management and Turbo Credits

---

**Ready for immutable data storage on Arweave!** 🚀
