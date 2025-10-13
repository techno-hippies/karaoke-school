import { useNavigate, useParams } from 'react-router-dom'
import { SongSegmentPage } from '@/components/class/SongSegmentPage'
import { useSongData } from '@/hooks/useSongData'
import { useSegmentLyrics } from '@/hooks/useSegmentLyrics'

/**
 * KaraokeSegmentPage - Container for individual segment practice page
 *
 * Responsibilities:
 * - Load song data and find the selected segment
 * - Load lyrics from base-alignment metadata
 * - Handle navigation back to song page
 * - Trigger study/karaoke modes
 *
 * TODO:
 * - Integrate with PostFlow hooks for audio processing
 * - Load study stats (new/learning/due counts)
 *
 * Renders: <SongSegmentPage /> from /components/class/SongSegmentPage.tsx
 */
export function KaraokeSegmentPage() {
  const navigate = useNavigate()
  const { geniusId, segmentId } = useParams<{ geniusId: string; segmentId: string }>()

  const { song, segments, isLoading, error } = useSongData(geniusId ? parseInt(geniusId) : undefined)

  // Find the selected segment
  const segment = segments.find(s => s.id === segmentId)

  // Load lyrics for this segment
  const { lyrics, isLoading: lyricsLoading, error: lyricsError } = useSegmentLyrics(
    song?.metadataUri,
    segment?.startTime,
    segment?.endTime
  )

  if (isLoading) {
    return (
      <SongSegmentPage
        songTitle="Loading..."
        artist="Loading..."
        segmentName="Loading..."
        lyrics={[]}
        newCount={0}
        learningCount={0}
        dueCount={0}
        onBack={() => navigate(`/karaoke/song/${geniusId}`)}
      />
    )
  }

  if (error || !song || !segment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Segment Not Found</h1>
          <p className="text-muted-foreground mb-4">{error?.message || 'This segment could not be loaded.'}</p>
          <button
            onClick={() => navigate(`/karaoke/song/${geniusId}`)}
            className="text-primary hover:underline"
          >
            Back to Song
          </button>
        </div>
      </div>
    )
  }

  console.log('[KaraokeSegmentPage] Rendering segment:', {
    segmentId,
    segmentName: segment.displayName,
    hasMetadata: !!song.metadataUri,
    lyricsLoading,
    lyricsCount: lyrics.length,
    lyricsError: lyricsError?.message
  })

  return (
    <SongSegmentPage
      segmentName={segment.displayName}
      lyrics={lyrics}
      newCount={0} // TODO: Load from study system
      learningCount={0}
      dueCount={0}
      onBack={() => navigate(`/karaoke/song/${geniusId}`)}
      onStudy={() => console.log('Study mode')}
      onKaraoke={() => console.log('Karaoke mode')}
    />
  )
}
