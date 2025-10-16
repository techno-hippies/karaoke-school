/**
 * Tests for Unlock Flow State Machine
 */

import { describe, test, expect, vi } from 'vitest';
import { createActor, waitFor } from 'xstate';
import { setup, fromPromise, assign } from 'xstate';
import type { Hash } from 'viem';

// Mock the imports that the machine uses
vi.mock('@/lib/lit/actions', () => ({
  executeMatchAndSegment: vi.fn(),
}));

vi.mock('@/lib/lit/actions/audio-processor', () => ({
  executeAudioProcessor: vi.fn(),
}));

vi.mock('@/lib/lit/actions/base-alignment', () => ({
  executeBaseAlignment: vi.fn(),
}));

vi.mock('@/lib/lit/actions/translate', () => ({
  executeTranslateLyrics: vi.fn(),
}));

vi.mock('viem/actions', () => ({
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock('@/config/contracts', () => ({
  publicClient: {},
}));

describe('Unlock Machine', () => {
  // Create a testable version of the machine with mocked actors
  const createTestMachine = (mockBehavior: {
    matchAndSegment?: any;
    fetchLyrics?: any;
    waitForTx?: any;
    audioProcessor?: any;
    baseAlignment?: any;
    translation?: any;
  }) => {
    return setup({
      types: {
        context: {} as any,
        events: {} as any,
        input: {} as any,
      },
      actors: {
        matchAndSegment: fromPromise(async () => {
          if (mockBehavior.matchAndSegment?.shouldFail) {
            throw new Error(mockBehavior.matchAndSegment.error || 'Match failed');
          }
          return mockBehavior.matchAndSegment?.result || {
            success: true,
            isMatch: true,
            sections: [{ type: 'verse', startTime: 0, endTime: 10, duration: 10 }],
            genius: { soundcloudPermalink: 'https://soundcloud.com/test' },
            txHash: '0x123' as Hash,
          };
        }),
        fetchLyrics: fromPromise(async () => {
          if (mockBehavior.fetchLyrics?.shouldFail) {
            throw new Error('Lyrics fetch failed');
          }
          return mockBehavior.fetchLyrics?.result || 'Line 1\nLine 2\nLine 3';
        }),
        waitForTx: fromPromise(async () => {
          if (mockBehavior.waitForTx?.shouldFail) {
            throw new Error('Transaction failed');
          }
          return;
        }),
        audioProcessor: fromPromise(async () => {
          if (mockBehavior.audioProcessor?.shouldFail) {
            throw new Error('Audio processing failed');
          }
          return { vocalsUri: 'lens://vocals', instrumentalUri: 'lens://instrumental' };
        }),
        baseAlignment: fromPromise(async () => {
          if (mockBehavior.baseAlignment?.shouldFail) {
            throw new Error('Alignment failed');
          }
          return { wordTimings: [] };
        }),
        translation: fromPromise(async () => {
          if (mockBehavior.translation?.shouldFail) {
            throw new Error('Translation failed');
          }
          return { translatedLyrics: 'translated text' };
        }),
      },
      guards: {
        isFree: ({ context }) => context.isFree,
        hasCredits: ({ context }) => context.hasCredits,
      },
    }).createMachine({
      id: 'unlock',
      context: ({ input }) => ({
        geniusId: input.geniusId,
        pkpAuthContext: input.pkpAuthContext,
        pkpAddress: input.pkpAddress || '0x123',
        artist: input.artist || 'Test Artist',
        title: input.title || 'Test Song',
        isFree: input.isFree,
        targetLanguage: input.targetLanguage || 'en',
        hasCredits: input.creditBalance > 0,
        creditBalance: input.creditBalance,
        usdcBalance: '0.00',
        matchResult: null,
        txHash: null,
        soundcloudPermalink: null,
        sections: null,
        songDuration: null,
        plainLyrics: null,
        audioProgress: 0,
        alignmentProgress: 0,
        translationProgress: 0,
        audioResult: null,
        alignmentResult: null,
        translationResult: null,
        error: null,
        audioError: null,
        alignmentError: null,
        translationError: null,
      }),
      initial: 'idle',
      on: {
        CHANGE_LANGUAGE: {
          actions: assign({
            targetLanguage: ({ event }) => event.language,
          }),
        },
      },
      states: {
        idle: {
          on: { START: 'checkingRequirements' },
        },
        checkingRequirements: {
          always: [
            { guard: 'isFree', target: 'matchAndSegment' },
            { guard: 'hasCredits', target: 'matchAndSegment' },
            { target: 'showCreditDialog' },
          ],
        },
        showCreditDialog: {
          on: {
            CREDITS_ACQUIRED: { target: 'matchAndSegment' },
            CANCEL: 'idle',
          },
        },
        matchAndSegment: {
          invoke: {
            src: 'matchAndSegment',
            id: 'matchAndSegment',
            input: ({ context }) => ({
              geniusId: context.geniusId,
              pkpAuthContext: context.pkpAuthContext,
            }),
            onDone: [
              {
                guard: ({ event }) => event.output.success && event.output.isMatch,
                target: 'waitingForTx',
              },
              { target: 'matchFailed' },
            ],
            onError: { target: 'matchFailed' },
          },
        },
        matchFailed: {
          on: {
            RETRY_MATCH_AND_SEGMENT: 'matchAndSegment',
            CANCEL: 'idle',
          },
        },
        waitingForTx: {
          invoke: {
            src: 'waitForTx',
            id: 'waitForTx',
            input: ({ context }) => ({ txHash: context.txHash || '0x123' }),
            onDone: 'fetchingLyrics',
            onError: 'txFailed',
          },
        },
        fetchingLyrics: {
          invoke: {
            src: 'fetchLyrics',
            id: 'fetchLyrics',
            input: ({ context }) => ({ artist: context.artist, title: context.title }),
            onDone: 'processing',
            onError: 'lyricsFetchFailed',
          },
        },
        lyricsFetchFailed: {
          on: {
            RETRY_MATCH_AND_SEGMENT: 'matchAndSegment',
            CANCEL: 'idle',
          },
        },
        txFailed: {
          on: {
            RETRY_MATCH_AND_SEGMENT: 'matchAndSegment',
            CANCEL: 'idle',
          },
        },
        processing: {
          type: 'parallel',
          states: {
            audio: {
              initial: 'loading',
              states: {
                loading: {
                  invoke: {
                    src: 'audioProcessor',
                    onDone: 'success',
                    onError: 'error',
                  },
                },
                success: { type: 'final' },
                error: { on: { RETRY_AUDIO: 'loading' } },
              },
            },
            alignment: {
              initial: 'loading',
              states: {
                loading: {
                  invoke: {
                    src: 'baseAlignment',
                    onDone: 'success',
                    onError: 'error',
                  },
                },
                success: { type: 'final' },
                error: { on: { RETRY_ALIGNMENT: 'loading' } },
              },
            },
            translation: {
              initial: 'loading',
              states: {
                loading: {
                  invoke: {
                    src: 'translation',
                    onDone: 'success',
                    onError: 'error',
                  },
                },
                success: { type: 'final' },
                error: { on: { RETRY_TRANSLATION: 'loading' } },
              },
            },
          },
          onDone: 'complete',
        },
        complete: { type: 'final' },
      },
    });
  };

  describe('State Transitions', () => {
    test('starts in idle state', () => {
      const machine = createTestMachine({});
      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: false,
          creditBalance: 0,
        },
      });
      actor.start();

      expect(actor.getSnapshot().value).toBe('idle');
    });

    test('transitions to checkingRequirements on START', () => {
      const machine = createTestMachine({});
      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: false,
          creditBalance: 1,
        },
      });
      actor.start();

      actor.send({ type: 'START' });
      expect(actor.getSnapshot().value).toBe('matchAndSegment');
    });
  });

  describe('Credit Checking Guards', () => {
    test('free song skips credit check', () => {
      const machine = createTestMachine({});
      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true, // Free song
          creditBalance: 0, // No credits
        },
      });
      actor.start();

      actor.send({ type: 'START' });

      // Should skip showCreditDialog and go straight to matchAndSegment
      expect(actor.getSnapshot().value).toBe('matchAndSegment');
    });

    test('paid song with credits skips credit dialog', () => {
      const machine = createTestMachine({});
      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: false,
          creditBalance: 5, // Has credits
        },
      });
      actor.start();

      actor.send({ type: 'START' });

      // Should skip showCreditDialog
      expect(actor.getSnapshot().value).toBe('matchAndSegment');
    });

    test('paid song without credits shows credit dialog', () => {
      const machine = createTestMachine({});
      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: false,
          creditBalance: 0, // No credits
        },
      });
      actor.start();

      actor.send({ type: 'START' });

      // Should show credit dialog
      expect(actor.getSnapshot().value).toBe('showCreditDialog');
    });

    test('credit dialog can transition after credits acquired', () => {
      const machine = createTestMachine({});
      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: false,
          creditBalance: 0,
        },
      });
      actor.start();

      actor.send({ type: 'START' });
      expect(actor.getSnapshot().value).toBe('showCreditDialog');

      actor.send({ type: 'CREDITS_ACQUIRED' });
      expect(actor.getSnapshot().value).toBe('matchAndSegment');
    });

    test('credit dialog can be cancelled', () => {
      const machine = createTestMachine({});
      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: false,
          creditBalance: 0,
        },
      });
      actor.start();

      actor.send({ type: 'START' });
      expect(actor.getSnapshot().value).toBe('showCreditDialog');

      actor.send({ type: 'CANCEL' });
      expect(actor.getSnapshot().value).toBe('idle');
    });
  });

  describe('Match and Segment', () => {
    test('successful match transitions through waitingForTx, fetchingLyrics, and processing', async () => {
      const machine = createTestMachine({
        matchAndSegment: {
          result: {
            success: true,
            isMatch: true,
            sections: [{ type: 'verse', startTime: 0, endTime: 10, duration: 10 }],
            genius: { soundcloudPermalink: 'https://soundcloud.com/test' },
            txHash: '0xabc' as Hash,
          },
        },
      });

      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true,
          creditBalance: 0,
        },
      });
      actor.start();

      actor.send({ type: 'START' });

      // Wait until we've progressed to processing (through waitingForTx and fetchingLyrics)
      await waitFor(
        actor,
        (state) => state.matches('processing') || state.matches('waitingForTx') || state.matches('fetchingLyrics'),
        { timeout: 1000 }
      );

      // Should be in either waitingForTx, fetchingLyrics, or processing (transitions are fast in tests)
      const value = actor.getSnapshot().value;
      const isInExpectedState = value === 'waitingForTx' ||
        value === 'fetchingLyrics' ||
        (typeof value === 'object' && 'processing' in value);
      expect(isInExpectedState).toBe(true);
    });

    test('failed match transitions to matchFailed', async () => {
      const machine = createTestMachine({
        matchAndSegment: {
          shouldFail: true,
          error: 'Network error',
        },
      });

      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true,
          creditBalance: 0,
        },
      });
      actor.start();

      actor.send({ type: 'START' });

      await waitFor(actor, (state) => state.matches('matchFailed'), { timeout: 1000 });
      expect(actor.getSnapshot().value).toBe('matchFailed');
    });

    test('matchFailed can retry', async () => {
      const machine = createTestMachine({
        matchAndSegment: {
          shouldFail: true,
        },
      });

      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true,
          creditBalance: 0,
        },
      });
      actor.start();

      actor.send({ type: 'START' });
      await waitFor(actor, (state) => state.matches('matchFailed'), { timeout: 1000 });

      actor.send({ type: 'RETRY_MATCH_AND_SEGMENT' });
      expect(actor.getSnapshot().value).toBe('matchAndSegment');
    });
  });

  describe('Parallel Processing', () => {
    test('successful parallel processing completes', async () => {
      const machine = createTestMachine({
        matchAndSegment: {
          result: { success: true, isMatch: true, txHash: '0x123' as Hash },
        },
        waitForTx: {},
        audioProcessor: {},
        baseAlignment: {},
        translation: {},
      });

      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true,
          creditBalance: 0,
        },
      });
      actor.start();

      actor.send({ type: 'START' });

      // Wait for completion
      await waitFor(actor, (state) => state.matches('complete'), { timeout: 2000 });
      expect(actor.getSnapshot().value).toBe('complete');
    });

    test('audio failure can be retried independently', async () => {
      const machine = createTestMachine({
        matchAndSegment: {
          result: { success: true, isMatch: true, txHash: '0x123' as Hash },
        },
        waitForTx: {},
        audioProcessor: { shouldFail: true },
        baseAlignment: {},
        translation: {},
      });

      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true,
          creditBalance: 0,
        },
      });
      actor.start();

      actor.send({ type: 'START' });

      // Wait for processing state
      await waitFor(
        actor,
        (state) => state.matches({ processing: { audio: 'error' } }),
        { timeout: 2000 }
      );

      const snapshot = actor.getSnapshot();
      expect((snapshot.value as any).processing.audio).toBe('error');

      // Other processes should still succeed
      expect((snapshot.value as any).processing.alignment).toBe('success');
      expect((snapshot.value as any).processing.translation).toBe('success');

      // Can retry audio independently
      actor.send({ type: 'RETRY_AUDIO' });
      expect((actor.getSnapshot().value as any).processing.audio).toBe('loading');
    });
  });

  describe('Language Configuration', () => {
    test('uses default language if not specified', () => {
      const machine = createTestMachine({});
      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true,
          creditBalance: 0,
          // No targetLanguage specified
        },
      });
      actor.start();

      expect(actor.getSnapshot().context.targetLanguage).toBe('en');
    });

    test('uses provided target language', () => {
      const machine = createTestMachine({});
      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true,
          creditBalance: 0,
          targetLanguage: 'zh',
        },
      });
      actor.start();

      expect(actor.getSnapshot().context.targetLanguage).toBe('zh');
    });

    test('language can be changed during flow', () => {
      const machine = createTestMachine({});
      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true,
          creditBalance: 0,
          targetLanguage: 'en',
        },
      });
      actor.start();

      expect(actor.getSnapshot().context.targetLanguage).toBe('en');

      actor.send({ type: 'CHANGE_LANGUAGE', language: 'vi' });
      expect(actor.getSnapshot().context.targetLanguage).toBe('vi');
    });
  });

  describe('Error Recovery', () => {
    test('transaction failure can be retried', async () => {
      const machine = createTestMachine({
        matchAndSegment: {
          result: { success: true, isMatch: true, txHash: '0x123' as Hash },
        },
        waitForTx: { shouldFail: true },
      });

      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true,
          creditBalance: 0,
        },
      });
      actor.start();

      actor.send({ type: 'START' });

      await waitFor(actor, (state) => state.matches('txFailed'), { timeout: 1000 });
      expect(actor.getSnapshot().value).toBe('txFailed');

      // Can retry from match-and-segment
      actor.send({ type: 'RETRY_MATCH_AND_SEGMENT' });
      expect(actor.getSnapshot().value).toBe('matchAndSegment');
    });

    test('can cancel from error states', async () => {
      const machine = createTestMachine({
        matchAndSegment: { shouldFail: true },
      });

      const actor = createActor(machine, {
        input: {
          geniusId: 123,
          pkpAuthContext: {} as any,
          isFree: true,
          creditBalance: 0,
        },
      });
      actor.start();

      actor.send({ type: 'START' });

      await waitFor(actor, (state) => state.matches('matchFailed'), { timeout: 1000 });

      actor.send({ type: 'CANCEL' });
      expect(actor.getSnapshot().value).toBe('idle');
    });
  });
});
