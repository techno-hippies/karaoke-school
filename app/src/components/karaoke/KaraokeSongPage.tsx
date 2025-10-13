import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { SongPage } from '@/components/class/SongPage'
import { useAuth } from '@/contexts/AuthContext'
import { useSongData } from '@/hooks/useSongData'
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
  const { isPKPReady, pkpAuthContext } = useAuth()
  const [isUnlocking, setIsUnlocking] = useState(false)

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

  // TODO: Load leaderboard entries from contract
  // TODO: Check credit balance
  // TODO: Trigger audio processing + base alignment after unlock

  const handleSegmentClick = (segment: any) => {
    navigate(`/karaoke/song/${geniusId}/segment/${segment.id}`)
  }

  const handleUnlock = async () => {
    console.log('[Unlock] Starting unlock flow...', { isPKPReady, hasAuthContext: !!pkpAuthContext, geniusId })

    if (!isPKPReady || !pkpAuthContext || !geniusId) {
      console.error('[Unlock] Missing auth or geniusId', { isPKPReady, hasAuthContext: !!pkpAuthContext, geniusId })
      return
    }

    try {
      setIsUnlocking(true)

      // Execute match-and-segment-v7 (3-4 seconds)
      // Uses system PKP hardcoded in Lit Action (not user's PKP)
      console.log('[Unlock] Executing match-and-segment for genius ID:', geniusId)

      const { executeMatchAndSegment } = await import('@/lib/lit/actions')
      const result = await executeMatchAndSegment(
        parseInt(geniusId),
        pkpAuthContext
      )

      console.log('[Unlock] Match & Segment result:', {
        success: result.success,
        isMatch: result.isMatch,
        sectionsCount: result.sections?.length,
        txHash: result.txHash,
        error: result.error
      })

      if (result.success && result.isMatch && result.sections) {
        console.log('[Unlock] ✅ Match & Segment complete:', result.sections.length, 'sections')
        console.log('[Unlock] Sections:', result.sections)

        // Wait for transaction to be mined if txHash exists
        if (result.txHash) {
          console.log('[Unlock] ⏳ Waiting for transaction to be mined:', result.txHash)
          const { waitForTransactionReceipt } = await import('viem/actions')
          const { publicClient } = await import('@/config/contracts')

          const receipt = await waitForTransactionReceipt(publicClient, {
            hash: result.txHash as `0x${string}`,
            confirmations: 1
          })
          console.log('[Unlock] ✅ Transaction confirmed!', { blockNumber: receipt.blockNumber, status: receipt.status })
        } else {
          console.warn('[Unlock] ⚠️ No txHash returned - contract write may have failed')
        }

        // Reload song data to get updated segments from contract
        console.log('[Unlock] Refetching song data from contract...')
        await refetch()
        console.log('[Unlock] Refetch complete - song should now show segments')

        // Stay on song page - user can click segments to practice
        // TODO: Trigger base-alignment + audio-processor in parallel
      } else {
        console.error('[Unlock] ❌ Match & Segment failed:', {
          success: result.success,
          isMatch: result.isMatch,
          error: result.error,
          contractError: result.contractError
        })
      }
    } catch (err) {
      console.error('[Unlock] ❌ Error during unlock:', err)
    } finally {
      setIsUnlocking(false)
    }
  }

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

  // Construct external links from song metadata
  const externalSongLinks = buildExternalSongLinks({
    geniusId: displaySong.geniusId,
    title: displaySong.title,
    artist: displaySong.artist,
    soundcloudPermalink: displaySong.soundcloudPermalink,
  })

  const externalLyricsLinks = buildExternalLyricsLinks({
    geniusId: displaySong.geniusId,
    title: displaySong.title,
    artist: displaySong.artist,
  })

  console.log('[KaraokeSongPage] Rendering SongPage:', {
    songTitle: displaySong.title,
    isFree: displaySong.isFree,
    segmentsLength: segments.length,
    isUnlocking,
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
      isUnlocking={isUnlocking}
      onBack={() => navigate('/karaoke')}
      onPlay={() => console.log('Play')} // TODO: Open external links sheet
      onSelectSegment={handleSegmentClick}
      onUnlockAll={handleUnlock}
      isAuthenticated={isPKPReady}
    />
  )
}
