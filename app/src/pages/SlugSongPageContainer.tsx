import { useParams, useNavigate } from 'react-router-dom'
import { useSongSlug } from '@/hooks/useSongSlug'
import { useSpotifyTrackClipsWithMetadata } from '@/hooks/useSongV2'
import { useSongVideos } from '@/hooks/useSongVideos'
import { SongPage, type LeaderboardEntry } from '@/components/song/SongPage'
import { Spinner } from '@/components/ui/spinner'
import { convertGroveUri } from '@/lib/lens/utils'
import type { VideoPost } from '@/components/video/VideoGrid'

/**
 * Slug-based Song Page Container
 *
 * Routes:
 * - /:artistSlug/:songSlug (e.g., /eminem/lose-yourself)
 * - /:artistSlug/:songSlug/play
 * - /:artistSlug/:songSlug/karaoke
 * - /:artistSlug/:songSlug/study
 *
 * This is the primary song page. Clean URLs, no redirects.
 */
export function SlugSongPageContainer() {
  const { artistSlug, songSlug } = useParams<{ artistSlug?: string; songSlug?: string }>()
  const navigate = useNavigate()

  // Resolve slugs to Spotify track ID
  const { data: slugData, isLoading: isLoadingSlug, error: slugError } = useSongSlug(artistSlug, songSlug)

  // Fetch clips by Spotify track ID (only when slug is resolved)
  const {
    data: workData,
    isLoading: isLoadingClips,
    error: clipsError,
  } = useSpotifyTrackClipsWithMetadata(slugData?.spotifyTrackId)

  // Fetch creator videos
  const { data: lensVideos, isLoading: isLoadingVideos } = useSongVideos(
    workData?.grc20WorkId || slugData?.spotifyTrackId
  )

  // Loading state
  if (isLoadingSlug || isLoadingClips) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Slug not found
  if (slugError || !slugData?.spotifyTrackId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">
          Song not found
        </h1>
        <p className="text-muted-foreground text-center">
          {artistSlug && songSlug
            ? `No song found for "${artistSlug}/${songSlug}"`
            : 'Invalid song URL'}
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

  // No clips found
  if (clipsError || !workData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">
          Content not available
        </h1>
        <p className="text-muted-foreground text-center">
          No karaoke content found for this song yet.
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

  // Transform Lens videos to VideoPost format
  const videos: VideoPost[] = lensVideos?.map(video => ({
    id: video.id,
    thumbnailUrl: video.thumbnailUrl,
    username: video.username,
  })) || []

  // Song info from metadata
  const songTitle = metadata?.title || songSlug?.replace(/-/g, ' ') || 'Unknown'
  const artist = metadata?.artist || artistSlug?.replace(/-/g, ' ') || 'Unknown'
  const artworkUrl = metadata?.coverUri ? convertGroveUri(metadata.coverUri) : undefined

  // Build routes using slugs (clean URLs)
  const basePath = `/${artistSlug}/${songSlug}`
  const karaokeRoute = `${basePath}/karaoke`
  const studyRoute = `${basePath}/study`
  const playRoute = `${basePath}/play`

  // External links
  const songLinks: Array<{ label: string; url: string }> = []
  if (firstClip?.spotifyTrackId) {
    songLinks.push({
      label: 'Spotify',
      url: `https://open.spotify.com/track/${firstClip.spotifyTrackId}`,
    })
  }

  // Mock leaderboard
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
      onArtistClick={
        metadata?.artistLensHandle
          ? () => navigate(`/u/${metadata.artistLensHandle}`)
          : undefined
      }
      videos={videos}
      isLoadingVideos={isLoadingVideos}
      onVideoClick={(video) => {
        navigate(`/u/${video.username}/video/${video.id}?from=song&song=${artistSlug}/${songSlug}`)
      }}
      leaderboardEntries={leaderboard}
      currentUser={undefined}
      onStudy={() => navigate(studyRoute)}
      onKaraoke={() => navigate(karaokeRoute)}
    />
  )
}
