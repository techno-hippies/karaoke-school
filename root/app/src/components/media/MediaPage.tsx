import { CaretLeft } from '@phosphor-icons/react'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { LyricsDisplay } from '@/components/karaoke/LyricsDisplay'
import { AudioButton } from '@/components/ui/audio-button'
import { AudioScrobbleBar } from '@/components/audio/AudioScrobbleBar'
import type { LyricLine } from '@/types/karaoke'
import { cn } from '@/lib/utils'

export interface MediaPageProps {
  title: string
  artist: string
  audioUrl: string
  lyrics: LyricLine[]
  selectedLanguage?: string
  showTranslations?: boolean
  onBack?: () => void
  className?: string
}

// Full-screen media player with synchronized lyrics
export function MediaPage({
  title,
  artist,
  audioUrl,
  lyrics,
  selectedLanguage = 'cn',
  showTranslations = true,
  onBack,
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
    <div className={cn('relative w-full h-screen flex flex-col bg-neutral-900', className)}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header */}
      <div className="flex-none h-16 border-b border-neutral-800 flex items-center px-4">
        <button
          onClick={onBack}
          className="w-12 h-12 flex items-center justify-center hover:bg-white/10 transition-colors rounded-full"
        >
          <CaretLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-white text-base font-semibold flex-1 text-center pr-12">
          {title} - {artist}
        </h1>
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
      <div className="flex-none px-6 pt-6 pb-8 flex flex-col items-center gap-5">
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
  )
}
