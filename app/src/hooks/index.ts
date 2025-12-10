/**
 * Hooks Public API
 */

// Subgraph data fetching
export { useSongSlug, useAllSlugs, generateSlug } from './useSongSlug'
export { useSongClips, type Clip, type SongClips, type SongMetadata } from './useSongClips'
export { useSegmentMetadata, type SegmentMetadata } from './useSegmentMetadata'
export {
  useKaraokeSongs,
  useKaraokeSongsSearch,
  useKaraokeSongsWithMetadata,
  type KaraokeSong,
  type SearchOptions,
} from './useKaraokeSongs'

// Video playback
export { useVideoPlayback, type UseVideoPlaybackOptions, type UseVideoPlaybackReturn } from './useVideoPlayback'

// Audio playback
export { useAudioPlayer, type UseAudioPlayerOptions, type UseAudioPlayerReturn } from './useAudioPlayer'

// Audio recording
export { createAudioRecorder, type AudioRecorderState, type AudioRecorderResult } from './useAudioRecorder'

// Leaderboards
export { useSongLeaderboard, type LeaderboardEntry, type UseSongLeaderboardResult } from './useSongLeaderboard'
export { useArtistLeaderboard } from './useArtistLeaderboard'

// Study system
export { useStudyCards } from './useStudyCards'
export { useExerciseData, type ExerciseData } from './useExerciseData'
export { usePrefetchExercise } from './usePrefetchExercise'
export { useExerciseSubmission, type SubmissionResult } from './useExerciseSubmission'
export { useStudySession, type StudySessionState } from './useStudySession'
export { useLitActionGrader, type GradingParams, type GradingResult } from './useLitActionGrader'
export { useQuizMetadata, fetchQuizMetadata, type QuizMetadata } from './useQuizMetadata'

// Purchases & Subscriptions
export { useSongAccess, type SongAccessState, type UseSongAccessResult } from './useSongAccess'
export {
  useUnlockSubscription,
  type UseUnlockSubscriptionOptions,
  type UseUnlockSubscriptionResult,
} from './useUnlockSubscription'
