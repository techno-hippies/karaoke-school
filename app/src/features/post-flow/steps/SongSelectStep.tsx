/**
 * Song Select Step
 * Wrapper for SongSelectPage with search integration
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SongSelectPage } from '@/components/karaoke/SongSelectPage'
import { AuthDialog } from '@/components/layout/AuthDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useContractSongs } from '@/hooks/useContractSongs'
import { useUSDCBalance } from '@/hooks/useUSDCBalance'
// import { useCredits } from '../hooks/useCredits' // TODO: Use for credit purchases
import { useAudioProcessingStatus } from '../hooks/useAudioProcessingStatus'
import { executeSearch } from '@/lib/lit/actions'
// import { toast } from 'sonner' // TODO: Use for error notifications
import type { PostFlowContext, Song } from '../types'

interface SongSelectStepProps {
  flow: PostFlowContext
}

const SEARCH_CACHE_KEY = 'karaoke_search_results'
const SEARCH_QUERY_KEY = 'karaoke_search_query'

// Check for cached results synchronously before component renders
function loadCachedResults(urlSearchQuery: string): Song[] | null {
  if (!urlSearchQuery) return null

  const cachedQuery = sessionStorage.getItem(SEARCH_QUERY_KEY)
  const cachedResults = sessionStorage.getItem(SEARCH_CACHE_KEY)

  if (cachedQuery === urlSearchQuery && cachedResults) {
    try {
      return JSON.parse(cachedResults)
    } catch (e) {
      console.error('[SongSelectStep] Failed to parse cached results:', e)
      sessionStorage.removeItem(SEARCH_CACHE_KEY)
      sessionStorage.removeItem(SEARCH_QUERY_KEY)
    }
  }
  return null
}

export function SongSelectStep({ flow }: SongSelectStepProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read URL parameters for persistent state
  const urlSearchQuery = searchParams.get('q') || ''
  const urlActiveTab = (searchParams.get('tab') || 'trending') as 'trending' | 'favorites'

  // Check for cached results synchronously
  const cachedResults = loadCachedResults(urlSearchQuery)

  // Load songs from KaraokeCatalogV1 contract on Base Sepolia
  const { songs: trendingSongs } = useContractSongs()
  // const { songs: trendingSongs, isLoading: isTrendingLoading } = useContractSongs() // TODO: Use isLoading for loading state
  const [isSearching, setIsSearching] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [pendingSong, setPendingSong] = useState<Song | null>(null)
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)

  // Initialize flow data with cached results if available
  useEffect(() => {
    if (cachedResults) {
      console.log('[SongSelectStep] 📦 Using cached search results:', cachedResults.length, 'songs')
      flow.updateData({ searchResults: cachedResults })
    } else if (!urlSearchQuery) {
      // Clear cache if no search query in URL
      sessionStorage.removeItem(SEARCH_CACHE_KEY)
      sessionStorage.removeItem(SEARCH_QUERY_KEY)
    }
  }, [])

  // Poll audio processing status (if job is running)
  const { status: audioProcessingStatus } = useAudioProcessingStatus((flow as any).currentJobId || null)

  const {
    isPKPReady,
    hasLensAccount,
    pkpAuthContext,
    pkpAddress,
    capabilities,
    isAuthenticating,
    authStep,
    authMode,
    authStatus,
    authError,
    registerWithPasskey,
    signInWithPasskey,
    loginLens,
  } = useAuth()

  // Read USDC balance for PKP wallet
  const { balance: usdcBalance } = useUSDCBalance(pkpAddress as `0x${string}` | undefined)

  // Credit purchase - TODO: Implement purchase flow
  // const { purchaseCredits, isPurchasing } = useCredits()

  // Log PKP address and USDC balance for debugging
  useEffect(() => {
    console.log('[SongSelectStep] PKP Address:', pkpAddress)
    console.log('[SongSelectStep] USDC Balance:', usdcBalance)
  }, [pkpAddress, usdcBalance])

  // Log audio processing status changes
  useEffect(() => {
    if (audioProcessingStatus) {
      console.log('[SongSelectStep] Audio processing status:', audioProcessingStatus)

      if (audioProcessingStatus.status === 'complete') {
        console.log('[SongSelectStep] ✅ Audio processing complete!')
        console.log('[SongSelectStep] Segments:', audioProcessingStatus.segmentsCompleted, '/', audioProcessingStatus.segmentsTotal)
        // TODO: Refresh song data from contract to show processed segments
      } else if (audioProcessingStatus.status === 'error') {
        console.error('[SongSelectStep] ❌ Audio processing error:', audioProcessingStatus.error)
      }
    }
  }, [audioProcessingStatus])

  // Auto-close dialog and retry pending actions when auth completes
  useEffect(() => {
    if (showAuthDialog && isPKPReady && hasLensAccount && !isAuthenticating) {
      // Auth is complete - close dialog and retry pending actions
      setShowAuthDialog(false)

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
  }, [showAuthDialog, isPKPReady, hasLensAccount, isAuthenticating, pendingSearch, pendingSong])

  // Handle search - initializes Lit on-demand
  const handleSearch = async (query: string) => {
    // Update URL parameters
    setSearchParams({ q: query, tab: urlActiveTab })

    // Only need PKP for search (no Lens required)
    if (!capabilities.canSearch || !pkpAuthContext) {
      setPendingSearch(query)
      setShowAuthDialog(true)
      return
    }

    setIsSearching(true)
    try {
      const result = await executeSearch(query, 20, pkpAuthContext)

      if (result.success && result.results) {
        // Check contract to see which songs are already processed
        const { createPublicClient, http } = await import('viem')
        const { baseSepolia } = await import('viem/chains')
        const { BASE_SEPOLIA_CONTRACTS } = await import('@/config/contracts')
        const { KARAOKE_CATALOG_ABI } = await import('@/config/abis/karaokeCatalog')

        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        })

        // Check each song in parallel
        const processedChecks = await Promise.all(
          result.results.map(r =>
            publicClient.readContract({
              address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
              abi: KARAOKE_CATALOG_ABI,
              functionName: 'songExistsByGeniusId',
              args: [r.genius_id],
            })
          )
        )

        console.log('[SongSelect] Processed checks:', result.results.map((r, i) => ({
          geniusId: r.genius_id,
          title: r.title,
          isProcessed: processedChecks[i]
        })))

        // For processed songs, load full data from contract (including segments via metadataUri)
        const songsWithData = await Promise.all(
          result.results.map(async (r, index) => {
            const isProcessed = processedChecks[index] as boolean

            if (!isProcessed) {
              return {
                id: r.genius_id.toString(),
                geniusId: r.genius_id,
                title: r.title,
                artist: r.artist,
                artworkUrl: r.artwork_thumbnail || undefined,
                soundcloudPermalink: r.soundcloud_permalink || undefined,
                isProcessed: false,
                isFree: false,
              }
            }

            // Load full song data from contract including segments
            try {
              const songData = await publicClient.readContract({
                address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
                abi: KARAOKE_CATALOG_ABI,
                functionName: 'getSongByGeniusId',
                args: [r.genius_id],
              }) as any

              // Fetch and parse metadata to get segments
              let segments = undefined
              if (songData.metadataUri) {
                try {
                  console.log('[SongSelect] Loading metadata for', r.genius_id, 'from', songData.metadataUri)

                  // Convert lens:// to Grove URL
                  const metadataUrl = songData.metadataUri.startsWith('lens://')
                    ? `https://api.grove.storage/${songData.metadataUri.replace('lens://', '')}`
                    : songData.metadataUri

                  const metadataResp = await fetch(metadataUrl)
                  const metadata = await metadataResp.json()

                  // Extract segments from metadata
                  if (metadata.sections && Array.isArray(metadata.sections)) {
                    segments = metadata.sections.map((section: any) => ({
                      id: section.type.toLowerCase().replace(/\s+/g, '-'),
                      displayName: section.type,
                      startTime: section.startTime,
                      endTime: section.endTime,
                      duration: section.duration,
                      isOwned: false, // Will be checked separately
                    }))
                    console.log('[SongSelect] Loaded', segments.length, 'segments from metadata for', r.genius_id)
                  } else {
                    console.warn('[SongSelect] No sections in metadata for', r.genius_id)
                  }
                } catch (metaError) {
                  console.error('[SongSelect] Failed to parse metadata for', r.genius_id, metaError)
                }
              } else {
                console.warn('[SongSelect] No metadataUri for processed song', r.genius_id)
              }

              return {
                id: r.genius_id.toString(),
                geniusId: r.genius_id,
                title: songData.title || r.title,
                artist: songData.artist || r.artist,
                artworkUrl: r.artwork_thumbnail || undefined, // Use Genius artwork (always HTTPS)
                isProcessed: true,
                isFree: false,
                segments,
              }
            } catch (error) {
              console.error('[SongSelect] Failed to load song data for', r.genius_id, error)
              return {
                id: r.genius_id.toString(),
                geniusId: r.genius_id,
                title: r.title,
                artist: r.artist,
                artworkUrl: r.artwork_thumbnail || undefined,
                isProcessed: true,
                isFree: false,
              }
            }
          })
        )

        // Save to sessionStorage for persistence
        sessionStorage.setItem(SEARCH_QUERY_KEY, query)
        sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(songsWithData))
        console.log('[SongSelectStep] Cached', songsWithData.length, 'search results for:', query)

        flow.updateData({ searchResults: songsWithData })
      } else {
        console.error('[Search] Failed:', result.error)
        flow.updateData({ searchResults: [] })
      }
    } catch (error) {
      console.error('[Search] Error:', error)
      flow.updateData({ searchResults: [] })
    } finally {
      setIsSearching(false)
    }
  }

  const handleSongClick = (song: Song) => {
    console.log('[SongSelectStep] Song clicked:', {
      geniusId: song.geniusId,
      title: song.title,
      isProcessed: song.isProcessed,
    })

    const targetPath = `/song/${song.geniusId}`
    console.log('[SongSelectStep] Navigating to:', targetPath)

    // Navigate to song detail page, pass song data in state for unprocessed songs
    navigate(targetPath, { state: { song } })
  }

  // Handle tab change - update URL parameters
  const handleTabChange = (tab: 'trending' | 'favorites') => {
    if (urlSearchQuery) {
      setSearchParams({ q: urlSearchQuery, tab })
    } else {
      setSearchParams({ tab })
    }
  }

  // Handle clear search - clear URL params, cache, and results
  const handleClearSearch = () => {
    setSearchParams({ tab: urlActiveTab })
    sessionStorage.removeItem(SEARCH_CACHE_KEY)
    sessionStorage.removeItem(SEARCH_QUERY_KEY)
    flow.updateData({ searchResults: [] })
  }


  return (
    <>
      <SongSelectPage
        open={true}
        onClose={flow.cancel}
        trendingSongs={trendingSongs}
        favoriteSongs={[]} // TODO: Add favorites support
        searchResults={cachedResults || flow.data.searchResults}
        isSearching={isSearching}
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onSongClick={handleSongClick}
        initialSearchQuery={urlSearchQuery}
        initialActiveTab={urlActiveTab}
        onTabChange={handleTabChange}
        skipAutoSearch={!!cachedResults}
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
