import { useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SongSegmentPage } from '@/components/class/SongSegmentPage'
import { useSongData } from '@/hooks/useSongData'
import { useSegmentLyrics } from '@/hooks/useSegmentLyrics'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Map i18n language codes to Lit Action translation codes
 */
function mapI18nToLitActionLanguage(i18nLang: string): string {
  const languageMap: Record<string, string> = {
    'zh-CN': 'zh',  // Simplified Chinese
    'zh-TW': 'zh',  // Traditional Chinese (use same code)
    'vi': 'vi',     // Vietnamese
    'es': 'es',     // Spanish
    'ja': 'ja',     // Japanese
    'ko': 'ko',     // Korean
    'tr': 'tr',     // Turkish
  }

  return languageMap[i18nLang] || 'zh' // Default to Chinese
}

/**
 * KaraokeSegmentPage - Container for individual segment practice page
 *
 * Flow:
 * 1. Load song data (match-and-segment data)
 * 2. Load base-aligned lyrics for segment
 * 3. Use i18n to determine user's language preference
 * 4. Show "Translate" button if translation doesn't exist (user clicks explicitly)
 * 5. Show skeleton loader while translating (~5s)
 * 6. Once translated, show translated lyrics automatically
 *
 * Renders: <SongSegmentPage /> from /components/class/SongSegmentPage.tsx
 */
