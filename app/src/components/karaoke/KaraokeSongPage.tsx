import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { SongPage } from '@/components/class/SongPage'
import { CreditFlowDialog } from '@/components/karaoke/CreditFlowDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import { useSongData } from '@/hooks/useSongData'
import { useCatalogSong } from '@/hooks/useCatalogSong'
import { useUnlockSong, InsufficientCreditsError } from '@/hooks/useUnlockSong'
import { buildExternalSongLinks, buildExternalLyricsLinks } from '@/lib/karaoke/externalLinks'
import { getArtistRoute } from '@/lib/genius/artist-mapping'
import type { Song } from '@/features/post-flow/types'

/**
 * KaraokeSongPage - Container for individual song detail page
 *
 * Simplified Flow:
 * 1. Page Load (if authenticated) → Auto-catalog (match-and-segment, FREE)
 *    - Shows skeleton → segments with lock icons
 * 2. User clicks "Unlock" → Run base-alignment (PAID, requires credits)
 *    - If no credits → Show CreditFlowDialog
 *    - If success → Segments become clickable (locks removed)
 *
 * Renders: <SongPage /> from /components/class/SongPage.tsx
 */
export function KaraokeSongPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { geniusId } = useParams<{ geniusId: string }>()
  const { isPKPReady, pkpAuthContext, pkpInfo, pkpAddress } = useAuth()
  const { credits, loadCredits } = useCredits()

  // Fetch song metadata from Genius as fallback (for direct URL navigation)
  const [isFetchingSong, setIsFetchingSong] = useState(false)
  const [fetchedSong, setFetchedSong] = useState<Song | null>(null)

  // Get song from navigation state (for unprocessed songs from search)
  const songFromState = location.state?.song as Song | undefined

  // Load from contract (will return null for unprocessed songs)
  const { song: songFromContract, segments, isLoading, error, refetch } = useSongData(
    geniusId ? parseInt(geniusId) : undefined,
    pkpAddress || undefined
  )

  // Merge song data: contract (artwork, segments) + state (fallback) + Genius (artistId for navigation)
  // Use stable keys to prevent re-renders
  const song = useMemo(() => {
    if (!songFromContract) return songFromState
    return {
      ...songFromContract,
      artworkUrl: songFromContract.artworkUrl || songFromState?.artworkUrl, // Artwork from contract (Grove) preferred
      geniusArtistId: fetchedSong?.geniusArtistId || songFromState?.geniusArtistId
    }
  }, [
    songFromContract?.id,
    songFromContract?.artworkUrl,
    songFromContract?.hasBaseAlignment,
    songFromContract?.isOwned,
    songFromState?.id,
    songFromState?.artworkUrl,
    songFromState?.geniusArtistId,
    fetchedSong?.artworkUrl,
    fetchedSong?.geniusArtistId
  ])

  const isProcessed = !!songFromContract
  const displaySong = useMemo(() =>
    song || fetchedSong,
    [song?.id, song?.artworkUrl, song?.hasBaseAlignment, song?.isOwned, song?.geniusArtistId, fetchedSong?.id, fetchedSong?.geniusArtistId]
  )

  // Fetch song metadata from Genius for artistId and external links (only if not in contract)
  // NOTE: Artwork now comes from contract (coverUri/thumbnailUri)
  useEffect(() => {
    if (geniusId && isPKPReady && pkpAuthContext && !isFetchingSong && !fetchedSong) {
      setIsFetchingSong(true)
      const fetchSongMetadata = async () => {
        console.log('[KaraokeSongPage] Fetching artist ID and external links from Genius:', geniusId)
        const { executeSongMetadata } = await import('@/lib/lit/actions')
        const result = await executeSongMetadata(parseInt(geniusId), pkpAuthContext)

        if (result.success && result.song) {
          console.log('[KaraokeSongPage] ✅ Fetched metadata:', result.song.title, `(artistId: ${result.song.artist_id})`)
          setFetchedSong({
            id: geniusId,
            geniusId: parseInt(geniusId),
            geniusArtistId: result.song.artist_id,
            title: result.song.title,
            artist: result.song.artist,
            artworkUrl: result.song.song_art_image_thumbnail_url, // Fallback only, contract preferred
            isProcessed: false,
            isFree: false,
            segments: [],
            soundcloudPermalink: result.song.soundcloud_url || undefined,
            youtubeUrl: result.song.youtube_url || undefined,
            spotifyUuid: result.song.spotify_uuid || undefined,
            appleMusicId: result.song.apple_music_id || undefined,
            appleMusicPlayerUrl: result.song.apple_music_player_url || undefined,
          })
        } else {
          console.error('[KaraokeSongPage] ❌ Failed to fetch song metadata:', result.error)
        }
        setIsFetchingSong(false)
      }
      fetchSongMetadata()
    }
  }, [geniusId, isPKPReady, pkpAuthContext, isFetchingSong, fetchedSong])

  // Initialize catalog and unlock hooks
  const catalog = useCatalogSong({
    geniusId: displaySong?.geniusId || parseInt(geniusId || '0'),
    pkpAuthContext: pkpAuthContext || null,
    artist: displaySong?.artist || '',
    title: displaySong?.title || '',
  })

  const unlock = useUnlockSong({
    geniusId: displaySong?.geniusId || parseInt(geniusId || '0'),
    pkpAuthContext: pkpAuthContext || null,
    pkpInfo: pkpInfo || null,
    isFree: displaySong?.isFree || false,
    isOwned: displaySong?.isOwned || false,
  })

  // Credit dialog state
  const [showCreditDialog, setShowCreditDialog] = useState(false)
  const [usdcBalance, setUsdcBalance] = useState('0.00')
  const [isPurchasingCredits, setIsPurchasingCredits] = useState(false)

  // Track base-alignment success in this session (for immediate UI update)
  const [baseAlignmentComplete, setBaseAlignmentComplete] = useState(false)

  // Auto-catalog: Run match-and-segment on page load (if authenticated and not already cataloged)
  const hasStartedAutoCatalogRef = useRef(false)

  useEffect(() => {
    // Wait for displaySong (from metadata fetch) then auto-catalog in background
    if (displaySong && isPKPReady && pkpAuthContext && !hasStartedAutoCatalogRef.current && !isProcessed) {
      console.log('[KaraokeSongPage] Auto-cataloging song...', { geniusId })
      hasStartedAutoCatalogRef.current = true
      catalog.catalogSong()
    }
  }, [displaySong, isPKPReady, pkpAuthContext, isProcessed, geniusId, catalog.catalogSong])

  // Reset auto-catalog flag and base-alignment flag when song changes
  useEffect(() => {
    hasStartedAutoCatalogRef.current = false
    setBaseAlignmentComplete(false)
  }, [geniusId])

  // Refetch song data after catalog completes
  const hasRefetchedRef = useRef(false)
  const prevGeniusIdRef = useRef(geniusId)
  const segmentsRef = useRef(segments)

  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  useEffect(() => {
    if (prevGeniusIdRef.current !== geniusId) {
      hasRefetchedRef.current = false
      prevGeniusIdRef.current = geniusId
    }
  }, [geniusId])

  useEffect(() => {
    if (catalog.result?.success && !hasRefetchedRef.current && !catalog.isCataloging) {
      console.log('[KaraokeSongPage] ✅ Catalog complete! Refetching song data...')
      hasRefetchedRef.current = true

      // Retry refetch until song appears in contract (up to 5 attempts)
      let attempts = 0
      const maxAttempts = 5
      const retryInterval = 2000
      let timeoutId: NodeJS.Timeout | null = null

      const tryRefetch = async () => {
        attempts++
        console.log(`[KaraokeSongPage] Refetch attempt ${attempts}/${maxAttempts}`)
        await refetch()

        const currentSegments = segmentsRef.current
        if (currentSegments.length === 0 && attempts < maxAttempts) {
          console.log('[KaraokeSongPage] No segments yet, retrying...')
          timeoutId = setTimeout(tryRefetch, retryInterval)
        } else if (currentSegments.length > 0) {
          console.log(`[KaraokeSongPage] ✅ Loaded ${currentSegments.length} segments!`)
        } else {
          console.warn('[KaraokeSongPage] ⚠️ Max refetch attempts reached, segments not loaded')
        }
      }

      timeoutId = setTimeout(tryRefetch, retryInterval)

      return () => {
        if (timeoutId) clearTimeout(timeoutId)
      }
    }
  }, [catalog.result, catalog.isCataloging, refetch])

  // Handle unlock button click
  const handleUnlock = useCallback(async () => {
    console.log('[KaraokeSongPage] Unlock button clicked', { isPKPReady, hasAuthContext: !!pkpAuthContext, geniusId })

    if (!isPKPReady || !pkpAuthContext || !geniusId) {
      console.error('[KaraokeSongPage] Missing auth or geniusId', { isPKPReady, hasAuthContext: !!pkpAuthContext, geniusId })
      return
    }

    // Only check credits if song is not already owned (retrying base-alignment is free)
    if (!displaySong?.isOwned) {
      console.log('[KaraokeSongPage] Checking credits...', { credits })
      if (credits < 1) {
        console.log('[KaraokeSongPage] Insufficient credits, showing dialog')
        // Load USDC balance
        const { getUSDCBalance } = await import('@/lib/credits/queries')
        const balance = await getUSDCBalance(pkpAddress || '')
        setUsdcBalance(balance)
        setShowCreditDialog(true)
        return
      }
    } else {
      console.log('[KaraokeSongPage] Song already owned, retrying base-alignment for free')
    }

    // Proceed with unlock transaction
    try {
      const result = await unlock.unlockSong()

      if (!result.success) {
        console.error('[KaraokeSongPage] ❌ Unlock failed:', result.error)
        // TODO: Show error toast/message to user
        return
      }

      // Success! Refetch song data to get updated hasBaseAlignment flag
      console.log('[KaraokeSongPage] ✅ Unlock successful! Refetching song data...')
      setBaseAlignmentComplete(true) // Base-alignment runs as part of unlock
      setTimeout(() => refetch(), 2000)

    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        // Contract disagreed with our cached credits, refresh and show dialog
        console.log('[KaraokeSongPage] Contract reported insufficient credits (cache was stale), refreshing...')
        await loadCredits()
        const { getUSDCBalance } = await import('@/lib/credits/queries')
        const balance = await getUSDCBalance(pkpAddress || '')
        setUsdcBalance(balance)
        setShowCreditDialog(true)
      } else {
        console.error('[KaraokeSongPage] ❌ Unlock error:', err)
      }
    }
  }, [isPKPReady, pkpAuthContext, geniusId, unlock.unlockSong, refetch, pkpAddress, displaySong, songFromContract, credits, loadCredits])

  // Memoized handlers to prevent re-renders
  const handleBack = useCallback(() => navigate(-1), [navigate])
  const handlePlay = useCallback(() => console.log('Play'), [])
  const handleSegmentClick = useCallback((segment: any) => {
    navigate(`/song/${geniusId}/segment/${segment.id}`)
  }, [navigate, geniusId])
  const handleArtistClick = useCallback(() => {
    if (displaySong?.geniusArtistId) {
      // Use smart routing: /u/:username for PKP artists, /artist/:id for others
      navigate(getArtistRoute(displaySong.geniusArtistId))
    }
  }, [navigate, displaySong?.geniusArtistId])

  // Handle credit purchase
  const handlePurchaseCredits = useCallback(async (packageId: number) => {
    console.log('[KaraokeSongPage] Purchasing credits, package ID:', packageId)
    setIsPurchasingCredits(true)

    try {
      const { purchaseCredits } = await import('@/lib/credits/purchase')
      await purchaseCredits({
        packageId,
        pkpAuthContext: pkpAuthContext!,
        pkpInfo: pkpInfo!,
      })
      console.log('[KaraokeSongPage] ✅ Credits purchased!')

      // Refresh credits (purchase function already waited for confirmation + indexing)
      await loadCredits()

      // Give a moment for state to propagate
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Now proceed with unlock WITHOUT closing dialog first
      // This way dialog stays open during entire flow
      console.log('[KaraokeSongPage] Proceeding with unlock after purchase...')

      // Re-check credits directly from context
      // Note: Credits are updated in context by loadCredits above
      if (!displaySong?.isOwned && !songFromContract?.hasBaseAlignment) {
        try {
          const result = await unlock.unlockSong()

          if (result.success) {
            console.log('[KaraokeSongPage] ✅ Unlock successful after purchase!')
            setBaseAlignmentComplete(true)
            setShowCreditDialog(false) // Close on success
            setTimeout(() => refetch(), 2000)
          } else {
            console.error('[KaraokeSongPage] ❌ Unlock failed after purchase:', result.error)
            setShowCreditDialog(false)
          }
        } catch (err) {
          console.error('[KaraokeSongPage] ❌ Unlock error after purchase:', err)
          setShowCreditDialog(false)
        }
      } else {
        // Just close if already owned/aligned
        setShowCreditDialog(false)
      }
    } catch (err) {
      console.error('[KaraokeSongPage] ❌ Failed to purchase credits:', err)
      setShowCreditDialog(false)
    } finally {
      setIsPurchasingCredits(false)
    }
  }, [pkpAuthContext, pkpInfo, unlock, loadCredits, displaySong, songFromContract, refetch])

  // Construct external links - memoize based on actual values, not object reference
  const externalSongLinks = useMemo(() => {
    if (!displaySong) return []
    return buildExternalSongLinks({
      geniusId: displaySong.geniusId,
      title: displaySong.title,
      artist: displaySong.artist,
      soundcloudPermalink: displaySong.soundcloudPermalink,
      youtubeUrl: displaySong.youtubeUrl,
      spotifyUuid: displaySong.spotifyUuid,
      appleMusicId: displaySong.appleMusicId,
      appleMusicPlayerUrl: displaySong.appleMusicPlayerUrl,
    })
  }, [
    displaySong?.geniusId,
    displaySong?.title,
    displaySong?.artist,
    displaySong?.soundcloudPermalink,
    displaySong?.youtubeUrl,
    displaySong?.spotifyUuid,
    displaySong?.appleMusicId,
    displaySong?.appleMusicPlayerUrl
  ])

  const externalLyricsLinks = useMemo(() => {
    if (!displaySong) return []
    return buildExternalLyricsLinks({
      geniusId: displaySong.geniusId,
      title: displaySong.title,
      artist: displaySong.artist,
    })
  }, [displaySong?.geniusId, displaySong?.title, displaySong?.artist])

  // Show loading state
  if (isLoading && !songFromState && !fetchedSong) {
    return (
      <SongPage
        songTitle="Loading..."
        artist="Loading..."
        leaderboardEntries={[]}
        segments={[]}
        onBack={handleBack}
        onPlay={handlePlay}
        onArtistClick={handleArtistClick}
      />
    )
  }

  if (!displaySong && geniusId && (isFetchingSong || isPKPReady)) {
    return (
      <SongPage
        songTitle={isFetchingSong ? "Loading..." : `Song ${geniusId}`}
        artist="Loading..."
        leaderboardEntries={[]}
        segments={[]}
        onBack={handleBack}
        onPlay={handlePlay}
        onArtistClick={handleArtistClick}
        isAuthenticated={isPKPReady}
      />
    )
  }

  if (!displaySong) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Song Not Found</h1>
          <p className="text-muted-foreground mb-4">
            {error?.message || 'This song could not be loaded. Try searching again.'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-primary hover:underline"
          >
            Back to Search
          </button>
        </div>
      </div>
    )
  }

  // Log state for debugging
  console.log('[KaraokeSongPage] Render state:', {
    hasSegments: segments.length > 0,
    segmentCount: segments.length,
    hasBaseAlignment: songFromContract?.hasBaseAlignment,
    baseAlignmentComplete,
    isOwned: displaySong.isOwned,
    isLocked: segments.length > 0 && !songFromContract?.hasBaseAlignment && !baseAlignmentComplete
  })

  return (
    <>
      <SongPage
        songTitle={displaySong.title}
        artist={displaySong.artist}
        geniusArtistId={displaySong.geniusArtistId}
        artworkUrl={displaySong.artworkUrl}
        isExternal={true}
        externalSongLinks={externalSongLinks}
        externalLyricsLinks={externalLyricsLinks}
        leaderboardEntries={[]}
        segments={segments}
        isFree={displaySong.isFree || false}
        isOwned={displaySong.isOwned || false}
        isUnlocking={catalog.isCataloging}
        isProcessing={unlock.isUnlocking}
        catalogError={catalog.catalogError || undefined}
        hasFullAudio={catalog.result?.hasFullAudio}
        isLocked={segments.length > 0 && !songFromContract?.hasBaseAlignment && !baseAlignmentComplete}
        onBack={handleBack}
        onPlay={handlePlay}
        onArtistClick={handleArtistClick}
        onSelectSegment={handleSegmentClick}
        onUnlockAll={handleUnlock}
        isAuthenticated={isPKPReady}
      />

      <CreditFlowDialog
        open={showCreditDialog}
        onOpenChange={setShowCreditDialog}
        songTitle={displaySong.title}
        songArtist={displaySong.artist}
        walletAddress={pkpAddress || ''}
        usdcBalance={usdcBalance}
        creditsBalance={credits}
        onPurchaseCredits={handlePurchaseCredits}
        isPurchasing={isPurchasingCredits}
      />
    </>
  )
}
