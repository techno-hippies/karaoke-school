/**
 * Song Select Step
 * Wrapper for SongSelectPage with search integration
 */

import { useState, useEffect } from 'react'
import { SongSelectPage } from '@/components/karaoke/SongSelectPage'
import { AuthDialog } from '@/components/layout/AuthDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useContractSongs } from '@/hooks/useContractSongs'
import { executeSearch } from '@/lib/lit/actions'
import type { PostFlowContext, Song } from '../types'

interface SongSelectStepProps {
  flow: PostFlowContext
}

export function SongSelectStep({ flow }: SongSelectStepProps) {
  // Load songs from KaraokeCatalogV1 contract on Base Sepolia
  const { songs: trendingSongs, isLoading: isTrendingLoading } = useContractSongs()
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [pendingSong, setPendingSong] = useState<Song | null>(null)
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)

  const {
    isPKPReady,
    hasLensAccount,
    pkpAuthContext,
    isAuthenticating,
    authStep,
    authMode,
    authStatus,
    authError,
    registerWithPasskey,
    signInWithPasskey,
    loginLens,
  } = useAuth()

  // Auto-close dialog and retry pending actions when auth completes
  useEffect(() => {
    console.log('[SongSelectStep] useEffect auth check:', {
      showAuthDialog,
      isPKPReady,
      hasLensAccount,
      isAuthenticating,
      hasPending: !!pendingSearch || !!pendingSong,
    })

    if (showAuthDialog && isPKPReady && hasLensAccount && !isAuthenticating) {
      console.log('[SongSelectStep] Auth complete - closing dialog and retrying pending actions')
      // Auth is complete - close dialog and retry pending actions
      setShowAuthDialog(false)

      // Retry pending search
      if (pendingSearch) {
        console.log('[SongSelectStep] Retrying pending search:', pendingSearch)
        handleSearch(pendingSearch)
        setPendingSearch(null)
      }

      // Retry pending song selection
      if (pendingSong) {
        console.log('[SongSelectStep] Retrying pending song:', pendingSong.title)
        handleSongClick(pendingSong)
        setPendingSong(null)
      }
    }
  }, [showAuthDialog, isPKPReady, hasLensAccount, isAuthenticating, pendingSearch, pendingSong])

  // Handle search - initializes Lit on-demand
  const handleSearch = async (query: string) => {
    console.log('[SongSelectStep] handleSearch:', {
      query,
      isPKPReady,
      hasLensAccount,
      pkpAuthContext: !!pkpAuthContext,
    })

    // Check basic auth (wallet + Lens)
    if (!isPKPReady || !hasLensAccount || !pkpAuthContext) {
      console.log('[SongSelectStep] Opening auth dialog - auth not ready for search')
      setPendingSearch(query)
      setShowAuthDialog(true)
      return
    }

    setIsSearching(true)
    try {
      const result = await executeSearch(query, 20, pkpAuthContext)

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
    console.log('[SongSelectStep] handleSongClick:', {
      isPKPReady,
      hasLensAccount,
      pkpAuthContext: !!pkpAuthContext,
      song: song.title,
    })

    // Check auth before allowing song selection
    if (!isPKPReady || !hasLensAccount) {
      console.log('[SongSelectStep] Opening auth dialog - auth not ready')
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
          if (!isPKPReady || !hasLensAccount) {
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
          if (!isPKPReady || !hasLensAccount) {
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
        }}
        currentStep={authStep}
        isAuthenticating={isAuthenticating}
        authMode={authMode}
        statusMessage={authStatus}
        errorMessage={authError?.message || ''}
        isPKPReady={isPKPReady}
        hasSocialAccount={hasLensAccount}
        onRegister={registerWithPasskey}
        onLogin={signInWithPasskey}
        onConnectSocial={loginLens}
      />
    </>
  )
}
