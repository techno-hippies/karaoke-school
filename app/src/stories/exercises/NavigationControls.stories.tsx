import type { Meta, StoryObj } from '@storybook/react-vite'
import { NavigationControls } from '@/components/exercises/NavigationControls'

const meta = {
  title: 'Exercises/NavigationControls',
  component: NavigationControls,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '500px' }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof NavigationControls>

export default meta
type Story = StoryObj<typeof meta>

export const Next: Story = {
  args: {
    label: 'Next',
    onNext: () => console.log('Next clicked'),
    disabled: false,
  },
}

export const Continue: Story = {
  args: {
    label: 'Continue',
    onNext: () => console.log('Continue clicked'),
    disabled: false,
  },
}

export const Finish: Story = {
  args: {
    label: 'Finish',
    onNext: () => console.log('Finish clicked'),
    disabled: false,
  },
}

export const Disabled: Story = {
  args: {
    label: 'Next',
    onNext: () => console.log('Next clicked'),
    disabled: true,
  },
}

export const WithReportButton: Story = {
  args: {
    label: 'Next',
    onNext: () => console.log('Next clicked'),
    onReport: (reason) => console.log('Reported:', reason),
    exerciseKey: 'exercise-1',
    disabled: false,
  },
}
