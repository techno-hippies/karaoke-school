import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useGRC20WorkClipsWithMetadata } from '@/hooks/useSongV2'
import { useSegmentMetadata } from '@/hooks/useSegmentV2'
import { MediaPage } from '@/components/media/MediaPage'
import { Spinner } from '@/components/ui/spinner'
import { convertGroveUri } from '@/lib/lens/utils'
import { getPreferredLanguage } from '@/lib/language'
import { SubscriptionDialog } from '@/components/subscription/SubscriptionDialog'
import { useCreatorSubscriptionLock } from '@/hooks/useCreatorSubscriptionLock'
import { useUnlockSubscription } from '@/hooks/useUnlockSubscription'
import { useDecryptFullAudio } from '@/hooks/useDecryptFullAudio'
import { useAuth } from '@/contexts/AuthContext'

// Debug logging configuration
const DEBUG_TIMING = false
const DEBUG_RERENDERS = false

/**
 * Media Page Container - Karaoke player
 *
 * Routes:
 * - /song/grc20/:workId/play (primary)
 *
 * Loads first segment from a GRC-20 work and plays karaoke
 * Handles both OLD format (inline lyrics) and NEW format (separate translation files)
 */
export function MediaPageContainer() {
  const { workId } = useParams<{ workId: string }>()
  const navigate = useNavigate()
  const [loadedTranslations, setLoadedTranslations] = useState<Record<string, any>>({})
  const [originalLyricsLines, setOriginalLyricsLines] = useState<any[]>([])
  const { pkpAddress, pkpWalletClient } = useAuth()

  // Subscription dialog state
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false)

  // Performance tracking
  const renderCountRef = useRef(0)
  const lastRenderTimeRef = useRef(Date.now())
  const componentStartTimeRef = useRef(Date.now())

  // Timing synchronization tracking
  const lastActiveLineRef = useRef<number | null>(null)
  const lastActiveWordRef = useRef<{ lineIndex: number; wordIndex: number } | null>(null)
  const timingLogsRef = useRef<Array<{timestamp: number, currentTime: number, activeLine: number, activeWord: number}>>([])

  // Increment render counter and log performance
  renderCountRef.current++
  const currentRender = renderCountRef.current

  if (DEBUG_RERENDERS) {
    const now = Date.now()
    const timeSinceLastRender = now - lastRenderTimeRef.current
    const timeSinceStart = now - componentStartTimeRef.current
    lastRenderTimeRef.current = now
  }

  // Fetch clips for this GRC-20 work with metadata
  const { data: workData, isLoading: isLoadingWork } = useGRC20WorkClipsWithMetadata(workId)

  // Get first clip from work
  const firstClip = workData?.clips?.[0]

  const spotifyTrackIds = firstClip?.spotifyTrackId ? [firstClip.spotifyTrackId] : undefined

  console.log('[MediaPageContainer] 🔐 First clip data:', {
    spotifyTrackId: firstClip?.spotifyTrackId,
    hasEncryptedFullUri: !!firstClip?.encryptedFullUri,
    hasUnlockLockAddress: !!firstClip?.unlockLockAddress,
    hasUnlockChainId: !!firstClip?.unlockChainId,
    encryptedFullUri: firstClip?.encryptedFullUri,
    unlockLockAddress: firstClip?.unlockLockAddress,
    unlockChainId: firstClip?.unlockChainId,
  })
  console.log('[MediaPageContainer] 🔐 Subscription setup - spotifyTrackIds:', spotifyTrackIds)
  console.log('[MediaPageContainer] 🔐 PKP Address:', pkpAddress)
  console.log('[MediaPageContainer] 🔐 PKP Wallet Client:', pkpWalletClient ? 'Available' : 'Not available')
  console.log('[MediaPageContainer] 🔐 PKP Wallet Client chain:', pkpWalletClient?.chain)
  console.log('[MediaPageContainer] 🔐 PKP Wallet Client account:', pkpWalletClient?.account)

  const { data: subscriptionLockData } = useCreatorSubscriptionLock(spotifyTrackIds)

  console.log('[MediaPageContainer] 🔐 Subscription lock data:', subscriptionLockData)

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

  console.log('[MediaPageContainer] 🔐 Subscription status:', subscriptionStatus)

  const isSubscriptionProcessing =
    subscriptionStatus === 'approving' || subscriptionStatus === 'purchasing'

  // Fetch clip metadata (includes lyrics and alignment)
  const { data: clipMetadata, isLoading: isLoadingClip } = useSegmentMetadata(
    firstClip?.metadataUri
  )

  // Fetch encryption data from subgraph for full audio decryption
  const encryptedFullUri = firstClip?.encryptedFullUri
  const unlockLockAddress = firstClip?.unlockLockAddress
  const unlockChainId = firstClip?.unlockChainId

  console.log('[MediaPageContainer] 🔐 Encrypted full URI:', encryptedFullUri)
  console.log('[MediaPageContainer] 🔐 Unlock lock address:', unlockLockAddress)
  console.log('[MediaPageContainer] 🔐 Unlock chain ID:', unlockChainId)

  // Decrypt full audio if user has subscription
  const {
    decryptedAudioUrl,
    isDecrypting,
    hasSubscription,
    error: decryptError,
  } = useDecryptFullAudio(
    firstClip?.spotifyTrackId,
    encryptedFullUri,
    unlockLockAddress,
    unlockChainId
  )

  console.log('[MediaPageContainer] 🔐 Decryption status:', {
    isDecrypting,
    hasSubscription,
    hasDecryptedAudio: !!decryptedAudioUrl,
    error: decryptError,
  })

  // Timing synchronization function - calculates which line/word should be active
  const calculateActiveLineAndWord = useCallback((currentTime: number, lyrics: any[]) => {
    if (!lyrics || lyrics.length === 0) return { lineIndex: -1, wordIndex: -1 }
    
    let activeLineIndex = -1
    let activeWordIndex = -1
    
    // Find the current line
    for (let i = 0; i < lyrics.length; i++) {
      const line = lyrics[i]
      if (currentTime >= line.start && currentTime <= line.end) {
        activeLineIndex = i
        break
      }
    }
    
    // If we found an active line, find the active word within that line
    if (activeLineIndex >= 0) {
      const activeLine = lyrics[activeLineIndex]
      for (let j = 0; j < activeLine.words.length; j++) {
        const word = activeLine.words[j]
        if (currentTime >= word.start && currentTime <= word.end) {
          activeWordIndex = j
          break
        }
      }
    }
    
    return { lineIndex: activeLineIndex, wordIndex: activeWordIndex }
  }, [])

  // Create debug info that will be passed to MediaPage for child component logging
  const debugInfo = {
    renderCount: currentRender,
    startTime: componentStartTimeRef.current,
    lastActiveLine: lastActiveLineRef.current,
    lastActiveWord: lastActiveWordRef.current,
    calculateActiveLineAndWord,
    timingLogsRef,
  }

  if (DEBUG_TIMING && performance.now() % 100 < 16) { // Log roughly every ~6 seconds at 60fps
    console.log('⏰ [MediaPageContainer] Current performance metrics:', {
      renderCount: currentRender,
      avgRenderInterval: componentStartTimeRef.current > 0 ? (Date.now() - componentStartTimeRef.current) / currentRender : 0,
      activeLine: lastActiveLineRef.current,
      activeWord: lastActiveWordRef.current,
    })
  }

  // Load translations and alignment from NEW format (separate Grove files)
  useEffect(() => {
    if (!clipMetadata) {
      return
    }

    // Load alignment if it exists in metadata
    if (clipMetadata.assets?.alignment) {
      fetch(clipMetadata.assets.alignment)
        .then((r) => r.json())
        .then((data) => {
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
    console.log('[MediaPageContainer] Loading translations - hasSubscription:', hasSubscription)
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
      if (firstTranslation?.lines && Array.isArray(firstTranslation.lines)) {
        // Transform lines to include calculated timing fields (start, end, startTime, endTime)
        const lyricsLines = firstTranslation.lines.map((line: any) => {
          return {
            start: line.start,
            end: line.end,
            startTime: line.start * 1000,
            endTime: line.end * 1000,
            originalText: line.originalText || line.text || '',
            words:
              line.words?.map((w: any) => ({
                text: w.text || w.word || '',
                start: w.start || 0,
                end: w.end || 0,
                startTime: (w.start || 0) * 1000,
                endTime: (w.end || 0) * 1000,
              })) || [],
          }
        })

        setOriginalLyricsLines(lyricsLines)
        setLoadedTranslations(translations)
      }
    })
  }, [clipMetadata, hasSubscription])

  // Loading state
  if (isLoadingWork || isLoadingClip) {
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
        <h1 className="text-xl sm:text-2xl font-bold text-center">Unable to load media</h1>
        <p className="text-muted-foreground">
          {!workData
            ? 'Work not found'
            : !firstClip
              ? 'No clips available for this work'
              : 'Clip metadata not available'}
        </p>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">
          Go back
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

  console.log('[MediaPageContainer] 🔐 Audio URL selection:', {
    hasDecrypted: !!decryptedAudioUrl,
    clipUrl: clipAudioUrl,
    finalUrl: audioUrl,
  })

  // Audio URL configured

  if (!audioUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Unable to load media</h1>
        <p className="text-muted-foreground">Instrumental audio not available</p>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">
          Go back
        </button>
      </div>
    )
  }

  // Extract metadata from Grove
  const title = clipMetadata?.title || 'Untitled'
  const artist = clipMetadata?.artist || 'Unknown Artist'

  // NEW FORMAT: Use tiktok_clip_duration_ms
  // OLD FORMAT: Use cropped_duration_ms
  const croppedDurationMs = clipMetadata?.timing?.tiktok_clip_duration_ms ||
    clipMetadata?.timing?.cropped_duration_ms ||
    50000

  // Extract artwork/cover image from Grove metadata (uploaded from grc20_artists.image_url)
  // coverUri is set during pipeline emission in emit-clip-events.ts
  // NOTE: Don't pass artworkUrl to MediaPage to avoid background image on play page
  const artworkUrl = undefined // Don't show artwork background on play page

  // Transform V2 lyrics format to LyricLine[] format
  // NEW format: use built original lyrics from translations
  // OLD format: use inline lyrics
  const originalLyrics = {
    lines: originalLyricsLines.length > 0 ? originalLyricsLines : clipMetadata.lyrics.original.lines,
  }

  // Get available translation languages from EITHER format
  // OLD: clipMetadata.lyrics.translations (inline)
  // NEW: loadedTranslations (fetched separately)
  const inlineTranslations = clipMetadata.lyrics.translations || {}
  const allTranslations = { ...inlineTranslations, ...loadedTranslations }
  const availableLanguages = Object.keys(allTranslations)

  // Determine preferred language based on browser settings
  const preferredLanguage = getPreferredLanguage(availableLanguages)

  const lyrics = originalLyrics.lines.map((line: any, index: number) => {
    // Build translations object from BOTH formats
    const translations: Record<string, string> = {}

    // Add translations from other languages (both inline and fetched)
    Object.entries(allTranslations).forEach(([lang, lyricsData]: [string, any]) => {
      const translatedLine = lyricsData.lines?.[index]
      if (translatedLine) {
        if (index === 0) {
          console.log(`[MediaPageContainer] ${lang} line structure:`, {
            keys: Object.keys(translatedLine),
            hasTranslatedWords: !!translatedLine.translatedWords,
            hasTranslatedText: !!translatedLine.translatedText,
            hasText: !!translatedLine.text,
            translatedTextValue: typeof translatedLine.translatedText === 'string' ? translatedLine.translatedText.substring(0, 40) : 'not a string',
          })
        }

        // Use translatedText field (line-level translation from Gemini)
        const text = translatedLine.translatedText || translatedLine.text || translatedLine.words?.map((w: any) => w.text || w.word).join(' ') || ''
        translations[lang] = text
      }
    })

    if (index === 0) {
      console.log('[MediaPageContainer] First line - allTranslations keys:', Object.keys(allTranslations))
      console.log('[MediaPageContainer] First line - zh sample:', allTranslations.zh?.lines?.[0])
      console.log('[MediaPageContainer] Translations built for first line:', translations)
    }

    const builtLine = {
      lineIndex: index,
      originalText: line.words.map((w: any) => w.text).join(' '),
      translations: Object.keys(translations).length > 0 ? translations : undefined,
      start: line.start,
      end: line.end,
      words: line.words.map((w: any) => ({
        text: w.text,
        start: w.start,
        end: w.end,
      })),
    }

    if (index === 0) {
      console.log('[MediaPageContainer] First built line:', builtLine)
    }

    return builtLine
  })

  const handleUnlockClick = () => {
    console.log('[MediaPageContainer] 🔐 handleUnlockClick called')
    console.log('[MediaPageContainer] 🔐 subscriptionLockData:', subscriptionLockData)
    console.log('[MediaPageContainer] 🔐 pkpAddress:', pkpAddress)
    console.log('[MediaPageContainer] 🔐 pkpWalletClient:', pkpWalletClient ? 'Available' : 'Not available')

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

    console.log('[MediaPageContainer] 🔐 Opening subscription dialog')
    setShowSubscriptionDialog(true)
  }

  const handleSubscriptionConfirm = async () => {
    console.log('[MediaPageContainer] 🔐 handleSubscriptionConfirm called')
    console.log('[MediaPageContainer] 🔐 pkpAddress:', pkpAddress)
    console.log('[MediaPageContainer] 🔐 pkpWalletClient:', pkpWalletClient ? 'Available' : 'Not available')

    if (!pkpAddress || !pkpWalletClient) {
      console.error('[MediaPageContainer] 🔐 No PKP wallet available for subscription')
      alert('Please sign in to subscribe and unlock this song.')
      return
    }

    console.log('[MediaPageContainer] 🔐 Calling subscribe()')
    await subscribe()
  }

  const handleSubscriptionRetry = async () => {
    console.log('[MediaPageContainer] 🔐 handleSubscriptionRetry called')
    if (!pkpAddress || !pkpWalletClient) {
      console.error('[MediaPageContainer] 🔐 No PKP wallet available for retry')
      alert('Please sign in to subscribe and unlock this song.')
      return
    }
    console.log('[MediaPageContainer] 🔐 Resetting subscription and retrying')
    resetSubscription()
    await subscribe()
  }

  const handleSubscriptionDialogClose = (open: boolean) => {
    console.log('[MediaPageContainer] 🔐 handleSubscriptionDialogClose called, open:', open)
    console.log('[MediaPageContainer] 🔐 Current subscription status:', subscriptionStatus)
    setShowSubscriptionDialog(open)
    if (!open && subscriptionStatus === 'complete') {
      console.log('[MediaPageContainer] 🔐 Resetting subscription after completion')
      resetSubscription()
    }
  }

  return (
    <>
      <MediaPage
        title={title}
        artist={artist}
        audioUrl={audioUrl}
        lyrics={lyrics}
        artworkUrl={artworkUrl}
        selectedLanguage={preferredLanguage}
        showTranslations={availableLanguages.length > 0}
        onBack={() => navigate(-1)}
        onArtistClick={
          (clipMetadata as any)?.artistLensHandle
            ? () => navigate(`/u/${(clipMetadata as any).artistLensHandle}`)
            : undefined
        }
        onUnlockClick={hasSubscription ? undefined : handleUnlockClick}
        debugInfo={debugInfo}
      />

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
