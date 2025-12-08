/**
 * Karaoke Line Session Hook
 *
 * Orchestrates the entire karaoke session:
 * - MediaRecorder for mic capture
 * - Audio slicing per line with time windows
 * - WAV encoding at 16kHz for Voxtral
 * - Line-by-line grading via Lit Action
 * - Session lifecycle (start/end blockchain transactions)
 */

import { createSignal, onCleanup } from 'solid-js'
import { keccak256, encodeAbiParameters } from 'viem'
import { sliceAndEncodeToWav } from '@/lib/audio'
import type { LyricLine } from '@/components/karaoke/types'

export type LineStatus = 'pending' | 'processing' | 'done' | 'error'

export interface LineResult {
  status: LineStatus
  score?: number
  rating?: string
  expectedText?: string
  transcript?: string
  error?: string
  txHash?: string
}

export interface LineSessionSummary {
  averageScore: number
  completedLines: number
  totalLines: number
  sessionId: string
}

export interface GradeLineParams {
  clipHash: string
  lineIndex: number
  audioDataBase64: string
  sessionId: string
  startSession: boolean
  endSession: boolean
  sessionCompleted: boolean
  expectedLineCount: number
  metadataUriOverride?: string
  skipTx?: boolean
  endOnly?: boolean // Skip line grading, just emit endSession (for background end)
}

export interface GradeLineResult {
  score: number
  scoreBp?: number
  rating: 'Easy' | 'Good' | 'Hard' | 'Again' | string
  transcript?: string
  expectedText?: string
  startTxHash?: string
  lineTxHash?: string
  endTxHash?: string
}

export interface KaraokeLineSessionOptions {
  lines: () => LyricLine[]
  clipHash: () => string
  performer: () => string
  metadataUriOverride?: () => string | undefined
  timesliceMs?: number
  padBeforeMs?: number
  padAfterMs?: number
  maxWindowMs?: number
  skipTx?: boolean
  maxRetries?: number
  audioRef: () => HTMLAudioElement | null
  gradeLine: (params: GradeLineParams) => Promise<GradeLineResult | null>
  onComplete?: (summary: LineSessionSummary) => void
  onError?: (err: Error) => void
}

interface Chunk {
  blob: Blob
  start: number // ms, perf.now timebase
  end: number   // ms, perf.now timebase
}

/**
 * Generates a deterministic session ID for karaoke grading.
 * Must match the Lit Action's session ID generation.
 */
function generateSessionId(performer: string, clipHash: string, nonce: bigint): string {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'bytes32' }, { type: 'uint256' }],
      [performer as `0x${string}`, clipHash as `0x${string}`, nonce]
    )
  )
}

