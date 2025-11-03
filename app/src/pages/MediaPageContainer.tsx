import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useGRC20WorkSegmentsWithMetadata } from '@/hooks/useSongV2'
import { useSegmentMetadata } from '@/hooks/useSegmentV2'
import { MediaPage } from '@/components/media/MediaPage'
import { Spinner } from '@/components/ui/spinner'
import { convertGroveUri } from '@/lib/lens/utils'
import { getPreferredLanguage } from '@/lib/language'

// Debug logging configuration
const DEBUG_TIMING = true
const DEBUG_RERENDERS = true

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
    console.log(`🎭 [MediaPageContainer] RENDER #${currentRender} - ${timeSinceStart}ms since start, ${timeSinceLastRender}ms since last render`)
    lastRenderTimeRef.current = now
  }

  // Fetch segments for this GRC-20 work with metadata
  const { data: workData, isLoading: isLoadingWork } = useGRC20WorkSegmentsWithMetadata(workId)

  console.log('[MediaPageContainer] Work data:', workData)

  // Get first segment from work
  const firstSegment = workData?.segments?.[0]

  console.log('[MediaPageContainer] First segment:', firstSegment)

  // Fetch segment metadata (includes lyrics and alignment)
  const { data: segmentMetadata, isLoading: isLoadingSegment } = useSegmentMetadata(
    firstSegment?.metadataUri
  )

  console.log('[MediaPageContainer] Segment metadata:', segmentMetadata)

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
    if (!segmentMetadata) {
      console.log('[MediaPageContainer] No segment metadata')
      return
    }

    // Load alignment if it exists in metadata
    if (segmentMetadata.assets?.alignment) {
      console.log('[MediaPageContainer] Loading alignment from:', segmentMetadata.assets.alignment)
      fetch(segmentMetadata.assets.alignment)
        .then((r) => r.json())
        .then((data) => {
          console.log('[MediaPageContainer] ✅ Alignment loaded:', data)
          // TODO: Update original lyrics from alignment if needed
        })
        .catch((e) => console.error('[MediaPageContainer] Failed to load alignment:', e))
    }

    // Load translations from NEW format (separate Grove files)
    if (!segmentMetadata?.translations || segmentMetadata.translations.length === 0) {
      console.log('[MediaPageContainer] No translations in NEW format')
      return
    }

    console.log('[MediaPageContainer] Loading translations from NEW format:', segmentMetadata.translations)

    Promise.all<[string, any] | null>(
      segmentMetadata.translations.map(async (t: any) => {
        try {
          const url = convertGroveUri(t.grove_url)
          console.log(`[MediaPageContainer] Fetching ${t.language_code} from ${url}`)
          const response = await fetch(url)
          const data = await response.json()
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
          console.log(`[MediaPageContainer] ✅ Loaded ${result[0]}:`, result[1])
        }
      })
      setLoadedTranslations(translations)
      console.log('[MediaPageContainer] All translations loaded:', translations)

      // Build original lyrics from first available translation
      // NOTE: Data is already pre-filtered to clip window and offset by SQL query
      // No filtering or offsetting needed here - just use the data directly
      const firstTranslation = Object.values(translations)[0]
      if (firstTranslation?.lines && Array.isArray(firstTranslation.lines)) {
        console.log('[MediaPageContainer] Building original lyrics from pre-filtered translation')

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
        console.log('[MediaPageContainer] Original lyrics built:', lyricsLines.length, 'lines')
        console.log('[MediaPageContainer] First line timing:', lyricsLines[0])
      }
    })
  }, [segmentMetadata?.translations, segmentMetadata?.assets?.alignment, segmentMetadata?.timing])

  // Loading state
  if (isLoadingWork || isLoadingSegment) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Error states
  if (!workData || !firstSegment || !segmentMetadata) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Unable to load media</h1>
        <p className="text-muted-foreground">
          {!workData
            ? 'Work not found'
            : !firstSegment
              ? 'No segments available for this work'
              : 'Segment metadata not available'}
        </p>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">
          Go back
        </button>
      </div>
    )
  }

  // NEW FORMAT: Use clip audio from metadata.assets.instrumental
  // OLD FORMAT: Use contract event's instrumentalUri
  const audioUrl = segmentMetadata?.assets?.instrumental
    ? convertGroveUri(segmentMetadata.assets.instrumental)
    : firstSegment.instrumentalUri
      ? convertGroveUri(firstSegment.instrumentalUri)
      : undefined

  console.log('[MediaPageContainer] Audio URL source:', {
    hasMetadataAssets: !!segmentMetadata?.assets?.instrumental,
    audioUrl: audioUrl?.substring(0, 50) + '...',
  })

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
  const title = segmentMetadata?.title || 'Untitled'
  const artist = segmentMetadata?.artist || 'Unknown Artist'
  // NEW FORMAT: Use tiktok_clip_duration_ms
  // OLD FORMAT: Use cropped_duration_ms
  const croppedDurationMs = segmentMetadata?.timing?.tiktok_clip_duration_ms ||
    segmentMetadata?.timing?.cropped_duration_ms ||
    50000

  console.log('[MediaPageContainer] Clip duration:', {
    tiktokClipMs: segmentMetadata?.timing?.tiktok_clip_duration_ms,
    croppedDurationMs: segmentMetadata?.timing?.cropped_duration_ms,
    final: croppedDurationMs,
  })

  // Transform V2 lyrics format to LyricLine[] format
  // NEW format: use built original lyrics from translations
  // OLD format: use inline lyrics
  const originalLyrics = {
    lines: originalLyricsLines.length > 0 ? originalLyricsLines : segmentMetadata.lyrics.original.lines,
  }

  // Get available translation languages from EITHER format
  // OLD: segmentMetadata.lyrics.translations (inline)
  // NEW: loadedTranslations (fetched separately)
  const inlineTranslations = segmentMetadata.lyrics.translations || {}
  const allTranslations = { ...inlineTranslations, ...loadedTranslations }
  const availableLanguages = Object.keys(allTranslations)

  console.log('[MediaPageContainer] Available languages:', availableLanguages)
  console.log('[MediaPageContainer] Inline translations:', Object.keys(inlineTranslations))
  console.log('[MediaPageContainer] Loaded translations:', Object.keys(loadedTranslations))

  // Determine preferred language based on browser settings
  const preferredLanguage = getPreferredLanguage(availableLanguages)

  console.log('[MediaPageContainer] Preferred language:', preferredLanguage)

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

  return (
    <MediaPage
      title={title}
      artist={artist}
      audioUrl={audioUrl}
      lyrics={lyrics}
      selectedLanguage={preferredLanguage}
      showTranslations={availableLanguages.length > 0}
      onBack={() => navigate(-1)}
      debugInfo={debugInfo}
    />
  )
}
