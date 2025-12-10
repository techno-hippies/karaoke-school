import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import { GradeSlotMachine, type PracticeGrade } from './GradeSlotMachine'

const meta: Meta<typeof GradeSlotMachine> = {
  title: 'Karaoke/GradeSlotMachine',
  component: GradeSlotMachine,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div class="bg-background p-12 rounded-xl min-w-[300px]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof GradeSlotMachine>

/** Interactive - click buttons to land on different grades */
export const Interactive: Story = {
  render: () => {
    const [isSpinning, setIsSpinning] = createSignal(true)
    const [grade, setGrade] = createSignal<PracticeGrade | null>(null)

    const simulateGrading = (targetGrade: PracticeGrade) => {
      setIsSpinning(true)
      setGrade(null)
      setTimeout(() => {
        setGrade(targetGrade)
        setIsSpinning(false)
      }, 2000)
    }

    return (
      <div class="space-y-8">
        <GradeSlotMachine grade={grade()} isSpinning={isSpinning()} />

        <div class="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => simulateGrading('A')}
            class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
          >
            A
          </button>
          <button
            onClick={() => simulateGrading('B')}
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500"
          >
            B
          </button>
          <button
            onClick={() => simulateGrading('C')}
            class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500"
          >
            C
          </button>
          <button
            onClick={() => simulateGrading('D')}
            class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500"
          >
            D
          </button>
          <button
            onClick={() => simulateGrading('F')}
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
          >
            F
          </button>
          <button
            onClick={() => { setIsSpinning(true); setGrade(null) }}
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
          >
            Reset
          </button>
        </div>
      </div>
    )
  },
}
