/**
 * Complete Unlock Flow State Machine
 *
 * Orchestrates the entire karaoke unlock process from page load to completion.
 *
 * Two main flows:
 *
 * 1. AUTO-CATALOG (FREE, runs on page load):
 *    - Check if song already cataloged in contract
 *    - If not → Run match-and-segment (FREE, writes basic metadata)
 *    - Shows segments skeleton → actual segments
 *
 * 2. UNLOCK (PAID, runs on button click):
 *    - Check if user has credits
 *    - If no credits → Show CreditFlowDialog
 *    - Skip match-and-segment (already done by auto-catalog)
 *    - Fetch lyrics from LRClib
 *    - Parallel processing: Audio + Alignment + Translation
 *
 * This eliminates the component-level state management complexity.
 */

import { setup, fromPromise, assign } from 'xstate';
import type { PKPAuthContext } from '@/lib/lit/auth/auth-pkp';
import type { Hash } from 'viem';

// Language detection helper
export function detectUserLanguage(): string {
  const stored = localStorage.getItem('preferredLanguage');
  if (stored) return stored;

  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) return 'zh'; // Mandarin (default)
  if (browserLang.startsWith('vi')) return 'vi'; // Vietnamese
  return 'en'; // English fallback
}

// Types
export interface UnlockContext {
  // Input data
  geniusId: number;
  pkpAuthContext: PKPAuthContext | null;
  pkpAddress: string | null;
  targetLanguage: string;

  // Song metadata (for LRClib fetch)
  artist: string;
  title: string;

  // Song status flags
  isAlreadyCataloged: boolean;  // true = song exists in contract
  isFree: boolean;              // true = no credits required
  hasFullAudio: boolean | null; // true = full audio, false = 30s snippet, null = unknown

  // Credit state
  hasCredits: boolean;
  creditBalance: number;
  usdcBalance: string;

  // Match-and-segment result
  matchResult: any | null;
  txHash: Hash | null;

  // Data needed by parallel actors (from match-and-segment)
  soundcloudPermalink: string | null;
  sections: Array<{ type: string; startTime: number; endTime: number; duration: number }> | null;
  songDuration: number | null;
  plainLyrics: string | null;

  // Progress tracking
  audioProgress: number;
  alignmentProgress: number;
  translationProgress: number;

  // Results
  audioResult: any | null;
  alignmentResult: any | null;
  translationResult: any | null;

  // Errors
  error: string | null;
  catalogError: string | null;
  audioError: string | null;
  alignmentError: string | null;
  translationError: string | null;
}

export type UnlockEvent =
  | { type: 'AUTO_CATALOG' }           // Start auto-catalog (page load)
  | { type: 'UNLOCK' }                 // Start unlock flow (button click)
  | { type: 'UPDATE_AUTH'; pkpAuthContext: PKPAuthContext; pkpAddress: string } // Update auth context
  | { type: 'CREDITS_PURCHASED' }      // User purchased credits
  | { type: 'UPDATE_CREDITS'; balance: number } // Update credit balance
  | { type: 'RETRY_CATALOG' }          // Retry catalog after error
  | { type: 'RETRY_AUDIO' }
  | { type: 'RETRY_ALIGNMENT' }
  | { type: 'RETRY_TRANSLATION' }
  | { type: 'CANCEL' }                 // Cancel and return to idle
  | { type: 'CHANGE_LANGUAGE'; language: string };

export interface UnlockInput {
  geniusId: number;
  pkpAuthContext: PKPAuthContext | null;
  pkpAddress: string | null;
  artist: string;
  title: string;
  creditBalance: number;
  targetLanguage?: string;
  // Pre-populated data (if song already cataloged in contract)
  isAlreadyCataloged?: boolean;
  isFree?: boolean;
  sections?: Array<{ type: string; startTime: number; endTime: number; duration: number }> | null;
  soundcloudPermalink?: string | null;
  songDuration?: number | null;
  hasFullAudio?: boolean | null;
}

// Actor logic: Match and Segment
const matchAndSegmentLogic = fromPromise<
  { success: boolean; isMatch: boolean; sections?: any[]; txHash?: Hash; genius?: { soundcloudPermalink: string }; error?: string },
  { geniusId: number; pkpAuthContext: PKPAuthContext }
