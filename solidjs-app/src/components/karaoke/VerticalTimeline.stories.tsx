import type { Meta, StoryObj } from 'storybook-solidjs'
import { VerticalTimeline, usePlaybackSimulator, type TimelineLyricLine, type TimelineColorScheme } from './VerticalTimeline'
import { createSignal, For } from 'solid-js'

const meta: Meta<typeof VerticalTimeline> = {
  title: 'Karaoke/VerticalTimeline',
  component: VerticalTimeline,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof VerticalTimeline>

// Another One Bites the Dust - sample lyrics with realistic timing
const ANOTHER_ONE_BITES_THE_DUST: TimelineLyricLine[] = [
  { text: "Steve walks warily down the street", startMs: 19700, endMs: 22500 },
  { text: "With the brim pulled way down low", startMs: 22800, endMs: 25500 },
  { text: "Ain't no sound but the sound of his feet", startMs: 25800, endMs: 28500 },
  { text: "Machine guns ready to go", startMs: 28800, endMs: 31500 },
  { text: "Are you ready? Hey, are you ready for this?", startMs: 32000, endMs: 35000 },
  { text: "Are you hanging on the edge of your seat?", startMs: 35200, endMs: 38500 },
  { text: "Out of the doorway the bullets rip", startMs: 38800, endMs: 41500 },
  { text: "To the sound of the beat, yeah", startMs: 41800, endMs: 44500 },
  { text: "Another one bites the dust", startMs: 45000, endMs: 47500 },
  { text: "Another one bites the dust", startMs: 48000, endMs: 50500 },
  { text: "And another one gone, and another one gone", startMs: 51000, endMs: 53500 },
  { text: "Another one bites the dust", startMs: 54000, endMs: 56500 },
  { text: "Hey, I'm gonna get you too", startMs: 57000, endMs: 59500 },
  { text: "Another one bites the dust", startMs: 60000, endMs: 62500 },
]

// Fast rap example - Eminem style timing (lines very close together)
const RAP_EXAMPLE: TimelineLyricLine[] = [
  { text: "Look, if you had one shot", startMs: 1000, endMs: 2200 },
  { text: "Or one opportunity", startMs: 2300, endMs: 3400 },
  { text: "To seize everything you ever wanted", startMs: 3500, endMs: 5000 },
  { text: "In one moment", startMs: 5100, endMs: 5900 },
  { text: "Would you capture it", startMs: 6000, endMs: 6800 },
  { text: "Or just let it slip?", startMs: 6900, endMs: 7800 },
  { text: "Yo", startMs: 9000, endMs: 9300 },
  { text: "His palms are sweaty", startMs: 9400, endMs: 10200 },
  { text: "Knees weak, arms are heavy", startMs: 10300, endMs: 11200 },
  { text: "There's vomit on his sweater already", startMs: 11300, endMs: 12500 },
  { text: "Mom's spaghetti", startMs: 12600, endMs: 13400 },
  { text: "He's nervous", startMs: 13500, endMs: 14200 },
  { text: "But on the surface he looks calm and ready", startMs: 14300, endMs: 15800 },
]

// Slow ballad example - lots of space between lines
const BALLAD_EXAMPLE: TimelineLyricLine[] = [
  { text: "Hello", startMs: 2000, endMs: 4500 },
  { text: "It's me", startMs: 6000, endMs: 8500 },
  { text: "I was wondering if after all these years", startMs: 11000, endMs: 16000 },
  { text: "You'd like to meet", startMs: 17000, endMs: 21000 },
  { text: "To go over everything", startMs: 24000, endMs: 29000 },
  { text: "They say that time's supposed to heal ya", startMs: 32000, endMs: 37000 },
  { text: "But I ain't done much healing", startMs: 39000, endMs: 44000 },
]

/** Interactive demo with playback controls - RED Guitar Hero style */
export const Interactive: Story = {
  render: () => {
    const playback = usePlaybackSimulator(65000)
    const [color, setColor] = createSignal<TimelineColorScheme>('red')
    const colors: TimelineColorScheme[] = ['red', 'blue', 'green', 'purple', 'orange']

    return (
      <div class="flex flex-col gap-4 w-[400px]">
        <VerticalTimeline
          lines={ANOTHER_ONE_BITES_THE_DUST}
          currentTimeMs={playback.currentTimeMs()}
          viewportHeight={500}
          pixelsPerSecond={80}
          colorScheme={color()}
          guitarHeroMode={true}
        />

        <div class="flex gap-2 justify-center">
          <button
            class="px-4 py-2 bg-red-500 text-white rounded-lg"
            onClick={() => playback.isPlaying() ? playback.pause() : playback.play()}
          >
            {playback.isPlaying() ? 'Pause' : 'Play'}
          </button>
          <button
            class="px-4 py-2 bg-white/20 text-white rounded-lg"
            onClick={() => playback.reset()}
          >
            Reset
          </button>
          <button
            class="px-4 py-2 bg-white/20 text-white rounded-lg"
            onClick={() => playback.seek(playback.currentTimeMs() - 5000)}
          >
            -5s
          </button>
          <button
            class="px-4 py-2 bg-white/20 text-white rounded-lg"
            onClick={() => playback.seek(playback.currentTimeMs() + 5000)}
          >
            +5s
          </button>
        </div>

        {/* Color picker */}
        <div class="flex gap-2 justify-center">
          <For each={colors}>
            {(c) => (
              <button
                class={`w-8 h-8 rounded-full border-2 ${color() === c ? 'border-white' : 'border-transparent'}`}
                style={{ background: c === 'red' ? '#ef4444' : c === 'blue' ? '#3b82f6' : c === 'green' ? '#22c55e' : c === 'purple' ? '#a855f7' : '#f97316' }}
                onClick={() => setColor(c)}
              />
            )}
          </For>
        </div>

        <div class="text-center text-white/60 text-sm">
          Another One Bites the Dust - Guitar Hero Mode
        </div>
      </div>
    )
  },
}

/** Fast rap - lines are tightly packed */
export const FastRap: Story = {
  render: () => {
    const playback = usePlaybackSimulator(20000)

    return (
      <div class="flex flex-col gap-4 w-[400px]">
        <VerticalTimeline
          lines={RAP_EXAMPLE}
          currentTimeMs={playback.currentTimeMs()}
          viewportHeight={500}
          pixelsPerSecond={100}
        />

        <div class="flex gap-2 justify-center">
          <button
            class="px-4 py-2 bg-primary text-white rounded-lg"
            onClick={() => playback.isPlaying() ? playback.pause() : playback.play()}
          >
            {playback.isPlaying() ? 'Pause' : 'Play'}
          </button>
          <button
            class="px-4 py-2 bg-white/20 text-white rounded-lg"
            onClick={() => playback.reset()}
          >
            Reset
          </button>
        </div>

        <div class="text-center text-white/60 text-sm">
          Lose Yourself - Fast rap, lines close together
        </div>
      </div>
    )
  },
}

/** Slow ballad - lots of space between lines */
export const SlowBallad: Story = {
  render: () => {
    const playback = usePlaybackSimulator(50000)

    return (
      <div class="flex flex-col gap-4 w-[400px]">
        <VerticalTimeline
          lines={BALLAD_EXAMPLE}
          currentTimeMs={playback.currentTimeMs()}
          viewportHeight={500}
          pixelsPerSecond={60}
        />

        <div class="flex gap-2 justify-center">
          <button
            class="px-4 py-2 bg-primary text-white rounded-lg"
            onClick={() => playback.isPlaying() ? playback.pause() : playback.play()}
          >
            {playback.isPlaying() ? 'Pause' : 'Play'}
          </button>
          <button
            class="px-4 py-2 bg-white/20 text-white rounded-lg"
            onClick={() => playback.reset()}
          >
            Reset
          </button>
        </div>

        <div class="text-center text-white/60 text-sm">
          Hello (Adele) - Slow ballad, big gaps between lines
        </div>
      </div>
    )
  },
}

/** Scrubber to manually explore timing */
export const WithScrubber: Story = {
  render: () => {
    const [timeMs, setTimeMs] = createSignal(19000)

    return (
      <div class="flex flex-col gap-4 w-[400px]">
        <VerticalTimeline
          lines={ANOTHER_ONE_BITES_THE_DUST}
          currentTimeMs={timeMs()}
          viewportHeight={500}
          pixelsPerSecond={80}
        />

        <div class="px-4">
          <input
            type="range"
            min={0}
            max={65000}
            value={timeMs()}
            onInput={(e) => setTimeMs(parseInt(e.currentTarget.value))}
            class="w-full"
          />
          <div class="text-center text-white/60 text-sm mt-2">
            Drag to scrub: {(timeMs() / 1000).toFixed(1)}s
          </div>
        </div>
      </div>
    )
  },
}

/** Compact mobile view */
export const MobileCompact: Story = {
  render: () => {
    const playback = usePlaybackSimulator(65000, true)

    return (
      <div class="w-[320px]">
        <VerticalTimeline
          lines={ANOTHER_ONE_BITES_THE_DUST}
          currentTimeMs={playback.currentTimeMs()}
          viewportHeight={300}
          pixelsPerSecond={60}
          nowMarkerPosition={0.4}
        />
      </div>
    )
  },
}

/** Different pixels per second comparison */
export const SpacingComparison: Story = {
  render: () => {
    const playback = usePlaybackSimulator(65000)

    return (
      <div class="flex gap-4">
        <div class="flex flex-col gap-2">
          <div class="text-white/60 text-xs text-center">60 px/sec (compact)</div>
          <VerticalTimeline
            lines={ANOTHER_ONE_BITES_THE_DUST}
            currentTimeMs={playback.currentTimeMs()}
            viewportHeight={400}
            pixelsPerSecond={60}
            class="w-[280px]"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-white/60 text-xs text-center">100 px/sec (spread)</div>
          <VerticalTimeline
            lines={ANOTHER_ONE_BITES_THE_DUST}
            currentTimeMs={playback.currentTimeMs()}
            viewportHeight={400}
            pixelsPerSecond={100}
            class="w-[280px]"
          />
        </div>

        <div class="mt-auto">
          <button
            class="px-3 py-1.5 bg-primary text-white rounded text-sm"
            onClick={() => playback.isPlaying() ? playback.pause() : playback.play()}
          >
            {playback.isPlaying() ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>
    )
  },
}
