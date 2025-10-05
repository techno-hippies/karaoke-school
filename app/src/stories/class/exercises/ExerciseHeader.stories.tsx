import type { Meta, StoryObj } from '@storybook/react'
import { ExerciseHeader } from '@/components/exercises/ExerciseHeader'

const meta: Meta<typeof ExerciseHeader> = {
  title: 'Exercises/ExerciseHeader',
  component: ExerciseHeader,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ExerciseHeader>

/**
 * At start of session (0% progress)
 */
export const Start: Story = {
  render: () => (
    <div className="h-screen bg-background relative">
      <ExerciseHeader
        progress={0}
        onClose={() => console.log('Close clicked')}
      />
      <div className="pt-24 p-6 text-center">
        <div className="text-foreground text-lg">
          Exercise content goes here
        </div>
      </div>
    </div>
  ),
}

/**
 * 25% through session
 */
export const Quarter: Story = {
  render: () => (
    <div className="h-screen bg-background relative">
      <ExerciseHeader
        progress={25}
        onClose={() => console.log('Close clicked')}
      />
      <div className="pt-24 p-6 text-center">
        <div className="text-foreground text-lg">
          25% complete
        </div>
      </div>
    </div>
  ),
}

/**
 * Halfway through session
 */
export const Half: Story = {
  render: () => (
    <div className="h-screen bg-background relative">
      <ExerciseHeader
        progress={50}
        onClose={() => console.log('Close clicked')}
      />
      <div className="pt-24 p-6 text-center">
        <div className="text-foreground text-lg">
          50% complete
        </div>
      </div>
    </div>
  ),
}

/**
 * Almost done (90% progress)
 */
export const AlmostDone: Story = {
  render: () => (
    <div className="h-screen bg-background relative">
      <ExerciseHeader
        progress={90}
        onClose={() => console.log('Close clicked')}
      />
      <div className="pt-24 p-6 text-center">
        <div className="text-foreground text-lg">
          90% complete
        </div>
      </div>
    </div>
  ),
}

/**
 * Complete (100% progress)
 */
export const Complete: Story = {
  render: () => (
    <div className="h-screen bg-background relative">
      <ExerciseHeader
        progress={100}
        onClose={() => console.log('Close clicked')}
      />
      <div className="pt-24 p-6 text-center">
        <div className="text-foreground text-lg">
          100% complete!
        </div>
      </div>
    </div>
  ),
}

/**
 * Without close button
 */
export const NoCloseButton: Story = {
  render: () => (
    <div className="h-screen bg-background relative">
      <ExerciseHeader
        progress={50}
        onClose={() => console.log('Close clicked')}
        showCloseButton={false}
      />
      <div className="pt-24 p-6 text-center">
        <div className="text-foreground text-lg">
          No close button (forced session)
        </div>
      </div>
    </div>
  ),
}

/**
 * In realistic exercise context with content
 */
export const InExerciseContext: Story = {
  render: () => (
    <div className="h-screen bg-background flex flex-col relative">
      <ExerciseHeader
        progress={60}
        onClose={() => console.log('Close clicked')}
      />

      {/* Exercise content */}
      <div className="flex-1 pt-24 pb-32 px-6 flex items-center justify-center">
        <div className="max-w-2xl w-full space-y-6">
          <div className="text-left space-y-3">
            <div className="text-muted-foreground text-base font-medium">
              Say it back:
            </div>
            <div className="text-xl font-medium text-foreground leading-relaxed">
              Hello, how are you?
            </div>
          </div>

          <div className="p-6 bg-green-500/20 border border-green-500/50 rounded-lg">
            <div className="text-green-400 text-xl font-medium">
              Correct!
            </div>
          </div>
        </div>
      </div>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-secondary border-t border-border">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <button className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium">
            Next
          </button>
        </div>
      </div>
    </div>
  ),
}
