# Complete Unlock Flow with XState

## State Machine Architecture

```
unlock
├─ idle (initial)
├─ checkingRequirements (automatic)
│  ├─ isFree? → matchAndSegment
│  ├─ hasCredits? → matchAndSegment
│  └─ else → showCreditDialog
├─ showCreditDialog (manual - user must purchase)
│  ├─ CREDITS_ACQUIRED → matchAndSegment
│  └─ CANCEL → idle
├─ matchAndSegment (3-4s)
│  ├─ success → waitingForTx
│  └─ error → matchFailed
├─ matchFailed
│  ├─ RETRY_MATCH_AND_SEGMENT → matchAndSegment
│  └─ CANCEL → idle
├─ waitingForTx (1-2s)
│  ├─ confirmed → processing
│  └─ error → txFailed
├─ txFailed
│  ├─ RETRY_MATCH_AND_SEGMENT → matchAndSegment
│  └─ CANCEL → idle
├─ processing (parallel)
│  ├─ audio: loading (~60s) → success/error
│  ├─ alignment: loading (~10s) → success/error
│  └─ translation: loading (~15s) → success/error
└─ complete (final)
```

## Integration Example

```tsx
// app/src/components/karaoke/KaraokeSongPage.tsx
import { useUnlockFlow } from '@/hooks/useUnlockFlow';
import { CreditFlowDialog } from './CreditFlowDialog';
import { UnlockProgress } from './UnlockProgress';
import { useCredits } from '@/contexts/CreditsContext';
import { useAuth } from '@/contexts/AuthContext';

export function KaraokeSongPage() {
  const { geniusId } = useParams<{ geniusId: string }>();
  const { isPKPReady, pkpAuthContext, pkpAddress } = useAuth();
  const { credits, loadCredits } = useCredits();
  const { song, segments, isLoading, refetch } = useSongData(
    geniusId ? parseInt(geniusId) : undefined
  );

  // XState unlock flow
  const unlockFlow = useUnlockFlow({
    geniusId: parseInt(geniusId!),
    pkpAuthContext,
    isFree: song?.isFree || false,
    creditBalance: credits,
    // Optional: override language detection
    // targetLanguage: 'zh',
  });

  // Credit purchase flow
  const { purchaseCredits, isPurchasing, checkUSDCBalance } = useCredits();
  const [usdcBalance, setUsdcBalance] = useState('0.00');

  // Load USDC balance when credit dialog is shown
  useEffect(() => {
    if (unlockFlow.needsCredits) {
      checkUSDCBalance().then((balance) => {
        // Convert from wei to dollars (USDC has 6 decimals)
        const balanceInDollars = Number(balance) / 1_000_000;
        setUsdcBalance(balanceInDollars.toFixed(2));
      });
    }
  }, [unlockFlow.needsCredits]);

  const handleUnlock = () => {
    console.log('[Unlock] Starting unlock flow...');
    unlockFlow.start();
  };

  const handlePurchaseCredits = async (packageId: number) => {
    console.log('[Credits] Purchasing package:', packageId);
    const success = await purchaseCredits(packageId);
    if (success) {
      // Reload credit balance
      await loadCredits();
      // Notify state machine that credits were acquired
      unlockFlow.creditsAcquired();
    }
  };

  // Refetch song data when processing completes
  useEffect(() => {
    if (unlockFlow.isComplete && unlockFlow.allSucceeded) {
      refetch();
    }
  }, [unlockFlow.isComplete, unlockFlow.allSucceeded]);

  return (
    <div>
      {/* Credit Flow Dialog - shown when needsCredits === true */}
      <CreditFlowDialog
        open={unlockFlow.needsCredits}
        onOpenChange={(open) => {
          if (!open) unlockFlow.cancel();
        }}
        songTitle={song?.title || ''}
        songArtist={song?.artist || ''}
        walletAddress={pkpAddress || ''}
        usdcBalance={usdcBalance}
        onPurchaseCredits={handlePurchaseCredits}
        isPurchasing={isPurchasing}
      />

      {/* Show match-and-segment progress */}
      {unlockFlow.isMatchingAndSegmenting && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">Matching lyrics and segmenting song...</p>
          <p className="text-xs text-muted-foreground mt-1">
            This takes 3-4 seconds
          </p>
        </div>
      )}

      {/* Show transaction confirmation progress */}
      {unlockFlow.isWaitingForTx && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">Waiting for transaction confirmation...</p>
          <p className="text-xs text-muted-foreground mt-1">
            Transaction: {unlockFlow.txHash?.slice(0, 10)}...
          </p>
        </div>
      )}

      {/* Show parallel processing progress */}
      {unlockFlow.isProcessing && (
        <UnlockProgress
          // Audio
          isAudioLoading={unlockFlow.isAudioLoading}
          isAudioSuccess={unlockFlow.isAudioSuccess}
          isAudioError={unlockFlow.isAudioError}
          audioProgress={unlockFlow.audioProgress}
          audioError={unlockFlow.audioError}
          onRetryAudio={unlockFlow.retryAudio}
          // Alignment
          isAlignmentLoading={unlockFlow.isAlignmentLoading}
          isAlignmentSuccess={unlockFlow.isAlignmentSuccess}
          isAlignmentError={unlockFlow.isAlignmentError}
          alignmentProgress={unlockFlow.alignmentProgress}
          alignmentError={unlockFlow.alignmentError}
          onRetryAlignment={unlockFlow.retryAlignment}
          // Translation
          isTranslationLoading={unlockFlow.isTranslationLoading}
          isTranslationSuccess={unlockFlow.isTranslationSuccess}
          isTranslationError={unlockFlow.isTranslationError}
          translationProgress={unlockFlow.translationProgress}
          translationError={unlockFlow.translationError}
          onRetryTranslation={unlockFlow.retryTranslation}
          // Overall
          overallProgress={unlockFlow.overallProgress}
        />
      )}

      {/* Show match/tx failure */}
      {(unlockFlow.hasMatchFailed || unlockFlow.hasTxFailed) && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm font-medium text-destructive">
            ❌ {unlockFlow.error}
          </p>
          <div className="flex gap-2 mt-2">
            <Button onClick={unlockFlow.retryMatchAndSegment} size="sm">
              Retry
            </Button>
            <Button onClick={unlockFlow.cancel} variant="ghost" size="sm">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Show completion */}
      {unlockFlow.isComplete && unlockFlow.allSucceeded && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-sm font-medium text-green-500">
            ✅ Song unlocked! All processing complete.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            You can now practice karaoke with vocals, word timing, and translations.
          </p>
        </div>
      )}

      {/* Rest of song page UI */}
      <SongPage
        songTitle={song?.title || ''}
        artist={song?.artist || ''}
        segments={segments}
        isUnlocking={unlockFlow.isUnlocking}
        onUnlockAll={handleUnlock}
        // ... other props
      />
    </div>
  );
}
```

