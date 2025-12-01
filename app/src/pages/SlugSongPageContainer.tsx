import { useParams, useNavigate } from 'react-router-dom'
import { useSongSlug } from '@/hooks/useSongSlug'
import { useSongClips } from '@/hooks/useSongClips'
import { useSongVideos } from '@/hooks/useSongVideos'
import { useSongLeaderboard } from '@/hooks/useLeaderboard'
import { useAuth } from '@/contexts/AuthContext'
import { useSEO, generateSongTitle, generateSongDescription } from '@/hooks/useSEO'
import { SongPage, SongPageSkeleton, type LeaderboardEntry } from '@/components/song/SongPage'
import { convertGroveUri } from '@/lib/lens/utils'
import type { VideoPost } from '@/components/video/VideoGrid'

/**
 * Slug-based Song Page Container
 *
 * Routes:
 * - /:artistSlug/:songSlug (e.g., /britney-spears/toxic)
 * - /:artistSlug/:songSlug/play
 * - /:artistSlug/:songSlug/karaoke
 * - /:artistSlug/:songSlug/study
 */
export function SlugSongPageContainer() {
  const { artistSlug, songSlug } = useParams<{ artistSlug?: string; songSlug?: string }>()
  const navigate = useNavigate()
  const { pkpAddress } = useAuth()

  // Resolve slugs to Spotify track ID
  const { data: slugData, isLoading: isLoadingSlug, error: slugError } = useSongSlug(artistSlug, songSlug)

  // Fetch clips by Spotify track ID
  const {
    data: workData,
    isLoading: isLoadingClips,
    error: clipsError,
  } = useSongClips(slugData?.spotifyTrackId)

  // Fetch creator videos
  const { data: lensVideos, isLoading: isLoadingVideos } = useSongVideos(slugData?.spotifyTrackId)

  // Fetch leaderboard data (called when Students tab is viewed)
  const { leaderboard: leaderboardData } = useSongLeaderboard(slugData?.spotifyTrackId)

  // Extract metadata for SEO (must be before any early returns)
  const firstClip = workData?.clips[0]
  const metadata = firstClip?.metadata
  const songTitle = metadata?.title || songSlug?.replace(/-/g, ' ') || 'Unknown'
  const artist = metadata?.artist || artistSlug?.replace(/-/g, ' ') || 'Unknown'
  const artworkUrl = metadata?.coverUri ? convertGroveUri(metadata.coverUri) : undefined

  // SEO: Update document title and meta tags (must be called unconditionally)
  useSEO({
    title: generateSongTitle(songTitle, artist),
    description: generateSongDescription(songTitle, artist),
    image: artworkUrl,
    type: 'music.song',
  })

  if (isLoadingSlug || isLoadingClips) {
    return <SongPageSkeleton />
  }

  if (slugError || !slugData?.spotifyTrackId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Song not found</h1>
        <p className="text-muted-foreground text-center">
          {artistSlug && songSlug
            ? `No song found for "${artistSlug}/${songSlug}"`
            : 'Invalid song URL'}
        </p>
        <button onClick={() => navigate('/')} className="text-primary hover:underline">
          Go home
        </button>
      </div>
    )
  }

  if (clipsError || !workData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Content not available</h1>
        <p className="text-muted-foreground text-center">
          No karaoke content found for this song yet.
        </p>
        <button onClick={() => navigate('/')} className="text-primary hover:underline">
          Go home
        </button>
      </div>
    )
  }

  const videos: VideoPost[] = lensVideos?.map(video => ({
    id: video.id,
    thumbnailUrl: video.thumbnailUrl,
    username: video.username,
  })) || []

  const basePath = `/${artistSlug}/${songSlug}`

  const songLinks: Array<{ label: string; url: string }> = []
  if (firstClip?.spotifyTrackId) {
    songLinks.push({
      label: 'Spotify',
      url: `https://open.spotify.com/track/${firstClip.spotifyTrackId}`,
    })
  }

  // Map leaderboard data to the format expected by SongPage
  const currentUserAddress = pkpAddress?.toLowerCase()
  const leaderboard: LeaderboardEntry[] = leaderboardData.map(entry => ({
    rank: entry.rank,
    username: entry.username,
    score: entry.totalPoints,
    isCurrentUser: currentUserAddress ? entry.address === currentUserAddress : false,
  }))

  return (
    <SongPage
      songTitle={songTitle}
      artist={artist}
      artworkUrl={artworkUrl}
      songLinks={songLinks}
      lyricsLinks={[]}
      onBack={() => navigate('/')}
      onPlay={() => navigate(`${basePath}/play`)}
      onArtistClick={
        artistSlug
          ? () => navigate(`/${artistSlug}`)
          : undefined
      }
      videos={videos}
      isLoadingVideos={isLoadingVideos}
      onVideoClick={(video) => {
        navigate(`/u/${video.username}/video/${video.id}?from=song&song=${artistSlug}/${songSlug}`)
      }}
      leaderboardEntries={leaderboard}
      currentUser={undefined}
      onStudy={() => navigate(`${basePath}/study`)}
      onKaraoke={() => navigate(`${basePath}/karaoke`)}
    />
  )
}
