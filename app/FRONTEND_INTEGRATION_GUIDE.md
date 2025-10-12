# Frontend Integration Guide: Song-Based Processing

This guide explains how to integrate the optimized song-based processing flow into the frontend.

## Overview

**Old Flow (Segment-Based)**:
1. User selects segment → Check ownership → Buy 1 credit → Unlock segment → Process segment
2. Repeat 5 times for 5 segments
3. 5 separate transactions, 5 separate processing jobs

**New Flow (Song-Based)**:
1. User selects song → Check ownership → Buy 5 credits → Unlock song → Process entire song
2. Single transaction unlocks all segments
3. Single processing job generates all stems

## Changes Required

### 1. Contract ABIs

Add new functions to `KaraokeCreditsV1` ABI:

```typescript
// app/src/lib/contracts/karaokeCreditsAbi.ts

export const karaokeCreditsAbi = [
  // ... existing functions ...

  // NEW: Song-level ownership
  {
    name: 'unlockSong',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'geniusId', type: 'uint32' },
      { name: 'segmentCount', type: 'uint8' }
    ],
    outputs: []
  },
  {
    name: 'ownsSong',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'geniusId', type: 'uint32' }
    ],
    outputs: [{ type: 'bool' }]
  },

  // Event
  {
    name: 'SongUnlocked',
    type: 'event',
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: true, name: 'geniusId', type: 'uint32' },
      { name: 'segmentCount', type: 'uint8' },
      { name: 'timestamp', type: 'uint64' }
    ]
  }
];
```

### 2. SongSelectPage Component

Update to show song-level unlock instead of segment-level:

```typescript
// app/src/components/karaoke/SongSelectPage.tsx

import { useState } from 'react';
import { useContractWrite, useContractRead } from 'wagmi';
import { karaokeCreditsAbi } from '@/lib/contracts/karaokeCreditsAbi';

export function SongSelectPage() {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if user owns the song
  const { data: ownsSong } = useContractRead({
    address: KARAOKE_CREDITS_ADDRESS,
    abi: karaokeCreditsAbi,
    functionName: 'ownsSong',
    args: [userAddress, selectedSong?.geniusId],
    enabled: !!selectedSong
  });

  // Check user's credit balance
  const { data: creditBalance } = useContractRead({
    address: KARAOKE_CREDITS_ADDRESS,
    abi: karaokeCreditsAbi,
    functionName: 'getCredits',
    args: [userAddress]
  });

  // Unlock song transaction
  const { write: unlockSong } = useContractWrite({
    address: KARAOKE_CREDITS_ADDRESS,
    abi: karaokeCreditsAbi,
    functionName: 'unlockSong',
    args: [selectedSong?.geniusId, selectedSong?.segmentCount],
    onSuccess: async (data) => {
      console.log('Song unlocked!', data.hash);
      // Trigger Modal processing
      await triggerSongProcessing(selectedSong);
    }
  });

  const handleUnlockSong = async () => {
    if (!selectedSong) return;

    // Check if enough credits
    if (creditBalance < selectedSong.segmentCount) {
      // Show InsufficientBalanceDialog
      setShowPurchaseDialog(true);
      return;
    }

    // Check if song is already processed in contract
    const song = await checkSongProcessed(selectedSong.geniusId);

    if (!song) {
      // Run Lit Action 1 (match + segment identification)
      console.log('Running match-and-segment Lit Action...');
      const litResult = await executeLitAction({
        ipfsId: MATCH_AND_SEGMENT_CID,
        jsParams: {
          geniusId: selectedSong.geniusId,
          writeToBlockchain: true,
          runAlignment: true
        }
      });

      if (!litResult.success) {
        throw new Error(`Match failed: ${litResult.error}`);
      }
    }

    // Unlock song (deduct credits)
    unlockSong();
  };

  const triggerSongProcessing = async (song: Song) => {
    // Get segment data from contract
    const catalogContract = getContract({
      address: KARAOKE_CATALOG_ADDRESS,
      abi: karaokeCatalogAbi
    });

    const songData = await catalogContract.read.getSongByGeniusId([song.geniusId]);

    // Trigger Modal processing (song-based endpoint)
    const jobId = crypto.randomUUID();
    const webhookUrl = 'https://your-webhook-server.railway.app/webhook/song-complete';

    const formData = new FormData();
    formData.append('job_id', jobId);
    formData.append('user_address', userAddress);
    formData.append('genius_id', song.geniusId.toString());
    formData.append('audio_url', songData.soundcloudUrl);
    formData.append('full_duration', songData.duration.toString());
    formData.append('segments_json', JSON.stringify(songData.segments));
    formData.append('chain_id', '37111');
    formData.append('mp3_bitrate', '192');
    formData.append('fal_strength', '0.4');
    formData.append('webhook_url', webhookUrl);

    const response = await fetch(
      'https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run/process-song-async',
      {
        method: 'POST',
        body: formData
      }
    );

    const result = await response.json();
    console.log('Processing started:', result);

    // Show processing UI
    setIsProcessing(true);
    setProcessingJobId(jobId);

    // Poll for completion
    pollProcessingStatus(jobId);
  };

  const pollProcessingStatus = async (jobId: string) => {
    const maxAttempts = 60; // 5 minutes (60 × 5s)
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;

      try {
        const response = await fetch(
          `https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run/job/${jobId}`
        );
        const job = await response.json();

        if (job.status === 'complete') {
          console.log('Processing complete!', job);
          setIsProcessing(false);
          clearInterval(poll);

          // Refresh segment data from contract
          await refetchSegments();
        } else if (job.status === 'failed') {
          console.error('Processing failed:', job.error);
          setIsProcessing(false);
          clearInterval(poll);
          // Show error dialog
        } else if (attempts >= maxAttempts) {
          console.error('Processing timeout');
          setIsProcessing(false);
          clearInterval(poll);
          // Show timeout dialog
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 5000); // Poll every 5 seconds
  };

  return (
    <div>
      {/* Song List */}
      <SongList
        songs={songs}
        onSelectSong={setSelectedSong}
      />

      {/* Song Details + Unlock Button */}
      {selectedSong && (
        <div className="song-details">
          <h2>{selectedSong.title}</h2>
          <p>{selectedSong.artist}</p>
          <p>{selectedSong.segmentCount} segments</p>

          {ownsSong ? (
            <div className="owned">
              ✅ You own this song
              <SegmentList segments={selectedSong.segments} />
            </div>
          ) : (
            <button onClick={handleUnlockSong}>
              Unlock Song ({selectedSong.segmentCount} credits)
            </button>
          )}

          {isProcessing && (
            <ProcessingIndicator
              jobId={processingJobId}
              message="Processing full song (vocals + instrumental stems)..."
            />
          )}
        </div>
      )}

      {/* Purchase Credits Dialog */}
      {showPurchaseDialog && (
        <InsufficientBalanceDialog
          required={selectedSong.segmentCount}
          available={creditBalance}
          onClose={() => setShowPurchaseDialog(false)}
        />
      )}
    </div>
  );
}
```

