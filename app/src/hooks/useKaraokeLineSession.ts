import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import type { LyricLine } from '@/types/karaoke'
import { keccak256, encodeAbiParameters } from 'viem'
import { webmToWav } from '@/lib/audio-converter'

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
   * Convert audio blob to base64, converting to WAV first.
   * Voxtral STT only accepts MP3/WAV, not WebM or MP4.
   */
  const blobToBase64 = useCallback(async (blob: Blob): Promise<string> => {
    // Convert WebM/MP4 to WAV for Voxtral compatibility
    let audioBlob = blob
    if (blob.type.includes('webm') || blob.type.includes('mp4')) {
      try {
        audioBlob = await webmToWav(blob, 16000)
      } catch (err) {
        console.warn('[useKaraokeLineSession] Audio→WAV conversion failed, using original:', err)
        // Fall back to original blob if conversion fails
      }
    }

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
      reader.readAsDataURL(audioBlob)
    })
  }, [])

  const updateLineResults = useCallback((updater: (prev: LineResult[]) => LineResult[]) => {
    setLineResults((prev) => {
      const next = updater(prev)
      lineResultsRef.current = next
      return next
    })
  }, [])

  const getSlice = useCallback((windowStart: number, windowEnd: number): Blob | null => {
    // WebM requires the header from the first chunk to be valid.
    // MediaRecorder chunks are NOT self-contained - only the first has the EBML header.
    // We must always include chunk 0 (the header) + the overlapping chunks.
    const chunks = chunksRef.current
    if (!chunks.length) return null

    const overlapping = chunks.filter(
      (c) => c.end > windowStart && c.start < windowEnd
    )
    if (!overlapping.length) return null

    // Always include the first chunk (header) if not already included
    const hasHeader = overlapping.includes(chunks[0])
    const blobsToMerge = hasHeader ? overlapping : [chunks[0], ...overlapping]

    const type = chunks[0]?.blob?.type || 'audio/webm'
    return new Blob(blobsToMerge.map((c) => c.blob), { type })
  }, [])

  const pruneChunks = useCallback((nowMs: number) => {
    const cutoff = nowMs - maxWindowMs
    // Never prune the first chunk (WebM header) - it's needed for all slices
    const chunks = chunksRef.current
    if (chunks.length <= 1) return
    const [header, ...rest] = chunks
    chunksRef.current = [header, ...rest.filter((c) => c.end >= cutoff)]
  }, [maxWindowMs])

  const processLine = useCallback(async (lineIndex: number, attempt = 0) => {
    const line = lines[lineIndex]
    // Convert absolute lyrics time to clip-relative time using offset
    const clipRelativeStart = (line.start - lyricsOffsetRef.current) * 1000
    const clipRelativeEnd = (line.end - lyricsOffsetRef.current) * 1000
    const startMs = tPlaybackStartRef.current + clipRelativeStart - padBeforeMs
    const endMs = tPlaybackStartRef.current + clipRelativeEnd + padAfterMs
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

    const sliceBlob = getSlice(startMs, endMs)
    if (!sliceBlob) {
      updateLineResults((prev) => {
        const next = [...prev]
        next[lineIndex] = { status: 'error', error: 'No audio captured for line window' }
        return next
      })
      return
    }

    const isFirstLine = lineIndex === 0
    const isLastLine = lineIndex === lines.length - 1

    try {
      const base64 = await blobToBase64(sliceBlob)
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
  }, [clipHash, getSlice, gradeLine, lines, metadataUriOverride, onError, padAfterMs, padBeforeMs, blobToBase64, skipTx, updateLineResults, maxRetries])

  const tick = useCallback(() => {
    if (!isRunningRef.current) return
    const now = performance.now()

    // Prune old chunks to cap memory
    pruneChunks(now)

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
  }, [cleanup, lines, onComplete, padAfterMs, pruneChunks, processLine])

  const startSession = useCallback(async () => {
    if (!audioRef.current) {
      throw new Error('Audio element not ready')
    }
    if (!performer) {
      throw new Error('Performer address required')
    }
    if (isRunningRef.current) return

    try {
      // Generate session ID once at start
      sessionNonceRef.current = BigInt(Date.now())
      const newSessionId = generateSessionId(performer, clipHash, sessionNonceRef.current)
      sessionIdRef.current = newSessionId
      setSessionId(newSessionId)

      // Reset line results
      const initialResults = lines.map(() => ({ status: 'pending' as LineStatus }))
      setLineResults(initialResults)
      lineResultsRef.current = initialResults
      currentLineRef.current = 0
      setSummary(null)

      // Calculate lyrics offset - the first line's start time represents where the clip begins
      // in the original song. We need to subtract this to get clip-relative times.
      lyricsOffsetRef.current = lines[0]?.start ?? 0

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
  }, [audioRef, cleanup, clipHash, lines, onError, performer, tick, timesliceMs])

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
