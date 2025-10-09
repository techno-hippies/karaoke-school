/**
 * Song Select Step
 * Wrapper for SongSelectPage with search integration
 */

import { useState } from 'react'
import { SongSelectPage } from '@/components/karaoke/SongSelectPage'
import { AuthDialog } from '@/components/layout/AuthDialog'
import { useAuth } from '@/contexts/AuthContext'
import { executeSearch } from '@/lib/lit/actions'
import type { PostFlowContext, Song } from '../types'

interface SongSelectStepProps {
  flow: PostFlowContext
}

export function SongSelectStep({ flow }: SongSelectStepProps) {
  const [trendingSongs] = useState<Song[]>([])
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [pendingSong, setPendingSong] = useState<Song | null>(null)
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)

  const {
    isWalletConnected,
    hasLensAccount,
    litReady,
    walletClient,
    connectWallet,
    loginLens,
  } = useAuth()

  // TODO: Load trending songs from GraphQL (public, no auth required)
  // useEffect(() => {
  //   const loadTrending = async () => {
  //     const { data } = await lensClient.query({
  //       query: GET_TRENDING_POSTS,
  //       variables: { orderBy: 'ENGAGEMENT', limit: 20 }
  //     })
  //     setTrendingSongs(data.posts)
  //   }
  //   loadTrending()
  // }, [])
  // Handle search - initializes Lit on-demand
  const handleSearch = async (query: string) => {
    // Check basic auth (wallet + Lens)
    if (!isWalletConnected || !hasLensAccount) {
      setPendingSearch(query)
      setShowAuthDialog(true)
      return
    }

    setIsSearching(true)
    try {
      const result = await executeSearch(query, 20, walletClient || undefined)

      if (result.success && result.results) {
        const songs: Song[] = result.results.map(r => ({
          id: r.genius_id.toString(),
          geniusId: r.genius_id,
          title: r.title,
          artist: r.artist,
          artworkUrl: r.artwork_thumbnail || undefined,
          isProcessed: false,
          isFree: false,
        }))
        setSearchResults(songs)
      } else {
        console.error('[Search] Failed:', result.error)
        setSearchResults([])
      }
    } catch (error) {
      console.error('[Search] Error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSongClick = (song: Song) => {
    // Check auth before allowing song selection
    if (!isWalletConnected || !hasLensAccount) {
      setPendingSong(song)
      setShowAuthDialog(true)
      return
    }

    // Auth complete - proceed with flow
    if (song.isFree) {
      // Free songs skip to recording
      if (song.segments && song.segments.length > 0) {
        flow.goToRecording(song, song.segments[0])
      }
      return
    }

    if (song.isProcessed && song.segments) {
      // Processed songs go to segment picker
      flow.goToSegmentPicker(song)
    } else {
      // Unprocessed songs need generation
      flow.goToGenerateKaraoke(song)
    }
  }

  // Handle auth completion - retry pending actions
  const handleAuthComplete = () => {
    setShowAuthDialog(false)
    if (isWalletConnected && hasLensAccount) {
      // Retry pending search
      if (pendingSearch) {
        handleSearch(pendingSearch)
        setPendingSearch(null)
      }
      // Retry pending song selection
      if (pendingSong) {
        handleSongClick(pendingSong)
        setPendingSong(null)
      }
    }
  }

  return (
    <>
      <SongSelectPage
        open={true}
        onClose={flow.cancel}
        trendingSongs={trendingSongs}
        favoriteSongs={[]} // TODO: Add favorites support
        searchResults={searchResults}
        isSearching={isSearching}
        onSearch={handleSearch}
        userCredits={flow.auth.credits}
        onSelectSong={(song, segment) => {
          if (!isWalletConnected || !hasLensAccount) {
            setPendingSong(song)
            setShowAuthDialog(true)
            return
          }
          flow.goToRecording(song, segment)
        }}
        onConfirmCredit={(song, segment) => {
          flow.unlockSegment(song, segment)
        }}
        onGenerateKaraoke={async (song) => {
          if (!isWalletConnected || !hasLensAccount) {
            setPendingSong(song)
            setShowAuthDialog(true)
            return
          }
          // Trigger generation in background - don't transition flow state
          // The drawer shows loading state while we process
          await flow.generateKaraoke(song)
        }}
        onPurchaseCredits={() => {
          flow.goToPurchaseCredits()
        }}
      />

      <AuthDialog
        open={showAuthDialog}
        onOpenChange={(open) => {
          setShowAuthDialog(open)
          if (!open) {
            setPendingSong(null)
            setPendingSearch(null)
          }
          if (open && isWalletConnected && hasLensAccount) {
            handleAuthComplete()
          }
        }}
        isWalletConnected={isWalletConnected}
        hasLensAccount={hasLensAccount}
        isLitReady={litReady}
        onConnectWallet={connectWallet}
        onLoginLens={loginLens}
      />
    </>
  )
}
