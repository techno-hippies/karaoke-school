import type { Meta, StoryObj } from '@storybook/react'
import { AnimatedFooter } from '@/components/exercises/AnimatedFooter'
import { VoiceControls } from '@/components/exercises/VoiceControls'
import { NavigationControls } from '@/components/exercises/NavigationControls'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const meta: Meta<typeof AnimatedFooter> = {
  title: 'Exercises/AnimatedFooter',
  component: AnimatedFooter,
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
type Story = StoryObj<typeof AnimatedFooter>

/**
 * Footer visible with VoiceControls inside
 */
export const WithVoiceControls: Story = {
  render: () => (
    <div className="h-screen bg-background flex items-center justify-center relative">
      <div className="text-foreground text-lg">
        Exercise content goes here
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

/**
 * Footer visible with NavigationControls inside
 */
export const WithNavigationControls: Story = {
  render: () => (
    <div className="h-screen bg-background flex items-center justify-center relative">
      <div className="text-foreground text-lg">
        Exercise content goes here
      </div>

      <AnimatedFooter show={true}>
        <NavigationControls
          label="Next"
          onNext={() => console.log('Next clicked')}
        />
      </AnimatedFooter>
    </div>
  ),
}

/**
 * Footer hidden (slides down out of view)
 */
export const Hidden: Story = {
  render: () => (
    <div className="h-screen bg-background flex items-center justify-center relative">
      <div className="text-foreground text-lg">
        Footer is hidden - check bottom of screen
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

/**
 * Interactive toggle demo
 */
export const InteractiveToggle: Story = {
  render: () => {
    const [show, setShow] = useState(true)

    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center relative p-6">
        <div className="text-center space-y-6">
          <div className="text-foreground text-lg">
            Toggle the footer animation
          </div>

          <Button onClick={() => setShow(!show)}>
            {show ? 'Hide Footer' : 'Show Footer'}
          </Button>

          <div className="text-muted-foreground text-sm">
            Footer is currently: {show ? 'visible' : 'hidden'}
          </div>
        </div>

        <AnimatedFooter show={show}>
          <VoiceControls
            onStartRecording={() => console.log('Start recording')}
            onStopRecording={() => console.log('Stop recording')}
          />
        </AnimatedFooter>
      </div>
    )
  },
}

/**
 * In realistic exercise context
 */
export const InExerciseContext: Story = {
  render: () => {
    const [showFooter, setShowFooter] = useState(false)
    const [answered, setAnswered] = useState(false)

    const handleAnswer = () => {
      setAnswered(true)
      setShowFooter(true)
    }

    return (
      <div className="h-screen bg-background flex flex-col relative">
        {/* Exercise content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-6">
            <div className="text-left space-y-3">
              <div className="text-muted-foreground text-base font-medium">
                Question:
              </div>
              <div className="text-xl font-medium text-foreground leading-relaxed">
                What is 2 + 2?
              </div>
            </div>

            {!answered && (
              <div className="space-y-3">
                <button
                  onClick={handleAnswer}
                  className="w-full p-4 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors"
                >
                  4
                </button>
                <button className="w-full p-4 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors">
                  5
                </button>
              </div>
            )}

            {answered && (
              <div className="p-6 bg-green-500/20 border border-green-500/50 rounded-lg">
                <div className="text-green-400 text-xl font-medium">
                  Correct!
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Animated footer appears after answer */}
        <AnimatedFooter show={showFooter}>
          <NavigationControls
            label="Next"
            onNext={() => console.log('Next clicked')}
          />
        </AnimatedFooter>
      </div>
    )
  },
}

/**
 * With NavigationControls and report button
 */
export const WithReportButton: Story = {
  render: () => (
    <div className="h-screen bg-background flex items-center justify-center relative">
      <div className="text-foreground text-lg">
        Exercise content goes here
      </div>

      <AnimatedFooter show={true}>
        <NavigationControls
          label="Next"
          exerciseKey="exercise-123"
          onNext={() => console.log('Next clicked')}
          onReport={(reason) => console.log('Reported:', reason)}
        />
      </AnimatedFooter>
    </div>
  ),
}
