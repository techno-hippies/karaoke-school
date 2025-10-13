/**
 * UnlockProgress Component
 *
 * Shows progress for the 3 parallel unlock processes:
 * - Audio processing (vocals/instrumental)
 * - Base alignment (word timing)
 * - Lyrics translation
 */

import { Check, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface UnlockProgressProps {
  // Audio
  isAudioLoading: boolean;
  isAudioSuccess: boolean;
  isAudioError: boolean;
  audioProgress: number;
  audioError: string | null;
  onRetryAudio: () => void;

  // Alignment
  isAlignmentLoading: boolean;
  isAlignmentSuccess: boolean;
  isAlignmentError: boolean;
  alignmentProgress: number;
  alignmentError: string | null;
  onRetryAlignment: () => void;

  // Translation
  isTranslationLoading: boolean;
  isTranslationSuccess: boolean;
  isTranslationError: boolean;
  translationProgress: number;
  translationError: string | null;
  onRetryTranslation: () => void;

  // Overall
  overallProgress: number;
}

export function UnlockProgress({
  isAudioLoading,
  isAudioSuccess,
  isAudioError,
  audioProgress,
  audioError,
  onRetryAudio,
  isAlignmentLoading,
  isAlignmentSuccess,
  isAlignmentError,
  alignmentProgress,
  alignmentError,
  onRetryAlignment,
  isTranslationLoading,
  isTranslationSuccess,
  isTranslationError,
  translationProgress,
  translationError,
  onRetryTranslation,
  overallProgress,
}: UnlockProgressProps) {
  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <div>
        <h3 className="text-sm font-semibold mb-2">Unlocking Song...</h3>
        <Progress value={overallProgress} className="h-2" />
        <p className="text-xs text-muted-foreground mt-1">{overallProgress}% complete</p>
      </div>

      {/* Audio Processing */}
      <ProcessItem
        label="Audio Processing"
        description="Separating vocals and instrumental"
        isLoading={isAudioLoading}
        isSuccess={isAudioSuccess}
        isError={isAudioError}
        progress={audioProgress}
        error={audioError}
        onRetry={onRetryAudio}
      />

      {/* Base Alignment */}
      <ProcessItem
        label="Word Timing"
        description="Syncing lyrics with audio"
        isLoading={isAlignmentLoading}
        isSuccess={isAlignmentSuccess}
        isError={isAlignmentError}
        progress={alignmentProgress}
        error={alignmentError}
        onRetry={onRetryAlignment}
      />

      {/* Translation */}
      <ProcessItem
        label="Translation"
        description="Translating lyrics to your language"
        isLoading={isTranslationLoading}
        isSuccess={isTranslationSuccess}
        isError={isTranslationError}
        progress={translationProgress}
        error={translationError}
        onRetry={onRetryTranslation}
      />
    </div>
  );
}

interface ProcessItemProps {
  label: string;
  description: string;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  progress: number;
  error: string | null;
  onRetry: () => void;
}

function ProcessItem({
  label,
  description,
  isLoading,
  isSuccess,
  isError,
  progress,
  error,
  onRetry,
}: ProcessItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">
        {isLoading && <CircleNotch className="h-4 w-4 animate-spin text-primary" />}
        {isSuccess && <Check className="h-4 w-4 text-green-500" />}
        {isError && <WarningCircle className="h-4 w-4 text-destructive" />}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{label}</p>
          {isLoading && <span className="text-xs text-muted-foreground">{progress}%</span>}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {isError && error && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-destructive">{error}</p>
            <Button onClick={onRetry} variant="ghost" size="sm" className="h-6 text-xs">
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