>(async ({ input }) => {
  const { executeMatchAndSegment } = await import('@/lib/lit/actions');
  return executeMatchAndSegment(input.geniusId, input.pkpAuthContext);
});

// Actor logic: Fetch Plain Lyrics from LRClib
const fetchLyricsLogic = fromPromise<string, { artist: string; title: string }>(
  async ({ input }) => {
    const resp = await fetch(
      'https://lrclib.net/api/search?' +
      new URLSearchParams({
        artist_name: input.artist,
        track_name: input.title
      })
    );

    const results = await resp.json();
    if (!results || results.length === 0) {
      throw new Error('No lyrics found on LRClib');
    }

    const lrcData = results[0];
    const syncedLyrics = lrcData.syncedLyrics;

    if (!syncedLyrics) {
      throw new Error('No synced lyrics available');
    }

    // Parse synced lyrics to extract plain text
    const lines = syncedLyrics.split('\n').filter((l: string) => l.trim());
    const plainLyrics = lines
      .map((line: string) => {
        const match = line.match(/\[[\d:.]+\]\s*(.+)/);
        return match ? match[1] : '';
      })
      .filter((l: string) => l)
      .join('\n');

    return plainLyrics;
  }
);

// Actor logic: Wait for transaction
const waitForTxLogic = fromPromise<void, { txHash: Hash }>(async ({ input }) => {
  const { waitForTransactionReceipt } = await import('viem/actions');
  const { publicClient } = await import('@/config/contracts');

  await waitForTransactionReceipt(publicClient, {
    hash: input.txHash,
    confirmations: 1,
  });
});

// Actor logic: Audio Processor
const audioProcessorLogic = fromPromise<
  any,
  {
    geniusId: number;
    sections: Array<{ type: string; startTime: number; endTime: number; duration: number }>;
    soundcloudPermalink: string;
    pkpAddress: string;
    songDuration: number;
    pkpAuthContext: PKPAuthContext;
  }
>(async ({ input }) => {
  const { executeAudioProcessor } = await import('@/lib/lit/actions/audio-processor');
  return executeAudioProcessor(
    input.geniusId,
    1, // sectionIndex - default to first segment (will process all segments)
    input.sections,
    input.soundcloudPermalink,
    input.pkpAddress,
    input.songDuration,
    input.pkpAuthContext
  );
});

// Actor logic: Base Alignment
const baseAlignmentLogic = fromPromise<
  any,
  { geniusId: number; plainLyrics: string; pkpAuthContext: PKPAuthContext }
>(async ({ input }) => {
  const { executeBaseAlignment } = await import('@/lib/lit/actions/base-alignment');
  return executeBaseAlignment(
    input.geniusId,
    input.plainLyrics,
    input.pkpAuthContext
  );
});

// Actor logic: Translation
const translationLogic = fromPromise<
  any,
  { geniusId: number; pkpAuthContext: PKPAuthContext; targetLanguage: string }
>(async ({ input }) => {
  const { executeTranslate } = await import('@/lib/lit/actions/translate');
  return executeTranslate(input.geniusId, input.targetLanguage, input.pkpAuthContext);
});

