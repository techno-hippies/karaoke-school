import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { Microphone, Stop, ArrowClockwise, SpeakerHigh } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useVoiceRecorder } from '../../hooks/media/useVoiceRecorder'
import { litProtocolService } from '../../services/lit/LitProtocolService'

// Simple text similarity scoring (can be enhanced with phoneme matching later)
function calculateTextSimilarity(expected: string, actual: string): number {
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim()
  const expectedNorm = normalize(expected)
  const actualNorm = normalize(actual)

  if (expectedNorm === actualNorm) return 100

  // Simple word-based similarity
  const expectedWords = expectedNorm.split(/\s+/)
  const actualWords = actualNorm.split(/\s+/)

  let matches = 0
  for (const word of expectedWords) {
    if (actualWords.includes(word)) matches++
  }

  return Math.round((matches / expectedWords.length) * 100)
}

// TTS Button (mock for now)
const TTSButton = ({ text }: { text: string }) => {
  const handleTTS = () => {
    console.log('[TTS] Would play:', text)
    // Future: Implement TTS playback
  }

  return (
    <button
      onClick={handleTTS}
      className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
    >
      <SpeakerHigh className="w-6 h-6 text-white" weight="fill" />
    </button>
  )
}

export interface SayItBackProps {
  expectedText: string
  onComplete?: (score: number, transcript: string) => void
}

export function SayItBack({ expectedText, onComplete }: SayItBackProps) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const { isRecording, audioBlob, error: recorderError, startRecording, stopRecording, clearRecording, hasAudio } = useVoiceRecorder()

  const [transcript, setTranscript] = useState<string>()
  const [score, setScore] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string>()
  const [litConnected, setLitConnected] = useState(false)
  const [authContext, setAuthContext] = useState<any>(null)

  // Connect to Lit Protocol on mount
  useEffect(() => {
    const connectLit = async () => {
      try {
        await litProtocolService.connect()
        setLitConnected(true)
      } catch (err: any) {
        console.error('[SayItBack] Failed to connect to Lit:', err)
        setError('Failed to connect to Lit Protocol')
      }
    }

    connectLit()
  }, [])

  // Create auth context when wallet is available (requires PKP)
  useEffect(() => {
    const createAuth = async () => {
      if (litConnected && walletClient && address && !authContext) {
        try {
          console.log('[SayItBack] Creating PKP auth context (may mint PKP if needed)...')
          const ctx = await litProtocolService.createAuthContext(walletClient)
          setAuthContext(ctx)
          console.log('[SayItBack] PKP auth context ready')
        } catch (err: any) {
          console.error('[SayItBack] Failed to create auth context:', err)
          if (err.message?.includes('insufficient funds')) {
            setError('Need tstLPX tokens on Chronicle Yellowstone. Get from: https://chronicle-yellowstone-faucet.getlit.dev/')
          } else {
            setError(`Failed to authenticate: ${err.message}`)
          }
        }
      }
    }

    createAuth()
  }, [litConnected, walletClient, address, authContext])

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording()
    } else {
      // Clear previous results
      clearRecording()
      setTranscript(undefined)
      setScore(null)
      setError(undefined)
      startRecording()
    }
  }

  const handleSubmit = async () => {
    if (!audioBlob || !address || !authContext) {
      setError('Missing audio, wallet, or auth context')
      return
    }

    setIsProcessing(true)
    setError(undefined)

    try {
      console.log('[SayItBack] Submitting audio for transcription...')

      // Transcribe audio using Lit Protocol
      const result = await litProtocolService.transcribeAudio(
        audioBlob,
        address,
        authContext
      )

      if (!result.success) {
        setError(result.error || 'Transcription failed')
        return
      }

      console.log('[SayItBack] Transcript:', result.transcript)
      setTranscript(result.transcript)

      // Calculate similarity score
      const similarity = calculateTextSimilarity(expectedText, result.transcript)
      setScore(similarity)

      console.log('[SayItBack] Score:', similarity)

      // Call completion callback
      if (onComplete) {
        onComplete(similarity, result.transcript)
      }

    } catch (err: any) {
      console.error('[SayItBack] Error:', err)
      setError(err.message || 'Failed to process audio')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRetry = () => {
    clearRecording()
    setTranscript(undefined)
    setScore(null)
    setError(undefined)
  }

  const isCorrect = score !== null && score >= 70
  const showResults = transcript !== undefined

  return (
    <div className="space-y-6">
      {/* Target text section */}
      <div className="text-left space-y-3">
        <div className="text-neutral-400 text-lg font-medium">
          Say it back:
        </div>
        <div className="flex items-center gap-4">
          <TTSButton text={expectedText} />
          <div className="text-2xl font-medium text-white leading-relaxed">
            {expectedText}
          </div>
        </div>
      </div>

      {/* Recording controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleRecordToggle}
          disabled={isProcessing || !litConnected || !authContext}
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200',
            isRecording
              ? 'bg-red-600 hover:bg-red-700 animate-pulse'
              : 'bg-blue-600 hover:bg-blue-700',
            (isProcessing || !litConnected || !authContext) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isRecording ? (
            <Stop className="w-8 h-8 text-white" weight="fill" />
          ) : (
            <Microphone className="w-8 h-8 text-white" weight="fill" />
          )}
        </button>

        {hasAudio && !isRecording && !showResults && (
          <>
            <button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Check Answer'}
            </button>

            <button
              onClick={handleRetry}
              disabled={isProcessing}
              className="p-3 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowClockwise className="w-6 h-6" />
            </button>
          </>
        )}

        {showResults && (
          <button
            onClick={handleRetry}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            Try Again
          </button>
        )}
      </div>

      {/* Status messages */}
      {!litConnected && (
        <div className="text-yellow-400 text-sm">
          Connecting to Lit Protocol...
        </div>
      )}

      {litConnected && !authContext && (
        <div className="text-yellow-400 text-sm">
          Setting up PKP authentication (may require gas on Chronicle Yellowstone)...
        </div>
      )}

      {isRecording && (
        <div className="text-blue-400 text-sm animate-pulse">
          Recording... Click stop when done
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div className="text-left space-y-2">
          {isCorrect ? (
            <div className="text-green-400 text-lg font-medium">
              ✓ Correct! ({score}%)
            </div>
          ) : (
            <>
              <div className="text-red-400 text-lg font-medium">
                ✗ Try again ({score}%)
              </div>
              <div className="text-neutral-400 text-lg font-medium">
                You said:
              </div>
              <div className="text-2xl font-medium text-white leading-relaxed">
                {transcript}
              </div>
            </>
          )}
        </div>
      )}

      {/* Errors */}
      {(error || recorderError) && (
        <div className="text-red-400 text-sm">
          Error: {error || recorderError}
        </div>
      )}
    </div>
  )
}