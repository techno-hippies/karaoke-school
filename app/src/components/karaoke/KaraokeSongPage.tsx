import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { SongPage } from '@/components/class/SongPage'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import { useSongData } from '@/hooks/useSongData'
import { useUnlockFlow } from '@/hooks/useUnlockFlow'
import { buildExternalSongLinks, buildExternalLyricsLinks } from '@/lib/karaoke/externalLinks'
import type { Song } from '@/features/post-flow/types'

/**
 * KaraokeSongPage - Container for individual song detail page
 *
 * Responsibilities:
 * - Load song data from contract (if processed) or navigation state (if unprocessed)
 * - Construct external links for song and lyrics
 * - Handle unlock flow (match-and-segment-v6)
 * - Navigate to first segment after unlock
 *
 * Renders: <SongPage /> from /components/class/SongPage.tsx
 */
export function KaraokeSongPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { geniusId } = useParams<{ geniusId: string }>()
  const { isPKPReady, pkpAuthContext, pkpAddress } = useAuth()
  const { credits } = useCredits()

  // Fetch song metadata from Genius as fallback (for direct URL navigation)
  const [isFetchingSong, setIsFetchingSong] = useState(false)
  const [fetchedSong, setFetchedSong] = useState<Song | null>(null)

  // Get song from navigation state (for unprocessed songs from search)
  const songFromState = location.state?.song as Song | undefined

  // Load from contract (will return null for unprocessed songs)
  const { song: songFromContract, segments, isLoading, error, refetch } = useSongData(geniusId ? parseInt(geniusId) : undefined)

  // Merge song data: contract data (with segments) + state data (with artwork)
  const song = songFromContract ? {
    ...songFromContract,
    // Preserve artwork from state data if contract doesn't have it
    artworkUrl: songFromContract.artworkUrl || songFromState?.artworkUrl || fetchedSong?.artworkUrl
  } : songFromState
  const isProcessed = !!songFromContract
  const displaySong = song || fetchedSong

  // Fetch song metadata from Genius if no song data available
  useEffect(() => {
    if (!song && geniusId && isPKPReady && pkpAuthContext && !isFetchingSong && !fetchedSong) {
      setIsFetchingSong(true)
      const fetchSongMetadata = async () => {
        console.log('[KaraokeSongPage] Fetching song metadata from Genius for ID:', geniusId)
        const { executeSongMetadata } = await import('@/lib/lit/actions')
        const result = await executeSongMetadata(parseInt(geniusId), pkpAuthContext)

        if (result.success && result.song) {
          console.log('[KaraokeSongPage] ✅ Fetched song metadata:', result.song.title)
          setFetchedSong({
            id: geniusId,
            geniusId: parseInt(geniusId),
            title: result.song.title,
            artist: result.song.artist,
            artworkUrl: result.song.song_art_image_thumbnail_url,
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
  }, [song, geniusId, isPKPReady, pkpAuthContext, isFetchingSong, fetchedSong])

  console.log('[KaraokeSongPage] Song data:', {
    geniusId,
    hasStateData: !!songFromState,
    hasContractData: !!songFromContract,
    isProcessed,
    title: song?.title
  })

  // Initialize unlock flow state machine (memoized to prevent re-renders)
  const unlockFlowInput = useMemo(() => ({
    geniusId: displaySong?.geniusId || parseInt(geniusId || '0'),
    pkpAuthContext: pkpAuthContext || null,
    pkpAddress: pkpAddress || null,
    artist: displaySong?.artist || '',
    title: displaySong?.title || '',
    creditBalance: credits,
    isAlreadyCataloged: isProcessed,
    isFree: displaySong?.isFree || false,
    // Pre-populate segments if already cataloged
    sections: segments.length > 0 ? segments.map(s => ({
      type: s.displayName,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration
    })) : null,
    soundcloudPermalink: displaySong?.soundcloudPermalink || null,
    songDuration: segments.length > 0 ? Math.max(...segments.map(s => s.endTime)) : null,
    hasFullAudio: null, // Will be set by machine after catalog
  }), [displaySong?.geniusId, displaySong?.artist, displaySong?.title, displaySong?.soundcloudPermalink, displaySong?.isFree, geniusId, credits, segments, isProcessed])

  const unlockFlow = useUnlockFlow(unlockFlowInput)

  const handleSegmentClick = useCallback((segment: any) => {
    navigate(`/karaoke/song/${geniusId}/segment/${segment.id}`)
  }, [navigate, geniusId])

  // Update machine auth context when it becomes available
  useEffect(() => {
    if (pkpAuthContext && pkpAddress) {
      console.log('[KaraokeSongPage] Updating machine auth context...')
      unlockFlow.updateAuth(pkpAuthContext, pkpAddress)
    }
  }, [pkpAuthContext, pkpAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update machine credit balance when it changes
  useEffect(() => {
    unlockFlow.updateCredits(credits)
  }, [credits]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-catalog: Start machine on mount if song not already cataloged
  useEffect(() => {
    if (!isProcessed && displaySong && isPKPReady && pkpAuthContext && unlockFlow.isIdle) {
      console.log('[Catalog] Starting auto-catalog via XState machine...')
      unlockFlow.startAutoCatalog()
    }
  }, [isProcessed, displaySong, isPKPReady, pkpAuthContext, unlockFlow.isIdle]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlock = useCallback(() => {
    console.log('[Unlock] Starting unlock flow via XState...', { isPKPReady, hasAuthContext: !!pkpAuthContext, geniusId })

    if (!isPKPReady || !pkpAuthContext || !geniusId) {
      console.error('[Unlock] Missing auth or geniusId', { isPKPReady, hasAuthContext: !!pkpAuthContext, geniusId })
      return
    }

    unlockFlow.startUnlock()
  }, [isPKPReady, pkpAuthContext, geniusId, unlockFlow])

  // Refetch song data when catalog completes (only once per song)
  const hasRefetchedRef = useRef(false)
  const prevGeniusIdRef = useRef(geniusId)

  // Reset refetch flag when song changes
  useEffect(() => {
    if (prevGeniusIdRef.current !== geniusId) {
      hasRefetchedRef.current = false
      prevGeniusIdRef.current = geniusId
    }
  }, [geniusId])

  useEffect(() => {
    if (unlockFlow.hasCatalogCompleted && !hasRefetchedRef.current) {
      console.log('[Catalog] ✅ Catalog complete! Refetching song data...')
      hasRefetchedRef.current = true

      // Retry refetch until song appears in contract (up to 5 attempts)
      let attempts = 0
      const maxAttempts = 5
      const retryInterval = 2000

      const tryRefetch = async () => {
        attempts++
        console.log(`[Catalog] Refetch attempt ${attempts}/${maxAttempts}`)
        await refetch()

        // Check if we got segments
        if (segments.length === 0 && attempts < maxAttempts) {
          console.log('[Catalog] No segments yet, retrying...')
          setTimeout(tryRefetch, retryInterval)
        } else if (segments.length > 0) {
          console.log(`[Catalog] ✅ Loaded ${segments.length} segments!`)
        } else {
          console.warn('[Catalog] ⚠️ Max refetch attempts reached, segments not loaded')
        }
      }

      setTimeout(tryRefetch, retryInterval)
    }
  }, [unlockFlow.hasCatalogCompleted, refetch, segments.length])

  // Construct external links from song metadata (memoized to prevent re-renders)
  // MUST be before early returns to satisfy Rules of Hooks
  const externalSongLinks = useMemo(() => {
    if (!displaySong) return []
    return buildExternalSongLinks({
      geniusId: displaySong.geniusId,
      title: displaySong.title,
      artist: displaySong.artist,
      soundcloudPermalink: displaySong.soundcloudPermalink,
    })
  }, [displaySong])

  const externalLyricsLinks = useMemo(() => {
    if (!displaySong) return []
    return buildExternalLyricsLinks({
      geniusId: displaySong.geniusId,
      title: displaySong.title,
      artist: displaySong.artist,
    })
  }, [displaySong])

  // Show loading state only if we're loading and don't have state data
  if (isLoading && !songFromState && !fetchedSong) {
    return (
      <SongPage
        songTitle="Loading..."
        artist="Loading..."
        leaderboardEntries={[]}
        segments={[]}
        onBack={() => navigate('/karaoke')}
        onPlay={() => console.log('Play')}
      />
    )
  }

  // Show loading while fetching song metadata
  if (!displaySong && geniusId && (isFetchingSong || isPKPReady)) {
    return (
      <SongPage
        songTitle={isFetchingSong ? "Loading..." : `Song ${geniusId}`}
        artist="Loading..."
        leaderboardEntries={[]}
        segments={[]}
        onBack={() => navigate('/karaoke')}
        isAuthenticated={isPKPReady}
      />
    )
  }

  // If no song data at all, show error
  if (!displaySong) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Song Not Found</h1>
          <p className="text-muted-foreground mb-4">
            {error?.message || 'This song could not be loaded. Try searching again.'}
          </p>
          <button
            onClick={() => navigate('/karaoke')}
            className="text-primary hover:underline"
          >
            Back to Search
          </button>
        </div>
      </div>
    )
  }

  console.log('[KaraokeSongPage] Rendering SongPage:', {
    songTitle: displaySong.title,
    isFree: displaySong.isFree,
    segmentsLength: segments.length,
    machineState: unlockFlow.state.value,
    isCataloging: unlockFlow.isCataloging,
    isUnlocking: unlockFlow.isUnlocking,
    isAuthenticated: isPKPReady,
    soundcloudPermalink: displaySong.soundcloudPermalink,
    externalSongLinksCount: externalSongLinks.length,
    externalLyricsLinksCount: externalLyricsLinks.length,
  })

  if (externalSongLinks.length > 0) {
    console.log('[KaraokeSongPage] External song links:', externalSongLinks)
  }
  if (externalLyricsLinks.length > 0) {
    console.log('[KaraokeSongPage] External lyrics links:', externalLyricsLinks)
  }

  return (
    <SongPage
      songTitle={displaySong.title}
      artist={displaySong.artist}
      artworkUrl={displaySong.artworkUrl}
      isExternal={true}
      externalSongLinks={externalSongLinks}
      externalLyricsLinks={externalLyricsLinks}
      leaderboardEntries={[]} // TODO: Load from contract
      segments={segments}
      isFree={displaySong.isFree || false}
      isUnlocking={unlockFlow.isCataloging}
      isProcessing={unlockFlow.isProcessing}
      catalogError={unlockFlow.catalogError}
      hasFullAudio={unlockFlow.hasFullAudio}
      onBack={() => navigate('/karaoke')}
      onPlay={() => console.log('Play')} // TODO: Open external links sheet
      onSelectSegment={handleSegmentClick}
      onUnlockAll={handleUnlock}
      isAuthenticated={isPKPReady}
    />
  )
}