## Complete Flow Timeline

### User clicks "Unlock" → `unlockFlow.start()`

1. **checkingRequirements** (instant)
   - If song is free (`isFree === true`) → skip to step 2
   - If user has credits (`credits > 0`) → skip to step 2
   - Else → show CreditFlowDialog

2. **showCreditDialog** (user-driven)
   - Dialog automatically shows View 1 (fund wallet) if USDC < $0.50
   - Dialog automatically shows View 2 (buy credits) if USDC >= $0.50
   - User purchases credits → `purchaseCredits(packageId)`
   - On success → `unlockFlow.creditsAcquired()` → proceed to step 3

3. **matchAndSegment** (3-4s)
   - Execute match-and-segment-v7 Lit Action
   - Get sections + metadata
   - Upload to Grove storage
   - Write to KaraokeCatalogV2 contract
   - Return txHash

4. **waitingForTx** (1-2s)
   - Wait for transaction confirmation
   - Check transaction receipt

5. **processing** (parallel - ~60s total)
   - **Audio** (~60s):
     - Trigger audio-processor-v4
     - Demucs Modal API processes song
     - Webhook calls update-karaoke-contract-batch (with new PKP permission!)
     - Vocals + instrumental URIs written to contract
   - **Alignment** (~10s):
     - Execute base-alignment-v1
     - Get word-level timing for lyrics
   - **Translation** (~15s):
     - Execute translate-lyrics-v1
     - Translate to Mandarin/Vietnamese/English

6. **complete**
   - All 3 processes succeeded
   - User can now practice karaoke!

## Language Detection Priority

1. `localStorage.getItem('preferredLanguage')` - if user changed language
2. `navigator.language`:
   - `zh*` → Mandarin (**default for Chinese speakers**)
   - `vi*` → Vietnamese
   - else → English

## Credits Required

- **Free songs** (`isFree: true`): No credits required, skip to match-and-segment
- **Paid songs** (`isFree: false`): Requires 1 credit
  - Check credit balance from `CreditsContext`
  - If no credits → show `CreditFlowDialog`

## Benefits of This Architecture

✅ **Sequential dependencies enforced** - Can't start processing until tx confirms
✅ **Credit gating** - Handles free vs. paid songs automatically
✅ **Parallel processing** - Audio/alignment/translation run simultaneously
✅ **Independent error handling** - One failing doesn't stop others
✅ **Individual retry** - Retry specific failed step
✅ **Progress tracking** - Real-time UI updates
✅ **TypeScript** - Fully typed context, events, states
✅ **Testable** - State machine logic is pure
✅ **Debuggable** - XState DevTools browser extension
✅ **Single source of truth** - Entire unlock flow in one place

## Debugging

Install [XState Inspector](https://stately.ai/docs/inspector) to visualize the state machine:

```tsx
import { inspect } from '@xstate/inspect';

if (process.env.NODE_ENV === 'development') {
  inspect({
    iframe: false,
  });
}
```

Then in the machine:
```tsx
const [state, send] = useMachine(unlockMachine, {
  inspect: true,
});
```
