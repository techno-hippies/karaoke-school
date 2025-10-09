/**
 * Posting Step
 * Preview and post to Lens
 */

import { useState } from 'react'
import { VideoPoster } from '@/components/karaoke/VideoPoster'
import type { PostFlowContext } from '../types'

interface PostingStepProps {
  flow: PostFlowContext
}

export function PostingStep({ flow }: PostingStepProps) {
  const [isPosting, setIsPosting] = useState(false)
  const { recordedVideoUrl, grade } = flow.data

  if (!recordedVideoUrl || !grade) {
    return null
  }

  const handlePost = async () => {
    try {
      setIsPosting(true)
      const postUrl = await flow.createPost(recordedVideoUrl, grade)
      console.log('[PostingStep] Post created:', postUrl)

      // Complete flow
      flow.complete()
    } catch (error) {
      console.error('[PostingStep] Post failed:', error)
      // TODO: Show error UI
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <VideoPoster
      videoUrl={recordedVideoUrl}
      // TODO: Load actual karaoke lines
      karaokeLines={[]}
      onBack={() => {
        // Go back to grading (allow re-grade?)
        // Or go back to recording?
        flow.goToSongSelect()
      }}
      onPost={handlePost}
    />
  )
}
