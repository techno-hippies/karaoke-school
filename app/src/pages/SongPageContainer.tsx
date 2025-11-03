import { useParams, useNavigate } from 'react-router-dom'
import { SongPage, type LeaderboardEntry } from '@/components/song/SongPage'
import { useGRC20WorkSegmentsWithMetadata } from '@/hooks/useSongV2'
// import { useSongVideos } from '@/hooks/useSongVideos' // TODO: Update to work with spotifyTrackId
import { Spinner } from '@/components/ui/spinner'
import { convertGroveUri } from '@/lib/lens/utils'
import type { VideoPost } from '@/components/video/VideoGrid'

/**
 * Song Page Container - GRC-20 based
 *
 * Routes:
 * - /song/grc20/:workId (GRC-20 work UUID)
 *
 * All queries are segment-based, grouped by grc20WorkId
 */
export function SongPageContainer() {
  const { workId } = useParams<{ workId?: string }>()
  const navigate = useNavigate()

  // Fetch segments for this GRC-20 work
  const {
    data: workData,
    isLoading: isLoadingSegments,
    error: segmentsError,
  } = useGRC20WorkSegmentsWithMetadata(workId)

  // Fetch creator videos (by Spotify track ID if available)
  // const _spotifyTrackId = workData?.spotifyTrackId
  // TODO: Update useSongVideos to accept spotifyTrackId instead of geniusId
  const { data: videosData, isLoading: isLoadingVideos } = {
    data: [] as VideoPost[],
    isLoading: false,
  }

  // Loading state
  if (isLoadingSegments) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Error states
  if (segmentsError || !workData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">
          Work not found
        </h1>
        <p className="text-muted-foreground text-center">
          {workId
            ? `No work found with GRC-20 ID ${workId}`
            : 'No work identifier provided'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="text-primary hover:underline"
        >
          Go home
        </button>
      </div>
    )
  }

  // Extract metadata from first segment
  const firstSegment = workData.segments[0]
  const metadata = firstSegment?.metadata

  console.log('[SongPageContainer] workData.segments:', workData.segments?.length || 0)
  console.log('[SongPageContainer] firstSegment:', firstSegment)
  console.log('[SongPageContainer] metadata:', metadata)
  console.log('[SongPageContainer] metadata keys:', metadata ? Object.keys(metadata) : 'N/A')
  console.log('[SongPageContainer] coverUri in metadata?', metadata?.coverUri ? 'YES' : 'NO')
  console.log('[SongPageContainer] coverUri value:', metadata?.coverUri)

  // Transform videos to VideoGrid format
  const videos: VideoPost[] = videosData || []

  // Extract song information
  // TODO: Fetch full work info from GRC-20 graph for title, artist, etc.
  const songTitle = metadata?.title || `Work ${workId}`
  const artist = metadata?.artist || 'Unknown Artist'
  const artworkUrl = metadata?.coverUri ? convertGroveUri(metadata.coverUri) : undefined
  console.log('[SongPageContainer] Final artworkUrl:', artworkUrl)
  const songIdentifier = `grc20/${workId}`
  const playRoute = `/song/${workId}/play`
  const studyRoute = `/song/${workId}/study`

  // Build external links
  const songLinks: Array<{ label: string; url: string }> = []
  if (firstSegment?.spotifyTrackId) {
    songLinks.push({
      label: 'Spotify',
      url: `https://open.spotify.com/track/${firstSegment.spotifyTrackId}`,
    })
  }

  // Mock leaderboard (TODO: fetch from contract/subgraph when ready)
  const leaderboard: LeaderboardEntry[] = []

  return (
    <SongPage
      songTitle={songTitle}
      artist={artist}
      artworkUrl={artworkUrl}
      songLinks={songLinks}
      lyricsLinks={[]}
      onBack={() => navigate(-1)}
      onPlay={() => navigate(playRoute)}
      onArtistClick={() => {
        // TODO: Navigate to artist GRC-20 page if available
        console.log('Navigate to artist: (GRC-20 implementation pending)')
      }}
      videos={videos}
      isLoadingVideos={isLoadingVideos}
      onVideoClick={(video) => {
        console.log('[SongPage] Video clicked:', video)
        navigate(
          `/u/${video.username}/video/${video.id}?from=song&songId=${songIdentifier}`
        )
      }}
      leaderboardEntries={leaderboard}
      currentUser={undefined}
      onStudy={() => {
        navigate(studyRoute)
      }}
      onKaraoke={() => {
        navigate(playRoute)
      }}
    />
  )
}
