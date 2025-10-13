/**
 * useUnlockFlow Hook
 *
 * React hook for managing the complete unlock flow state machine.
 * Handles credit checking, match-and-segment, and parallel processing.
 */

import { useMachine } from '@xstate/react';
import { unlockMachine } from '@/machines/unlockMachine';
import type { PKPAuthContext } from '@/lib/lit/auth/auth-pkp';

export interface UseUnlockFlowOptions {
  geniusId: number;
  pkpAuthContext: PKPAuthContext | null;
  pkpAddress: string;
  artist: string;
  title: string;
  creditBalance: number;
  targetLanguage?: string;
  // Pre-populated data (if song already cataloged)
  isAlreadyCataloged?: boolean;
  isFree?: boolean;
  sections?: Array<{ type: string; startTime: number; endTime: number; duration: number }> | null;
  soundcloudPermalink?: string | null;
  songDuration?: number | null;
  hasFullAudio?: boolean | null;
}

export function useUnlockFlow({
  geniusId,
  pkpAuthContext,
  pkpAddress,
  artist,
  title,
  creditBalance,
  targetLanguage,
  isAlreadyCataloged,
  isFree,
  sections,
  soundcloudPermalink,
  songDuration,
  hasFullAudio,
}: UseUnlockFlowOptions) {
  const [state, send] = useMachine(unlockMachine, {
    input: {
      geniusId,
      pkpAuthContext: pkpAuthContext!,
      pkpAddress,
      artist,
      title,
      creditBalance,
      targetLanguage,
      isAlreadyCataloged,
      isFree,
      sections,
      soundcloudPermalink,
      songDuration,
      hasFullAudio,
    },
  });

  // Main states
  const isIdle = state.matches('idle');
  const isCheckingSongStatus = state.matches('checkingSongStatus');
  const isMatchingAndSegmenting = state.matches('matchAndSegment');
  const isWaitingForTx = state.matches('waitingForTx');
  const isCataloged = state.matches('cataloged');
  const isCheckingCredits = state.matches('checkingCredits');
  const needsCredits = state.matches('needsCredits');
  const isFetchingLyrics = state.matches('fetchingLyrics');
  const isProcessing = state.matches('processing');
  const isComplete = state.matches('complete');
  const hasCatalogFailed = state.matches('catalogFailed');
  const hasLyricsFetchFailed = state.matches('lyricsFetchFailed');

  // Catalog completed (contract is updated, can refetch now)
  const hasCatalogCompleted = isWaitingForTx || isCataloged || isCheckingCredits || needsCredits || isFetchingLyrics || isProcessing || isComplete;

  // Individual parallel process states
  const audioState = isProcessing ? (state.value as any).processing?.audio : null;
  const alignmentState = isProcessing ? (state.value as any).processing?.alignment : null;
  const translationState = isProcessing ? (state.value as any).processing?.translation : null;

  const isAudioLoading = audioState === 'loading';
  const isAudioSuccess = audioState === 'success';
  const isAudioError = audioState === 'error';

  const isAlignmentLoading = alignmentState === 'loading';
  const isAlignmentSuccess = alignmentState === 'success';
  const isAlignmentError = alignmentState === 'error';

  const isTranslationLoading = translationState === 'loading';
  const isTranslationSuccess = translationState === 'success';
  const isTranslationError = translationState === 'error';

  // Overall progress calculation
  let overallProgress = 0;
  if (isIdle) overallProgress = 0;
  else if (isCheckingSongStatus) overallProgress = 3;
  else if (isMatchingAndSegmenting) overallProgress = 5;
  else if (isWaitingForTx) overallProgress = 10;
  else if (isCataloged) overallProgress = 12;
  else if (isCheckingCredits) overallProgress = 15;
  else if (needsCredits) overallProgress = 15;
  else if (isFetchingLyrics) overallProgress = 20;
  else if (isProcessing) {
    // 25% base for reaching processing, 75% distributed across 3 processes
    overallProgress =
      25 +
      Math.round(
        (state.context.audioProgress + state.context.alignmentProgress + state.context.translationProgress) /
          3 *
          0.75
      );
  } else if (isComplete) overallProgress = 100;

  // Check if all processes succeeded
  const allSucceeded = isAudioSuccess && isAlignmentSuccess && isTranslationSuccess;

  // Check if cataloging (auto-catalog flow)
  const isCataloging = isCheckingSongStatus || isMatchingAndSegmenting || isWaitingForTx;

  // Check if unlocking (paid unlock flow)
  const isUnlocking =
    isCheckingCredits ||
    needsCredits ||
    isFetchingLyrics ||
    isProcessing;

  return {
    // State
    state,
    send,
    context: state.context,

    // Main status
    isIdle,
    isCheckingSongStatus,
    isMatchingAndSegmenting,
    isCataloging,
    hasCatalogCompleted,
    isWaitingForTx,
    isCataloged,
    isCheckingCredits,
    needsCredits,
    isFetchingLyrics,
    isProcessing,
    isComplete,
    hasCatalogFailed,
    hasLyricsFetchFailed,
    isUnlocking,
    overallProgress,

    // Catalog info
    hasFullAudio: state.context.hasFullAudio,
    catalogError: state.context.catalogError,

    // Audio status
    isAudioLoading,
    isAudioSuccess,
    isAudioError,
    audioProgress: state.context.audioProgress,
    audioResult: state.context.audioResult,
    audioError: state.context.audioError,

    // Alignment status
    isAlignmentLoading,
    isAlignmentSuccess,
    isAlignmentError,
    alignmentProgress: state.context.alignmentProgress,
    alignmentResult: state.context.alignmentResult,
    alignmentError: state.context.alignmentError,

    // Translation status
    isTranslationLoading,
    isTranslationSuccess,
    isTranslationError,
    translationProgress: state.context.translationProgress,
    translationResult: state.context.translationResult,
    translationError: state.context.translationError,

    // Match and segment result
    matchResult: state.context.matchResult,
    txHash: state.context.txHash,
    allSucceeded,
    error: state.context.error,

    // Actions
    startAutoCatalog: () => send({ type: 'AUTO_CATALOG' }),
    startUnlock: () => send({ type: 'UNLOCK' }),
    updateAuth: (pkpAuthContext: PKPAuthContext, pkpAddress: string) =>
      send({ type: 'UPDATE_AUTH', pkpAuthContext, pkpAddress } as any),
    creditsPurchased: (balance: number) => send({ type: 'CREDITS_PURCHASED', balance } as any),
    updateCredits: (balance: number) => send({ type: 'UPDATE_CREDITS', balance }),
    retryCatalog: () => send({ type: 'RETRY_CATALOG' }),
    retryAudio: () => send({ type: 'RETRY_AUDIO' }),
    retryAlignment: () => send({ type: 'RETRY_ALIGNMENT' }),
    retryTranslation: () => send({ type: 'RETRY_TRANSLATION' }),
    cancel: () => send({ type: 'CANCEL' }),
    changeLanguage: (language: string) => send({ type: 'CHANGE_LANGUAGE', language }),
  };
}
