import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import { SongPurchaseDialog } from './SongPurchaseDialog'
import { type ChainOption, type ChainBalances } from './ChainSelectorGrid'
import { Button } from '@/components/ui/button'
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

const MOCK_WALLET = '0x1234567890abcdef1234567890abcdef12345678'
const MOCK_COVER = 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36'

const BASE_CHAIN: ChainOption = { id: 8453, name: 'Base', icon: '/images/base-chain.svg', nativeToken: 'ETH' }

/** Default - no chain selected yet */
export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Blinding Lights',
    artistName: 'The Weeknd',
    coverUrl: MOCK_COVER,
    currentStep: 'idle',
    priceUsd: 0.10,
    walletAddress: MOCK_WALLET,
  },
}

/** Chain selected with balances shown */
export const ChainSelected: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Blinding Lights',
    artistName: 'The Weeknd',
    coverUrl: MOCK_COVER,
    currentStep: 'idle',
    priceUsd: 0.10,
    walletAddress: MOCK_WALLET,
    selectedChain: BASE_CHAIN,
    balances: { native: 0.0234, usdc: 12.50 },
  },
}

/** Chain selected - loading balances */
export const LoadingBalances: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    coverUrl: MOCK_COVER,
    currentStep: 'idle',
    priceUsd: 0.10,
    walletAddress: MOCK_WALLET,
    selectedChain: BASE_CHAIN,
    balances: { loading: true },
  },
}

/** Chain selected - zero balances */
export const ZeroBalances: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    coverUrl: MOCK_COVER,
    currentStep: 'idle',
    priceUsd: 0.10,
    walletAddress: MOCK_WALLET,
    selectedChain: BASE_CHAIN,
    balances: { native: 0, usdc: 0 },
  },
}

/** Processing purchase */
export const Processing: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    currentStep: 'purchasing',
    statusMessage: 'Confirming...',
    walletAddress: MOCK_WALLET,
  },
}

/** Purchase complete */
export const Complete: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    currentStep: 'complete',
    walletAddress: MOCK_WALLET,
  },
}

/** Error state */
export const Error: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    songTitle: 'Toxic',
    artistName: 'Britney Spears',
    currentStep: 'error',
    errorMessage: 'Transaction failed. Please try again.',
    walletAddress: MOCK_WALLET,
    selectedChain: BASE_CHAIN,
    balances: { native: 0.0234, usdc: 12.50 },
  },
}

/** Interactive - full purchase flow */
export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    const [step, setStep] = createSignal<PurchaseStep>('idle')
    const [status, setStatus] = createSignal('')
    const [selectedChain, setSelectedChain] = createSignal<ChainOption | undefined>()
    const [balances, setBalances] = createSignal<ChainBalances>({})

    const handleChainSelect = (chain: ChainOption) => {
      setSelectedChain(chain)
      setBalances({ loading: true })
      // Simulate fetching balances
      setTimeout(() => {
        setBalances({ native: 0.0234, usdc: 12.50 })
      }, 1000)
    }

    const handlePurchase = async () => {
      setStep('checking')
      setStatus('Checking...')
      await new Promise((r) => setTimeout(r, 800))

      setStep('signing')
      setStatus('Signing...')
      await new Promise((r) => setTimeout(r, 1200))

      setStep('purchasing')
      setStatus('Confirming...')
      await new Promise((r) => setTimeout(r, 1500))

      setStep('complete')
      setStatus('')
    }

    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Purchase Dialog</Button>
        <SongPurchaseDialog
          open={open()}
          onOpenChange={setOpen}
          songTitle="Blinding Lights"
          artistName="The Weeknd"
          coverUrl={MOCK_COVER}
          priceUsd={0.10}
          currentStep={step()}
          statusMessage={status()}
          walletAddress={MOCK_WALLET}
          selectedChain={selectedChain()}
          balances={balances()}
          onChainSelect={handleChainSelect}
          onPurchase={handlePurchase}
        />
      </div>
    )
  },
}
