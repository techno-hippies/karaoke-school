import { useParams, useNavigate } from 'react-router-dom'
import { SongPage, type LeaderboardEntry } from '@/components/song/SongPage'
import { useSongWithMetadata } from '@/hooks/useSongV2'
import { useSongVideos } from '@/hooks/useSongVideos'
import { Spinner } from '@/components/ui/spinner'
import { convertGroveUri } from '@/lib/lens/utils'
import type { VideoPost as LensVideoPost } from '@/hooks/useSongVideos'
import type { VideoPost } from '@/components/video/VideoGrid'

export function SongPageContainer() {
  const { geniusId } = useParams<{ geniusId: string }>()
  const navigate = useNavigate()

  const songId = geniusId ? parseInt(geniusId) : undefined

  // Fetch song data from The Graph with Grove metadata
  const { data: songData, isLoading: isLoadingSong, error: songError } = useSongWithMetadata(songId)

  // Fetch creator videos from Lens (by genius_id attribute)
  const { data: videosData } = useSongVideos(songId)

  // Loading state
  if (isLoadingSong) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Error states
  if (songError || !songData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Song not found</h1>
        <p className="text-muted-foreground text-center">
          No song found with ID {geniusId}
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

  // Extract metadata from enriched song
  const metadata = songData.metadata

  // Transform Lens videos to VideoGrid format (already transformed in hook)
  const videos: VideoPost[] = videosData || []

  // Mock leaderboard (TODO: fetch from LeaderboardV1 when deployed)
  const leaderboard: LeaderboardEntry[] = []

  // External links
  const songLinks = [
    metadata?.spotifyId && {
      label: 'Spotify',
      url: `https://open.spotify.com/track/${metadata.spotifyId}`,
    },
  ].filter(Boolean) as Array<{ label: string; url: string }>

  const lyricsLinks = songData.geniusId
    ? [
        {
          label: 'Genius',
          url: `https://genius.com/songs/${songData.geniusId}`,
        },
      ]
    : []

  return (
    <SongPage
      songTitle={metadata?.title || `Song ${songData.geniusId}`}
      artist={metadata?.artist || 'Unknown Artist'}
      artworkUrl={metadata?.coverUri ? convertGroveUri(metadata.coverUri) : undefined}
      songLinks={songLinks}
      lyricsLinks={lyricsLinks}
      onBack={() => navigate(-1)}
      onPlay={() => navigate(`/song/${geniusId}/play`)}
      onArtistClick={() => {
        // TODO: Navigate to artist page using geniusArtistId
        console.log('Navigate to artist:', songData.geniusArtistId)
      }}
      videos={videos}
      onVideoClick={(video) => {
        console.log('[SongPage] Video clicked:', video)
        console.log('[SongPage] Navigating to:', `/u/${video.username}/video/${video.id}?from=song&songId=${geniusId}`)
        navigate(`/u/${video.username}/video/${video.id}?from=song&songId=${geniusId}`)
      }}
      leaderboardEntries={leaderboard}
      currentUser={undefined} // TODO: Fetch current user rank
      onStudy={() => {
        // TODO: Navigate to first segment for this song
        console.log('Study clicked')
      }}
      onKaraoke={() => {
        // TODO: Navigate to karaoke mode
        console.log('Karaoke clicked')
      }}
    />
  )
}
