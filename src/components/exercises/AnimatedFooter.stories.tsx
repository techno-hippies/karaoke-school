import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { AnimatedFooter } from './AnimatedFooter'
import { NavigationControls } from './NavigationControls'
import { VoiceControls } from './VoiceControls'

const meta: Meta<typeof AnimatedFooter> = {
  title: 'Exercises/AnimatedFooter',
  component: AnimatedFooter,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a0a' },
      ],
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof AnimatedFooter>

// Basic States
export const Hidden: Story = {
  args: {
    show: false,
    children: <NavigationControls onNext={() => console.log('Next clicked')} />,
  },
}

export const Visible: Story = {
  args: {
    show: true,
    children: <NavigationControls onNext={() => console.log('Next clicked')} />,
  },
}

export const WithVoiceControls: Story = {
  args: {
    show: true,
    children: (
      <VoiceControls
        isRecording={false}
        onStartRecording={() => console.log('Start')}
        onStopRecording={() => console.log('Stop')}
      />
    ),
  },
}

export const WithNavigationAndFlag: Story = {
  args: {
    show: true,
    children: (
      <NavigationControls
        onNext={() => console.log('Next clicked')}
        onReport={(reason) => console.log('Reported issue:', reason)}
        exerciseKey="songid123-zh-CN-0"
      />
    ),
  },
}

