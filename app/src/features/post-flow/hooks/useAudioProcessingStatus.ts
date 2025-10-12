/**
 * Audio Processing Status Hook
 * Polls Modal endpoint for job status and updates contract when complete
 */

import { useState, useEffect, useCallback } from 'react'

export interface AudioProcessingStatus {
  jobId: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  progress?: number
  segmentsCompleted?: number
  segmentsTotal?: number
  error?: string
}

export function useAudioProcessingStatus(jobId: string | null) {
  const [status, setStatus] = useState<AudioProcessingStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const pollStatus = useCallback(async (id: string) => {
    try {
      const pollUrl = `${import.meta.env.VITE_DEMUCS_ENDPOINT}/job/${id}`
      const response = await fetch(pollUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status}`)
      }

      const data = await response.json()

      const newStatus: AudioProcessingStatus = {
        jobId: id,
        status: data.status || 'pending',
        progress: data.progress,
        segmentsCompleted: data.segments_completed,
        segmentsTotal: data.segments_total,
        error: data.error,
      }

      setStatus(newStatus)

      // Stop polling when complete or error
      if (data.status === 'complete' || data.status === 'error') {
        setIsPolling(false)
      }

      return newStatus
    } catch (err) {
      console.error('[AudioProcessingStatus] Poll failed:', err)
      setStatus({
        jobId: id,
        status: 'error',
        error: err instanceof Error ? err.message : 'Poll failed',
      })
      setIsPolling(false)
      return null
    }
  }, [])

  // Start polling when jobId is provided
  useEffect(() => {
    if (!jobId) {
      setIsPolling(false)
      setStatus(null)
      return
    }

    setIsPolling(true)

    // Initial poll
    pollStatus(jobId)

    // Poll every 5 seconds
    const interval = setInterval(() => {
      if (isPolling) {
        pollStatus(jobId)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [jobId, pollStatus, isPolling])

  return {
    status,
    isPolling,
    pollStatus,
  }
}