// State machine setup
export const unlockMachine = setup({
  types: {
    context: {} as UnlockContext,
    events: {} as UnlockEvent,
    input: {} as UnlockInput,
  },
  actors: {
    matchAndSegment: matchAndSegmentLogic,
    fetchLyrics: fetchLyricsLogic,
    waitForTx: waitForTxLogic,
    audioProcessor: audioProcessorLogic,
    baseAlignment: baseAlignmentLogic,
    translation: translationLogic,
  },
  guards: {},
}).createMachine({
  id: 'unlock',
  context: ({ input }) => ({
    geniusId: input.geniusId,
    pkpAuthContext: input.pkpAuthContext || null,
    pkpAddress: input.pkpAddress || null,
    artist: input.artist,
    title: input.title,
    targetLanguage: input.targetLanguage || detectUserLanguage(),
    isAlreadyCataloged: input.isAlreadyCataloged || false,
    isFree: input.isFree || false,
    hasFullAudio: input.hasFullAudio ?? null,
    hasCredits: input.creditBalance > 0,
    creditBalance: input.creditBalance,
    usdcBalance: '0.00',
    matchResult: null,
    txHash: null,
    soundcloudPermalink: input.soundcloudPermalink || null,
    sections: input.sections || null,
    songDuration: input.songDuration || null,
    plainLyrics: null,
    audioProgress: 0,
    alignmentProgress: 0,
    translationProgress: 0,
    audioResult: null,
    alignmentResult: null,
    translationResult: null,
    error: null,
    catalogError: null,
    audioError: null,
    alignmentError: null,
    translationError: null,
  }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        AUTO_CATALOG: {
          guard: ({ context }) => {
            const hasAuth = !!context.pkpAuthContext;
            if (!hasAuth) {
              console.warn('[UnlockMachine] ⚠️ Cannot start auto-catalog: auth context not ready');
            }
            return hasAuth;
          },
          target: 'checkingSongStatus',
        },
        UNLOCK: {
          guard: ({ context }) => {
            const hasAuth = !!context.pkpAuthContext;
            if (!hasAuth) {
              console.warn('[UnlockMachine] ⚠️ Cannot start unlock: auth context not ready');
            }
            return hasAuth;
          },
          target: 'checkingCredits',
        },
      },
    },
    checkingSongStatus: {
      entry: () => console.log('[UnlockMachine] 🔍 Checking if song needs cataloging...'),
      always: [
        {
          // Song already cataloged (has segments) → done
          guard: ({ context }) => context.isAlreadyCataloged && !!context.sections && context.sections.length > 0,
          target: 'cataloged',
          actions: () => console.log('[UnlockMachine] ✅ Song already cataloged, skipping match-and-segment'),
        },
        {
          // Song not cataloged → run match-and-segment (FREE)
          target: 'matchAndSegment',
          actions: () => console.log('[UnlockMachine] 📝 Song not cataloged, starting match-and-segment...'),
        }
      ],
    },
    cataloged: {
      entry: () => console.log('[UnlockMachine] ✅ Catalog complete - song ready'),
      on: {
        UNLOCK: {
          guard: ({ context }) => !!context.pkpAuthContext,
          target: 'checkingCredits',
        },
      },
    },
    matchAndSegment: {
      meta: {
        description: 'Executing match-and-segment-v7 (FREE, 3-4 seconds)',
      },
      invoke: {
        src: 'matchAndSegment',
        id: 'matchAndSegment',
        input: ({ context }) => ({
          geniusId: context.geniusId,
          pkpAuthContext: context.pkpAuthContext!,
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.success && event.output.isMatch,
            target: 'waitingForTx',
            actions: assign({
              matchResult: ({ event }) => {
                console.log('[UnlockMachine] ✅ Match-and-segment succeeded:', {
                  hasPermalink: !!event.output.genius?.soundcloudPermalink,
                  hasFullAudio: event.output.hasFullAudio,
                  sectionCount: event.output.sections?.length || 0,
                  txHash: event.output.txHash
                });
                return event.output;
              },
              txHash: ({ event }) => event.output.txHash || null,
              soundcloudPermalink: ({ event }) => event.output.genius?.soundcloudPermalink || null,
              hasFullAudio: ({ event }) => event.output.hasFullAudio || false,
              sections: ({ event }) => event.output.sections || null,
              songDuration: ({ event }) =>
                event.output.sections && event.output.sections.length > 0
                  ? Math.max(...event.output.sections.map((s: any) => s.endTime))
                  : null,
            }),
          },
          {
            target: 'catalogFailed',
            actions: assign({
              catalogError: ({ event }) => event.output.error || 'Match and segment failed',
            }),
          },
        ],
        onError: {
          target: 'catalogFailed',
          actions: assign({
            catalogError: ({ event }) => (event.error as Error).message,
          }),
        },
      },
    },
    catalogFailed: {
      entry: ({ context }) => console.error('[UnlockMachine] ❌ Catalog failed:', context.catalogError),
      on: {
        RETRY_CATALOG: 'matchAndSegment',
        CANCEL: 'idle',
      },
    },
    waitingForTx: {
      entry: ({ context }) => console.log('[UnlockMachine] ⏳ Waiting for transaction:', context.txHash),
      meta: {
        description: 'Waiting for transaction confirmation (1-2 seconds)',
      },
      invoke: {
        src: 'waitForTx',
        id: 'waitForTx',
        input: ({ context }) => ({
          txHash: context.txHash!,
        }),
        onDone: {
          target: 'cataloged',
          actions: () => console.log('[UnlockMachine] ✅ Transaction confirmed - catalog complete!'),
        },
        onError: {
          target: 'catalogFailed',
          actions: assign({
            catalogError: ({ event }) => `Transaction confirmation failed: ${(event.error as Error).message}`,
          }),
        },
      },
    },
    checkingCredits: {
      entry: ({ context }) => console.log('[UnlockMachine] 💳 Checking credits:', {
        balance: context.creditBalance,
        hasCredits: context.hasCredits,
        isFree: context.isFree
      }),
      always: [
        {
          // Free song → skip credit check, go straight to processing
          guard: ({ context }) => context.isFree,
          target: 'fetchingLyrics',
          actions: () => console.log('[UnlockMachine] 🆓 Free song, skipping credit check'),
        },
        {
          // Has credits → proceed to processing
          guard: ({ context }) => context.hasCredits,
          target: 'fetchingLyrics',
          actions: () => console.log('[UnlockMachine] ✅ Credits available, proceeding...'),
        },
        {
          // No credits → show credit dialog
          target: 'needsCredits',
          actions: () => console.log('[UnlockMachine] ⚠️ No credits, showing purchase dialog'),
        }
      ],
    },
    needsCredits: {
      entry: () => console.log('[UnlockMachine] 💰 Waiting for user to purchase credits...'),
      on: {
        CREDITS_PURCHASED: {
          target: 'fetchingLyrics',
          actions: [
            assign({
              hasCredits: true,
              creditBalance: ({ event }) => (event as any).balance || 1,
            }),
            () => console.log('[UnlockMachine] ✅ Credits purchased, resuming unlock...'),
          ],
        },
        UPDATE_CREDITS: {
          actions: assign({
            hasCredits: ({ event }) => event.balance > 0,
            creditBalance: ({ event }) => event.balance,
          }),
        },
        CANCEL: 'idle',
      },
    },
    fetchingLyrics: {
      entry: ({ context }) => console.log('[UnlockMachine] 🎵 Fetching lyrics from LRClib:', { artist: context.artist, title: context.title }),
      meta: {
        description: 'Fetching plain lyrics from LRClib for base alignment',
      },
      invoke: {
        src: 'fetchLyrics',
        id: 'fetchLyrics',
        input: ({ context }) => ({
          artist: context.artist,
          title: context.title,
        }),
        onDone: {
          target: 'processing',
          actions: assign({
            plainLyrics: ({ event }) => {
              console.log('[UnlockMachine] ✅ Lyrics fetched:', event.output.substring(0, 100) + '...');
              return event.output;
            },
          }),
        },
        onError: {
          target: 'lyricsFetchFailed',
          actions: assign({
            error: ({ event }) => `Failed to fetch lyrics: ${(event.error as Error).message}`,
          }),
        },
      },
    },
    lyricsFetchFailed: {
      entry: ({ context }) => console.error('[UnlockMachine] ❌ Lyrics fetch failed:', context.error),
      on: {
        UNLOCK: 'fetchingLyrics',  // Retry by clicking unlock again
        CANCEL: 'idle',
      },
    },
    processing: {
      entry: () => console.log('[UnlockMachine] ✅ Entered parallel processing state'),
      meta: {
        description: 'Parallel processing: audio (~60s) + alignment (~10s) + translation (~15s)',
      },
      type: 'parallel',
      states: {
        audio: {
          initial: 'loading',
          states: {
            loading: {
              entry: ({ context }) => console.log('[UnlockMachine] 🎧 Starting audio processor:', {
                geniusId: context.geniusId,
                sectionCount: context.sections?.length,
                hasPermalink: !!context.soundcloudPermalink
              }),
              invoke: {
                src: 'audioProcessor',
                id: 'audioProcessor',
                input: ({ context }) => ({
                  geniusId: context.geniusId,
                  sections: context.sections!,
                  soundcloudPermalink: context.soundcloudPermalink!,
                  pkpAddress: context.pkpAddress!,
                  songDuration: context.songDuration!,
                  pkpAuthContext: context.pkpAuthContext!,
                }),
                onDone: {
                  target: 'success',
                  actions: assign({
                    audioResult: ({ event }) => {
                      console.log('[UnlockMachine] ✅ Audio processor completed');
                      return event.output;
                    },
                    audioProgress: 100,
                  }),
                },
                onError: {
                  target: 'error',
                  actions: assign({
                    audioError: ({ event }) => {
                      const message = (event.error as Error).message;
                      console.error('[UnlockMachine] ❌ Audio processor failed:', message);
                      return message;
                    },
                  }),
                },
              },
            },
            success: {
              type: 'final',
            },
            error: {
              on: {
                RETRY_AUDIO: 'loading',
              },
            },
          },
        },
        alignment: {
          initial: 'loading',
          states: {
            loading: {
              entry: ({ context }) => console.log('[UnlockMachine] 🎤 Starting base alignment:', {
                geniusId: context.geniusId,
                hasLyrics: !!context.plainLyrics,
                hasPermalink: !!context.soundcloudPermalink
              }),
              invoke: {
                src: 'baseAlignment',
                id: 'baseAlignment',
                input: ({ context }) => ({
                  geniusId: context.geniusId,
                  plainLyrics: context.plainLyrics!,
                  pkpAuthContext: context.pkpAuthContext!,
                }),
                onDone: {
                  target: 'success',
                  actions: assign({
                    alignmentResult: ({ event }) => {
                      console.log('[UnlockMachine] ✅ Base alignment completed');
                      return event.output;
                    },
                    alignmentProgress: 100,
                  }),
                },
                onError: {
                  target: 'error',
                  actions: assign({
                    alignmentError: ({ event }) => {
                      const message = (event.error as Error).message;
                      console.error('[UnlockMachine] ❌ Base alignment failed:', message);
                      return message;
                    },
                  }),
                },
              },
            },
            success: {
              type: 'final',
            },
            error: {
              on: {
                RETRY_ALIGNMENT: 'loading',
              },
            },
          },
        },
        translation: {
          initial: 'loading',
          states: {
            loading: {
              entry: ({ context }) => console.log('[UnlockMachine] 🌐 Starting translation:', {
                geniusId: context.geniusId,
                targetLanguage: context.targetLanguage
              }),
              invoke: {
                src: 'translation',
                id: 'translation',
                input: ({ context }) => ({
                  geniusId: context.geniusId,
                  pkpAuthContext: context.pkpAuthContext!,
                  targetLanguage: context.targetLanguage,
                }),
                onDone: {
                  target: 'success',
                  actions: assign({
                    translationResult: ({ event }) => {
                      console.log('[UnlockMachine] ✅ Translation completed');
                      return event.output;
                    },
                    translationProgress: 100,
                  }),
                },
                onError: {
                  target: 'error',
                  actions: assign({
                    translationError: ({ event }) => {
                      const message = (event.error as Error).message;
                      console.error('[UnlockMachine] ❌ Translation failed:', message);
                      return message;
                    },
                  }),
                },
              },
            },
            success: {
              type: 'final',
            },
            error: {
              on: {
                RETRY_TRANSLATION: 'loading',
              },
            },
          },
        },
      },
      onDone: {
        target: 'complete',
        actions: () => console.log('[UnlockMachine] 🎉 All parallel processing complete!'),
      },
    },
    complete: {
      entry: () => console.log('[UnlockMachine] ✨ Unlock flow finished'),
      type: 'final',
    },
  },
  on: {
    UPDATE_AUTH: {
      actions: assign({
        pkpAuthContext: ({ event }) => event.pkpAuthContext,
        pkpAddress: ({ event }) => event.pkpAddress,
      }),
    },
    UPDATE_CREDITS: {
      actions: assign({
        hasCredits: ({ event }) => event.balance > 0,
        creditBalance: ({ event }) => event.balance,
      }),
    },
    CHANGE_LANGUAGE: {
      actions: assign({
        targetLanguage: ({ event }) => event.language,
      }),
    },
  },
});
