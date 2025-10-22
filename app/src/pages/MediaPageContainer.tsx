import { useParams, useNavigate } from 'react-router-dom'
import { useSong } from '@/hooks/useSongRegistry'
import { useSegmentsBySong, useSegment, type Segment } from '@/hooks/useSegmentRegistry'
import { useSegmentAlignment } from '@/hooks/useSegmentAlignment'
import { MediaPage } from '@/components/media/MediaPage'
import { Spinner } from '@/components/ui/spinner'
import { lensUriToHttp } from '@/lib/grove'

export function MediaPageContainer() {
  const { geniusId } = useParams<{ geniusId: string }>()
  const navigate = useNavigate()

  const songId = geniusId ? parseInt(geniusId) : undefined

  // Fetch song data
  const { data: songData, isLoading: isLoadingSong } = useSong(songId)

  console.log('[MediaPageContainer] Song data:', songData)

  // Fetch segments for this song
  const { data: segmentHashes, isLoading: isLoadingSegments } = useSegmentsBySong(songId)

  console.log('[MediaPageContainer] Segment hashes:', segmentHashes)

  // Use first segment for now (TODO: allow user to select segment)
  const firstSegmentHash = Array.isArray(segmentHashes) && segmentHashes.length > 0
    ? (segmentHashes[0] as `0x${string}`)
    : undefined

  console.log('[MediaPageContainer] First segment hash:', firstSegmentHash)

  // Fetch segment data
  const { data: segmentData, isLoading: isLoadingSegment } = useSegment(firstSegmentHash)

  const segment = segmentData as Segment | undefined

  console.log('[MediaPageContainer] Segment data:', segment)
  console.log('[MediaPageContainer] Alignment URI:', segment?.alignmentUri)

  // Fetch alignment data (lyrics)
  const { data: lyrics, isLoading: isLoadingLyrics, error: lyricsError } = useSegmentAlignment(segment?.alignmentUri)

  console.log('[MediaPageContainer] Lyrics:', lyrics)
  console.log('[MediaPageContainer] Lyrics loading:', isLoadingLyrics)
  console.log('[MediaPageContainer] Lyrics error:', lyricsError)

  // Loading state
  if (isLoadingSong || isLoadingSegments || isLoadingSegment || isLoadingLyrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Error states
  if (!songData || !segment || !lyrics) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Unable to load media</h1>
        <p className="text-muted-foreground">
          {!songData ? 'Song not found' : !segment ? 'No segments available for this song' : 'Lyrics not available'}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  const song = songData as any

  // Convert lens:// URIs to HTTP URLs
  const audioUrl = lensUriToHttp(segment.instrumentalUri)

  return (
    <MediaPage
      title={song.title}
      artist={song.artist}
      audioUrl={audioUrl}
      lyrics={lyrics}
      selectedLanguage="en"
      showTranslations={false}
      onBack={() => navigate(-1)}
    />
  )
}
