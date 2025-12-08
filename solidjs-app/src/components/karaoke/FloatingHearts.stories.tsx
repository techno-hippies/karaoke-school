import type { Meta, StoryObj } from 'storybook-solidjs'
import { FloatingHearts, getHeartsRate } from './FloatingHearts'
import { createSignal } from 'solid-js'

const meta: Meta<typeof FloatingHearts> = {
  title: 'Karaoke/FloatingHearts',
  component: FloatingHearts,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof FloatingHearts>

/** Interactive - adjust performance and combo to see hearts change */
export const Interactive: Story = {
  render: () => {
    const [performanceLevel, setPerformanceLevel] = createSignal(0.5)
    const [combo, setCombo] = createSignal(1)
    const heartsRate = () => getHeartsRate(performanceLevel(), combo())

    return (
      <div class="relative h-screen w-full bg-gradient-to-b from-purple-900 to-black">
        <FloatingHearts
          heartsPerSecond={heartsRate()}
          performanceLevel={performanceLevel()}
          combo={combo()}
        />

        <div class="absolute top-10 left-1/2 -translate-x-1/2 bg-black/50 p-6 rounded-xl text-white space-y-4 z-10">
          <div>
            <label class="block text-base mb-2">Performance: {Math.round(performanceLevel() * 100)}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={performanceLevel() * 100}
              onInput={(e) => setPerformanceLevel(parseInt(e.currentTarget.value) / 100)}
              class="w-48"
            />
          </div>

          <div>
            <label class="block text-base mb-2">Combo: {combo()}x</label>
            <input
              type="range"
              min="1"
              max="15"
              value={combo()}
              onInput={(e) => setCombo(parseInt(e.currentTarget.value))}
              class="w-48"
            />
          </div>

          <div class="text-center pt-2 border-t border-white/20">
            <span class="text-base opacity-60">Hearts/sec:</span>
            <span class="ml-2 font-bold text-xl">{heartsRate().toFixed(1)}</span>
          </div>
        </div>
      </div>
    )
  },
}
