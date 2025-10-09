/**
 * Segment Picker Step
 * Wrapper for SegmentPickerDrawer
 */

import { SegmentPickerDrawer } from '@/components/karaoke/SegmentPickerDrawer'
import type { PostFlowContext, SongSegment } from '../types'

interface SegmentPickerStepProps {
  flow: PostFlowContext
}

export function SegmentPickerStep({ flow }: SegmentPickerStepProps) {
  const { selectedSong } = flow.data

  if (!selectedSong || !selectedSong.segments) {
    return null
  }

  const handleSegmentSelect = (segment: SongSegment) => {
    // If segment is owned, proceed directly to recording
    if (segment.isOwned) {
      flow.goToRecording(selectedSong, segment)
      return
    }

    // If user has credits, unlock and proceed
    if (flow.auth.hasCredits) {
      flow.unlockSegment(selectedSong, segment)
      return
    }

    // Otherwise, go to purchase credits
    flow.goToPurchaseCredits()
  }

  return (
    <SegmentPickerDrawer
      open={true}
      onOpenChange={(open) => {
        if (!open) flow.goToSongSelect()
      }}
      songTitle={selectedSong.title}
      songArtist={selectedSong.artist}
      songArtwork={selectedSong.artworkUrl}
      segments={selectedSong.segments}
      onSelectSegment={handleSegmentSelect}
    />
  )
}
