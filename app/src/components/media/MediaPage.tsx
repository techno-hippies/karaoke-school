import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { LyricsDisplay } from '@/components/karaoke/LyricsDisplay'
import { AudioButton } from '@/components/media/AudioButton'
import { AudioScrobbleBar } from '@/components/audio/AudioScrobbleBar'
import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { LockKey } from '@phosphor-icons/react'
import type { LyricLine } from '@/types/karaoke'
import { cn } from '@/lib/utils'

// Debug logging configuration
const DEBUG_TIMING = true

export interface MediaPageProps {
  title: string
  artist: string
  audioUrl: string
  lyrics: LyricLine[]
  artworkUrl?: string
  selectedLanguage?: string
  showTranslations?: boolean
  onBack?: () => void
  onArtistClick?: () => void
  onUnlockClick?: () => void
  className?: string
  debugInfo?: {
    renderCount: number
    startTime: number
    lastActiveLine: number | null
    lastActiveWord: { lineIndex: number; wordIndex: number } | null
    calculateActiveLineAndWord: (currentTime: number, lyrics: LyricLine[]) => { lineIndex: number; wordIndex: number }
    timingLogsRef: React.MutableRefObject<Array<{timestamp: number, currentTime: number, activeLine: number, activeWord: number}>>
  }
}

/**
 * Full-screen media player with synchronized lyrics
 * Used for playing instrumental tracks with karaoke lyrics
 */
export function MediaPage({
  title,
  artist,
  audioUrl,
  lyrics,
  artworkUrl,
  selectedLanguage = 'zh', // ISO 639-1 code, not old 'cn' code
  showTranslations = true,
  onBack,
  onArtistClick,
  onUnlockClick,
  className,
  debugInfo,
}: MediaPageProps) {
  const {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    seek,
  } = useAudioPlayer(audioUrl)

  // Log timing synchronization if debugInfo is provided
  if (debugInfo && DEBUG_TIMING && currentTime > 0) {
    const currentActive = debugInfo.calculateActiveLineAndWord(currentTime, lyrics)

    // Only log when the active line or word changes
    if (currentActive.lineIndex !== debugInfo.lastActiveLine ||
        currentActive.wordIndex !== debugInfo.lastActiveWord?.wordIndex) {

      const logEntry = {
        timestamp: Date.now(),
        currentTime: Math.round(currentTime * 100) / 100,
        activeLine: currentActive.lineIndex,
        activeWord: currentActive.wordIndex,
      }

      debugInfo.timingLogsRef.current.push(logEntry)
      // Keep only last 100 entries
      if (debugInfo.timingLogsRef.current.length > 100) {
        debugInfo.timingLogsRef.current.shift()
      }

      console.log(`🎵 [MediaPage] TIMING SYNC - Audio: ${logEntry.currentTime}s, Line: ${logEntry.activeLine}, Word: ${logEntry.activeWord}`, {
        lineText: currentActive.lineIndex >= 0 ? lyrics[currentActive.lineIndex]?.originalText?.substring(0, 30) + '...' : 'none',
        wordText: currentActive.lineIndex >= 0 && currentActive.wordIndex >= 0 ?
          lyrics[currentActive.lineIndex]?.words?.[currentActive.wordIndex]?.text : 'none',
        isPlaying,
      })
    }
  }

  return (
    <div className={cn('relative w-full h-screen bg-background flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-2xl flex flex-col">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header with optional artwork */}
      <div className="flex-none relative">
        {/* Artwork Hero Section - only show if artworkUrl is provided */}
        {artworkUrl && (
          <div className="relative w-full bg-neutral-900" style={{ height: 'min(200px, 30vh)' }}>
            <img
              src={artworkUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay to ensure text is readable */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)'
              }}
            />
            {/* Back button on top of artwork */}
            <div className="absolute top-4 left-4 z-10">
              <BackButton onClick={onBack} />
            </div>
          </div>
        )}

        {/* Title and Artist Bar */}
        <div className={cn(
          'flex items-center justify-between px-4 gap-2 border-b border-neutral-800',
          artworkUrl ? 'h-14 bg-background/95 backdrop-blur' : 'h-16'
        )}>
          {!artworkUrl && <BackButton onClick={onBack} />}
          <div className="flex-1 min-w-0">
            <h1 className={cn(
              'text-foreground font-semibold flex-1 text-center truncate min-w-0',
              artworkUrl ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
            )}>
              {title} - {onArtistClick ? (
                <button
                  onClick={onArtistClick}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  {artist}
                </button>
              ) : artist}
            </h1>
          </div>
          {onUnlockClick && (
            <Button
              onClick={onUnlockClick}
              variant="destructive"
              size="sm"
            >
              <LockKey className="w-5 h-5" weight="fill" />
              Unlock
            </Button>
          )}
        </div>
      </div>

      {/* Lyrics Display - flex-1 makes it fill available space */}
      <div className="flex-1 relative overflow-hidden">
        <LyricsDisplay
          lyrics={lyrics}
          currentTime={currentTime}
          selectedLanguage={selectedLanguage}
          showTranslations={showTranslations}
          debugInfo={debugInfo}
          className="absolute inset-0"
        />
      </div>

      {/* Bottom Controls */}
      <div className="flex-none px-4 sm:px-6 pt-6 pb-8 flex flex-col items-center gap-5">
        {/* Play/Pause Button */}
        <AudioButton
          isPlaying={isPlaying}
          onClick={togglePlayPause}
          size="lg"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        />

        {/* Progress Bar */}
        <AudioScrobbleBar
          currentTime={currentTime}
          duration={duration}
          onSeek={seek}
          showTimeLabels
          className="w-full"
        />
      </div>
      </div>
    </div>
  )
}
