# MLC Integration Architecture

## Overview

The Mechanical Licensing Collective (MLC) data should be added via a **separate batch process**, not in the real-time karaoke pipeline.

**Why separate?**
- ✅ MLC reporting is monthly (not real-time)
- ✅ MLC API may have rate limits
- ✅ Keeps critical path fast
- ✅ Allows for manual review/correction
- ✅ Can retry failures without blocking users

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│          Real-Time Pipeline (unchanged)              │
│                                                       │
│  User → Modal → Webhook → Lit Action → Contract     │
│  (Processes audio, stores Grove URIs)                │
└─────────────────────────────────────────────────────┘

                          ↓
                    (contract updated)
                          ↓

┌─────────────────────────────────────────────────────┐
│           MLC Batch Processor (new)                  │
│                                                       │
│  Runs: Monthly via cron                              │
│  Input: Songs from contract                          │
│  Process: Query MLC API, match, update contract      │
│  Output: Updated contract with MLC codes             │
└─────────────────────────────────────────────────────┘
```

---

## Where to Add MLC Data

### Option 1: Standalone Script (Recommended)

**Location**: `lit-actions/scripts/mlc-batch-processor.mjs`

**Runs via**: GitHub Actions cron (monthly)

**Flow**:
```javascript
1. Read all songs from contract (getSongsCount, iterate)
2. For each song without MLC data:
   a. Query MLC portal (2 API calls):
      - Search by title + artist
      - Get work details by MLC code
   b. Match using:
      - SoundCloud URL (if available)
      - Title + Artist fuzzy match
      - Duration similarity
   c. Store MLC code in contract
3. Generate report (matched/unmatched)
4. Send notification (email/Discord)
```

**Advantages**:
- ✅ Simple to deploy (GitHub Actions)
- ✅ No infrastructure cost
- ✅ Easy to run manually for testing
- ✅ Version controlled
- ✅ Can review PR with changes before running

---

### Option 2: Backend Service

**Location**: New service `mlc-processor-service/`

**Runs via**: Railway/Render with cron trigger

**Advantages**:
- ✅ Can have UI for manual review
- ✅ More sophisticated matching logic
- ✅ Database for tracking history

**Disadvantages**:
- ❌ More infrastructure
- ❌ More maintenance

---

## Recommended Implementation

### Contract Schema Addition

Add MLC fields to the `Song` struct:

```solidity
struct Song {
    // ... existing fields ...

    // MLC fields
    string mlcCode;           // MLC work code (e.g., "W123456789")
    uint64 mlcMatchedAt;      // Timestamp when matched
    uint8 mlcMatchConfidence; // 0-100, confidence in match
    string mlcMatchMethod;    // "soundcloud_url" | "title_artist" | "manual"
}
```

### Add Contract Function

```solidity
function updateMlcData(
    uint32 geniusId,
    string calldata mlcCode,
    uint8 matchConfidence,
    string calldata matchMethod
) external onlyOwner {
    uint256 index = geniusIdToIndex[geniusId];
    require(index > 0, "Song not found");

    Song storage song = songs[index - 1];
    song.mlcCode = mlcCode;
    song.mlcMatchedAt = uint64(block.timestamp);
    song.mlcMatchConfidence = matchConfidence;
    song.mlcMatchMethod = matchMethod;

    emit MlcDataUpdated(geniusId, mlcCode, matchConfidence);
}
```

---

## Batch Processor Structure

### `lit-actions/scripts/mlc-batch-processor.mjs`

```javascript
/**
 * MLC Batch Processor
 *
 * Runs monthly to match songs with MLC codes
 */

import { ethers } from 'ethers';

class MlcBatchProcessor {
  constructor(contractAddress, rpcUrl, privateKey) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, ABI, this.wallet);
    this.mlcClient = new MlcApiClient();
  }

  async processAllSongs() {
    // 1. Get all songs from contract
    const songs = await this.getAllSongs();

    // 2. Filter songs without MLC data
    const unmatchedSongs = songs.filter(s => !s.mlcCode);

    console.log(`Found ${unmatchedSongs.length} songs without MLC data`);

    // 3. Process in batches (rate limiting)
    const results = [];
    for (const song of unmatchedSongs) {
      try {
        const mlcData = await this.matchSongWithMlc(song);

        if (mlcData) {
          // Update contract
          const tx = await this.contract.updateMlcData(
            song.geniusId,
            mlcData.code,
            mlcData.confidence,
            mlcData.matchMethod
          );
          await tx.wait();

          results.push({
            geniusId: song.geniusId,
            status: 'matched',
            mlcCode: mlcData.code
          });
        } else {
          results.push({
            geniusId: song.geniusId,
            status: 'no_match'
          });
        }

        // Rate limiting: 1 request per second
        await new Promise(r => setTimeout(r, 1000));

      } catch (error) {
        results.push({
          geniusId: song.geniusId,
          status: 'error',
          error: error.message
        });
      }
    }

    // 4. Generate report
    this.generateReport(results);

    return results;
  }

  async matchSongWithMlc(song) {
    // Strategy 1: Match by SoundCloud URL (most reliable)
    if (song.audioUri && song.audioUri.includes('soundcloud.com')) {
      const mlcData = await this.mlcClient.searchByUrl(song.audioUri);
      if (mlcData) {
        return { ...mlcData, matchMethod: 'soundcloud_url', confidence: 95 };
      }
    }

    // Strategy 2: Match by title + artist
    const mlcData = await this.mlcClient.searchByTitleArtist(
      song.title,
      song.artist
    );

    if (mlcData) {
      // Verify match quality
      const confidence = this.calculateMatchConfidence(song, mlcData);
      if (confidence > 70) {
        return { ...mlcData, matchMethod: 'title_artist', confidence };
      }
    }

    return null;
  }

  calculateMatchConfidence(song, mlcData) {
    let score = 0;

    // Title similarity (Levenshtein distance)
    const titleSim = this.similarity(song.title, mlcData.title);
    score += titleSim * 40; // 40% weight

    // Artist similarity
    const artistSim = this.similarity(song.artist, mlcData.artist);
    score += artistSim * 40; // 40% weight

    // Duration similarity (within 5 seconds)
    if (Math.abs(song.duration - mlcData.duration) <= 5) {
      score += 20; // 20% weight
    }

    return Math.round(score);
  }

  similarity(a, b) {
    // Levenshtein distance implementation
    // Returns 0-1 similarity score
    // ... implementation ...
  }
}