### 3. Update Segment Picker (Optional)

If you still want to show individual segments after unlock:

```typescript
// app/src/components/karaoke/SegmentPickerDrawer.tsx

export function SegmentPickerDrawer({ song }: { song: Song }) {
  const { data: ownsSong } = useContractRead({
    address: KARAOKE_CREDITS_ADDRESS,
    abi: karaokeCreditsAbi,
    functionName: 'ownsSong',
    args: [userAddress, song.geniusId]
  });

  return (
    <Drawer>
      <h3>{song.title} - Select Segment</h3>

      {ownsSong ? (
        <SegmentList
          segments={song.segments}
          onSelectSegment={handleStartKaraoke}
        />
      ) : (
        <div>
          <p>Unlock song to access all {song.segments.length} segments</p>
          <button onClick={handleUnlockSong}>
            Unlock Song ({song.segments.length} credits)
          </button>
        </div>
      )}
    </Drawer>
  );
}
```

### 4. InsufficientBalanceDialog

Update to show song-level pricing:

```typescript
// app/src/components/karaoke/InsufficientBalanceDialog.tsx

export function InsufficientBalanceDialog({
  required,
  available,
  onClose
}: {
  required: number;
  available: number;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insufficient Credits</DialogTitle>
          <DialogDescription>
            You need {required} credits to unlock this song.
            <br />
            You currently have {available} credits.
          </DialogDescription>
        </DialogHeader>

        <div className="packages">
          <h4>Purchase Credits</h4>
          <PackageList
            packages={[
              { id: 0, credits: 1, price: '$0.50' },
              { id: 1, credits: 5, price: '$2.50' },
              { id: 2, credits: 20, price: '$10.00' }
            ]}
            required={required - available}
          />
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 5. Environment Variables

Update `.env.local`:

```bash
# Lit Action CIDs
NEXT_PUBLIC_MATCH_AND_SEGMENT_CID=QmWUicJAFvVfhNBHgyHfB3kLzXdBHwKTkzkA974ddsATj4  # v5
NEXT_PUBLIC_UPDATE_CONTRACT_CID=QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  # NEW: Batch version

