import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import { PremiumUpgradeDialog } from './PremiumUpgradeDialog'
import { Button } from '@/components/ui/button'
import type { PurchaseStep } from './types'

const meta: Meta<typeof PremiumUpgradeDialog> = {
  title: 'Purchase/PremiumUpgradeDialog',
  component: PremiumUpgradeDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    currentStep: {
      control: 'select',
      options: ['idle', 'checking', 'signing', 'approving', 'purchasing', 'complete', 'error'],
    },
    priceEth: {
      control: { type: 'number', min: 0, max: 1, step: 0.001 },
    },
  },
}

export default meta
type Story = StoryObj<typeof PremiumUpgradeDialog>

// Interactive wrapper for stories
const InteractiveWrapper = (props: {
  priceEth?: number
  priceDisplay?: string
  previewAudioUrl?: string
  initialStep?: PurchaseStep
}) => {
  const [open, setOpen] = createSignal(false)
  const [step, setStep] = createSignal<PurchaseStep>(props.initialStep ?? 'idle')
  const [statusMessage, setStatusMessage] = createSignal('')
  const [errorMessage, setErrorMessage] = createSignal('')

  const simulateUpgrade = async () => {
    setStep('checking')
    setStatusMessage('Checking wallet balance...')
    await new Promise((r) => setTimeout(r, 1000))

    setStep('signing')
    setStatusMessage('Please sign the transaction...')
    await new Promise((r) => setTimeout(r, 1500))

    setStep('approving')
    setStatusMessage('Approving ETH spend...')
    await new Promise((r) => setTimeout(r, 1000))

    setStep('purchasing')
    setStatusMessage('Processing subscription...')
    await new Promise((r) => setTimeout(r, 1500))

    setStep('complete')
  }

  const handleRetry = () => {
    setErrorMessage('')
    setStep('idle')
  }

  return (
    <div>
      <Button onClick={() => setOpen(true)} variant="gradient-gold">
        Open Premium Upgrade Dialog
      </Button>
      <PremiumUpgradeDialog
        open={open()}
        onOpenChange={setOpen}
        priceEth={props.priceEth}
        priceDisplay={props.priceDisplay}
        previewAudioUrl={props.previewAudioUrl}
        currentStep={step()}
        statusMessage={statusMessage()}
        errorMessage={errorMessage()}
        onUpgrade={simulateUpgrade}
        onRetry={handleRetry}
      />
    </div>
  )
}

export const Default: Story = {
  render: () => <InteractiveWrapper priceEth={0.001} />,
}

export const WithAudioPreview: Story = {
  render: () => (
    <InteractiveWrapper
      priceEth={0.001}
      previewAudioUrl="/audio/upgrade-tts.mp3"
    />
  ),
}

export const CustomPriceDisplay: Story = {
  render: () => (
    <InteractiveWrapper priceDisplay="~$2.50" />
  ),
}

export const IdleState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    currentStep: 'idle',
    priceEth: 0.001,
  },
}

export const CheckingState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    currentStep: 'checking',
    statusMessage: 'Checking wallet balance...',
  },
}

export const SigningState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    currentStep: 'signing',
    statusMessage: 'Please sign the transaction in your wallet...',
  },
}

export const PurchasingState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    currentStep: 'purchasing',
    statusMessage: 'Processing subscription...',
  },
}

export const CompleteState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    currentStep: 'complete',
  },
}

export const ErrorState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    currentStep: 'error',
    errorMessage: 'Insufficient ETH balance. Please add funds to your wallet.',
  },
}

export const AllStates: Story = {
  render: () => {
    const steps: PurchaseStep[] = [
      'idle',
      'checking',
      'signing',
      'approving',
      'purchasing',
      'complete',
      'error',
    ]
    const [currentIndex, setCurrentIndex] = createSignal(0)

    const currentStep = () => steps[currentIndex()]

    return (
      <div class="flex flex-col items-center gap-4">
        <div class="flex gap-2 flex-wrap justify-center">
          {steps.map((step, index) => (
            <Button
              variant={currentIndex() === index ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentIndex(index)}
            >
              {step}
            </Button>
          ))}
        </div>
        <PremiumUpgradeDialog
          open={true}
          onOpenChange={() => {}}
          currentStep={currentStep()}
          statusMessage={
            currentStep() === 'checking'
              ? 'Checking wallet...'
              : currentStep() === 'signing'
              ? 'Please sign...'
              : currentStep() === 'purchasing'
              ? 'Processing subscription...'
              : ''
          }
          errorMessage={
            currentStep() === 'error' ? 'Transaction failed. Please try again.' : ''
          }
          priceEth={0.001}
        />
      </div>
    )
  },
}
