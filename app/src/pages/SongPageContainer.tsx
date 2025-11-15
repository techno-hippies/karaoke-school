import { useParams, useNavigate } from 'react-router-dom'
import { SongPage, type LeaderboardEntry } from '@/components/song/SongPage'
import { useGRC20WorkClipsWithMetadata } from '@/hooks/useSongV2'
import { useSongVideos } from '@/hooks/useSongVideos'
import { Spinner } from '@/components/ui/spinner'
import { convertGroveUri } from '@/lib/lens/utils'
import type { VideoPost } from '@/components/video/VideoGrid'

/**
 * Song Page Container - GRC-20 based
 *
 * Routes:
 * - /song/grc20/:workId (GRC-20 work UUID)
 *
 * All queries are clip-based, grouped by grc20WorkId
 */
export function SongPageContainer() {
  const { workId } = useParams<{ workId?: string }>()
  const navigate = useNavigate()

  // Fetch clips for this GRC-20 work
  const {
    data: workData,
    isLoading: isLoadingClips,
    error: clipsError,
  } = useGRC20WorkClipsWithMetadata(workId)

  // Fetch creator videos by GRC-20 work ID
  const { data: lensVideos, isLoading: isLoadingVideos } = useSongVideos(workId)

  // Loading state
  if (isLoadingClips) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Error states
  if (clipsError || !workData) {
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

  // Extract metadata from first clip
  const firstClip = workData.clips[0]
  const metadata = firstClip?.metadata

  console.log('[SongPageContainer] workData.clips:', workData.clips?.length || 0)
  console.log('[SongPageContainer] firstClip:', firstClip)
  console.log('[SongPageContainer] metadata:', metadata)
  console.log('[SongPageContainer] metadata keys:', metadata ? Object.keys(metadata) : 'N/A')
  console.log('[SongPageContainer] coverUri in metadata?', metadata?.coverUri ? 'YES' : 'NO')
  console.log('[SongPageContainer] coverUri value:', metadata?.coverUri)
  console.log('[SongPageContainer] 🚨 artistLensHandle in metadata?', metadata?.artistLensHandle ? 'YES' : 'NO')
  console.log('[SongPageContainer] 🚨 artistLensHandle value:', metadata?.artistLensHandle)
  console.log('[SongPageContainer] 🚨 artistAccount value:', metadata?.artistAccount)

  // Transform Lens videos to VideoPost format (VideoGrid only needs id, thumbnailUrl, username)
  const videos: VideoPost[] = lensVideos?.map(video => ({
    id: video.id,
    thumbnailUrl: video.thumbnailUrl,
    username: video.username,
  })) || []

  // Extract song information
  // TODO: Fetch full work info from GRC-20 graph for title, artist, etc.
  const songTitle = metadata?.title || `Work ${workId}`
  const artist = metadata?.artist || 'Unknown Artist'
  const artworkUrl = metadata?.coverUri ? convertGroveUri(metadata.coverUri) : undefined
  console.log('[SongPageContainer] Final artworkUrl:', artworkUrl)
  const songIdentifier = `grc20/${workId}`
  const karaokeRoute = `/song/${workId}/karaoke`
  const studyRoute = `/song/${workId}/study`

  // Build external links
  const songLinks: Array<{ label: string; url: string }> = []
  if (firstClip?.spotifyTrackId) {
    songLinks.push({
      label: 'Spotify',
      url: `https://open.spotify.com/track/${firstClip.spotifyTrackId}`,
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
      onPlay={() => navigate(karaokeRoute)}
      onArtistClick={
        metadata?.artistLensHandle
          ? () => navigate(`/u/${metadata.artistLensHandle}`)
          : undefined
      }
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
        navigate(karaokeRoute)
      }}
    />
  )
}
