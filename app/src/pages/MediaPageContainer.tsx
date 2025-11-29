import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
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
import { useCreatorSubscriptionLock } from '@/hooks/useCreatorSubscriptionLock'
import { useUnlockSubscription } from '@/hooks/useUnlockSubscription'
import { useHybridDecrypt } from '@/hooks/useHybridDecrypt'
import { useAuth } from '@/contexts/AuthContext'
import { useLineKaraokeGrader } from '@/hooks/useLineKaraokeGrader'

interface MediaPageContainerProps {
  variant?: 'media' | 'practice'
}

/**
 * Media Page Container - Karaoke player or practice session
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
  // Trigger to re-check subscription after purchase
  const [subscriptionRecheckTrigger, setSubscriptionRecheckTrigger] = useState(0)

  // Resolve slug to Spotify track ID if using slug-based route
  const { data: slugData, isLoading: isLoadingSlug } = useSongSlug(artistSlug, songSlug)

  // Determine spotifyTrackId: direct workId or resolved from slug
  const spotifyTrackId = workId || slugData?.spotifyTrackId

  // Fetch clips with metadata
  const { data: workData, isLoading: isLoadingWork } = useSongClips(spotifyTrackId)

  // Get first clip from work
  const firstClip = workData?.clips?.[0]

  // Get artist slug from URL params or clip metadata
  const resolvedArtistSlug = artistSlug || firstClip?.metadata?.artistSlug

  // Get subscription lock by artist slug (works for all songs from same artist)
  const { data: subscriptionLockData } = useCreatorSubscriptionLock(resolvedArtistSlug)

  const {
    subscribe,
    status: subscriptionStatus,
    statusMessage: subscriptionStatusMessage,
    errorMessage: subscriptionErrorMessage,
    reset: resetSubscription,
  } = useUnlockSubscription(
    pkpAddress ?? undefined,
    subscriptionLockData?.unlockLockAddress,
    { walletClient: pkpWalletClient }
  )


  const isSubscriptionProcessing =
    subscriptionStatus === 'approving' || subscriptionStatus === 'purchasing'

  // Fetch clip metadata (includes lyrics and alignment)
  const { data: clipMetadata, isLoading: isLoadingClip } = useSegmentMetadata(
    firstClip?.metadataUri
  )

  // Get subscription lock data from subgraph
  const unlockLockAddress = firstClip?.unlockLockAddress
  const unlockChainId = firstClip?.unlockChainId

  // Get encryption metadata URI for v2 hybrid decryption
  // This points to JSON with encrypted key + audio URL (no longer leaks unencrypted URL)
  const encryptionMetadataUri = clipMetadata?.encryption?.encryptionMetadataUri

  // Decrypt full audio using v2 hybrid encryption (key-only Lit, no 413 errors!)
  const {
    decryptedAudioUrl,
    isDecrypting,
    hasSubscription,
    error: decryptError,
    isLoading: isDecryptLoading,
    progress: decryptProgress,
  } = useHybridDecrypt(
    encryptionMetadataUri,
    firstClip?.spotifyTrackId,
    subscriptionRecheckTrigger
  )

  // Load translations and alignment from NEW format (separate Grove files)
  useEffect(() => {
    if (!clipMetadata) {
      return
    }

  // Choose karaoke lines based on subscription status:
  // - Subscribers get full_karaoke_lines (all lyrics) if available
  // - Non-subscribers get karaoke_lines (clip portion only)
  const karaokeLinesToUse = hasSubscription && clipMetadata.full_karaoke_lines?.length
    ? clipMetadata.full_karaoke_lines
    : clipMetadata.karaoke_lines

  if (karaokeLinesToUse && Array.isArray(karaokeLinesToUse) && karaokeLinesToUse.length > 0) {
      console.log(`[MediaPageContainer] Using ${karaokeLinesToUse.length} karaoke lines (subscriber: ${hasSubscription}, full available: ${!!clipMetadata.full_karaoke_lines?.length})`)

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

    // Choose translation URLs based on subscription status
    // Non-subscribed: Use clip_grove_url (40-60s clip only)
    // Subscribed: Use grove_url (full song)
    // console.log('[MediaPageContainer] Loading translations - hasSubscription:', hasSubscription)
    Promise.all<[string, any] | null>(
    // @ts-expect-error - Promise.all type inference
      clipMetadata.translations.map(async (t: any) => {
        try {
          const translationUrl = hasSubscription ? t.grove_url : (t.clip_grove_url || t.grove_url)
          console.log(`[MediaPageContainer] Loading ${t.language_code} from:`, translationUrl, '(subscription:', hasSubscription, ')')
          const url = convertGroveUri(translationUrl)
          const response = await fetch(url)
          const data = await response.json()
          console.log(`[MediaPageContainer] Loaded ${t.language_code} with ${data.lines?.length || 0} lines`)
          return [t.language_code, data]
        } catch (e) {
          console.error(`[MediaPageContainer] Failed to load ${t.language_code}:`, e)
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
  }, [clipMetadata, hasSubscription]) // Removed originalLyricsLines from dep array to avoid loops

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
  // 1. Decrypted full audio (if user has subscription)
  // 2. NEW FORMAT: Clip audio from metadata.assets.instrumental
  // 3. OLD FORMAT: Contract event's instrumentalUri
  const clipAudioUrl = clipMetadata?.assets?.instrumental
    ? convertGroveUri(clipMetadata.assets.instrumental)
    : firstClip.instrumentalUri
      ? convertGroveUri(firstClip.instrumentalUri)
      : undefined

  const audioUrl = decryptedAudioUrl || clipAudioUrl

  // Debug audio URL selection
  console.log('[MediaPageContainer] 🎵 Audio URL selection:', {
    hasSubscription,
    encryptionMetadataUri: encryptionMetadataUri?.slice(0, 50) || '(none)',
    isDecrypting,
    decryptProgress,
    decryptedAudioUrl: decryptedAudioUrl?.slice(0, 50) || '(none)',
    clipAudioUrl: clipAudioUrl?.slice(0, 50) || '(none)',
    finalAudioUrl: audioUrl?.slice(0, 50) || '(none)',
  })

  // Audio URL configured

  if (!audioUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">{t('song.unableToLoad')}</h1>
        <p className="text-muted-foreground">{t('song.instrumentalNotAvailable')}</p>
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

  // Determine which karaoke lines to use for translations based on subscription
  const activeKaraokeLines = hasSubscription && clipMetadata?.full_karaoke_lines?.length
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
    // Use activeKaraokeLines which is full_karaoke_lines for subscribers, karaoke_lines otherwise
    const karaokeLineSource = activeKaraokeLines?.[index]
    if (karaokeLineSource?.zh_text) translations['zh'] = karaokeLineSource.zh_text
    if (karaokeLineSource?.vi_text) translations['vi'] = karaokeLineSource.vi_text
    if (karaokeLineSource?.id_text) translations['id'] = karaokeLineSource.id_text

    // Add translations from other languages (both inline and fetched)
    Object.entries(allTranslations).forEach(([lang, lyricsData]: [string, any]) => {
      const translatedLine = lyricsData.lines?.[index]
      if (translatedLine) {
        // Use translatedText field (line-level translation from Gemini)
        const text = translatedLine.translatedText || translatedLine.text || translatedLine.words?.map((w: any) => w.text || w.word).join(' ') || ''
        translations[lang] = text
      }
    })

    if (index === 0) {
      // console.log('[MediaPageContainer] First line - allTranslations keys:', Object.keys(allTranslations))
      // console.log('[MediaPageContainer] First line - zh sample:', allTranslations.zh?.lines?.[0])
      // console.log('[MediaPageContainer] Translations built for first line:', translations)
    }

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

    if (index === 0) {
      // console.log('[MediaPageContainer] First built line:', builtLine)
      // Log FULL word timing for debugging - show actual values
      const wordTiming = builtLine.words.map((w: any) => `"${w.text}" [${w.start?.toFixed?.(2) ?? w.start ?? 'undefined'}-${w.end?.toFixed?.(2) ?? w.end ?? 'undefined'}]`)
      // console.log('[MediaPageContainer] 🎯 WORD TIMING:', wordTiming.join(', '))
      // console.log('[MediaPageContainer] 🎯 LINE TIMING: start=', builtLine.start, 'end=', builtLine.end)
    }

    return builtLine
  })

  const handleUnlockClick = () => {
    // console.log('[MediaPageContainer] 🔐 handleUnlockClick called')
    // console.log('[MediaPageContainer] 🔐 subscriptionLockData:', subscriptionLockData)
    // console.log('[MediaPageContainer] 🔐 pkpAddress:', pkpAddress)
    // console.log('[MediaPageContainer] 🔐 pkpWalletClient:', pkpWalletClient ? 'Available' : 'Not available')

    if (!subscriptionLockData?.unlockLockAddress) {
      console.warn('[MediaPageContainer] 🔐 No lock address available')
      alert('Subscription not available for this song yet.')
      return
    }

    if (!pkpAddress || !pkpWalletClient) {
      console.warn('[MediaPageContainer] 🔐 No PKP wallet available')
      alert('Please sign in to subscribe and unlock this song.')
      return
    }

    // console.log('[MediaPageContainer] 🔐 Opening subscription dialog')
    setShowSubscriptionDialog(true)
  }

  const handleSubscriptionConfirm = async () => {
    // console.log('[MediaPageContainer] 🔐 handleSubscriptionConfirm called')
    // console.log('[MediaPageContainer] 🔐 pkpAddress:', pkpAddress)
    // console.log('[MediaPageContainer] 🔐 pkpWalletClient:', pkpWalletClient ? 'Available' : 'Not available')

    if (!pkpAddress || !pkpWalletClient) {
      console.error('[MediaPageContainer] 🔐 No PKP wallet available for subscription')
      alert('Please sign in to subscribe and unlock this song.')
      return
    }

    // console.log('[MediaPageContainer] 🔐 Calling subscribe()')
    await subscribe()
  }

  const handleSubscriptionRetry = async () => {
    // console.log('[MediaPageContainer] 🔐 handleSubscriptionRetry called')
    if (!pkpAddress || !pkpWalletClient) {
      console.error('[MediaPageContainer] 🔐 No PKP wallet available for retry')
      alert('Please sign in to subscribe and unlock this song.')
      return
    }
    // console.log('[MediaPageContainer] 🔐 Resetting subscription and retrying')
    resetSubscription()
    await subscribe()
  }

  const handleSubscriptionDialogClose = (open: boolean) => {
    // console.log('[MediaPageContainer] 🔐 handleSubscriptionDialogClose called, open:', open)
    // console.log('[MediaPageContainer] 🔐 Current subscription status:', subscriptionStatus)
    setShowSubscriptionDialog(open)
    if (!open && subscriptionStatus === 'complete') {
      // console.log('[MediaPageContainer] 🔐 Resetting subscription after completion')
      resetSubscription()
      // Trigger re-check of subscription to unlock full audio
      setSubscriptionRecheckTrigger(prev => prev + 1)
    }
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
          isSubscriber={hasSubscription}
          onClose={() => navigate(-1)}
          onSubscribe={hasSubscription ? undefined : handleUnlockClick}
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
          isAudioLoading={isDecrypting || isDecryptLoading}
          onBack={() => navigate(-1)}
          onArtistClick={
            (clipMetadata as any)?.artistLensHandle
              ? () => navigate(`/u/${(clipMetadata as any).artistLensHandle}`)
              : undefined
          }
          onUnlockClick={hasSubscription ? undefined : handleUnlockClick}
        />
      )

  return (
    <>
      {pageContent}

      <SubscriptionDialog
        open={showSubscriptionDialog}
        onOpenChange={handleSubscriptionDialogClose}
        displayName={artist}
        currentStep={subscriptionStatus}
        isProcessing={isSubscriptionProcessing}
        statusMessage={subscriptionStatusMessage}
        errorMessage={subscriptionErrorMessage}
        onSubscribe={handleSubscriptionConfirm}
        onRetry={handleSubscriptionRetry}
      />
    </>
  )
}
