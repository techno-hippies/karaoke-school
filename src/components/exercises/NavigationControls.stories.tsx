import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { NavigationControls } from './NavigationControls'

const meta: Meta<typeof NavigationControls> = {
  title: 'Exercises/NavigationControls',
  component: NavigationControls,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a0a' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-md p-6">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof NavigationControls>

// Basic States
export const Default: Story = {
  args: {
    onNext: () => console.log('Next clicked'),
    label: 'Next',
    disabled: false,
  },
}

export const Disabled: Story = {
  args: {
    onNext: () => console.log('Next clicked'),
    label: 'Next',
    disabled: true,
  },
}

export const CustomLabel: Story = {
  args: {
    onNext: () => console.log('Continue clicked'),
    label: 'Continue',
    disabled: false,
  },
}

export const WithReportButton: Story = {
  args: {
    onNext: () => console.log('Next clicked'),
    onReport: (reason) => console.log('Reported:', reason),
    exerciseKey: 'exercise-123',
    label: 'Next',
    disabled: false,
  },
}

export const DisabledWithReport: Story = {
  args: {
    onNext: () => console.log('Next clicked'),
    onReport: (reason) => console.log('Reported:', reason),
    exerciseKey: 'exercise-123',
    label: 'Next',
    disabled: true,
  },
}

// Interactive Examples
export const InteractiveWithReport: Story = {
  render: () => {
    const [reportedIssues, setReportedIssues] = useState<string[]>([])
    const [currentExercise, setCurrentExercise] = useState(1)

    const handleReport = (reason: string) => {
      console.log('Reported:', reason)
      setReportedIssues(prev => [...prev, reason])
    }

    const handleNext = () => {
      console.log('Next exercise')
      setCurrentExercise(prev => prev + 1)
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">
            Exercise {currentExercise}
          </h3>
          <p className="text-sm text-neutral-400">
            Click the flag icon to report an issue
          </p>
        </div>

        <NavigationControls
          onNext={handleNext}
          onReport={handleReport}
          exerciseKey={`exercise-${currentExercise}`}
        />

        {reportedIssues.length > 0 && (
          <div className="p-4 bg-yellow-900/20 border border-yellow-600 rounded-lg">
            <p className="text-yellow-400 text-sm font-medium mb-2">
              Reported Issues ({reportedIssues.length}):
            </p>
            <ul className="space-y-1">
              {reportedIssues.map((issue, index) => (
                <li key={index} className="text-yellow-300 text-sm">
                  • {issue.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  },
}

// State Transitions
export const EnabledAfterAnswer: Story = {
  render: () => {
    const [hasAnswered, setHasAnswered] = useState(false)

    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold text-white">
            Answer Required Flow
          </h3>
          <p className="text-sm text-neutral-400">
            Next button is disabled until you answer the question
          </p>

          {/* Mock question */}
          <div className="p-4 bg-neutral-800 rounded-lg text-left">
            <p className="text-white mb-3">What is 2 + 2?</p>
            <div className="space-y-2">
              {['3', '4', '5', '6'].map((answer) => (
                <button
                  key={answer}
                  onClick={() => setHasAnswered(true)}
                  disabled={hasAnswered}
                  className="w-full p-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors disabled:opacity-50"
                >
                  {answer}
                </button>
              ))}
            </div>
          </div>

          {hasAnswered && (
            <div className="text-green-400 font-medium">
              ✓ Answer recorded!
            </div>
          )}
        </div>

        <NavigationControls
          onNext={() => {
            console.log('Next exercise')
            setHasAnswered(false)
          }}
          disabled={!hasAnswered}
        />
      </div>
    )
  },
}

// In Exercise Context
export const InExerciseContext: Story = {
  render: () => {
    const [answered, setAnswered] = useState(false)

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        {/* Exercise content */}
        <div className="flex-1 px-6 py-8 max-w-2xl mx-auto">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-medium text-white mb-4">
                Translate: "Hello"
              </h2>
              <div className="space-y-2">
                {['Hola', 'Adiós', 'Gracias', 'Por favor'].map((option, i) => (
                  <button
                    key={i}
                    onClick={() => setAnswered(true)}
                    className="w-full p-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-800 border-t border-neutral-700">
          <div className="max-w-2xl mx-auto px-6 py-4">
            <NavigationControls
              onNext={() => {
                console.log('Next')
                setAnswered(false)
              }}
              onReport={(reason) => console.log('Reported:', reason)}
              exerciseKey="translate-hello"
              disabled={!answered}
            />
          </div>
        </div>
      </div>
    )
  },
  parameters: {
    layout: 'fullscreen',
  },
}

// Report Flow
export const ReportFlow: Story = {
  render: () => {
    const [reported, setReported] = useState<string | null>(null)

    const handleReport = (reason: string) => {
      console.log('Reported:', reason)
      setReported(reason)
      setTimeout(() => setReported(null), 3000)
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">
            Report Issue Flow
          </h3>
          <p className="text-sm text-neutral-400">
            Click the flag icon to open report menu
          </p>
        </div>

        <NavigationControls
          onNext={() => console.log('Next')}
          onReport={handleReport}
          exerciseKey="example-exercise"
        />

        {reported && (
          <div className="p-4 bg-green-900/20 border border-green-600 rounded-lg animate-in fade-in slide-in-from-bottom-2">
            <p className="text-green-400 text-sm font-medium">
              Thank you for your feedback!
            </p>
            <p className="text-green-300 text-sm mt-1">
              Reported: {reported.replace(/_/g, ' ')}
            </p>
          </div>
        )}
      </div>
    )
  },
}

// Different Labels
export const DifferentLabels: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-neutral-400 mb-2">Default:</p>
        <NavigationControls onNext={() => console.log('Next')} />
      </div>

      <div>
        <p className="text-sm text-neutral-400 mb-2">Continue:</p>
        <NavigationControls onNext={() => console.log('Continue')} label="Continue" />
      </div>

      <div>
        <p className="text-sm text-neutral-400 mb-2">Finish:</p>
        <NavigationControls onNext={() => console.log('Finish')} label="Finish" />
      </div>

      <div>
        <p className="text-sm text-neutral-400 mb-2">Check Answer:</p>
        <NavigationControls onNext={() => console.log('Check')} label="Check Answer" />
      </div>
    </div>
  ),
}

// Mobile View
export const MobileView: Story = {
  render: () => (
    <div className="w-[375px] p-4">
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-white font-medium mb-2">Mobile View</h3>
          <p className="text-sm text-neutral-400">With report button</p>
        </div>
        <NavigationControls
          onNext={() => console.log('Next')}
          onReport={(reason) => console.log('Reported:', reason)}
          exerciseKey="mobile-exercise"
        />
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
