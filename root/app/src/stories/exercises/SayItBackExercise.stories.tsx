import type { Meta, StoryObj } from '@storybook/react'
import { SayItBackExercise } from '@/components/exercises/SayItBackExercise'
import { AnimatedFooter } from '@/components/exercises/AnimatedFooter'
import { ExerciseFeedback } from '@/components/exercises/ExerciseFeedback'
import { NavigationControls } from '@/components/exercises/NavigationControls'
import { VoiceControls } from '@/components/exercises/VoiceControls'

const meta: Meta<typeof SayItBackExercise> = {
  title: 'Exercises/SayItBackExercise',
  component: SayItBackExercise,
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
type Story = StoryObj<typeof SayItBackExercise>

export const NotStarted: Story = {
  render: () => (
    <div className="h-screen bg-background flex flex-col relative">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <SayItBackExercise
            expectedText="Hello, how are you?"
            canRecord={true}
            onStartRecording={() => console.log('Start recording')}
            onStopRecording={() => console.log('Stop recording')}
          />
        </div>
      </div>

      <AnimatedFooter show={true}>
        <VoiceControls
          onStartRecording={() => console.log('Start recording')}
          onStopRecording={() => console.log('Stop recording')}
        />
      </AnimatedFooter>
    </div>
  ),
}

export const Recording: Story = {
  render: () => (
    <div className="h-screen bg-background flex flex-col relative">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <SayItBackExercise
            expectedText="Hello, how are you?"
            isRecording={true}
            canRecord={true}
            onStartRecording={() => console.log('Start recording')}
            onStopRecording={() => console.log('Stop recording')}
          />
        </div>
      </div>

      <AnimatedFooter show={true}>
        <VoiceControls
          isRecording={true}
          onStartRecording={() => console.log('Start recording')}
          onStopRecording={() => console.log('Stop recording')}
        />
      </AnimatedFooter>
    </div>
  ),
}

export const Processing: Story = {
  render: () => (
    <div className="h-screen bg-background flex flex-col relative">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <SayItBackExercise
            expectedText="Hello, how are you?"
            isProcessing={true}
            canRecord={true}
            onStartRecording={() => console.log('Start recording')}
            onStopRecording={() => console.log('Stop recording')}
          />
        </div>
      </div>

      <AnimatedFooter show={true}>
        <VoiceControls
          isProcessing={true}
          onStartRecording={() => console.log('Start recording')}
          onStopRecording={() => console.log('Stop recording')}
        />
      </AnimatedFooter>
    </div>
  ),
}

export const NotReady: Story = {
  render: () => (
    <div className="h-screen bg-background flex flex-col relative">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <SayItBackExercise
            expectedText="Hello, how are you?"
            canRecord={false}
            statusMessage="Connecting to speech recognition..."
            onStartRecording={() => console.log('Start recording')}
            onStopRecording={() => console.log('Stop recording')}
          />
        </div>
      </div>

      <AnimatedFooter show={false}>
        <VoiceControls
          onStartRecording={() => console.log('Start recording')}
          onStopRecording={() => console.log('Stop recording')}
        />
      </AnimatedFooter>
    </div>
  ),
}

export const CorrectAnswer: Story = {
  render: () => (
    <div className="h-screen bg-background flex flex-col relative">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <SayItBackExercise
            expectedText="Good morning"
            transcript="Good morning"
            score={100}
            canRecord={true}
          />
        </div>
      </div>

      <AnimatedFooter show={true}>
        <div className="space-y-3">
          <ExerciseFeedback variant="correct" />
          <NavigationControls
            label="Next"
            onNext={() => console.log('Next clicked')}
          />
        </div>
      </AnimatedFooter>
    </div>
  ),
}

export const Incorrect: Story = {
  render: () => (
    <div className="h-screen bg-background flex flex-col relative">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <SayItBackExercise
            expectedText="Good morning"
            transcript="Good evening"
            score={50}
            attempts={1}
            canRecord={true}
          />
        </div>
      </div>

      <AnimatedFooter show={true}>
        <div className="space-y-3">
          <ExerciseFeedback variant="incorrect" />
          <NavigationControls
            label="Try again"
            onNext={() => console.log('Try again clicked')}
          />
        </div>
      </AnimatedFooter>
    </div>
  ),
}
