import { useParams, useNavigate } from 'react-router-dom'
import { SongPage, type LeaderboardEntry } from '@/components/song/SongPage'
import { useSong } from '@/hooks/useSongRegistry'
import { useSongVideos } from '@/hooks/useSongVideos'
import { Spinner } from '@/components/ui/spinner'
import type { VideoPost as LensVideoPost } from '@/hooks/useSongVideos'
import type { VideoPost } from '@/components/video/VideoGrid'

export function SongPageContainer() {
  const { geniusId } = useParams<{ geniusId: string }>()
  const navigate = useNavigate()

  const songId = geniusId ? parseInt(geniusId) : undefined

  // Fetch song data from SongRegistry contract
  const { data: songData, isLoading: isLoadingSong, error: songError } = useSong(songId)

  // Fetch creator videos from Lens (by genius_id attribute)
  const { data: videosData, isLoading: isLoadingVideos } = useSongVideos(songId)

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
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-2xl font-bold">Song not found</h1>
        <p className="text-muted-foreground">
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

  // Transform contract song data
  const song = songData as any

  // Transform Lens videos to VideoGrid format
  const videos: VideoPost[] = (videosData || []).map((video: LensVideoPost) => ({
    id: video.id,
    thumbnailUrl: video.thumbnailUrl || 'https://placehold.co/400x711/8b5cf6/ffffff?text=Video',
    username: video.author.username || video.author.address.slice(0, 8),
  }))

  // Mock leaderboard (TODO: fetch from LeaderboardV1 when deployed)
  const leaderboard: LeaderboardEntry[] = []

  // External links
  const songLinks = [
    song.spotifyId && {
      label: 'Spotify',
      url: `https://open.spotify.com/track/${song.spotifyId}`,
    },
    song.tiktokMusicId && {
      label: 'TikTok',
      url: `https://www.tiktok.com/music/${song.tiktokMusicId}`,
    },
  ].filter(Boolean) as Array<{ label: string; url: string }>

  const lyricsLinks = song.geniusId
    ? [
        {
          label: 'Genius',
          url: `https://genius.com/songs/${song.geniusId}`,
        },
      ]
    : []

  return (
    <SongPage
      songTitle={song.title}
      artist={song.artist}
      artworkUrl={song.coverUri || undefined} // TODO: Convert grove:// URI to HTTP URL
      songLinks={songLinks}
      lyricsLinks={lyricsLinks}
      onBack={() => navigate(-1)}
      onPlay={() => navigate(`/song/${geniusId}/play`)}
      onArtistClick={() => {
        // TODO: Navigate to artist page using geniusArtistId
        console.log('Navigate to artist:', song.geniusArtistId)
      }}
      videos={videos}
      onVideoClick={(video) => {
        // TODO: Navigate to video detail page
        console.log('Video clicked:', video)
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