export function useKaraokeLineSession(options: KaraokeLineSessionOptions) {
  const {
    lines,
    clipHash,
    performer,
    metadataUriOverride,
    timesliceMs = 500,
    padBeforeMs = 500,
    padAfterMs = 1000,
    skipTx = false,
    maxRetries = 1,
    audioRef,
    gradeLine,
    onComplete,
    onError,
  } = options

  // Refs (not reactive - internal state)
  let recorderRef: MediaRecorder | null = null
  let chunksRef: Chunk[] = []
  let rafRef: number | null = null
  let isRunningRef = false
  let chunkIndexRef = 0
  let tRecordStartRef = 0
  let tPlaybackStartRef = 0
  let currentLineRef = 0
  let sessionIdRef: string | null = null
  let sessionNonceRef: bigint = BigInt(0)
  let lyricsOffsetRef = 0
  let sessionCompletedRef = false
  let lineResultsRef: LineResult[] = []

  // Reactive state
  const [lineResults, setLineResults] = createSignal<LineResult[]>([])
  const [isRunning, setIsRunning] = createSignal(false)
  const [summary, setSummary] = createSignal<LineSessionSummary | null>(null)
  const [sessionId, setSessionId] = createSignal<string | null>(null)
  const [currentLineIndex, setCurrentLineIndex] = createSignal(0)

  const stopRecorder = () => {
    try {
      recorderRef?.stop()
      // Stop all tracks to release microphone
      recorderRef?.stream?.getTracks().forEach(track => track.stop())
    } catch {
      // ignore
    }
    recorderRef = null
  }

  const cleanup = () => {
    if (rafRef !== null) {
      cancelAnimationFrame(rafRef)
      rafRef = null
    }
    stopRecorder()
    chunksRef = []
    isRunningRef = false
    setIsRunning(false)
  }

  /**
   * Convert audio blob to base64 string.
   */
  const blobToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error || new Error('FileReader error'))
      reader.onload = () => {
        const res = reader.result
        if (typeof res === 'string') {
          const parts = res.split(',')
          resolve(parts.length > 1 ? parts[1] : res)
        } else {
          reject(new Error('Unexpected FileReader result'))
        }
      }
      reader.readAsDataURL(blob)
    })
  }

  const updateLineResults = (updater: (prev: LineResult[]) => LineResult[]) => {
    setLineResults((prev) => {
      const next = updater(prev)
      lineResultsRef = next
      return next
    })
  }

  /**
   * Complete the session immediately with current results.
   * Called when the last line (by index) finishes, even if retries are pending.
   */
  const completeSessionNow = () => {
    if (sessionCompletedRef) return // Already completed
    sessionCompletedRef = true

    cleanup()

    // Compute summary from available results (pending/processing count as 0)
    const results = lineResultsRef
    const completed = results.filter((r) => r.status === 'done').length
    const scores = results
      .filter((r) => typeof r.score === 'number')
      .map((r) => r.score as number)
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

    const summaryResult: LineSessionSummary = {
      averageScore: avg,
      completedLines: completed,
      totalLines: lines().length,
      sessionId: sessionIdRef || '',
    }
    console.log(`[useKaraokeLineSession] Session completed: ${completed}/${lines().length} lines, avg ${avg}%`)
    setSummary(summaryResult)
    onComplete?.(summaryResult)
  }

  /**
   * Get the full recording as a single blob (all chunks merged).
   */
  const getFullRecordingBlob = (): Blob | null => {
    if (!chunksRef.length) return null

    const type = chunksRef[0]?.blob?.type || 'audio/webm'
    return new Blob(chunksRef.map((c) => c.blob), { type })
  }

  const processLine = async (lineIndex: number, attempt = 0) => {
    const linesData = lines()
    const line = linesData[lineIndex]
    // Convert absolute lyrics time to clip-relative time using offset
    const clipRelativeStart = (line.start - lyricsOffsetRef) * 1000
    const clipRelativeEnd = (line.end - lyricsOffsetRef) * 1000

    // Calculate time window in recording timebase
    const recordingOffset = tPlaybackStartRef - tRecordStartRef
    const sliceStartMs = recordingOffset + clipRelativeStart - padBeforeMs
    const sliceEndMs = recordingOffset + clipRelativeEnd + padAfterMs

    const currentSessionId = sessionIdRef

    if (!currentSessionId) {
      updateLineResults((prev) => {
        const next = [...prev]
        next[lineIndex] = { status: 'error', error: 'No session ID' }
        return next
      })
      return
    }

    updateLineResults((prev) => {
      const next = [...prev]
      next[lineIndex] = { status: 'processing' }
      return next
    })

    const fullRecording = getFullRecordingBlob()
    if (!fullRecording) {
      updateLineResults((prev) => {
        const next = [...prev]
        next[lineIndex] = { status: 'error', error: 'No audio captured' }
        return next
      })
      return
    }

    const isFirstLine = lineIndex === 0
    const isLastLine = lineIndex === linesData.length - 1

    try {
      // Decode full recording, slice by timestamp window, encode to WAV
      const sliceStart = performance.now()
      const wavBlob = await sliceAndEncodeToWav(fullRecording, sliceStartMs, sliceEndMs, 16000)
      const sliceEnd = performance.now()
      console.log(`[useKaraokeLineSession] Line ${lineIndex}: ${sliceStartMs.toFixed(0)}-${sliceEndMs.toFixed(0)}ms, ${(wavBlob.size / 1024).toFixed(1)} KB, sliced in ${((sliceEnd - sliceStart) / 1000).toFixed(2)}s`)

      const base64 = await blobToBase64(wavBlob)

      // For the last line, DON'T include endSession - we'll do that separately
      const gradeStart = performance.now()
      console.log(`[useKaraokeLineSession] Line ${lineIndex}: Starting gradeLine() at ${new Date().toISOString()} (isLast=${isLastLine})`)
      const result = await gradeLine({
        clipHash: clipHash(),
        lineIndex,
        audioDataBase64: base64,
        sessionId: currentSessionId,
        startSession: isFirstLine,
        endSession: false, // Never end in the line call - we'll do it separately
        sessionCompleted: false,
        expectedLineCount: linesData.length,
        metadataUriOverride: metadataUriOverride?.(),
        skipTx,
      })
      const gradeEnd = performance.now()
      console.log(`[useKaraokeLineSession] Line ${lineIndex}: gradeLine() returned in ${((gradeEnd - gradeStart) / 1000).toFixed(2)}s`)

      // If this is the last line and grading succeeded, fire off endSession in background
      if (isLastLine && result && !skipTx) {
        console.log(`[useKaraokeLineSession] Last line done in ${((gradeEnd - gradeStart) / 1000).toFixed(2)}s, firing endSession in background...`)
        // Fire and forget - don't await
        gradeLine({
          clipHash: clipHash(),
          lineIndex: 0, // Not used in endOnly mode
          audioDataBase64: '', // No audio needed in endOnly mode
          sessionId: currentSessionId,
          startSession: false,
          endSession: true,
          sessionCompleted: true,
          expectedLineCount: linesData.length,
          metadataUriOverride: metadataUriOverride?.(),
          skipTx: false,
          endOnly: true, // Skip line grading, just emit endSession
        }).then((endResult) => {
          if (endResult?.endTxHash) {
            console.log(`[useKaraokeLineSession] ✅ Session ended: ${endResult.endTxHash}`)
          }
        }).catch((err) => {
          console.warn(`[useKaraokeLineSession] ⚠️ End session failed (non-blocking):`, err?.message)
        })
      }

      if (!result) {
        // Retry logic
        if (attempt < maxRetries) {
          console.warn(`[useKaraokeLineSession] Line ${lineIndex} grading returned null, retrying (${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
          return processLine(lineIndex, attempt + 1)
        }

        updateLineResults((prev) => {
          const next = [...prev]
          next[lineIndex] = { status: 'error', error: 'Grading returned null after retries' }
          return next
        })
        return
      }

      updateLineResults((prev) => {
        const next = [...prev]
        next[lineIndex] = {
          status: 'done',
          score: typeof result.score === 'number' ? result.score : undefined,
          rating: result.rating,
          expectedText: result.expectedText,
          transcript: result.transcript,
          txHash: result.lineTxHash,
        }
        return next
      })

      // If this is the LAST line by index, complete session immediately (regardless of attempt number)
      if (isLastLine) {
        console.log(`[useKaraokeLineSession] Last line ${lineIndex} completed (attempt ${attempt}), completing session...`)
        completeSessionNow()
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))

      // Retry on error
      if (attempt < maxRetries) {
        console.warn(`[useKaraokeLineSession] Line ${lineIndex} grading failed, retrying (${attempt + 1}/${maxRetries}):`, error.message)
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        return processLine(lineIndex, attempt + 1)
      }

      updateLineResults((prev) => {
        const next = [...prev]
        next[lineIndex] = { status: 'error', error: error.message || 'Grading failed' }
        return next
      })

      // If last line failed after all retries, still complete the session
      if (lineIndex === lines().length - 1) {
        completeSessionNow()
      }
      onError?.(error)
    }
  }

  // Timestamp when all lines were scheduled (for timeout fallback)
  let allLinesScheduledAt: number | null = null

  const tick = () => {
    if (!isRunningRef) return
    const now = performance.now()
    const linesData = lines()

    const idx = currentLineRef
    if (idx >= linesData.length) {
      // All lines scheduled - check if we should stop the tick loop
      if (sessionCompletedRef) {
        return // Session already completed, stop tick loop
      }

      // Track when all lines were scheduled
      if (allLinesScheduledAt === null) {
        allLinesScheduledAt = now
        console.log(`[useKaraokeLineSession] All ${linesData.length} lines scheduled, waiting for grading to complete...`)
      }

      // Fallback: if somehow all lines are done/error but session wasn't completed
      const allDone = lineResultsRef.every((r) => r.status === 'done' || r.status === 'error')
      if (allDone) {
        console.log(`[useKaraokeLineSession] All lines done/error, completing session via tick fallback`)
        completeSessionNow()
        return
      }

      // Timeout fallback: if grading is taking too long (45s after all lines scheduled), complete anyway
      const timeSinceAllScheduled = now - allLinesScheduledAt
      if (timeSinceAllScheduled > 45000) {
        console.warn(`[useKaraokeLineSession] Grading timeout (${(timeSinceAllScheduled / 1000).toFixed(1)}s), completing session with partial results`)
        completeSessionNow()
        return
      }
    } else {
      const line = linesData[idx]
      // Convert absolute lyrics time to clip-relative time using offset
      const clipRelativeEndMs = (line.end - lyricsOffsetRef) * 1000
      const endMs = tPlaybackStartRef + clipRelativeEndMs + padAfterMs
      // Use small tolerance (50ms) to avoid timing edge cases
      if (now >= endMs - 50) {
        // Trigger slice/grading for this line
        processLine(idx)
        currentLineRef = idx + 1
        setCurrentLineIndex(idx + 1)
      }
    }

    rafRef = requestAnimationFrame(tick)
  }

  const startSession = async () => {
    const audio = audioRef()
    if (!audio) {
      throw new Error('Audio element not ready')
    }
    const performerAddr = performer()
    // Allow empty performer when skipTx is true (testing mode)
    if (!performerAddr && !skipTx) {
      throw new Error('Performer address required')
    }
    if (isRunningRef) return

    try {
      // Generate session ID once at start (use mock address for testing)
      const effectivePerformer = performerAddr || '0x0000000000000000000000000000000000000001'
      sessionNonceRef = BigInt(Date.now())
      const newSessionId = generateSessionId(effectivePerformer, clipHash(), sessionNonceRef)
      sessionIdRef = newSessionId
      setSessionId(newSessionId)

      // Reset line results
      const linesData = lines()
      const initialResults: LineResult[] = linesData.map(() => ({ status: 'pending' as LineStatus }))
      setLineResults(initialResults)
      lineResultsRef = initialResults
      currentLineRef = 0
      setCurrentLineIndex(0)
      setSummary(null)
      sessionCompletedRef = false // Reset completion flag for new session
      allLinesScheduledAt = null // Reset timeout tracking for new session

      // Clips always start at position 0 of the original song (including intro).
      // Lyrics use absolute timing from the original song, no offset needed.
      lyricsOffsetRef = 0

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Choose best available audio format (iOS Safari only supports MP4/AAC)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm' // Fallback

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 48000,
      })

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          const i = chunkIndexRef
          const start = tRecordStartRef + i * timesliceMs
          const end = start + timesliceMs
          chunksRef.push({ blob: event.data, start, end })
          chunkIndexRef += 1
        }
      }

      recorder.onerror = (event) => {
        onError?.(new Error(`Recorder error: ${(event as ErrorEvent).error?.name || (event as ErrorEvent).error}`))
      }

      chunkIndexRef = 0
      chunksRef = []
      tRecordStartRef = performance.now()
      recorderRef = recorder
      recorder.start(timesliceMs)

      // Start playback and anchor timeline
      audio.currentTime = 0
      await audio.play()
      tPlaybackStartRef = performance.now()

      isRunningRef = true
      setIsRunning(true)
      rafRef = requestAnimationFrame(tick)
    } catch (err: unknown) {
      cleanup()
      sessionIdRef = null
      setSessionId(null)
      const error = err instanceof Error ? err : new Error(String(err))
      onError?.(error)
      throw error
    }
  }

  const stopSession = () => {
    cleanup()
  }

  // Cleanup on unmount
  onCleanup(() => {
    cleanup()
  })

  return {
    startSession,
    stopSession,
    isRunning,
    lineResults,
    currentLineIndex,
    summary,
    sessionId,
  }
}
