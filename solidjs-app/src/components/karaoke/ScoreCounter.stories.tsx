import type { Meta, StoryObj } from 'storybook-solidjs'
import { ScoreCounter } from './ScoreCounter'
import { createSignal } from 'solid-js'

const meta: Meta<typeof ScoreCounter> = {
  title: 'Karaoke/ScoreCounter',
  component: ScoreCounter,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div class="p-10">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ScoreCounter>

/** Interactive - click buttons to adjust score */
export const Interactive: Story = {
  render: () => {
    const [score, setScore] = createSignal(50)

    const addPoints = (points: number) => {
      setScore((prev) => Math.min(100, Math.max(0, prev + points)))
    }

    return (
      <div class="flex flex-col items-center gap-8">
        <ScoreCounter score={score()} label="Score" />

        <div class="flex gap-2">
          <button
            onClick={() => addPoints(-10)}
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            -10
          </button>
          <button
            onClick={() => addPoints(10)}
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            +10
          </button>
          <button
            onClick={() => setScore(0)}
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Reset
          </button>
        </div>
      </div>
    )
  },
}
