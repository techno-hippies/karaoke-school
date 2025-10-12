/**
 * Song Select Step
 * Wrapper for SongSelectPage with search integration
 */

import { useState, useEffect } from 'react'
import { SongSelectPage } from '@/components/karaoke/SongSelectPage'
import { AuthDialog } from '@/components/layout/AuthDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useContractSongs } from '@/hooks/useContractSongs'
import { useUSDCBalance } from '@/hooks/useUSDCBalance'
import { useCredits } from '../hooks/useCredits'
import { useAudioProcessingStatus } from '../hooks/useAudioProcessingStatus'
import { executeSearch } from '@/lib/lit/actions'
import { toast } from 'sonner'
import type { PostFlowContext, Song } from '../types'

interface SongSelectStepProps {
  flow: PostFlowContext
}

export function SongSelectStep({ flow }: SongSelectStepProps) {
  // Load songs from KaraokeCatalogV1 contract on Base Sepolia
  const { songs: trendingSongs, isLoading: isTrendingLoading } = useContractSongs()
  const [isSearching, setIsSearching] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [pendingSong, setPendingSong] = useState<Song | null>(null)
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)

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

  // Credit purchase
  const { purchaseCredits, isPurchasing } = useCredits()

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
                artworkUrl: songData.thumbnailUri || r.artwork_thumbnail || undefined,
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
    console.log('[SongSelect] Song clicked:', {
      geniusId: song.geniusId,
      title: song.title,
      isProcessed: song.isProcessed,
      hasSegments: !!song.segments,
      segmentCount: song.segments?.length || 0
    })

    // Only need PKP for browsing
    if (!capabilities.canBrowse) {
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

    if (song.isProcessed) {
      // Processed songs go to segment picker (load segments from contract on-demand)
      console.log('[SongSelect] Going to segment picker for processed song')
      flow.goToSegmentPicker(song)
    } else {
      // Unprocessed songs need generation (needs credits)
      console.log('[SongSelect] Going to generate karaoke for unprocessed song')
      if (!capabilities.canGenerate) {
        setPendingSong(song)
        flow.goToPurchaseCredits()
        return
      }
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
        searchResults={flow.data.searchResults}
        isSearching={isSearching}
        onSearch={handleSearch}
        userCredits={flow.auth.credits}
        walletAddress={pkpAddress || ''}
        walletBalance={usdcBalance}
        onSelectSong={(song, segment) => {
          // Need PKP for recording (segment already owned/unlocked)
          if (!capabilities.canRecord) {
            if (!capabilities.capabilities.hasPKP) {
              setPendingSong(song)
              setShowAuthDialog(true)
              return
            }
            // Has PKP but no credits
            flow.goToPurchaseCredits()
            return
          }
          flow.goToRecording(song, segment)
        }}
        onConfirmCredit={(song, segment) => {
          // Unlock requires canUnlock (PKP + credits)
          if (!capabilities.canUnlock) {
            if (!capabilities.capabilities.hasPKP) {
              setPendingSong(song)
              setShowAuthDialog(true)
              return
            }
            // Has PKP but no credits
            flow.goToPurchaseCredits()
            return
          }
          flow.unlockSegment(song, segment)
        }}
        onGenerateKaraoke={async (song) => {
          // Generation requires canGenerate (PKP + credits)
          if (!capabilities.canGenerate) {
            if (!capabilities.capabilities.hasPKP) {
              setPendingSong(song)
              setShowAuthDialog(true)
              return
            }
            // Has PKP but no credits
            flow.goToPurchaseCredits()
            return
          }
          // Trigger generation in background - don't transition flow state
          // The drawer shows loading state while we process
          await flow.generateKaraoke(song)
        }}
        onPurchaseCredits={async (packageId) => {
          const success = await purchaseCredits(packageId)
          if (success) {
            // Reload credits after successful purchase
            // Credits will auto-refresh via AuthContext
            console.log('[SongSelectStep] Credits purchased successfully')
            toast.success('Credits purchased successfully!')
          } else {
            toast.error('Failed to purchase credits. Please try again.')
          }
        }}
        isPurchasingCredits={isPurchasing}
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