# Modal Endpoints
NEXT_PUBLIC_MODAL_SONG_ENDPOINT=https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run/process-song-async
NEXT_PUBLIC_MODAL_SEGMENT_ENDPOINT=https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run/process-karaoke-async  # DEPRECATED

# Webhook Server
NEXT_PUBLIC_WEBHOOK_URL=https://your-webhook-server.railway.app/webhook/song-complete

# Contracts (Base Sepolia)
NEXT_PUBLIC_KARAOKE_CREDITS_ADDRESS=0x...  # Updated contract with unlockSong()
NEXT_PUBLIC_KARAOKE_CATALOG_ADDRESS=0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6
```

### 6. Feature Flag (Optional - for gradual rollout)

Add a feature flag to toggle between old and new flow:

```typescript
// app/src/lib/features.ts

export const FEATURES = {
  USE_SONG_BASED_PROCESSING: process.env.NEXT_PUBLIC_USE_SONG_BASED === 'true'
};

// Usage in components:
if (FEATURES.USE_SONG_BASED_PROCESSING) {
  // New flow: unlock song
  await unlockSong();
} else {
  // Old flow: unlock segment
  await useCredit();
}
```

## Testing Checklist

### Unit Tests
- [ ] `unlockSong()` contract call with correct parameters
- [ ] `ownsSong()` returns true after unlock
- [ ] `ownsSegment()` returns true for all segments after song unlock
- [ ] Credit balance decreases by segment count
- [ ] Double unlock fails with "Song already owned"

### Integration Tests
- [ ] End-to-end: Select song → Unlock → Process → View segments
- [ ] Insufficient credits flow → Purchase → Unlock
- [ ] Processing status polling (success, failure, timeout)
- [ ] Contract events (SongUnlocked) trigger UI updates

### Edge Cases
- [ ] Song with >190s duration (first 190s processed)
- [ ] Song already in SongCatalogV1 (free) → No credits needed
- [ ] Processing fails → Show error, don't deduct credits
- [ ] User owns some segments individually → Upgrade to full song

## Deployment Steps

1. **Deploy Updated Contract**
   ```bash
   cd contracts
   forge script evm/base-sepolia/KaraokeCredits/script/DeployKaraokeCreditsV2.s.sol \
     --rpc-url https://sepolia.base.org \
     --broadcast --verify
   ```

2. **Upload New Lit Action**
   ```bash
   cd lit-actions
   node scripts/upload-lit-action.mjs \
     src/karaoke/update-karaoke-contract-batch.js \
     "Update Contract Batch - Song-based optimization"
   # Save CID: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

3. **Update Webhook Server**
   ```bash
   cd webhook-server
   # Update LIT_ACTION_2_CID in Railway environment variables
   railway variables set LIT_ACTION_2_CID=QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

4. **Deploy Modal Changes**
   ```bash
   cd spleeter-modal
   modal deploy spleeter_api.py
   ```

5. **Update Frontend**
   ```bash
   cd app
   # Update .env.local with new contract address and CIDs
   npm run build
   vercel --prod
   ```

## Rollback Plan

If issues arise, rollback is simple:

1. Set feature flag: `USE_SONG_BASED_PROCESSING=false`
2. Revert webhook server to old Lit Action CID
3. Frontend continues using old flow (segment-based)
4. No contract changes needed (backward compatible)

## Monitoring

Track these metrics post-deployment:

- **Cost**: fal.ai spend per song (target: $0.20 vs $1.00)
- **Processing time**: Full song processing duration (target: <90s)
- **Error rate**: Song processing failures (target: <5%)
- **User engagement**: Songs unlocked per day
- **Revenue**: Credits purchased (should increase with better UX)

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify contract addresses in `.env.local`
3. Check webhook server logs: `railway logs`
4. Check Modal logs: `modal logs`
5. Verify Lit Action CIDs are correct

---

## Quick Reference

### Contract Addresses (Base Sepolia)

- KaraokeCreditsV2: `0x...` (NEW - with unlockSong)
- KaraokeCatalogV1: `0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6`

### Lit Action CIDs

- Match & Segment v5: `QmWUicJAFvVfhNBHgyHfB3kLzXdBHwKTkzkA974ddsATj4`
- Update Contract (Batch): `QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` (NEW)

### Endpoints

- Modal Song Processing: `https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run/process-song-async`
- Webhook Server: `https://your-webhook-server.railway.app/webhook/song-complete`
- Job Status: `https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run/job/{jobId}`
