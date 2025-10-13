/**
 * Recording Step
 * Wrapper for VideoRecorder - passes segment data and handles completion
 */

import { VideoRecorder } from '@/components/karaoke/VideoRecorder'
import type { PostFlowContext } from '../types'

interface RecordingStepProps {
  flow: PostFlowContext
}

export function RecordingStep({ flow }: RecordingStepProps) {
  const { selectedSong, selectedSegment } = flow.data

  if (!selectedSong || !selectedSegment) {
    console.error('[RecordingStep] Missing song or segment data')
    return null
  }

  // Ensure we have the instrumental URL
  if (!selectedSegment.audioUrl) {
    console.error('[RecordingStep] Missing instrumental audio URL')
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center px-8">
          <p className="text-red-400 font-medium mb-2">Configuration Error</p>
          <p className="text-muted-foreground text-sm">
            Instrumental track not available for this segment
          </p>
        </div>
      </div>
    )
  }

  const handleRecordingComplete = (blob: Blob) => {
    console.log('[RecordingStep] Recording completed, blob size:', blob.size, 'bytes')

    // Create object URL for preview
    const videoUrl = URL.createObjectURL(blob)

    // Store blob and proceed to grading
    flow.goToGrading(blob)
  }

  return (
    <VideoRecorder
      selectedSong={{
        id: selectedSong.id,
        title: selectedSong.title,
        artist: selectedSong.artist,
        coverUrl: selectedSong.artworkUrl,
      }}
      instrumentalUrl={selectedSegment.audioUrl}
      segmentStartTime={selectedSegment.startTime}
      segmentEndTime={selectedSegment.endTime}
      karaokeLines={selectedSong.segments?.find(s => s.id === selectedSegment.id)?.karaokeLines}
      onRecordingComplete={handleRecordingComplete}
      onClose={() => flow.goToSongSelect()}
      onSelectSong={() => flow.goToSongSelect()}
    />
  )
}
