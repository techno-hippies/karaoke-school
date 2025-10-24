import { useParams, useNavigate } from 'react-router-dom'
import { useSongWithMetadata } from '@/hooks/useSongV2'
import { useSegmentMetadata } from '@/hooks/useSegmentV2'
import { MediaPage } from '@/components/media/MediaPage'
import { Spinner } from '@/components/ui/spinner'
import { convertGroveUri } from '@/lib/lens/utils'
import { getPreferredLanguage } from '@/lib/language'

export function MediaPageContainer() {
  const { geniusId } = useParams<{ geniusId: string }>()
  const navigate = useNavigate()

  const songId = geniusId ? parseInt(geniusId) : undefined

  // Fetch song data from The Graph with Grove metadata
  const { data: songData, isLoading: isLoadingSong } = useSongWithMetadata(songId)

  console.log('[MediaPageContainer] Song data:', songData)

  // Get first segment from song data
  const firstSegment = songData?.segments?.[0]

  console.log('[MediaPageContainer] First segment:', firstSegment)

  // Fetch segment metadata (includes lyrics)
  const { data: segmentMetadata, isLoading: isLoadingSegment } = useSegmentMetadata(firstSegment?.metadataUri)

  console.log('[MediaPageContainer] Segment metadata:', segmentMetadata)

  // Loading state
  if (isLoadingSong || isLoadingSegment) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Error states
  if (!songData || !firstSegment || !segmentMetadata) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Unable to load media</h1>
        <p className="text-muted-foreground">
          {!songData ? 'Song not found' : !firstSegment ? 'No segments available for this song' : 'Segment metadata not available'}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  // Convert lens:// URIs to HTTP URLs
  const audioUrl = firstSegment.instrumentalUri ? convertGroveUri(firstSegment.instrumentalUri) : undefined

  if (!audioUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Unable to load media</h1>
        <p className="text-muted-foreground">Instrumental audio not available</p>
        <button
          onClick={() => navigate(-1)}
          className="text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  // Transform V2 lyrics format to LyricLine[] format
  const originalLyrics = segmentMetadata.lyrics.original

  // Get available translation languages
  const availableLanguages = segmentMetadata.lyrics.translations
    ? Object.keys(segmentMetadata.lyrics.translations)
    : []

  // Determine preferred language based on browser settings
  const preferredLanguage = getPreferredLanguage(availableLanguages)

  const lyrics = originalLyrics.lines.map((line: any, index: number) => {
    // Build translations object from V2 format
    const translations: Record<string, string> = {}

    // Add translations from other languages
    if (segmentMetadata.lyrics.translations) {
      Object.entries(segmentMetadata.lyrics.translations).forEach(([lang, lyricsData]: [string, any]) => {
        const translatedLine = lyricsData.lines[index]
        if (translatedLine) {
          // Combine words into text (Grove uses 'text' not 'word')
          translations[lang] = translatedLine.words.map((w: any) => w.text).join(' ')
        }
      })
    }

    return {
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
  })

  return (
    <MediaPage
      title={songData.metadata?.title || `Song ${songData.geniusId}`}
      artist={songData.metadata?.artist || 'Unknown Artist'}
      audioUrl={audioUrl}
      lyrics={lyrics}
      selectedLanguage={preferredLanguage}
      showTranslations={availableLanguages.length > 0}
      onBack={() => navigate(-1)}
    />
  )
}
