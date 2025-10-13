/**
 * Post Flow Container
 * Main component that orchestrates the entire karaoke post flow
 */

import { usePostFlow } from './hooks/usePostFlow'
import {
  SongSelectStep,
  PurchaseCreditsStep,
  RecordingStep,
  GradingStep,
  PostingStep,
} from './steps'

export interface PostFlowContainerProps {
  /** Whether the flow is open */
  open: boolean
  /** Called when flow completes or is cancelled */
  onClose: () => void
}

export function PostFlowContainer({ open, onClose }: PostFlowContainerProps) {
  const flow = usePostFlow(onClose)

  if (!open) return null

  // Render current step
  switch (flow.state) {
    case 'SONG_SELECT':
      return <SongSelectStep flow={flow} />

    case 'GENERATE_KARAOKE':
      // Generation is now handled by redirecting to song page
      return <SongSelectStep flow={flow} />

    case 'PURCHASE_CREDITS':
      return <PurchaseCreditsStep flow={flow} />

    case 'RECORDING':
      return <RecordingStep flow={flow} />

    case 'GRADING':
      return <GradingStep flow={flow} />

    case 'POSTING':
      return <PostingStep flow={flow} />

    case 'COMPLETE':
      return null

    default:
      return null
  }
}
