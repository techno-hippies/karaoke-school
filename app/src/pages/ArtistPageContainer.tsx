import { useParams, useNavigate } from 'react-router-dom'
import { ArtistPage, type ArtistSong } from '@/components/profile/ArtistPage'
import { useGeniusIdByLensHandle, useArtist } from '@/hooks/useArtistRegistry'
import { useArtistSongs } from '@/hooks/useArtistSongs'
import { Spinner } from '@/components/ui/spinner'

export function ArtistPageContainer() {
  const { lenshandle } = useParams<{ lenshandle: string }>()
  const navigate = useNavigate()

  // Step 1: Get Genius ID from Lens handle
  const { data: geniusId, isLoading: isLoadingGeniusId, error: geniusIdError } = useGeniusIdByLensHandle(lenshandle)

  // Step 2: Get artist data (only runs when we have geniusId)
  const { data: artistData, isLoading: isLoadingArtist, error: artistError } = useArtist(
    geniusId ? Number(geniusId) : undefined
  )

  // Step 3: Get artist's songs (only runs when we have geniusId)
  const { data: songsData, isLoading: isLoadingSongs } = useArtistSongs(
    geniusId ? Number(geniusId) : undefined
  )

  // Loading state
  if (isLoadingGeniusId || isLoadingArtist) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Error states
  if (geniusIdError || !geniusId || geniusId === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Artist not found</h1>
        <p className="text-muted-foreground text-center">
          No artist found with handle @{lenshandle}
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

  if (artistError || !artistData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Error loading artist</h1>
        <p className="text-muted-foreground text-center">
          Failed to load artist data
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

  // Transform contract data to component props
  const artist = artistData as any // Type assertion for now

  // Safely transform songs data
  const songs: ArtistSong[] = Array.isArray(songsData)
    ? (songsData as any[]).map((song: any) => ({
        id: song.geniusId.toString(),
        title: song.title,
        artist: song.artist,
        artworkUrl: song.coverUri || undefined, // TODO: Convert grove:// URI to HTTP URL
        onSongClick: () => navigate(`/song/${song.geniusId}`),
      }))
    : []

  return (
    <ArtistPage
      username={artist.lensHandle}
      displayName={artist.lensHandle} // TODO: Fetch from Lens Account Metadata
      avatarUrl={`https://placebear.com/300/300?random=${artist.geniusArtistId}`} // TODO: Fetch from Lens Account Metadata
      isVerified={artist.verified}
      isOwnProfile={false} // TODO: Check if connected wallet matches PKP
      isFollowing={false} // TODO: Implement following
      videos={[]} // TODO: Fetch from Lens posts
      songs={songs}
      topStudents={[]} // TODO: Fetch from LeaderboardV1 when deployed
      currentUser={undefined} // TODO: Fetch current user rank
      onBack={() => navigate(-1)}
      onFollow={() => console.log('Follow clicked')} // TODO: Implement following
      onEditProfile={() => console.log('Edit profile clicked')} // TODO: Implement profile editing
    />
  )
}
