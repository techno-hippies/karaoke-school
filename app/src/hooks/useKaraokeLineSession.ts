import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import type { LyricLine } from '@/types/karaoke'
import { keccak256, encodeAbiParameters } from 'viem'
import { sliceAndEncodeToWav } from '@/lib/audio-converter'

type LineStatus = 'pending' | 'processing' | 'done' | 'error'

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
  lines: LyricLine[]
  clipHash: string
  performer: string
  metadataUriOverride?: string
  timesliceMs?: number
  padBeforeMs?: number
  padAfterMs?: number
  maxWindowMs?: number
  skipTx?: boolean
  maxRetries?: number
  audioRef: React.RefObject<HTMLAudioElement | null>
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
    padBeforeMs = 250,
    padAfterMs = 150,
    maxWindowMs = 15000,
    skipTx = false,
    maxRetries = 1,
    audioRef,
    gradeLine,
    onComplete,
    onError,
  } = options

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Chunk[]>([])
  const rafRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)
  const chunkIndexRef = useRef(0)
  const tRecordStartRef = useRef<number>(0)
  const tPlaybackStartRef = useRef<number>(0)
  const currentLineRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const sessionNonceRef = useRef<bigint>(BigInt(0))
  // Offset to convert absolute lyrics times to clip-relative times
  // e.g., if lyrics start at 10.68s in original song, offset = 10.68s
  const lyricsOffsetRef = useRef<number>(0)

  const [lineResults, setLineResults] = useState<LineResult[]>(() =>
    lines.map(() => ({ status: 'pending' }))
  )
  const lineResultsRef = useRef<LineResult[]>(lines.map(() => ({ status: 'pending' })))
  const [isRunning, setIsRunning] = useState(false)
  const [summary, setSummary] = useState<LineSessionSummary | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const stopRecorder = useCallback(() => {
    try {
      recorderRef.current?.stop()
      // Stop all tracks to release microphone
      recorderRef.current?.stream?.getTracks().forEach(track => track.stop())
    } catch (err) {
      // ignore
    }
    recorderRef.current = null
  }, [])

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    stopRecorder()
    chunksRef.current = []
    isRunningRef.current = false
    setIsRunning(false)
  }, [stopRecorder])

  /**
   * Convert audio blob to base64 string.
   */
  const blobToBase64 = useCallback(async (blob: Blob): Promise<string> => {
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
  }, [])

  const updateLineResults = useCallback((updater: (prev: LineResult[]) => LineResult[]) => {
    setLineResults((prev) => {
      const next = updater(prev)
      lineResultsRef.current = next
      return next
    })
  }, [])

  /**
   * Get the full recording as a single blob (all chunks merged).
   * We decode the full recording and slice by timestamp in PCM space
   * to avoid WebM container issues with chunk boundaries.
   */
  const getFullRecordingBlob = useCallback((): Blob | null => {
    const chunks = chunksRef.current
    if (!chunks.length) return null

    const type = chunks[0]?.blob?.type || 'audio/webm'
    return new Blob(chunks.map((c) => c.blob), { type })
  }, [])

  // Note: With PCM-based slicing, we need ALL chunks to decode the full recording.
  // Chunk pruning is disabled - memory usage is acceptable for typical karaoke clips (<60s).
  // If memory becomes an issue for very long recordings, we could implement incremental
  // decoding or keep a decoded AudioBuffer cache.

  const processLine = useCallback(async (lineIndex: number, attempt = 0) => {
    const line = lines[lineIndex]
    // Convert absolute lyrics time to clip-relative time using offset
    const clipRelativeStart = (line.start - lyricsOffsetRef.current) * 1000
    const clipRelativeEnd = (line.end - lyricsOffsetRef.current) * 1000

    // Calculate time window in recording timebase
    // playbackStart and recordStart are both in performance.now() timebase
    // The difference accounts for any delay between recording and playback start
    const recordingOffset = tPlaybackStartRef.current - tRecordStartRef.current
    const sliceStartMs = recordingOffset + clipRelativeStart - padBeforeMs
    const sliceEndMs = recordingOffset + clipRelativeEnd + padAfterMs

    const currentSessionId = sessionIdRef.current

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
    const isLastLine = lineIndex === lines.length - 1

    try {
      // Decode full recording, slice by timestamp window, encode to WAV
      const wavBlob = await sliceAndEncodeToWav(fullRecording, sliceStartMs, sliceEndMs, 16000)
      console.log(`[useKaraokeLineSession] Line ${lineIndex}: ${sliceStartMs.toFixed(0)}-${sliceEndMs.toFixed(0)}ms, ${(wavBlob.size / 1024).toFixed(1)} KB`)

      const base64 = await blobToBase64(wavBlob)
      const result = await gradeLine({
        clipHash,
        lineIndex,
        audioDataBase64: base64,
        sessionId: currentSessionId,
        startSession: isFirstLine,
        endSession: isLastLine,
        sessionCompleted: isLastLine, // True if completing all lines
        expectedLineCount: lines.length,
        metadataUriOverride,
        skipTx,
      })

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
    } catch (err: any) {
      // Retry on error
      if (attempt < maxRetries) {
        console.warn(`[useKaraokeLineSession] Line ${lineIndex} grading failed, retrying (${attempt + 1}/${maxRetries}):`, err?.message)
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        return processLine(lineIndex, attempt + 1)
      }

      updateLineResults((prev) => {
        const next = [...prev]
        next[lineIndex] = { status: 'error', error: err?.message || 'Grading failed' }
        return next
      })
      onError?.(err)
    }
  }, [clipHash, getFullRecordingBlob, gradeLine, lines, metadataUriOverride, onError, padAfterMs, padBeforeMs, blobToBase64, skipTx, updateLineResults, maxRetries])

  const tick = useCallback(() => {
    if (!isRunningRef.current) return
    const now = performance.now()

    const idx = currentLineRef.current
    if (idx >= lines.length) {
      // All lines scheduled; if all done, finish.
      const allDone = lineResultsRef.current.every((r) => r.status === 'done' || r.status === 'error')
      if (allDone) {
        cleanup()
        // Compute summary
        const completed = lineResultsRef.current.filter((r) => r.status === 'done').length
        const scores = lineResultsRef.current
          .filter((r) => typeof r.score === 'number')
          .map((r) => r.score as number)
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
        const summaryResult: LineSessionSummary = {
          averageScore: avg,
          completedLines: completed,
          totalLines: lines.length,
          sessionId: sessionIdRef.current || '',
        }
        setSummary(summaryResult)
        onComplete?.(summaryResult)
        return
      }
    } else {
      const line = lines[idx]
      // Convert absolute lyrics time to clip-relative time using offset
      const clipRelativeEndMs = (line.end - lyricsOffsetRef.current) * 1000
      const endMs = tPlaybackStartRef.current + clipRelativeEndMs + padAfterMs
      // Use small tolerance (50ms) to avoid timing edge cases
      if (now >= endMs - 50) {
        // Trigger slice/grading for this line
        processLine(idx)
        currentLineRef.current = idx + 1
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [cleanup, lines, onComplete, padAfterMs, processLine])

  const startSession = useCallback(async () => {
    if (!audioRef.current) {
      throw new Error('Audio element not ready')
    }
    // Allow empty performer when skipTx is true (testing mode)
    if (!performer && !skipTx) {
      throw new Error('Performer address required')
    }
    if (isRunningRef.current) return

    try {
      // Generate session ID once at start (use mock address for testing)
      const effectivePerformer = performer || '0x0000000000000000000000000000000000000001'
      sessionNonceRef.current = BigInt(Date.now())
      const newSessionId = generateSessionId(effectivePerformer, clipHash, sessionNonceRef.current)
      sessionIdRef.current = newSessionId
      setSessionId(newSessionId)

      // Reset line results
      const initialResults = lines.map(() => ({ status: 'pending' as LineStatus }))
      setLineResults(initialResults)
      lineResultsRef.current = initialResults
      currentLineRef.current = 0
      setSummary(null)

      // Clips always start at position 0 of the original song (including intro).
      // Lyrics use absolute timing from the original song, no offset needed.
      // The create-clip.ts script crops from 0 to clip_end_ms, preserving original timing.
      lyricsOffsetRef.current = 0

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
          const i = chunkIndexRef.current
          const start = tRecordStartRef.current + i * timesliceMs
          const end = start + timesliceMs
          chunksRef.current.push({ blob: event.data, start, end })
          chunkIndexRef.current += 1
        }
      }

      recorder.onerror = (event) => {
        onError?.(new Error(`Recorder error: ${(event as any).error?.name || (event as any).error}`))
      }

      chunkIndexRef.current = 0
      chunksRef.current = []
      tRecordStartRef.current = performance.now()
      recorderRef.current = recorder
      recorder.start(timesliceMs)

      // Start playback and anchor timeline
      audioRef.current.currentTime = 0
      await audioRef.current.play()
      tPlaybackStartRef.current = performance.now()

      isRunningRef.current = true
      setIsRunning(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch (err: any) {
      cleanup()
      sessionIdRef.current = null
      setSessionId(null)
      onError?.(err)
      throw err
    }
  }, [audioRef, cleanup, clipHash, lines, onError, performer, skipTx, tick, timesliceMs])

  const stopSession = useCallback(() => {
    cleanup()
  }, [cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    startSession,
    stopSession,
    isRunning,
    lineResults,
    currentLine: currentLineRef.current,
    summary,
    sessionId,
  }
}
