import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import { SongPurchaseDialog } from './SongPurchaseDialog'
import { Button } from '@/components/ui/button'
import { useCurrency } from '@/contexts/CurrencyContext'
import type { PurchaseStep } from './types'

const meta: Meta<typeof SongPurchaseDialog> = {
  title: 'Purchase/SongPurchaseDialog',
  component: SongPurchaseDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    currentStep: {
      control: 'select',
      options: ['idle', 'checking', 'signing', 'approving', 'purchasing', 'complete', 'error'],
    },
    priceUsd: {
      control: { type: 'number', min: 0, max: 10, step: 0.01 },
    },
  },
}

export default meta
type Story = StoryObj<typeof SongPurchaseDialog>

// Interactive wrapper for stories
const InteractiveWrapper = (props: {
  songTitle: string
  artistName?: string
  coverUrl?: string
  priceUsd?: number
  initialStep?: PurchaseStep
}) => {
  const [open, setOpen] = createSignal(false)
  const [step, setStep] = createSignal<PurchaseStep>(props.initialStep ?? 'idle')
  const [statusMessage, setStatusMessage] = createSignal('')
  const [errorMessage, setErrorMessage] = createSignal('')

  const simulatePurchase = async () => {
    setStep('checking')
    setStatusMessage('Checking wallet balance...')
    await new Promise((r) => setTimeout(r, 1000))

    setStep('signing')
    setStatusMessage('Please sign the transaction...')
    await new Promise((r) => setTimeout(r, 1500))

    setStep('approving')
    setStatusMessage('Approving USDC...')
    await new Promise((r) => setTimeout(r, 1000))

    setStep('purchasing')
    setStatusMessage('Completing purchase...')
    await new Promise((r) => setTimeout(r, 1500))

    setStep('complete')
  }

  const handleRetry = () => {
    setErrorMessage('')
    setStep('idle')
  }

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Song Purchase Dialog</Button>
      <SongPurchaseDialog
        open={open()}
        onOpenChange={setOpen}
        songTitle={props.songTitle}
        artistName={props.artistName}
        coverUrl={props.coverUrl}
        priceUsd={props.priceUsd}
        currentStep={step()}
        statusMessage={statusMessage()}
        errorMessage={errorMessage()}
        onPurchase={simulatePurchase}
        onRetry={handleRetry}
      />
    </div>
  )
}

export const Default: Story = {
  render: () => (
    <InteractiveWrapper
      songTitle="Toxic"
      artistName="Britney Spears"
      priceUsd={0.10}
    />
  ),
}

export const WithCover: Story = {
  render: () => (
    <InteractiveWrapper
      songTitle="Bohemian Rhapsody"
      artistName="Queen"
      coverUrl="https://i.scdn.co/image/ab67616d0000b273e8b066f70c206551210d902b"
      priceUsd={0.10}
    />
  ),
}

// Wrapper to set currency for story
const CurrencyWrapper = (props: { currency: 'CNY' | 'IDR' | 'VND'; children: any }) => {
  const { setCurrency } = useCurrency()
  setCurrency(props.currency)
  return props.children
}

export const WithLocalCurrency: Story = {
  render: () => (
    <CurrencyWrapper currency="CNY">
      <SongPurchaseDialog
        open={true}
        onOpenChange={() => {}}
        songTitle="Bohemian Rhapsody"
        artistName="Queen"
        coverUrl="https://i.scdn.co/image/ab67616d0000b273e8b066f70c206551210d902b"
        currentStep="idle"
        priceUsd={0.10}
      />
    </CurrencyWrapper>
  ),
}

export const IdleState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    currentStep: 'idle',
    priceUsd: 0.10,
  },
}

export const CheckingState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    currentStep: 'checking',
    statusMessage: 'Checking wallet balance...',
  },
}

export const SigningState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    currentStep: 'signing',
    statusMessage: 'Please sign the transaction in your wallet...',
  },
}

export const PurchasingState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    currentStep: 'purchasing',
    statusMessage: 'Completing purchase...',
  },
}

export const CompleteState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    currentStep: 'complete',
  },
}

export const ErrorState: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    currentStep: 'error',
    errorMessage: 'Insufficient USDC balance. Please add funds to your wallet.',
  },
}

export const LongErrorMessage: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    currentStep: 'error',
    errorMessage:
      'Transaction failed: execution reverted: ERC20: transfer amount exceeds allowance. Please ensure you have approved the contract to spend your USDC tokens and try again.',
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
        <SongPurchaseDialog
          open={true}
          onOpenChange={() => {}}
          songTitle="Toxic"
          artistName="Britney Spears"
          currentStep={currentStep()}
          statusMessage={
            currentStep() === 'checking'
              ? 'Checking wallet...'
              : currentStep() === 'signing'
              ? 'Please sign...'
              : currentStep() === 'purchasing'
              ? 'Completing purchase...'
              : ''
          }
          errorMessage={
            currentStep() === 'error' ? 'Transaction failed. Please try again.' : ''
          }
          priceUsd={0.10}
        />
      </div>
    )
  },
}
