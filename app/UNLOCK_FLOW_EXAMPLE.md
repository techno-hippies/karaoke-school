# Unlock Flow Implementation Example

## How to integrate the XState unlock flow into KaraokeSongPage

```tsx
// app/src/components/karaoke/KaraokeSongPage.tsx
import { useUnlockFlow } from '@/hooks/useUnlockFlow';
import { UnlockProgress } from './UnlockProgress';

export function KaraokeSongPage() {
  const { geniusId } = useParams<{ geniusId: string }>();
  const { isPKPReady, pkpAuthContext } = useAuth();

  // XState unlock flow
  const unlockFlow = useUnlockFlow({
    geniusId: parseInt(geniusId!),
    pkpAuthContext,
    // Optional: override language detection
    // targetLanguage: 'zh',
  });

  const handleUnlock = async () => {
    console.log('[Unlock] Starting unlock flow...');

    if (!isPKPReady || !pkpAuthContext || !geniusId) {
      console.error('[Unlock] Missing auth or geniusId');
      return;
    }

    try {
      // Execute match-and-segment-v7 (3-4 seconds)
      console.log('[Unlock] Executing match-and-segment for genius ID:', geniusId);

      const { executeMatchAndSegment } = await import('@/lib/lit/actions');
      const result = await executeMatchAndSegment(
        parseInt(geniusId),
        pkpAuthContext
      );

      if (result.success && result.isMatch && result.sections) {
        console.log('[Unlock] ✅ Match & Segment complete:', result.sections.length, 'sections');

        // Wait for transaction to be mined
        if (result.txHash) {
          console.log('[Unlock] ⏳ Waiting for transaction to be mined:', result.txHash);
          const { waitForTransactionReceipt } = await import('viem/actions');
          const { publicClient } = await import('@/config/contracts');

          await waitForTransactionReceipt(publicClient, {
            hash: result.txHash as `0x${string}`,
            confirmations: 1,
          });
          console.log('[Unlock] ✅ Transaction confirmed!');
        }

        // Reload song data to get updated segments from contract
        console.log('[Unlock] Refetching song data from contract...');
        await refetch();

        // 🚀 Start parallel processing with XState
        console.log('[Unlock] Starting parallel processing (audio, alignment, translation)...');
        unlockFlow.start();

      } else {
        console.error('[Unlock] ❌ Match & Segment failed:', result.error);
      }
    } catch (err) {
      console.error('[Unlock] ❌ Error during unlock:', err);
    }
  };

  return (
    <div>
      {/* Show unlock progress if processing */}
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

      {/* Show completion message */}
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

      {/* Rest of your song page UI */}
      <SongPage
        songTitle={displaySong.title}
        artist={displaySong.artist}
        // ...
        onUnlockAll={handleUnlock}
      />
    </div>
  );
}
```

## Language Detection

The machine automatically detects the user's language in this priority:

1. `localStorage.getItem('preferredLanguage')` (if user changed language before)
2. `navigator.language` browser setting:
   - `zh*` → Mandarin (default for Chinese speakers)
   - `vi*` → Vietnamese
   - else → English fallback

## Changing Language After Unlock

```tsx
// User clicks language selector
<Select onValueChange={(lang) => unlockFlow.changeLanguage(lang)}>
  <SelectItem value="zh">中文 (Mandarin)</SelectItem>
  <SelectItem value="vi">Tiếng Việt (Vietnamese)</SelectItem>
  <SelectItem value="en">English</SelectItem>
</Select>
```

This will update the context and can be used to re-trigger translation if needed.

## State Machine Architecture

### Parallel States
```
unlock
├─ idle
├─ processing (parallel)
│  ├─ audio: idle → loading → success/error
│  ├─ alignment: idle → loading → success/error
│  └─ translation: idle → loading → success/error
└─ complete
```

### Benefits
- ✅ **3 processes run in parallel** - audio (60s), alignment (10s), translation (15s) all start at once
- ✅ **Independent error handling** - one process failing doesn't stop the others
- ✅ **Individual retry** - retry just the failed process, not everything
- ✅ **Progress tracking** - each process tracks its own progress (0-100%)
- ✅ **Strongly typed** - full TypeScript support for context, events, states
- ✅ **Testable** - state machine logic is pure, easy to test
- ✅ **Debuggable** - XState DevTools support (install browser extension)

## What Gets Called

After match-and-segment completes:

1. **Audio Processor** (`audio-processor.ts`)
   - Triggers Demucs Modal API (~60s)
   - Webhook calls update-karaoke-contract-batch (with your new PKP permission!)
   - Result: vocals + instrumental URIs in contract

2. **Base Alignment** (`base-alignment.ts`)
   - Gets word-level timing for lyrics (~10s)
   - Result: word timing data for karaoke scrolling text

3. **Translation** (`translate.ts`)
   - Translates lyrics to target language (~15s)
   - Result: translated lyrics in Mandarin/Vietnamese/etc.

All 3 results are stored in the machine's context and can be accessed via `unlockFlow.audioResult`, `unlockFlow.alignmentResult`, `unlockFlow.translationResult`.
