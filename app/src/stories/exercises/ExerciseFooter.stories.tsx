import type { Meta, StoryObj } from '@storybook/react-vite'
import { ExerciseFooter } from '@/components/exercises/ExerciseFooter'

const meta = {
  title: 'Exercises/ExerciseFooter',
  component: ExerciseFooter,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ExerciseFooter>

export default meta
type Story = StoryObj<typeof meta>

export const VoiceControlsIdle: Story = {
  args: {
    show: true,
    controls: {
      type: 'voice',
      isRecording: false,
      isProcessing: false,
      onStartRecording: () => console.log('Start recording'),
      onStopRecording: () => console.log('Stop recording'),
    },
  },
}

export const VoiceControlsRecording: Story = {
  args: {
    show: true,
    controls: {
      type: 'voice',
      isRecording: true,
      isProcessing: false,
      onStartRecording: () => console.log('Start recording'),
      onStopRecording: () => console.log('Stop recording'),
    },
  },
}

export const VoiceControlsProcessing: Story = {
  args: {
    show: true,
    controls: {
      type: 'voice',
      isRecording: false,
      isProcessing: true,
      onStartRecording: () => console.log('Start recording'),
      onStopRecording: () => console.log('Stop recording'),
    },
  },
}

export const NavigationWithCorrectFeedback: Story = {
  args: {
    show: true,
    feedback: {
      isCorrect: true,
      message: 'Correct!',
    },
    controls: {
      type: 'navigation',
      onNext: () => console.log('Next clicked'),
      label: 'Next',
    },
  },
}

export const NavigationWithIncorrectFeedback: Story = {
  args: {
    show: true,
    feedback: {
      isCorrect: false,
      message: 'Try again',
    },
    controls: {
      type: 'navigation',
      onNext: () => console.log('Next clicked'),
      label: 'Continue',
    },
  },
}

export const NavigationWithReportButton: Story = {
  args: {
    show: true,
    feedback: {
      isCorrect: true,
    },
    controls: {
      type: 'navigation',
      onNext: () => console.log('Next clicked'),
      onReport: (reason) => console.log('Reported:', reason),
      exerciseKey: 'exercise-1',
      label: 'Next',
    },
  },
}

export const FinishButton: Story = {
  args: {
    show: true,
    feedback: {
      isCorrect: true,
      message: 'Perfect! You completed all exercises!',
    },
    controls: {
      type: 'navigation',
      onNext: () => console.log('Finish clicked'),
      label: 'Finish',
    },
  },
}

export const Hidden: Story = {
  args: {
    show: false,
    controls: {
      type: 'voice',
      onStartRecording: () => console.log('Start recording'),
      onStopRecording: () => console.log('Stop recording'),
    },
  },
}
