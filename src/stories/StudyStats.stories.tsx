import type { Meta, StoryObj } from '@storybook/react-vite'
import { StudyStats } from '../components/exercises/StudyStats'

const meta: Meta<typeof StudyStats> = {
  title: 'Exercises/StudyStats',
  component: StudyStats,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#171717' },
      ],
    },
  },
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
    showButton: {
      control: 'boolean',
    },
    showTitle: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof StudyStats>

export const Default: Story = {
  args: {
    newCount: 23,
    learningCount: 15,
    dueCount: 42,
    onStudy: () => console.log('Study clicked'),
  },
}

export const WithButton: Story = {
  args: {
    newCount: 23,
    learningCount: 15,
    dueCount: 42,
    showButton: true,
    onStudy: () => console.log('Study clicked'),
  },
}

export const WithoutTitle: Story = {
  args: {
    newCount: 10,
    learningCount: 5,
    dueCount: 8,
    showTitle: false,
    showButton: true,
    onStudy: () => console.log('Study clicked'),
  },
}

export const AllZeros: Story = {
  args: {
    newCount: 0,
    learningCount: 0,
    dueCount: 0,
    showButton: true,
    onStudy: () => console.log('Study clicked'),
  },
}

export const LargeCounts: Story = {
  args: {
    newCount: 999,
    learningCount: 150,
    dueCount: 1250,
    showButton: true,
    onStudy: () => console.log('Study clicked'),
  },
}

export const OnlyDue: Story = {
  args: {
    newCount: 0,
    learningCount: 0,
    dueCount: 87,
    showButton: true,
    onStudy: () => console.log('Study clicked'),
  },
}

export const OnlyNew: Story = {
  args: {
    newCount: 45,
    learningCount: 0,
    dueCount: 0,
    showButton: true,
    onStudy: () => console.log('Study clicked'),
  },
}

export const OnlyLearning: Story = {
  args: {
    newCount: 0,
    learningCount: 25,
    dueCount: 0,
    showButton: true,
    onStudy: () => console.log('Study clicked'),
  },
}

export const Compact: Story = {
  args: {
    newCount: 12,
    learningCount: 8,
    dueCount: 15,
    showTitle: false,
    showButton: false,
  },
}