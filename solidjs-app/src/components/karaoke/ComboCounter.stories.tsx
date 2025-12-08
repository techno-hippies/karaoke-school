import type { Meta, StoryObj } from 'storybook-solidjs'
import { ComboCounter } from './ComboCounter'
import { createSignal } from 'solid-js'

const meta: Meta<typeof ComboCounter> = {
  title: 'Karaoke/ComboCounter',
  component: ComboCounter,
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
type Story = StoryObj<typeof ComboCounter>

/** Interactive - hit to build combo, miss to reset */
export const Interactive: Story = {
  render: () => {
    const [combo, setCombo] = createSignal(1)

    return (
      <div class="flex flex-col items-center gap-8">
        <ComboCounter combo={combo()} />

        <p class="text-white text-base opacity-60">
          {combo() === 1 ? 'No combo yet' : `${combo()}x combo!`}
        </p>

        <div class="flex gap-4">
          <button
            onClick={() => setCombo((c) => c + 1)}
            class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
          >
            HIT
          </button>
          <button
            onClick={() => setCombo(1)}
            class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold"
          >
            MISS
          </button>
        </div>
      </div>
    )
  },
}
