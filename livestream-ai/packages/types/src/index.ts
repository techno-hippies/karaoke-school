/**
 * Shared types for livestream-ai services
 */

// ============ Lyrics & Karaoke ============

export interface LyricLine {
  index: number
  text: string
  startMs: number
  endMs: number
}

export interface KaraokeSession {
  songId: string
  title: string
  artist: string
  lyrics: LyricLine[]
  startedAt?: number
}

export interface KaraokeResult {
  songId: string
  score: number
  lineResults: LineResult[]
}

export interface LineResult {
  index: number
  score: number
  rating: string
}

export interface KaraokeResultsState {
  stillGrading: boolean
  grade: string | null
  completed: number
  total: number
  skipped: number
  averageScore: number | null
  timedOut?: boolean
}

// ============ TTS Service ============

export interface TTSSpeakRequest {
  text: string
  options?: TTSOptions
}

export interface TTSOptions {
  speed?: number
  stability?: number
  emotion?: string
}

export interface TTSScheduleRequest {
  lines: LyricLine[]
  startedAt: number
}

// ============ Browser Service ============

export interface BrowserNavigateRequest {
  url: string
}

export interface BrowserClickRequest {
  selector: string
}

export interface BrowserReadRequest {
  selector: string
  attribute?: string
}

export interface BrowserReadResponse {
  value: string | null
}

export interface BrowserLyricsResponse {
  lyrics: LyricLine[]
  title: string
  artist: string
}

export interface BrowserSessionResponse {
  isLoggedIn: boolean
  address?: string
}

// ============ Orchestrator ============

export type OrchestratorState =
  | 'idle'
  | 'logging_in'
  | 'navigating'
  | 'ready_to_start'
  | 'performing'
  | 'viewing_results'
  | 'error'

export interface OrchestratorStatus {
  state: OrchestratorState
  currentSong?: string
  error?: string
}
