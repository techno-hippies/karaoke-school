import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StudyStats } from './StudyStats'
import { cn } from '@/lib/utils'
import type { LyricLine } from '@/types/karaoke'

export interface SongSegmentPageProps {
  segmentName: string
  lyrics: LyricLine[]
  selectedLanguage?: string
  showTranslations?: boolean
  topScore?: number // Top score percentage (0-100), undefined if never attempted
  // Study stats
  newCount: number
  learningCount: number
  dueCount: number
  onBack?: () => void
  onStudy?: () => void
  onKaraoke?: () => void
  onTranslate?: () => void // Trigger translation if not done
  isStudyLoading?: boolean
  isKaraokeLoading?: boolean
  isTranslating?: boolean
  hasTranslations?: boolean // Whether translations exist for selected language
  className?: string
}


// Lyric line component with smaller text size for segment page
function SegmentLyricLine({
  line,
  showTranslation,
  selectedLanguage = 'cn',
}: {
  line: LyricLine
  showTranslation: boolean
  selectedLanguage?: string
}) {
  const translation = showTranslation
    ? line.translations?.[selectedLanguage]
    : undefined

  return (
    <div className="transition-all duration-300">
      <p className="text-xl md:text-3xl font-semibold leading-relaxed text-foreground">
        {line.originalText}
      </p>
      {translation && (
        <p className="text-base md:text-xl mt-2 text-muted-foreground leading-relaxed">
          {translation}
        </p>
      )}
    </div>
  )
}

// Song segment detail page with lyrics and study/karaoke actions
export function SongSegmentPage({
  segmentName,
  lyrics,
  selectedLanguage = 'cn',
  showTranslations = true,
  topScore,
  newCount,
  learningCount,
  dueCount,
  onBack,
  onStudy,
  onKaraoke,
  onTranslate,
  isStudyLoading = false,
  isKaraokeLoading = false,
  isTranslating = false,
  hasTranslations = false,
  className,
}: SongSegmentPageProps) {
  // Filter out section markers
  const filteredLyrics = lyrics.filter((line) => !line.sectionMarker)

  return (
    <div className={cn('relative w-full h-screen bg-background overflow-hidden flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-6xl">
        {/* Header - Back | Title | Spacer */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-background border-b border-neutral-800">
          <div className="flex items-center justify-between px-4 py-4">
            {/* Left: Back button */}
            <BackButton onClick={onBack} />

            {/* Center: Segment name */}
            <h1 className="text-center font-semibold text-base md:text-xl text-foreground flex-1">
              {segmentName}
            </h1>

            {/* Right: Spacer */}
            <div className="w-9" />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="absolute inset-x-0 bottom-24" style={{ top: '57px' }}>
          <ScrollArea className="h-full">
            <div className="px-6 pt-12 pb-8 space-y-4">
              {/* Score container with same style as StudyStats */}
              <div className="bg-neutral-900/30 rounded-lg border border-neutral-800/50 p-3 md:p-4 text-center">
                {topScore !== undefined ? (
                  <>
                    <div className="text-xl md:text-2xl font-bold text-primary">{topScore}%</div>
                    <div className="text-neutral-500 text-base md:text-lg font-medium mt-1">Top Score</div>
                  </>
                ) : (
                  <>
                    <div className="text-xl md:text-2xl font-bold text-neutral-600">—</div>
                    <div className="text-neutral-500 text-base md:text-lg font-medium mt-1">No Score</div>
                  </>
                )}
              </div>

              {/* Study Stats */}
              <StudyStats
                newCount={newCount}
                learningCount={learningCount}
                dueCount={dueCount}
              />

              {/* Lyrics */}
              <div className="space-y-6 pt-2">
                {filteredLyrics.map((line) => (
                  <SegmentLyricLine
                    key={line.lineIndex}
                    line={line}
                    showTranslation={showTranslations}
                    selectedLanguage={selectedLanguage}
                  />
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Sticky Footer with Translate or Study/Karaoke Buttons */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
          {!hasTranslations && onTranslate ? (
            // Show translate button if translations don't exist
            <Button
              onClick={onTranslate}
              disabled={isTranslating}
              size="lg"
              variant="default"
              className="w-full"
            >
              {isTranslating && <Spinner />}
              {isTranslating ? 'Translating...' : 'Translate to Chinese'}
            </Button>
          ) : (
            // Show Study/Karaoke buttons after translation
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={onStudy}
                disabled={isStudyLoading}
                size="lg"
                variant="secondary"
              >
                {isStudyLoading && <Spinner />}
                Study
              </Button>

              <Button
                onClick={onKaraoke}
                disabled={isKaraokeLoading}
                size="lg"
              >
                {isKaraokeLoading && <Spinner />}
                Karaoke
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
