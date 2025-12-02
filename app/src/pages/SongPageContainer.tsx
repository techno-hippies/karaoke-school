import { useParams, useNavigate } from 'react-router-dom'
import { SongPage, type LeaderboardEntry } from '@/components/song/SongPage'
import { useSongClips } from '@/hooks/useSongClips'
import { useSongVideos } from '@/hooks/useSongVideos'
import { Spinner } from '@/components/ui/spinner'
import { convertGroveUri } from '@/lib/lens/utils'
import type { VideoPost } from '@/components/video/VideoGrid'

/**
 * Song Page Container - Uses Spotify track IDs
 *
 * Route: /song/:spotifyTrackId
 */
export function SongPageContainer() {
  const { workId: spotifyTrackId } = useParams<{ workId?: string }>()
  const navigate = useNavigate()

  // Fetch clips by Spotify track ID
  const {
    data: workData,
    isLoading: isLoadingClips,
    error: clipsError,
  } = useSongClips(spotifyTrackId)

  // Fetch creator videos
  const { data: lensVideos, isLoading: isLoadingVideos } = useSongVideos(spotifyTrackId)

  if (isLoadingClips) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (clipsError || !workData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Song not found</h1>
        <p className="text-muted-foreground text-center">
          {spotifyTrackId ? `No clips found for track ${spotifyTrackId}` : 'No track ID provided'}
        </p>
        <button onClick={() => navigate('/')} className="text-primary hover:underline">
          Go home
        </button>
      </div>
    )
  }

  const firstClip = workData.clips[0]
  const metadata = firstClip?.metadata

  const videos: VideoPost[] = lensVideos?.map(video => ({
    id: video.id,
    thumbnailUrl: video.thumbnailUrl,
    username: video.username,
  })) || []

  const songTitle = metadata?.title || 'Unknown Song'
  const artist = metadata?.artist || 'Unknown Artist'
  const artworkUrl = metadata?.coverUri ? convertGroveUri(metadata.coverUri) : undefined

  const songLinks: Array<{ label: string; url: string }> = []
  if (spotifyTrackId) {
    songLinks.push({
      label: 'Spotify',
      url: `https://open.spotify.com/track/${spotifyTrackId}`,
    })
  }

  const leaderboard: LeaderboardEntry[] = []

  return (
    <SongPage
      songTitle={songTitle}
      artist={artist}
      artworkUrl={artworkUrl}
      songLinks={songLinks}
      lyricsLinks={[]}
      onBack={() => navigate(-1)}
      onPlay={() => navigate(`/song/${spotifyTrackId}/play`)}
      onArtistClick={
        metadata?.artistLensHandle
          ? () => navigate(`/u/${metadata.artistLensHandle}`)
          : undefined
      }
      videos={videos}
      isLoadingVideos={isLoadingVideos}
      onVideoClick={(video) => {
        navigate(`/u/${video.username}/video/${video.id}?from=song&spotifyTrackId=${spotifyTrackId}`)
      }}
      leaderboardEntries={leaderboard}
      currentUser={undefined}
      onStudy={() => navigate(`/song/${spotifyTrackId}/study`)}
      onKaraoke={() => navigate(`/song/${spotifyTrackId}/karaoke`)}
    />
  )
}
