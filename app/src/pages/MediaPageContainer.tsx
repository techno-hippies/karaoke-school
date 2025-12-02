import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSongClips } from '@/hooks/useSongClips'
import { useSongSlug } from '@/hooks/useSongSlug'
import { useSegmentMetadata } from '@/hooks/useSegmentV2'
import { MediaPage } from '@/components/media/MediaPage'
import { KaraokePracticeSession } from '@/components/karaoke/KaraokePracticeSession'
import { Spinner } from '@/components/ui/spinner'
import { convertGroveUri } from '@/lib/lens/utils'
import { getPreferredLanguage } from '@/lib/language'
import { SubscriptionDialog } from '@/components/subscription/SubscriptionDialog'
import { useSongAccess } from '@/hooks/useSongAccess'
import { useAuth } from '@/contexts/AuthContext'
import { useLineKaraokeGrader } from '@/hooks/useLineKaraokeGrader'

interface MediaPageContainerProps {
  variant?: 'media' | 'practice'
}

/**
 * Media Page Container - Karaoke player or practice session
 *
 * Uses unified useSongAccess state machine for:
 * - Ownership checking (SongAccess contract only)
 * - Purchase flow (USDC permit)
 * - Audio decryption (Lit Protocol)
 *
 * Routes:
 * - /song/:workId/play (MediaPage)
 * - /song/:workId/karaoke (Practice)
 * - /:artistSlug/:songSlug/play (MediaPage via slug)
 * - /:artistSlug/:songSlug/karaoke (Practice via slug)
 */
