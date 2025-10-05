import type { Meta, StoryObj } from '@storybook/react-vite'
import { StudyStats } from '@/components/school/StudyStats'

const meta = {
  title: 'Class/StudyStats',
  component: StudyStats,
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
  argTypes: {
    newCount: {
      control: 'number',
    },
    learningCount: {
      control: 'number',
    },
    dueCount: {
      control: 'number',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl mx-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StudyStats>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    newCount: 12,
    learningCount: 5,
    dueCount: 8,
  },
}

export const NoCards: Story = {
  args: {
    newCount: 0,
    learningCount: 0,
    dueCount: 0,
  },
}

export const HighNumbers: Story = {
  args: {
    newCount: 150,
    learningCount: 42,
    dueCount: 89,
  },
}

export const OnlyNew: Story = {
  args: {
    newCount: 25,
    learningCount: 0,
    dueCount: 0,
  },
}

export const OnlyDue: Story = {
  args: {
    newCount: 0,
    learningCount: 0,
    dueCount: 15,
  },
}