// Interactive Demo
export const Interactive: Story = {
  render: () => {
    const [show, setShow] = useState(false)
    const [answered, setAnswered] = useState(false)

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">AnimatedFooter Demo</h1>
          <p className="text-neutral-400">
            Click the button below to simulate answering a question and see the footer animate up.
          </p>
          <button
            onClick={() => {
              setAnswered(true)
              setShow(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Answer Question
          </button>
          {answered && (
            <p className="text-green-400 mt-4">✓ Question answered!</p>
          )}
        </div>

        <AnimatedFooter show={show}>
          <NavigationControls
            onNext={() => {
              console.log('Next clicked')
              setShow(false)
              setAnswered(false)
            }}
          />
        </AnimatedFooter>
      </div>
    )
  },
}

// Transition Between Content
export const TransitionDemo: Story = {
  render: () => {
    const [show, setShow] = useState(false)
    const [footerContent, setFooterContent] = useState<'voice' | 'navigation'>('voice')

    const createMockBlob = () => new Blob(['mock'], { type: 'audio/webm' })

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Footer Transition Demo</h1>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={() => {
                setFooterContent('voice')
                setShow(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Show Voice Controls
            </button>
            <button
              onClick={() => {
                setFooterContent('navigation')
                setShow(true)
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Show Navigation
            </button>
            <button
              onClick={() => setShow(false)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Hide Footer
            </button>
          </div>
        </div>

        <AnimatedFooter show={show}>
          {footerContent === 'voice' ? (
            <VoiceControls
              isRecording={false}
              onStartRecording={() => console.log('Start')}
              onStopRecording={() => {
                console.log('Stop - auto submitting')
                setFooterContent('navigation')
              }}
            />
          ) : (
            <NavigationControls
              onNext={() => {
                console.log('Next clicked')
                setShow(false)
              }}
            />
          )}
        </AnimatedFooter>
      </div>
    )
  },
}

// With Flag Button
export const InteractiveWithFlag: Story = {
  render: () => {
    const [show, setShow] = useState(true)
    const [reportedIssues, setReportedIssues] = useState<string[]>([])

    const handleReport = (reason: string) => {
      console.log('Reported:', reason)
      setReportedIssues(prev => [...prev, reason])
    }

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Exercise Footer with Flag Button</h1>
          <p className="text-neutral-400">
            This demonstrates the footer with a flag button for reporting issues.
          </p>

          <div className="bg-neutral-800 p-4 rounded-lg">
            <p className="text-white font-medium mb-2">Sample Question:</p>
            <p className="text-neutral-300">What does "hello" mean in Spanish?</p>
            <div className="mt-3 space-y-2">
              <button className="w-full p-2 bg-neutral-700 text-white rounded hover:bg-neutral-600">
                A) Adiós
              </button>
              <button className="w-full p-2 bg-green-600 text-white rounded">
                B) Hola ✓
              </button>
              <button className="w-full p-2 bg-neutral-700 text-white rounded hover:bg-neutral-600">
                C) Gracias
              </button>
            </div>
          </div>

          {reportedIssues.length > 0 && (
            <div className="bg-red-900/20 border border-red-600 p-3 rounded">
              <p className="text-red-400 text-sm font-medium mb-1">Reported Issues:</p>
              {reportedIssues.map((issue, index) => (
                <p key={index} className="text-red-300 text-sm">
                  • {issue.replace(/_/g, ' ')}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={() => setShow(!show)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {show ? 'Hide' : 'Show'} Footer
          </button>
        </div>

        <AnimatedFooter show={show}>
          <NavigationControls
            onNext={() => {
              console.log('Next clicked')
              setReportedIssues([])
            }}
            onReport={handleReport}
            exerciseKey="songid-demo-zh-CN-0"
          />
        </AnimatedFooter>
      </div>
    )
  },
}

// Dual Footer System (as in actual study page)
export const DualFooterSystem: Story = {
  render: () => {
    const [hasAnswered, setHasAnswered] = useState(false)
    const [showFeedback, setShowFeedback] = useState(false)
    const [isCorrect, setIsCorrect] = useState(false)

    const handleAnswer = (correct: boolean) => {
      setHasAnswered(true)
      setIsCorrect(correct)
      setShowFeedback(true)
      setTimeout(() => setShowFeedback(false), 2000)
    }

    const handleNext = () => {
      setHasAnswered(false)
      setShowFeedback(false)
    }

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        {/* Content */}
        <div className="flex-1 pt-8 pb-32 px-6 max-w-2xl mx-auto">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-medium text-white mb-4">
                What does "gracias" mean?
              </h2>
              <div className="space-y-2">
                <button
                  onClick={() => handleAnswer(false)}
                  disabled={hasAnswered}
                  className="w-full p-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Goodbye
                </button>
                <button
                  onClick={() => handleAnswer(true)}
                  disabled={hasAnswered}
                  className="w-full p-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Thank you
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  disabled={hasAnswered}
                  className="w-full p-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Please
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Footer */}
        <AnimatedFooter show={showFeedback}>
          <div className={`text-center text-lg font-medium ${
            isCorrect ? 'text-green-400' : 'text-red-400'
          }`}>
            {isCorrect ? '✓ Correct!' : '✗ Incorrect, try again'}
          </div>
        </AnimatedFooter>

        {/* Controls Footer (always shown) */}
        <AnimatedFooter show={true}>
          <NavigationControls
            onNext={handleNext}
            disabled={!hasAnswered}
            onReport={(reason) => console.log('Reported:', reason)}
            exerciseKey="translate-gracias"
          />
        </AnimatedFooter>
      </div>
    )
  },
}

// Full Study Page Context
export const StudyPageContext: Story = {
  render: () => {
    const [step, setStep] = useState<'idle' | 'recording' | 'processing' | 'results'>('idle')
    const [score, setScore] = useState<number | null>(null)

    const handleStartRecording = () => {
      setStep('recording')
    }

    const handleStopRecording = () => {
      setStep('processing')
      // Auto-submit on stop
      setTimeout(() => {
        setScore(85)
        setStep('results')
      }, 2000)
    }

    const handleNext = () => {
      setStep('idle')
      setScore(null)
    }

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        {/* Content */}
        <div className="flex-1 pt-8 pb-32 px-6 max-w-2xl mx-auto">
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-neutral-400 mb-2">Say it back:</p>
              <h2 className="text-2xl font-medium text-white">
                Hello, how are you today?
              </h2>
            </div>

            {score !== null && (
              <div className={`text-center p-6 rounded-lg ${
                score >= 70 ? 'bg-green-900/20 border border-green-600' : 'bg-red-900/20 border border-red-600'
              }`}>
                <div className={`text-xl font-bold ${score >= 70 ? 'text-green-400' : 'text-red-400'}`}>
                  {score >= 70 ? '✓ Correct!' : '✗ Try again'}
                </div>
                <div className="text-neutral-300 mt-2">
                  Score: {score}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <AnimatedFooter show={true}>
          {step === 'results' ? (
            <NavigationControls onNext={handleNext} />
          ) : (
            <VoiceControls
              isRecording={step === 'recording'}
              isProcessing={step === 'processing'}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
            />
          )}
        </AnimatedFooter>
      </div>
    )
  },
}

// Custom Styling
export const CustomStyling: Story = {
  args: {
    show: true,
    className: 'bg-blue-900 border-blue-700',
    children: (
      <div className="text-center text-white">
        Custom styled footer with different colors
      </div>
    ),
  },
}
