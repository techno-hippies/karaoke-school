/**
 * SayItBack - Container Component (Business Logic)
 *
 * This is a CONTAINER component that handles:
 * - Wagmi hooks (useAccount, useWalletClient)
 * - Lit Protocol authentication and STT
 * - Voice recording logic
 * - Error handling
 *
 * ⚠️ DO NOT create Storybook stories for this component!
 * It requires WagmiProvider and cannot render in Storybook.
 *
 * ✅ For Storybook: Use SayItBackExercise.stories.tsx instead
 * (Pure presentation component with no external dependencies)
 */

import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { useVoiceRecorder } from '../../hooks/media/useVoiceRecorder'
import { litProtocolService } from '../../services/lit/LitProtocolService'
import { SayItBackExercise, calculateTextSimilarity } from './SayItBackExercise'

export interface SayItBackProps {
  expectedText: string
  onComplete?: (score: number, transcript: string) => void
  transcript?: string
  score?: number | null
  attempts?: number
  isCompleted?: boolean
}

export function SayItBack({
  expectedText,
  onComplete,
  transcript: externalTranscript,
  score: externalScore,
  attempts = 0,
  isCompleted = false
}: SayItBackProps) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const {
    isRecording,
    audioBlob,
    error: recorderError,
    startRecording,
    stopRecording,
    clearRecording,
    hasAudio
  } = useVoiceRecorder()

  const [transcript, setTranscript] = useState<string | undefined>(externalTranscript)
  const [score, setScore] = useState<number | null>(externalScore ?? null)
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

  // Create auth context when wallet is available
  useEffect(() => {
    const createAuth = async () => {
      if (litConnected && walletClient && address && !authContext) {
        try {
          console.log('[SayItBack] Creating EOA auth context...')
          const ctx = await litProtocolService.createAuthContext(walletClient)
          setAuthContext(ctx)
          console.log('[SayItBack] Auth context ready')
        } catch (err: any) {
          console.error('[SayItBack] Failed to create auth context:', err)
          setError(`Failed to authenticate: ${err.message}`)
        }
      }
    }

    createAuth()
  }, [litConnected, walletClient, address, authContext])

  // Auto-submit when recording stops and audioBlob is available
  useEffect(() => {
    const submitAudio = async () => {
      if (!audioBlob || !address || !authContext || isProcessing) {
        return
      }

      setIsProcessing(true)
      setError(undefined)

      try {
        console.log('[SayItBack] Auto-submitting audio for transcription...')

        // Transcribe audio using Lit Protocol
        const result = await litProtocolService.transcribeAudio(
          audioBlob,
          address,
          authContext
        )

        if (!result.success) {
          setError(result.error || 'Transcription failed')
          setIsProcessing(false)
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

    submitAudio()
  }, [audioBlob, address, authContext])

  // Check if user can record (Lit ready + wallet connected)
  const canRecord = litConnected && !!authContext

  // Determine status message
  let statusMessage: string | undefined
  if (!litConnected) {
    statusMessage = 'Connecting to Lit Protocol...'
  } else if (litConnected && !authContext) {
    statusMessage = 'Setting up authentication...'
  } else if (error || recorderError) {
    statusMessage = `Error: ${error || recorderError}`
  }

  return (
    <SayItBackExercise
      expectedText={expectedText}
      transcript={transcript}
      score={score}
      attempts={attempts}
      isRecording={isRecording}
      isProcessing={isProcessing}
      canRecord={canRecord}
      statusMessage={statusMessage}
      onStartRecording={() => {
        if (!canRecord) {
          setError('Please wait for authentication to complete')
          return
        }
        clearRecording()
        setError(undefined)
        startRecording()
      }}
      onStopRecording={stopRecording}
    />
  )
}
