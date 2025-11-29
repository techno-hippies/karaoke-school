import { useParams, useNavigate } from 'react-router-dom'
import { useArtist } from '@/hooks/useArtist'
import { useArtistLeaderboard } from '@/hooks/useArtistLeaderboard'
import { ArtistPage, type ArtistSong, type StudentEntry } from '@/components/artist/ArtistPage'
import { convertGroveUri } from '@/lib/lens/utils'
import { Spinner } from '@/components/ui/spinner'

/**
 * Artist Page Container
 *
 * Route: /:artistSlug (e.g., /queen, /eminem, /britney-spears)
 *
 * Displays artist info, songs, and student rankings.
 */
export function ArtistPageContainer() {
  const { artistSlug } = useParams<{ artistSlug: string }>()
  const navigate = useNavigate()

  const { data: artist, isLoading, error } = useArtist(artistSlug)

  // Get all spotify track IDs for this artist's songs
  const spotifyTrackIds = artist?.songs.map((s) => s.spotifyTrackId) ?? []

  // Lazy-loaded leaderboard - only fetches when Students tab is clicked
  const {
    leaderboard,
    isLoading: isLoadingLeaderboard,
    hasLoaded: hasLoadedLeaderboard,
    refetch: fetchLeaderboard,
  } = useArtistLeaderboard(spotifyTrackIds)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !artist) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Artist not found</h1>
        <p className="text-muted-foreground text-center">
          No artist found for "{artistSlug}"
        </p>
        <button onClick={() => navigate('/')} className="text-primary hover:underline">
          Go home
        </button>
      </div>
    )
  }

  // Transform songs to ArtistPage format
  const songs: ArtistSong[] = artist.songs.map((song) => {
    const coverUrl = song.coverUri
      ? song.coverUri.startsWith('https://')
        ? song.coverUri
        : convertGroveUri(song.coverUri)
      : undefined

    return {
      id: song.spotifyTrackId,
      title: song.title,
      coverUrl,
      onClick: () => navigate(`/${song.artistSlug}/${song.songSlug}`),
    }
  })

  // Transform leaderboard to StudentEntry format
  const students: StudentEntry[] = leaderboard.map((entry) => ({
    rank: entry.rank,
    username: entry.username,
    score: entry.totalPoints,
    streak: entry.currentStreak,
  }))

  // Only fetch leaderboard when Students tab is clicked (lazy loading)
  const handleStudentsTabClick = () => {
    if (!hasLoadedLeaderboard && !isLoadingLeaderboard) {
      fetchLeaderboard()
    }
  }

  return (
    <ArtistPage
      artistName={artist.name}
      imageUrl={artist.imageUrl}
      songs={songs}
      students={students}
      isLoadingStudents={isLoadingLeaderboard}
      onBack={() => navigate(-1)}
      onStudentsTabClick={handleStudentsTabClick}
    />
  )
}