export function MediaPageContainer({ variant = 'media' }: MediaPageContainerProps = {}) {
  const { t } = useTranslation()
  const { workId, artistSlug, songSlug } = useParams<{ workId?: string; artistSlug?: string; songSlug?: string }>()
  const navigate = useNavigate()
  const [loadedTranslations, setLoadedTranslations] = useState<Record<string, any>>({})
  const [originalLyricsLines, setOriginalLyricsLines] = useState<any[]>([])
  const { pkpAddress, pkpWalletClient } = useAuth()
  const { gradeLine } = useLineKaraokeGrader()

  // Subscription dialog state
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false)

  // Resolve slug to Spotify track ID if using slug-based route
  const { data: slugData, isLoading: isLoadingSlug } = useSongSlug(artistSlug, songSlug)

  // Determine spotifyTrackId: direct workId or resolved from slug
  const spotifyTrackId = workId || slugData?.spotifyTrackId

  // Fetch clips with metadata
  const { data: workData, isLoading: isLoadingWork } = useSongClips(spotifyTrackId)

  // Get first clip from work
  const firstClip = workData?.clips?.[0]

  // Fetch clip metadata (includes lyrics and alignment)
  const { data: clipMetadata, isLoading: isLoadingClip } = useSegmentMetadata(
    firstClip?.metadataUri
  )

  // Get encryption metadata URI for v2 hybrid decryption
  const encryptionMetadataUri = (clipMetadata as any)?.encryption?.encryptionMetadataUri

  // ============ Unified Song Access State Machine ============
  const {
    state: accessState,
    isOwned,
    isPurchasing,
    isDecrypting,
    decryptedAudioUrl,
    decryptProgress,
    error: accessError,
    statusMessage,
    purchase,
    retryDecrypt,
    reset: resetAccess,
    purchaseSubState,
  } = useSongAccess({
    spotifyTrackId,
    encryptionMetadataUrl: encryptionMetadataUri,
    walletClient: pkpWalletClient,
  })

  // Map state machine to dialog step
  const getDialogStep = (): 'idle' | 'checking' | 'signing' | 'purchasing' | 'complete' | 'error' => {
    if (!isPurchasing && accessState === 'not-owned') {
      // Check if we have an error from a failed purchase
      if (accessError) return 'error'
      return 'idle'
    }
    if (isPurchasing) {
      switch (purchaseSubState) {
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
    // After purchase success, state transitions to owned-pending-decrypt
    if (accessState === 'owned-pending-decrypt' && showSubscriptionDialog) {
      return 'complete'
    }
    // Also show complete for other owned states if dialog is still open
    if (isOwned && showSubscriptionDialog) {
      return 'complete'
    }
    return 'idle'
  }

  // Load translations and alignment from NEW format (separate Grove files)
  useEffect(() => {
    if (!clipMetadata) {
      return
    }

  // Choose karaoke lines based on subscription status:
  // - Owners get full_karaoke_lines (all lyrics) if available
  // - Non-owners get karaoke_lines (clip portion only)
  const karaokeLinesToUse = isOwned && clipMetadata.full_karaoke_lines?.length
    ? clipMetadata.full_karaoke_lines
    : clipMetadata.karaoke_lines

  if (karaokeLinesToUse && Array.isArray(karaokeLinesToUse) && karaokeLinesToUse.length > 0) {

      const lyricsLines = karaokeLinesToUse.map((line: any) => ({
          start: Number(line.start_ms) / 1000,
          end: Number(line.end_ms) / 1000,
          // Convert word timing array if present; fallback to coarse line timing
          words: Array.isArray(line.words) ? line.words.map((w: any) => ({
            text: w.text || w.word || '',
            // Handle both ms (new format) and seconds (old format)
            start: w.start_ms ? Number(w.start_ms) / 1000 : Number(w.start || 0),
            end: w.end_ms ? Number(w.end_ms) / 1000 : Number(w.end || 0),
          })) : [],
          originalText: line.text || line.original_text || '',
      }))

      setOriginalLyricsLines(lyricsLines)
  }

    // Load alignment if it exists in metadata
    if (clipMetadata.assets?.alignment) {
      fetch(clipMetadata.assets.alignment)
        .then((r) => r.json())
        .then(() => {
          // TODO: Update original lyrics from alignment if needed
        })
        .catch((e) => console.error('[MediaPageContainer] Failed to load alignment:', e))
    }

    // Load translations from NEW format (separate Grove files)
    if (!clipMetadata?.translations || clipMetadata.translations.length === 0) {
      return
    }

    // Choose translation URLs based on ownership status
    // Non-owners: Use clip_grove_url (40-60s clip only)
    // Owners: Use grove_url (full song)
    Promise.all<[string, any] | null>(
    // @ts-expect-error - Promise.all type inference
      clipMetadata.translations.map(async (t: any) => {
        try {
          const translationUrl = isOwned ? t.grove_url : (t.clip_grove_url || t.grove_url)
          const url = convertGroveUri(translationUrl)
          const response = await fetch(url)
          const data = await response.json()
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

      // Build original lyrics from first available translation
      // NOTE: Data is already pre-filtered to clip window and offset by SQL query
      // No filtering or offsetting needed here - just use the data directly
      const firstTranslation = Object.values(translations)[0]
      // Only override originalLyricsLines if we didn't already populate it from karaoke_lines
      if (firstTranslation?.lines && Array.isArray(firstTranslation.lines) && originalLyricsLines.length === 0) {
        // Transform lines to include calculated timing fields (start, end, startTime, endTime)
        const lyricsLines = firstTranslation.lines.map((line: any) => {
          return {
            // Keep in seconds to match audio currentTime comparisons
            start: line.start,
            end: line.end,
            startTime: line.start,
            endTime: line.end,
            originalText: line.originalText || line.text || '',
            words:
              line.words?.map((w: any) => ({
                text: w.text || w.word || '',
                // Keep word timings in seconds as well
                start: w.start || 0,
                end: w.end || 0,
                startTime: w.start || 0,
                endTime: w.end || 0,
              })) || [],
          }
        })

        setOriginalLyricsLines(lyricsLines)
      }

      // Always update translations map
      setLoadedTranslations(translations)
    })
  }, [clipMetadata, isOwned]) // Removed originalLyricsLines from dep array to avoid loops

  // Loading state - check both loading AND data completeness to prevent placeholder flash
  if (isLoadingSlug || isLoadingWork || isLoadingClip || !clipMetadata?.title || !clipMetadata?.artist) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Error states
  if (!workData || !firstClip || !clipMetadata) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">{t('song.unableToLoad')}</h1>
        <p className="text-muted-foreground">
          {!workData
            ? 'Work not found'
            : !firstClip
              ? 'No clips available for this work'
              : 'Clip metadata not available'}
        </p>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">
          {t('common.back')}
        </button>
      </div>
    )
  }

  // Audio URL priority:
  // 1. Decrypted full audio (if ready)
  // 2. NEW FORMAT: Clip audio from metadata.assets.instrumental
  // 3. OLD FORMAT: Contract event's instrumentalUri
  const clipAudioUrl = clipMetadata?.assets?.instrumental
    ? convertGroveUri(clipMetadata.assets.instrumental)
    : firstClip.instrumentalUri
      ? convertGroveUri(firstClip.instrumentalUri)
      : undefined

  // Always start with clip audio, swap to full when decrypted
  // This prevents blocking the whole page while decrypting
  const audioUrl = decryptedAudioUrl || clipAudioUrl

  // Track if we're upgrading from clip to full audio
  // Show progress only during actual decryption (after Lit auth succeeds)
  const isUpgradingToFullAudio = isDecrypting || (accessState === 'owned-pending-decrypt' && encryptionMetadataUri)

  // Show unlock button if:
  // 1. User hasn't purchased the song (!isOwned), OR
  // 2. Decryption failed with ACC error (state === 'owned-decrypt-failed')
  const shouldShowUnlockButton = !isOwned || accessState === 'owned-decrypt-failed'

  // Show error only if we have no audio at all
  if (!audioUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">{t('song.unableToLoad')}</h1>
        <p className="text-muted-foreground">{accessError || t('song.instrumentalNotAvailable')}</p>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">
          {t('common.back')}
        </button>
      </div>
    )
  }

  // Extract metadata from Grove (guaranteed to exist due to loading check above)
  const title = clipMetadata.title
  const artist = clipMetadata.artist

  // Extract artwork/cover image from Grove metadata
  // coverUri is set during pipeline emission in emit-clip-events.ts
  // NOTE: Don't pass artworkUrl to MediaPage to avoid background image on play page
  const artworkUrl = undefined // Don't show artwork background on play page

  // Transform V2 lyrics format to LyricLine[] format
  // NEW format: use built original lyrics from translations
  // OLD format: use inline lyrics
  const originalLyrics = {
    lines: originalLyricsLines.length > 0 ? originalLyricsLines : clipMetadata.lyrics.original.lines,
  }

  // Get available translation languages from ALL formats
  // OLD: clipMetadata.lyrics.translations (inline)
  // NEW: loadedTranslations (fetched separately)
  // NEWEST: karaoke_lines with zh_text, vi_text, id_text
  const inlineTranslations = clipMetadata.lyrics.translations || {}
  const allTranslations = { ...inlineTranslations, ...loadedTranslations }

  // Determine which karaoke lines to use for translations based on ownership
  const activeKaraokeLines = isOwned && clipMetadata?.full_karaoke_lines?.length
    ? clipMetadata.full_karaoke_lines
    : clipMetadata?.karaoke_lines

  // Check for inline translations in karaoke_lines
  const firstKaraokeLine = activeKaraokeLines?.[0]
  const karaokeInlineLanguages: string[] = []
  if (firstKaraokeLine?.zh_text) karaokeInlineLanguages.push('zh')
  if (firstKaraokeLine?.vi_text) karaokeInlineLanguages.push('vi')
  if (firstKaraokeLine?.id_text) karaokeInlineLanguages.push('id')

  const availableLanguages = [...new Set([...Object.keys(allTranslations), ...karaokeInlineLanguages])]

  // Determine preferred language based on browser settings
  const preferredLanguage = getPreferredLanguage(availableLanguages)

  const lyrics = originalLyrics.lines.map((line: any, index: number) => {
    // Build translations object from BOTH formats
    const translations: Record<string, string> = {}

    // NEW: Check for inline translations in karaoke_lines (zh_text, vi_text, id_text)
    // Use activeKaraokeLines which is full_karaoke_lines for owners, karaoke_lines otherwise
    const karaokeLineSource = activeKaraokeLines?.[index] as Record<string, any> | undefined
    if (karaokeLineSource?.zh_text) translations['zh'] = karaokeLineSource.zh_text as string
    if (karaokeLineSource?.vi_text) translations['vi'] = karaokeLineSource.vi_text as string
    if (karaokeLineSource?.id_text) translations['id'] = karaokeLineSource.id_text as string

    // Add translations from other languages (both inline and fetched)
    Object.entries(allTranslations).forEach(([lang, lyricsData]: [string, any]) => {
      const translatedLine = lyricsData.lines?.[index]
      if (translatedLine) {
        // Use translatedText field (line-level translation from Gemini)
        const text = translatedLine.translatedText || translatedLine.text || translatedLine.words?.map((w: any) => w.text || w.word).join(' ') || ''
        translations[lang] = text
      }
    })

    const builtLine = {
      lineIndex: index,
      originalText: (line.words && line.words.length > 0)
        ? line.words.map((w: any) => w.text).join(' ')
        : (line.originalText || ''),
      translations: Object.keys(translations).length > 0 ? translations : undefined,
      start: line.start,
      end: line.end,
      words: (line.words || []).map((w: any) => ({
        text: w.text,
        start: w.start,
        end: w.end,
      })),
    }

    return builtLine
  })

  const handleUnlockClick = () => {
    if (!pkpAddress || !pkpWalletClient) {
      alert('Please sign in to unlock this song.')
      return
    }

    // If decrypt failed, retry instead of showing dialog
    if (accessState === 'owned-decrypt-failed') {
      retryDecrypt()
      return
    }

    setShowSubscriptionDialog(true)
  }

  const handleSubscriptionConfirm = async () => {
    if (!pkpAddress || !pkpWalletClient) {
      alert('Please sign in to unlock this song.')
      return
    }

    await purchase()
  }

  const handleSubscriptionRetry = async () => {
    if (!pkpAddress || !pkpWalletClient) {
      alert('Please sign in to unlock this song.')
      return
    }
    resetAccess()
    setShowSubscriptionDialog(true)
  }

  const handleSubscriptionDialogClose = (open: boolean) => {
    setShowSubscriptionDialog(open)
    // No need to reset or trigger recheck - state machine handles it all!
    // After purchase success, state is already owned-pending-decrypt
    // Closing dialog just hides the UI, decryption continues/starts automatically
  }


  const pageContent = variant === 'practice'
    ? (
        <KaraokePracticeSession
          title={title}
          artist={artist}
          audioUrl={audioUrl}
          lyrics={lyrics}
          clipHash={firstClip.clipHash}
          metadataUri={firstClip.metadataUri}
          isSubscriber={isOwned && accessState !== 'owned-decrypt-failed'}
          onClose={() => navigate(-1)}
          onSubscribe={shouldShowUnlockButton ? handleUnlockClick : undefined}
          gradeLine={gradeLine}
        />
      )
    : (
        <MediaPage
          title={title}
          artist={artist}
          audioUrl={audioUrl}
          lyrics={lyrics}
          artworkUrl={artworkUrl}
          selectedLanguage={preferredLanguage}
          showTranslations={availableLanguages.length > 0}
          isAudioLoading={false}
          isUnlockingFullAudio={isUpgradingToFullAudio}
          unlockProgress={decryptProgress}
          onBack={() => navigate(-1)}
          onArtistClick={
            (clipMetadata as any)?.artistLensHandle
              ? () => navigate(`/u/${(clipMetadata as any).artistLensHandle}`)
              : undefined
          }
          onUnlockClick={shouldShowUnlockButton ? handleUnlockClick : undefined}
        />
      )

  return (
    <>
      {pageContent}

      <SubscriptionDialog
        open={showSubscriptionDialog}
        onOpenChange={handleSubscriptionDialogClose}
        displayName={title}
        currentStep={getDialogStep()}
        isProcessing={isPurchasing}
        statusMessage={statusMessage}
        errorMessage={accessError}
        onSubscribe={handleSubscriptionConfirm}
        onRetry={handleSubscriptionRetry}
      />
    </>
  )
}
