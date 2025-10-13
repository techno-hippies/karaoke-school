import type { Meta, StoryObj } from '@storybook/react-vite'
import { InlineAudioPlayer } from '@/components/media/InlineAudioPlayer'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'

const meta = {
  title: 'Media/InlineAudioPlayer',
  component: InlineAudioPlayer,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof InlineAudioPlayer>

export default meta
type Story = StoryObj<typeof meta>

// Free audio sample for demo purposes
const DEMO_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

/**
 * Static player showing paused state
 */
export const Paused: Story = {
  args: {
    audioUrl: DEMO_AUDIO_URL,
    isPlaying: false,
    currentTime: 0,
    duration: 180,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (time) => console.log('Seek to:', time),
  },
}

/**
 * Static player showing playing state
 */
export const Playing: Story = {
  args: {
    audioUrl: DEMO_AUDIO_URL,
    isPlaying: true,
    currentTime: 45,
    duration: 180,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (time) => console.log('Seek to:', time),
  },
}

/**
 * Static player showing almost finished
 */
export const AlmostFinished: Story = {
  args: {
    audioUrl: DEMO_AUDIO_URL,
    isPlaying: true,
    currentTime: 170,
    duration: 180,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (time) => console.log('Seek to:', time),
  },
}

/**
 * Interactive player with real audio playback
 */
export const Interactive: Story = {
  render: () => {
    const {
      audioRef,
      isPlaying,
      currentTime,
      duration,
      togglePlayPause,
      seek,
    } = useAudioPlayer(DEMO_AUDIO_URL)

    return (
      <div className="max-w-md mx-auto">
        <InlineAudioPlayer
          audioUrl={DEMO_AUDIO_URL}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={togglePlayPause}
          onSeek={seek}
          audioRef={audioRef}
        />
      </div>
    )
  },
}

/**
 * Example of how it looks between sections
 */
export const InContext: Story = {
  render: () => {
    const {
      audioRef,
      isPlaying,
      currentTime,
      duration,
      togglePlayPause,
      seek,
    } = useAudioPlayer(DEMO_AUDIO_URL)

    return (
      <div className="max-w-md mx-auto space-y-6">
        {/* Top Score Card */}
        <div className="bg-neutral-900/30 rounded-lg border border-neutral-800/50 p-4 text-center">
          <div className="text-3xl font-bold text-primary">87%</div>
          <div className="text-neutral-500 text-sm font-medium mt-1">Your Top Score</div>
        </div>

        {/* Inline Audio Player */}
        <InlineAudioPlayer
          audioUrl={DEMO_AUDIO_URL}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={togglePlayPause}
          onSeek={seek}
          audioRef={audioRef}
        />

        {/* Study Stats */}
        <div className="bg-neutral-900/30 rounded-lg border border-neutral-800/50 flex relative">
          <div className="flex-1 p-3 md:p-4 text-center">
            <div className="text-xl md:text-2xl font-bold text-neutral-300">12</div>
            <div className="text-neutral-500 text-xs md:text-sm font-medium mt-1">New</div>
          </div>
          <div className="absolute left-1/3 top-1/2 -translate-y-1/2 w-px h-1/2 bg-neutral-800/50" />
          <div className="flex-1 p-3 md:p-4 text-center">
            <div className="text-xl md:text-2xl font-bold text-neutral-300">5</div>
            <div className="text-neutral-500 text-xs md:text-sm font-medium mt-1">Learning</div>
          </div>
          <div className="absolute left-2/3 top-1/2 -translate-y-1/2 w-px h-1/2 bg-neutral-800/50" />
          <div className="flex-1 p-3 md:p-4 text-center">
            <div className="text-xl md:text-2xl font-bold text-red-400">8</div>
            <div className="text-neutral-500 text-xs md:text-sm font-medium mt-1">Due</div>
          </div>
        </div>

        {/* Lyrics section placeholder */}
        <div className="space-y-6">
          <p className="text-xl font-semibold leading-relaxed text-foreground">
            Walking down the street today
          </p>
          <p className="text-xl font-semibold leading-relaxed text-foreground">
            Feeling good, feeling free
          </p>
        </div>
      </div>
    )
  },
}

/**
 * Short segment (15 seconds) - typical verse
 */
export const ShortSegment: Story = {
  args: {
    audioUrl: DEMO_AUDIO_URL,
    isPlaying: false,
    currentTime: 0,
    duration: 15,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (time) => console.log('Seek to:', time),
  },
}

/**
 * Short segment playing midway
 */
export const ShortSegmentPlaying: Story = {
  args: {
    audioUrl: DEMO_AUDIO_URL,
    isPlaying: true,
    currentTime: 8,
    duration: 18,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (time) => console.log('Seek to:', time),
  },
}

/**
 * Loading state - audio being generated (~50 seconds)
 * Shows spinner in play button and disabled state
 */
export const Loading: Story = {
  args: {
    isLoading: true,
    currentTime: 0,
    duration: 0,
  },
}
