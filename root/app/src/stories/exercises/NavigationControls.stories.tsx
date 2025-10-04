import type { Meta, StoryObj } from '@storybook/react'
import { NavigationControls } from '@/components/exercises/NavigationControls'

const meta: Meta<typeof NavigationControls> = {
  title: 'Exercises/NavigationControls',
  component: NavigationControls,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl mx-auto">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof NavigationControls>

/**
 * Default "Next" button without report functionality
 */
export const Default: Story = {
  args: {
    label: 'Next',
    onNext: () => console.log('Next clicked'),
  },
}

/**
 * With report button enabled
 */
export const WithReport: Story = {
  args: {
    label: 'Next',
    exerciseKey: 'exercise-123',
    onNext: () => console.log('Next clicked'),
    onReport: (reason) => console.log('Reported:', reason),
  },
}

/**
 * Disabled state (waiting for user to answer)
 */
export const Disabled: Story = {
  args: {
    label: 'Next',
    disabled: true,
    onNext: () => console.log('Next clicked'),
  },
}

/**
 * Custom label - "Finish"
 */
export const Finish: Story = {
  args: {
    label: 'Finish',
    onNext: () => console.log('Finish clicked'),
  },
}

/**
 * Custom label - "Continue"
 */
export const Continue: Story = {
  args: {
    label: 'Continue',
    onNext: () => console.log('Continue clicked'),
  },
}

/**
 * Finish with report option
 */
export const FinishWithReport: Story = {
  args: {
    label: 'Finish',
    exerciseKey: 'exercise-456',
    onNext: () => console.log('Finish clicked'),
    onReport: (reason) => console.log('Reported:', reason),
  },
}

/**
 * In exercise context (with padding)
 */
export const InExerciseContext: Story = {
  render: () => (
    <div className="min-h-[400px] flex flex-col bg-background">
      {/* Exercise content */}
      <div className="flex-1 p-6">
        <div className="space-y-6">
          <div className="text-left space-y-3">
            <div className="text-muted-foreground text-base font-medium">
              Question:
            </div>
            <div className="text-xl font-medium text-foreground leading-relaxed">
              What is the capital of France?
            </div>
          </div>

          {/* Answered state */}
          <div className="p-6 bg-green-500/20 border border-green-500/50 rounded-lg">
            <div className="text-green-400 text-xl font-medium">
              Correct! Paris is the capital of France.
            </div>
          </div>
        </div>
      </div>

      {/* Navigation controls at bottom */}
      <div className="p-6 border-t border-border bg-secondary/20">
        <NavigationControls
          label="Next"
          exerciseKey="exercise-789"
          onNext={() => console.log('Next clicked')}
          onReport={(reason) => console.log('Reported:', reason)}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
}