class MlcApiClient {
  constructor() {
    this.baseUrl = 'https://portal.themlc.com/api'; // Assuming API endpoint
  }

  async searchByUrl(soundcloudUrl) {
    // Query 1: Search by SoundCloud URL
    const response = await fetch(`${this.baseUrl}/search/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: soundcloudUrl })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.works?.[0]; // Return first match
  }

  async searchByTitleArtist(title, artist) {
    // Query 2: Search by title + artist
    const response = await fetch(`${this.baseUrl}/search/work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.works?.[0]; // Return first match
  }
}

// Run processor
const processor = new MlcBatchProcessor(
  process.env.CATALOG_CONTRACT,
  process.env.RPC_URL,
  process.env.PRIVATE_KEY
);

const results = await processor.processAllSongs();

console.log(`\nProcessing complete:`);
console.log(`  Matched: ${results.filter(r => r.status === 'matched').length}`);
console.log(`  No match: ${results.filter(r => r.status === 'no_match').length}`);
console.log(`  Errors: ${results.filter(r => r.status === 'error').length}`);
```

---

## GitHub Actions Workflow

### `.github/workflows/mlc-monthly-update.yml`

```yaml
name: MLC Monthly Update

on:
  schedule:
    # Run on the 1st of every month at 9am UTC
    - cron: '0 9 1 * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  update-mlc-data:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        working-directory: lit-actions
        run: npm install

      - name: Run MLC batch processor
        working-directory: lit-actions
        env:
          CATALOG_CONTRACT: ${{ secrets.CATALOG_CONTRACT }}
          RPC_URL: ${{ secrets.BASE_SEPOLIA_RPC }}
          PRIVATE_KEY: ${{ secrets.OWNER_PRIVATE_KEY }}
        run: node scripts/mlc-batch-processor.mjs

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: mlc-report-${{ github.run_id }}
          path: lit-actions/reports/mlc-*.json

      - name: Notify on Discord
        if: always()
        uses: sarisia/actions-status-discord@v1
        with:
          webhook: ${{ secrets.DISCORD_WEBHOOK }}
          title: "MLC Monthly Update Complete"
          description: "Check artifacts for detailed report"
```

---

## Manual Review Flow

For songs with low confidence matches (<80%), create a CSV for manual review:

```csv
geniusId,title,artist,mlcCode,mlcTitle,mlcArtist,confidence,action
395791,Dancing Queen,ABBA,W123456789,Dancing Queen,ABBA,95,approve
378195,Chandelier,Sia,W987654321,Chandelier,Sia,75,review
...
```

Admin can review and re-run with approved matches.

---

## Alternative: Lit Action for MLC Updates

If you want to keep everything in Lit Protocol:

**Pros**:
- ✅ Trustless execution
- ✅ PKP can sign transactions
- ✅ Consistent with existing architecture

**Cons**:
- ❌ Lit Actions have execution time limits
- ❌ Harder to debug/iterate
- ❌ More expensive (Lit capacity units)

**Verdict**: Use regular script for batch processing, Lit Actions are overkill here.

---

## Implementation Priority

### Phase 1: Core Script
1. ✅ Create `mlc-batch-processor.mjs`
2. ✅ Add MLC fields to contract
3. ✅ Add `updateMlcData()` function
4. ✅ Deploy updated contract

### Phase 2: Automation
1. ✅ Set up GitHub Actions workflow
2. ✅ Add secrets to GitHub
3. ✅ Test with manual trigger
4. ✅ Enable monthly cron

### Phase 3: Refinements
1. ✅ Add manual review UI (optional)
2. ✅ Improve matching algorithm
3. ✅ Add retry logic for failed matches
4. ✅ Track match history in database

---

## Summary

**Recommendation**: Create a **standalone script** that runs **monthly via GitHub Actions**.

**Why?**
- Simple, maintainable, version-controlled
- No infrastructure costs
- Easy to test and debug
- Can run manually anytime
- Keeps real-time pipeline clean

**Where?**
- Script: `lit-actions/scripts/mlc-batch-processor.mjs`
- Contract: Add MLC fields to `Song` struct + `updateMlcData()` function
- Automation: GitHub Actions with monthly cron

**Integration Point**: After songs are added to contract (not during real-time processing)

This keeps your critical path fast while still getting MLC compliance! 🎵
