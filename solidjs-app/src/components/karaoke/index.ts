/**
 * Karaoke Components Public API
 */

export { KaraokeLyricLine, type KaraokeLyricLineProps } from './KaraokeLyricLine'
export { LyricsDisplay, type LyricsDisplayProps } from './LyricsDisplay'
export type { LyricLine, KaraokeWord } from './types'

// Results page components
export { KaraokeResultsPage, type KaraokeResultsPageProps, type PracticeGrade } from './KaraokeResultsPage'
export { LineResultRow, type LineResultRowProps, type LineResult, type LineStatus } from './LineResultRow'
export { GradeSlotMachine, type GradeSlotMachineProps } from './GradeSlotMachine'

// Real-time feedback components (used during karaoke, not on results)
export { FloatingHearts, type FloatingHeartsProps, getHeartsRate } from './FloatingHearts'
export { ScoreCounter, type ScoreCounterProps } from './ScoreCounter'
export { ComboCounter, type ComboCounterProps } from './ComboCounter'

// Vertical timeline for Guitar Hero style karaoke
export { VerticalTimeline, usePlaybackSimulator, type VerticalTimelineProps, type TimelineLyricLine, type TimelineColorScheme } from './VerticalTimeline'