export function KaraokeSegmentPage() {
  const navigate = useNavigate()
  const { geniusId, segmentId } = useParams<{ geniusId: string; segmentId: string }>()
  const { pkpAuthContext, pkpInfo, pkpAddress } = useAuth()
  const { i18n } = useTranslation()

  const [isTranslating, setIsTranslating] = useState(false)
  const [translationVersion, setTranslationVersion] = useState(0)

  // Get target language from i18n
  const targetLanguage = mapI18nToLitActionLanguage(i18n.language)
  const isEnglish = i18n.language === 'en'

  console.log('[KaraokeSegmentPage] Language detection:', {
    i18nLanguage: i18n.language,
    targetLanguage,
    isEnglish
  })

  const { song, segments, isLoading, error, refetch } = useSongData(
    geniusId ? parseInt(geniusId) : undefined,
    pkpAddress || undefined
  )

  // Find the selected segment (memoized to prevent new reference on each render)
  // Use stable dependencies to avoid recreating segment object
  const segment = useMemo(() => {
    const found = segments.find(s => s.id === segmentId)
    return found
  }, [segments.length, segmentId])

  // Load lyrics for this segment
  // Use alignmentUri (V2 architecture) or fall back to metadataUri (legacy)
  // Memoize to prevent refetch when song object changes (e.g., ownership update)
  const alignmentUriToUse = useMemo(() =>
    song?.alignmentUri || song?.metadataUri,
    [song?.alignmentUri, song?.metadataUri]
  )

  // Extract stable values from segment for dependencies
  const segmentStartTime = segment?.startTime
  const segmentEndTime = segment?.endTime

  console.log('[KaraokeSegmentPage] Loading lyrics:', {
    segmentId,
    segment: segment ? {
      id: segment.id,
      name: segment.displayName,
      startTime: segment.startTime,
      endTime: segment.endTime
    } : null,
    alignmentUri: song?.alignmentUri,
    metadataUri: song?.metadataUri,
    usingUri: alignmentUriToUse
  })

  const { lyrics, isLoading: lyricsLoading, error: lyricsError } = useSegmentLyrics(
    alignmentUriToUse,
    segmentStartTime,
    segmentEndTime,
    geniusId ? parseInt(geniusId) : undefined,
    isEnglish ? undefined : targetLanguage,
    translationVersion
  )

  // Check if translations exist for user's language
  // Keep loading state stable to prevent button flashing
  const hasTranslations = useMemo(() => {
    // If English, we don't need translations
    if (isEnglish) return true

    // Keep loading state: don't determine translation status until lyrics are fully loaded
    // This prevents flashing from "Translate" → "Study/Karaoke" during initial load
    if (lyricsLoading) return undefined // undefined = still determining

    if (lyrics.length === 0) return false

    // Check if at least one line has translation for target language
    const hasAnyTranslation = lyrics.some(line => line.translations?.[targetLanguage])
    console.log('[KaraokeSegmentPage] Translation check:', {
      targetLanguage,
      lyricsCount: lyrics.length,
      hasAnyTranslation,
      firstLineTranslations: lyrics[0]?.translations
    })
    return hasAnyTranslation
  }, [lyrics, targetLanguage, isEnglish, lyricsLoading])

  // Memoize callbacks to prevent SongSegmentPage re-renders
  const handleBack = useCallback(() => {
    navigate(`/song/${geniusId}`)
  }, [navigate, geniusId])

  const handleStudy = useCallback(() => {
    console.log('Study mode')
  }, [])

  const handleKaraoke = useCallback(() => {
    console.log('Karaoke mode')
  }, [])

  // Handle translate button click (explicit user action)
  const handleTranslate = useCallback(async () => {
    if (isEnglish) {
      console.log('[KaraokeSegmentPage] Skipping translation - English is the source language')
      return
    }

    if (!pkpAuthContext || !pkpInfo || !geniusId) {
      console.error('[KaraokeSegmentPage] Missing auth context or genius ID')
      return
    }

    setIsTranslating(true)
    try {
      console.log('[KaraokeSegmentPage] Starting translation...', { geniusId, targetLanguage })
      const { executeTranslate } = await import('@/lib/lit/actions/translate')

      const result = await executeTranslate(
        parseInt(geniusId),
        targetLanguage,
        pkpAuthContext
      )

      if (result.success) {
        console.log('[KaraokeSegmentPage] ✅ Translation complete!', {
          translationUri: result.translationUri,
          txHash: result.txHash
        })
        // Increment version to force lyrics refetch
        setTimeout(() => {
          setTranslationVersion(v => v + 1)
        }, 2000)
      } else {
        console.error('[KaraokeSegmentPage] ❌ Translation failed:', result.error)
        alert(`Translation failed: ${result.error || "Could not translate lyrics"}`)
      }
    } catch (err) {
      console.error('[KaraokeSegmentPage] ❌ Translation error:', err)
      alert(`Translation error: ${err instanceof Error ? err.message : "An error occurred"}`)
    } finally {
      setIsTranslating(false)
    }
  }, [pkpAuthContext, pkpInfo, geniusId, targetLanguage, refetch, isEnglish])

  if (isLoading) {
    return (
      <SongSegmentPage
        segmentName="Loading..."
        lyrics={[]}
        newCount={0}
        learningCount={0}
        dueCount={0}
        onBack={() => navigate(`/song/${geniusId}`)}
      />
    )
  }

  if (error || !song || !segment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Segment Not Found</h1>
          <p className="text-muted-foreground mb-4">{error?.message || 'This segment could not be loaded.'}</p>
          <button
            onClick={() => navigate(`/song/${geniusId}`)}
            className="text-primary hover:underline"
          >
            Back to Song
          </button>
        </div>
      </div>
    )
  }

  console.log('[KaraokeSegmentPage] Rendering segment:', {
    segmentId,
    segmentName: segment.displayName,
    hasMetadata: !!song.metadataUri,
    lyricsLoading,
    lyricsCount: lyrics.length,
    lyricsError: lyricsError?.message
  })

  return (
    <SongSegmentPage
      segmentName={segment.displayName}
      lyrics={lyrics}
      selectedLanguage={targetLanguage}
      showTranslations={hasTranslations}
      newCount={0} // TODO: Load from study system
      learningCount={0}
      dueCount={0}
      onBack={handleBack}
      onStudy={handleStudy}
      onKaraoke={handleKaraoke}
      onTranslate={handleTranslate}
      isTranslating={isTranslating}
      hasTranslations={hasTranslations}
    />
  )
}
