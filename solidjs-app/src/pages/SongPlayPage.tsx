import { type Component, Show, createSignal, createEffect, createMemo } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useSongClips } from '@/hooks/useSongClips'
import { useSongSlug } from '@/hooks/useSongSlug'
import { useSegmentMetadata } from '@/hooks/useSegmentMetadata'
import { useSongAccess } from '@/hooks/useSongAccess'
import { usePaymentWallet } from '@/hooks/usePaymentWallet'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/lib/i18n'
import { getLocalizedTitle, getLocalizedArtist } from '@/lib/localize-metadata'
import { MediaPage } from '@/components/media/MediaPage'
import { SongPurchaseDialog } from '@/components/purchase/SongPurchaseDialog'
import { Spinner } from '@/components/ui/spinner'
import { buildManifest, fetchJson, getBestUrl } from '@/lib/storage'
import type { LyricLine } from '@/components/karaoke/types'
import type { PurchaseStep } from '@/components/purchase/types'

const IS_DEV = import.meta.env.DEV

/**
 * Determines preferred language based on browser settings
 */
function getPreferredLanguage(availableLanguages: string[]): string {
  const browserLang = navigator.language.toLowerCase()

  // Check for exact match first (e.g., zh-cn)
  const exactMatch = availableLanguages.find(lang =>
    browserLang.startsWith(lang) || lang.startsWith(browserLang.split('-')[0])
  )
  if (exactMatch) return exactMatch

  // Default to Chinese if available, otherwise first available
  if (availableLanguages.includes('zh')) return 'zh'
  return availableLanguages[0] || 'zh'
}

/**
 * Song Play Page - Karaoke player (SolidJS)
 *
 * Routes:
 * - /song/:spotifyTrackId/play (MediaPage)
 * - /song/:spotifyTrackId/karaoke (MediaPage)
 * - /:artistSlug/:songSlug/play (MediaPage via slug)
 * - /:artistSlug/:songSlug/karaoke (MediaPage via slug)
 *
 * Access Control:
 * - Non-owners see clip audio (~60s) with "Unlock" button
 * - Owners see full decrypted audio (if encrypted) or full lyrics
 */
