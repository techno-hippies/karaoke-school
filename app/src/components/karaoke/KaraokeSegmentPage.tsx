import { useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SongSegmentPage } from '@/components/class/SongSegmentPage'
import { useSongData } from '@/hooks/useSongData'
import { useSegmentLyrics } from '@/hooks/useSegmentLyrics'
import { useAuth } from '@/contexts/AuthContext'

/**
 * KaraokeSegmentPage - Container for individual segment practice page
 *
 * Flow:
 * 1. Load song data (match-and-segment data)
 * 2. Load base-aligned lyrics for segment
 * 3. Check if translations exist for user's language
 * 4. Show translate button if not done
 * 5. Once translated, show Study/Karaoke buttons
 * 6. Clicking Karaoke kicks off audio processing (50s, dedicated page - TODO)
 *
 * Renders: <SongSegmentPage /> from /components/class/SongSegmentPage.tsx
 */
export function KaraokeSegmentPage() {
  const navigate = useNavigate()
  const { geniusId, segmentId } = useParams<{ geniusId: string; segmentId: string }>()
  const { pkpAuthContext, pkpInfo, pkpAddress } = useAuth()

  const [isTranslating, setIsTranslating] = useState(false)

  const { song, segments, isLoading, error, refetch } = useSongData(
    geniusId ? parseInt(geniusId) : undefined,
    pkpAddress || undefined
  )

  // Find the selected segment
  const segment = segments.find(s => s.id === segmentId)

  // Load lyrics for this segment
  // Use alignmentUri (V2 architecture) or fall back to metadataUri (legacy)
  const alignmentUriToUse = song?.alignmentUri || song?.metadataUri
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
    segment?.startTime,
    segment?.endTime
  )

  // Check if translations exist for user's language (Chinese)
  const hasTranslations = useMemo(() => {
    if (lyrics.length === 0) return false
    // Check if at least one line has Chinese translation
    return lyrics.some(line => line.translations?.zh || line.translations?.cn)
  }, [lyrics])

  // Handle translate button click
  const handleTranslate = useCallback(async () => {
    if (!pkpAuthContext || !pkpInfo || !geniusId) {
      console.error('[KaraokeSegmentPage] Missing auth context or genius ID')
      return
    }

    setIsTranslating(true)
    try {
      console.log('[KaraokeSegmentPage] Starting translation...', { geniusId })
      const { executeTranslate } = await import('@/lib/lit/actions/translate')

      const result = await executeTranslate(
        parseInt(geniusId),
        'zh', // Chinese
        pkpAuthContext,
        pkpInfo.ethAddress,
        pkpInfo.publicKey,
        pkpInfo.tokenId
      )

      if (result.success) {
        console.log('[KaraokeSegmentPage] ✅ Translation complete!', {
          translationUri: result.translationUri,
          txHash: result.txHash
        })
        // Refetch song data to get updated translation URI
        setTimeout(() => refetch(), 2000)
      } else {
        console.error('[KaraokeSegmentPage] ❌ Translation failed:', result.error)
      }
    } catch (err) {
      console.error('[KaraokeSegmentPage] ❌ Translation error:', err)
    } finally {
      setIsTranslating(false)
    }
  }, [pkpAuthContext, pkpInfo, geniusId, refetch])

  if (isLoading) {
    return (
      <SongSegmentPage
        songTitle="Loading..."
        artist="Loading..."
        segmentName="Loading..."
        lyrics={[]}
        newCount={0}
        learningCount={0}
        dueCount={0}
        onBack={() => navigate(`/karaoke/song/${geniusId}`)}
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
            onClick={() => navigate(`/karaoke/song/${geniusId}`)}
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
      selectedLanguage="zh"
      showTranslations={hasTranslations}
      newCount={0} // TODO: Load from study system
      learningCount={0}
      dueCount={0}
      onBack={() => navigate(`/karaoke/song/${geniusId}`)}
      onStudy={() => console.log('Study mode')}
      onKaraoke={() => console.log('Karaoke mode')}
      onTranslate={handleTranslate}
      isTranslating={isTranslating}
      hasTranslations={hasTranslations}
    />
  )
}
