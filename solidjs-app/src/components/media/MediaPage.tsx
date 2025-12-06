import { type Component, Show, createSignal, onMount } from 'solid-js'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { LyricsDisplay } from '@/components/karaoke/LyricsDisplay'
import { AudioButton } from '@/components/audio/AudioButton'
import { AudioScrobbleBar } from '@/components/audio/AudioScrobbleBar'
import { Button } from '@/components/ui/button'
import { Icon, LockSimple } from '@/components/icons'
import type { LyricLine } from '@/components/karaoke/types'
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
  class?: string
}

/**
 * Full-screen media player with synchronized lyrics (SolidJS)
 * Used for playing instrumental tracks with karaoke lyrics
 */
export const MediaPage: Component<MediaPageProps> = (props) => {
  const {
    setAudioRef,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    seek,
  } = useAudioPlayer()

  return (
    <div class={cn('relative w-full h-screen bg-background flex items-center justify-center', props.class)}>
      <div class="relative w-full h-full md:max-w-2xl flex flex-col">
        <audio ref={setAudioRef} src={props.audioUrl} preload="metadata" />

        {/* Header with optional artwork */}
        <div class="flex-none relative">
          {/* Artwork Hero Section */}
          <Show when={props.artworkUrl}>
            <div class="relative w-full bg-neutral-900" style={{ height: 'min(200px, 30vh)' }}>
              <img
                src={props.artworkUrl}
                alt={props.title}
                class="w-full h-full object-cover"
              />
              {/* Gradient overlay */}
              <div
                class="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)'
                }}
              />
              {/* Back button on top of artwork */}
              <div class="absolute top-4 left-4 z-10">
                <button
                  onClick={() => props.onBack?.()}
                  class="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                >
                  <Icon name="caret-left" class="text-2xl text-white" />
                </button>
              </div>
            </div>
          </Show>

          {/* Title and Artist Bar */}
          <div class={cn(
            'flex items-center justify-between px-4 gap-2 border-b border-border',
            props.artworkUrl ? 'h-16 bg-background/95 backdrop-blur' : 'h-16'
          )}>
            <Show when={!props.artworkUrl}>
              <button
                onClick={() => props.onBack?.()}
                class="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <Icon name="caret-left" class="text-2xl text-foreground" />
              </button>
            </Show>
            <div class="flex-1 min-w-0">
              {/* Title and artist removed per design */}
            </div>
            {/* Unlocking indicator for subscribers */}
            <Show when={props.isUnlockingFullAudio}>
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <div class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                <span>{props.unlockProgress ? `${props.unlockProgress}%` : 'Unlocking...'}</span>
              </div>
            </Show>
            {/* Unlock button for non-subscribers */}
            <Show when={props.onUnlockClick && !props.isUnlockingFullAudio}>
              <Button
                onClick={() => props.onUnlockClick?.()}
                size="sm"
              >
                <LockSimple class="w-4 h-4" />
                Unlock
              </Button>
            </Show>
          </div>
        </div>

        {/* Lyrics Display - flex-1 fills available space */}
        <div class="flex-1 relative overflow-hidden">
          <LyricsDisplay
            lyrics={props.lyrics}
            currentTime={currentTime}
            selectedLanguage={props.selectedLanguage}
            showTranslations={props.showTranslations}
            class="absolute inset-0"
          />
        </div>

        {/* Bottom Controls */}
        <div class="flex-none px-4 sm:px-6 pt-6 pb-8 flex flex-col items-center gap-5">
          {/* Play/Pause Button */}
          <AudioButton
            isPlaying={isPlaying()}
            onClick={togglePlayPause}
            size="lg"
            aria-label={isPlaying() ? 'Pause' : 'Play'}
          />

          {/* Progress Bar */}
          <AudioScrobbleBar
            currentTime={currentTime}
            duration={duration}
            onSeek={seek}
            showTimeLabels
            isAudioLoading={props.isAudioLoading}
            class="w-full"
          />
        </div>
      </div>
    </div>
  )
}