export const SongPlayPage: Component = () => {
  const params = useParams<{ spotifyTrackId?: string; artistSlug?: string; songSlug?: string }>()
  const navigate = useNavigate()
  const auth = useAuth()
  const { uiLanguage } = useTranslation()

  const [loadedTranslations, setLoadedTranslations] = createSignal<Record<string, any>>({})
  const [originalLyricsLines, setOriginalLyricsLines] = createSignal<any[]>([])
  const [showPurchaseDialog, setShowPurchaseDialog] = createSignal(false)

  // Resolve slug to Spotify track ID if using slug-based route
  const slugData = useSongSlug(
    () => params.artistSlug,
    () => params.songSlug
  )

  // Determine spotifyTrackId: direct param or resolved from slug
  const spotifyTrackId = createMemo(() => params.spotifyTrackId || slugData.data?.spotifyTrackId)

  // Fetch clips with metadata
  const workData = useSongClips(spotifyTrackId)

  // Get first clip from work
  const firstClip = createMemo(() => workData.data?.clips?.[0])

  // Fetch clip metadata (includes lyrics and alignment)
  const clipMetadata = useSegmentMetadata(() => firstClip()?.metadataUri)

  // Localized title and artist based on UI language
  const localizedTitle = createMemo(() =>
    getLocalizedTitle(clipMetadata.data, uiLanguage()) || clipMetadata.data?.title || 'Untitled'
  )
  const localizedArtist = createMemo(() =>
    getLocalizedArtist(clipMetadata.data, uiLanguage()) || clipMetadata.data?.artist || 'Unknown Artist'
  )

  // Get encryption metadata URI for v2 hybrid decryption
  const encryptionMetadataUri = createMemo(() => {
    const metadata = clipMetadata.data
    return (metadata as any)?.encryption?.encryptionMetadataUri
  })

  // ============ Song Access State Machine ============
  const songAccess = useSongAccess({
    spotifyTrackId,
    encryptionMetadataUrl: encryptionMetadataUri,
  })

  // ============ Payment Wallet (EOA or PKP based on auth method) ============
  const paymentWallet = usePaymentWallet({ requiredUsd: 0.10 })

  // Load translations and lyrics from metadata
  createEffect(() => {
    const metadata = clipMetadata.data
    if (!metadata) return

    const isOwned = songAccess.isOwned()

    // Choose karaoke lines based on ownership:
    // - Owners get full_karaoke_lines (all lyrics) if available
    // - Non-owners get karaoke_lines (clip portion only)
    const karaokeLinesToUse = isOwned && metadata.full_karaoke_lines?.length
      ? metadata.full_karaoke_lines
      : metadata.karaoke_lines

    if (IS_DEV) {
      console.log('[SongPlayPage] Using lyrics:', {
        isOwned,
        fullLines: metadata.full_karaoke_lines?.length || 0,
        clipLines: metadata.karaoke_lines?.length || 0,
        using: karaokeLinesToUse?.length || 0,
      })
    }

    if (karaokeLinesToUse && Array.isArray(karaokeLinesToUse) && karaokeLinesToUse.length > 0) {
      const lyricsLines = karaokeLinesToUse.map((line: any) => ({
        start: Number(line.start_ms) / 1000,
        end: Number(line.end_ms) / 1000,
        words: Array.isArray(line.words) ? line.words.map((w: any) => ({
          text: w.text || w.word || '',
          start: w.start_ms ? Number(w.start_ms) / 1000 : Number(w.start || 0),
          end: w.end_ms ? Number(w.end_ms) / 1000 : Number(w.end || 0),
        })) : [],
        originalText: line.text || line.original_text || '',
      }))

      setOriginalLyricsLines(lyricsLines)
    }

    // Load translations from NEW format (separate Grove files)
    if (!metadata.translations || metadata.translations.length === 0) return

    Promise.all(
      metadata.translations.map(async (t: any): Promise<[string, any] | null> => {
        try {
          // Non-owners: Use clip_grove_url (40-60s clip only)
          // Owners: Use grove_url (full song)
          const translationUrl = isOwned ? t.grove_url : (t.clip_grove_url || t.grove_url)
          // Use multi-gateway fallback: Cache → Grove → Arweave → Lighthouse
          const manifest = buildManifest(translationUrl)
          const data = await fetchJson(manifest)
          return [t.language_code, data]
        } catch {
          return null
        }
      })
    ).then((results) => {
      const translations: Record<string, any> = {}
      results.forEach((result) => {
        if (result) {
          translations[result[0]] = result[1]
        }
      })
      setLoadedTranslations(translations)

      // Build original lyrics from first translation if we didn't get karaoke_lines
      const firstTranslation = Object.values(translations)[0]
      if (firstTranslation?.lines && Array.isArray(firstTranslation.lines) && originalLyricsLines().length === 0) {
        const lyricsLines = firstTranslation.lines.map((line: any) => ({
          start: line.start,
          end: line.end,
          originalText: line.originalText || line.text || '',
          words: line.words?.map((w: any) => ({
            text: w.text || w.word || '',
            start: w.start || 0,
            end: w.end || 0,
          })) || [],
        }))

        setOriginalLyricsLines(lyricsLines)
      }
    })
  })

  // Loading state
  const isLoading = createMemo(() =>
    slugData.isLoading || workData.isLoading || clipMetadata.isLoading ||
    !clipMetadata.data?.title || !clipMetadata.data?.artist
  )

  // Audio URL priority:
  // 1. Decrypted full audio (if owned and ready)
  // 2. Clip audio from metadata
  const clipAudioUrl = createMemo(() => {
    const metadata = clipMetadata.data
    if (!metadata) return undefined

    // Try metadata assets first, then contract event URI
    // Use getBestUrl for audio URLs (returns URL string for <audio>)
    const clip = firstClip()
    if (metadata.assets?.instrumental) {
      const manifest = buildManifest(metadata.assets.instrumental)
      return getBestUrl(manifest) ?? undefined
    }
    if (clip?.instrumentalUri) {
      const manifest = buildManifest(clip.instrumentalUri)
      return getBestUrl(manifest) ?? undefined
    }
    return undefined
  })

  // Use decrypted audio if available, otherwise clip
  const audioUrl = createMemo(() => {
    const decrypted = songAccess.decryptedAudioUrl()
    if (decrypted) return decrypted
    return clipAudioUrl()
  })

  // Build lyrics with translations
  const lyrics = createMemo((): LyricLine[] => {
    const metadata = clipMetadata.data
    const originalLines = originalLyricsLines()
    const translations = loadedTranslations()
    const isOwned = songAccess.isOwned()

    if (originalLines.length === 0) return []

    // Determine which karaoke lines to use for inline translations
    const activeKaraokeLines = isOwned && metadata?.full_karaoke_lines?.length
      ? metadata.full_karaoke_lines
      : metadata?.karaoke_lines

    return originalLines.map((line: any, index: number) => {
      const lineTranslations: Record<string, string> = {}

      // Check for inline translations in karaoke_lines
      const karaokeLineSource = activeKaraokeLines?.[index] as Record<string, any> | undefined
      if (karaokeLineSource?.zh_text) lineTranslations['zh'] = karaokeLineSource.zh_text as string
      if (karaokeLineSource?.vi_text) lineTranslations['vi'] = karaokeLineSource.vi_text as string
      if (karaokeLineSource?.id_text) lineTranslations['id'] = karaokeLineSource.id_text as string

      // Add translations from fetched Grove files
      Object.entries(translations).forEach(([lang, lyricsData]: [string, any]) => {
        const translatedLine = lyricsData.lines?.[index]
        if (translatedLine) {
          const text = translatedLine.translatedText || translatedLine.text ||
            translatedLine.words?.map((w: any) => w.text || w.word).join('') || ''
          lineTranslations[lang] = text
        }
      })

      return {
        lineIndex: index,
        originalText: (line.words && line.words.length > 0)
          ? line.words.map((w: any) => w.text).join('')
          : (line.originalText || ''),
        translations: Object.keys(lineTranslations).length > 0 ? lineTranslations : undefined,
        start: line.start,
        end: line.end,
        words: (line.words || []).map((w: any) => ({
          text: w.text,
          start: w.start,
          end: w.end,
        })),
      }
    })
  })

  // Available languages
  const availableLanguages = createMemo(() => {
    const metadata = clipMetadata.data
    const translations = loadedTranslations()
    const inline = metadata?.lyrics?.translations || {}
    const isOwned = songAccess.isOwned()

    const activeKaraokeLines = isOwned && metadata?.full_karaoke_lines?.length
      ? metadata.full_karaoke_lines
      : metadata?.karaoke_lines

    const karaokeLinesSample = activeKaraokeLines?.[0]
    const karaokeInline: string[] = []
    if (karaokeLinesSample?.zh_text) karaokeInline.push('zh')
    if (karaokeLinesSample?.vi_text) karaokeInline.push('vi')
    if (karaokeLinesSample?.id_text) karaokeInline.push('id')

    return [...new Set([...Object.keys(inline), ...Object.keys(translations), ...karaokeInline])]
  })

  const preferredLanguage = createMemo(() => getPreferredLanguage(availableLanguages()))

  // Show unlock button if:
  // 1. User hasn't purchased the song (!isOwned), OR
  // 2. Decryption failed (state === 'owned-decrypt-failed')
  const shouldShowUnlockButton = createMemo(() => {
    const state = songAccess.state()
    const isOwned = songAccess.isOwned()
    return !isOwned || state === 'owned-decrypt-failed'
  })

  // Track if we're upgrading from clip to full audio
  const isUpgradingToFullAudio = createMemo(() => {
    const state = songAccess.state()
    const isDecrypting = songAccess.isDecrypting()
    const hasEncryption = encryptionMetadataUri()
    return isDecrypting || (state === 'owned-pending-decrypt' && hasEncryption)
  })

  // Map song access state to dialog step
  const dialogStep = createMemo((): PurchaseStep => {
    const state = songAccess.state()
    const isPurchasing = songAccess.isPurchasing()
    const subState = songAccess.purchaseSubState()
    const error = songAccess.error()
    const isOwned = songAccess.isOwned()

    if (!isPurchasing && state === 'not-owned') {
      if (error) return 'error'
      return 'idle'
    }

    if (isPurchasing) {
      switch (subState) {
        case 'checking-balance':
          return 'checking'
        case 'signing':
          return 'signing'
        case 'confirming':
          return 'purchasing'
        default:
          return 'checking'
      }
    }

    // After purchase success, show complete if dialog is still open
    if (isOwned && showPurchaseDialog()) {
      return 'complete'
    }

    return 'idle'
  })

  // Handle unlock button click
  const handleUnlockClick = () => {
    const pkpAddress = auth.pkpAddress()

    if (!pkpAddress) {
      // Not authenticated - open auth dialog
      auth.openAuthDialog()
      return
    }

    // If decrypt failed, retry instead of showing dialog
    if (songAccess.state() === 'owned-decrypt-failed') {
      songAccess.retryDecrypt()
      return
    }

    setShowPurchaseDialog(true)
  }

  // Handle purchase confirmation
  const handlePurchaseConfirm = async () => {
    const pkpAddress = auth.pkpAddress()

    if (!pkpAddress) {
      auth.openAuthDialog()
      return
    }

    await songAccess.purchase()
  }

  // Handle retry after error
  const handleRetry = () => {
    songAccess.reset()
    // Keep dialog open for retry
  }

  // Handle dialog close
  const handleDialogClose = (open: boolean) => {
    setShowPurchaseDialog(open)
    // State machine handles transitions automatically
  }

  // Log state for debugging
  createEffect(() => {
    if (IS_DEV) {
      console.log('[SongPlayPage] Access state:', {
        state: songAccess.state(),
        isOwned: songAccess.isOwned(),
        isPurchasing: songAccess.isPurchasing(),
        isDecrypting: songAccess.isDecrypting(),
        hasDecryptedAudio: !!songAccess.decryptedAudioUrl(),
        shouldShowUnlock: shouldShowUnlockButton(),
        audioUrl: audioUrl()?.slice(0, 50),
      })
    }
  })

  return (
    <>
      {/* Loading state */}
      <Show when={isLoading()}>
        <div class="flex items-center justify-center h-screen">
          <Spinner size="lg" />
        </div>
      </Show>

      {/* Error: No data */}
      <Show when={!isLoading() && (!workData.data || !firstClip() || !clipMetadata.data)}>
        <div class="flex flex-col items-center justify-center h-screen gap-4 px-4">
          <h1 class="text-xl sm:text-2xl font-bold text-center">Unable to load song</h1>
          <p class="text-muted-foreground">
            {!workData.data
              ? 'Work not found'
              : !firstClip()
                ? 'No clips available for this work'
                : 'Clip metadata not available'}
          </p>
          <button onClick={() => navigate(-1)} class="text-primary hover:underline">
            Go back
          </button>
        </div>
      </Show>

      {/* Error: No audio URL */}
      <Show when={!isLoading() && clipMetadata.data && !audioUrl()}>
        <div class="flex flex-col items-center justify-center h-screen gap-4 px-4">
          <h1 class="text-xl sm:text-2xl font-bold text-center">Unable to load song</h1>
          <p class="text-muted-foreground">Instrumental audio not available</p>
          <button onClick={() => navigate(-1)} class="text-primary hover:underline">
            Go back
          </button>
        </div>
      </Show>

      {/* Media Page */}
      <Show when={!isLoading() && clipMetadata.data && audioUrl()}>
        <MediaPage
          title={localizedTitle()}
          artist={localizedArtist()}
          audioUrl={audioUrl()!}
          lyrics={lyrics()}
          selectedLanguage={preferredLanguage()}
          showTranslations={availableLanguages().length > 0}
          isAudioLoading={false}
          isUnlockingFullAudio={isUpgradingToFullAudio()}
          unlockProgress={songAccess.decryptProgress()}
          onBack={() => navigate(-1)}
          onUnlockClick={shouldShowUnlockButton() ? handleUnlockClick : undefined}
        />
      </Show>

      {/* Purchase Dialog */}
      <SongPurchaseDialog
        open={showPurchaseDialog()}
        onOpenChange={handleDialogClose}
        songTitle={localizedTitle()}
        artistName={localizedArtist()}
        coverUrl={clipMetadata.data?.coverUri ? getBestUrl(buildManifest(clipMetadata.data.coverUri)) ?? undefined : undefined}
        currentStep={dialogStep()}
        statusMessage={songAccess.statusMessage()}
        errorMessage={songAccess.error()}
        onPurchase={handlePurchaseConfirm}
        onRetry={handleRetry}
        walletAddress={paymentWallet.walletAddress()}
      />
    </>
  )
}
