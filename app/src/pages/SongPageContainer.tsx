import { useParams, useNavigate } from 'react-router-dom'
import { SongPage, type LeaderboardEntry } from '@/components/song/SongPage'
import { useGRC20WorkClipsWithMetadata, useSpotifyTrackClipsWithMetadata } from '@/hooks/useSongV2'
import { useSongVideos } from '@/hooks/useSongVideos'
import { Spinner } from '@/components/ui/spinner'
import { convertGroveUri } from '@/lib/lens/utils'
import type { VideoPost } from '@/components/video/VideoGrid'

/**
 * Detect if an ID is a Spotify track ID vs GRC-20 UUID
 * Spotify IDs are 22-char base62 strings (alphanumeric)
 * GRC-20 UUIDs are 36-char with dashes (8-4-4-4-12)
 */
function isSpotifyTrackId(id: string): boolean {
  // Spotify IDs: 22 alphanumeric characters
  return /^[a-zA-Z0-9]{22}$/.test(id)
}

/**
 * Song Page Container - Supports both GRC-20 and Spotify track IDs
 *
 * Routes:
 * - /song/:workId (GRC-20 work UUID or Spotify track ID)
 *
 * Auto-detects identifier type and uses appropriate query
 */
export function SongPageContainer() {
  const { workId } = useParams<{ workId?: string }>()
  const navigate = useNavigate()

  // Detect identifier type
  const isSpotifyId = workId ? isSpotifyTrackId(workId) : false

  // Fetch clips - use appropriate hook based on identifier type
  const grc20Query = useGRC20WorkClipsWithMetadata(isSpotifyId ? undefined : workId)
  const spotifyQuery = useSpotifyTrackClipsWithMetadata(isSpotifyId ? workId : undefined)

  // Use whichever query is active
  const {
    data: workData,
    isLoading: isLoadingClips,
    error: clipsError,
  } = isSpotifyId ? spotifyQuery : grc20Query

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
      onPlay={() => navigate(`/song/${workId}/play`)}
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
