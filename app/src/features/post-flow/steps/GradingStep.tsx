/**
 * Grading Step
 * Execute grading Lit Action and display results
 */

import { useEffect, useState } from 'react'
import { PerformanceGradePage } from '@/components/karaoke/PerformanceGradePage'
import type { PostFlowContext, PerformanceGrade } from '../types'

interface GradingStepProps {
  flow: PostFlowContext
}

export function GradingStep({ flow }: GradingStepProps) {
  const [grade, setGrade] = useState<PerformanceGrade | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { recordedVideoBlob, selectedSegment } = flow.data

  useEffect(() => {
    if (!recordedVideoBlob || !selectedSegment) return

    const executeGrading = async () => {
      try {
        setIsLoading(true)
        const result = await flow.gradePerformance(recordedVideoBlob, selectedSegment)
        setGrade(result)
      } catch (error) {
        console.error('[GradingStep] Grading failed:', error)
        // TODO: Show error UI
      } finally {
        setIsLoading(false)
      }
    }

    executeGrading()
  }, [recordedVideoBlob, selectedSegment])

  const handleContinue = () => {
    if (!grade || !recordedVideoBlob) return

    // Convert blob to URL for preview
    const videoUrl = URL.createObjectURL(recordedVideoBlob)
    flow.goToPosting(videoUrl, grade)
  }

  if (isLoading || !grade) {
    // Show loading state
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Grading your performance...</p>
        </div>
      </div>
    )
  }

  return (
    <PerformanceGradePage
      grade={grade.grade}
      feedback={grade.feedback}
      onContinue={handleContinue}
    />
  )
}
