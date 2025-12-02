import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { LyricsDisplay } from '@/components/karaoke/LyricsDisplay'
import { AudioButton } from '@/components/media/AudioButton'
import { AudioScrobbleBar } from '@/components/audio/AudioScrobbleBar'
import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { LockKey } from '@phosphor-icons/react'
import type { LyricLine } from '@/types/karaoke'
import { cn } from '@/lib/utils'

export interface MediaPageProps {
  title: string
  artist: string
  audioUrl: string
  lyrics: LyricLine[]
  artworkUrl?: string
  selectedLanguage?: string
  showTranslations?: boolean
  isAudioLoading?: boolean
  /** Show unlocking indicator for subscribers waiting for full audio */
  isUnlockingFullAudio?: boolean
  /** Progress percentage (0-100) for unlocking */
  unlockProgress?: number
  onBack?: () => void
  onArtistClick?: () => void
  onUnlockClick?: () => void
  className?: string
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
  isAudioLoading = false,
  isUnlockingFullAudio = false,
  unlockProgress,
  onBack,
  onArtistClick,
  onUnlockClick,
  className,
}: MediaPageProps) {
  const {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    seek,
  } = useAudioPlayer(audioUrl)

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
          'flex items-center justify-between px-4 gap-2 border-b border-border',
          artworkUrl ? 'h-16 bg-background/95 backdrop-blur' : 'h-16'
        )}>
          {!artworkUrl && <BackButton onClick={onBack} />}
          <div className="flex-1 min-w-0">
            {/* Title and artist removed per user request */}
          </div>
          {/* Unlocking indicator for subscribers */}
          {isUnlockingFullAudio && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>{unlockProgress ? `${unlockProgress}%` : 'Unlocking...'}</span>
            </div>
          )}
          {/* Unlock button for non-subscribers */}
          {onUnlockClick && !isUnlockingFullAudio && (
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
          isAudioLoading={isAudioLoading}
          className="w-full"
        />
      </div>
      </div>
    </div>
  )
}
