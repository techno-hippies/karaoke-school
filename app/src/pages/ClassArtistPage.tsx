/**
 * ClassArtistPage - Container for individual artist detail page
 *
 * Flow:
 * 1. Load artist metadata via Lit Action (Genius API)
 * 2. Display artist info + top 10 songs
 * 3. Navigate to songs when clicked
 */

import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArtistPage, type ArtistSong } from '@/components/class/ArtistPage'
import { useAuth } from '@/contexts/AuthContext'
import { useArtistData } from '@/hooks/useArtistData'

export function ClassArtistPage() {
  const navigate = useNavigate()
  const { geniusArtistId } = useParams<{ geniusArtistId: string }>()
  const { /* isPKPReady, */ pkpAuthContext } = useAuth() // isPKPReady TODO: Use for loading state

  const artistId = geniusArtistId ? parseInt(geniusArtistId) : undefined

  // Fetch artist data via Lit Action
  const { artist, topSongs, isLoading, error } = useArtistData({
    artistId,
    pkpAuthContext,
    includeTopSongs: true
  })

  // Convert top songs to ArtistSong format
  const songs: ArtistSong[] = useMemo(() => {
    if (!topSongs) return []

    return topSongs.map((song) => ({
      id: song.id.toString(),
      title: song.title,
      artist: song.artist_names,
      artworkUrl: song.song_art_image_thumbnail_url,
      onSongClick: () => {
        navigate(`/song/${song.id}`, {
          state: {
            song: {
              id: song.id.toString(),
              geniusId: song.id,
              title: song.title,
              artist: song.artist_names,
              artworkUrl: song.song_art_image_thumbnail_url,
              isProcessed: false
            }
          }
        })
      },
      showPlayButton: false
    }))
  }, [topSongs, navigate])

  const handleBack = () => {
    navigate(-1)
  }

  // Loading state
  if (isLoading || !artist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading artist...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Error</h1>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <ArtistPage
      artistName={artist.name}
      artworkUrl={artist.header_image_url || artist.image_url}
      onBack={handleBack}
      songs={songs}
      leaderboardEntries={[]}
      currentUser={undefined}
      canQuiz={false}
    />
  )
}
