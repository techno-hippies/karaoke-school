import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import { ChainSelectorGrid, type ChainOption } from './ChainSelectorGrid'

const meta: Meta<typeof ChainSelectorGrid> = {
  title: 'Purchase/ChainSelectorGrid',
  component: ChainSelectorGrid,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
}

export default meta
type Story = StoryObj<typeof ChainSelectorGrid>

// Chains ordered by: cheapest fees first, most users second
// NO Ethereum L1 - fees would exceed purchase price for $0.10

// Current supported chains (4 chains - fits without scroll)
const SUPPORTED_CHAINS: ChainOption[] = [
  { id: 8453, name: 'Base', icon: '/images/base-chain.svg', nativeToken: 'ETH' },
  { id: 137, name: 'Polygon', icon: '/images/polygon-chain.svg', nativeToken: 'POL' },
  { id: 42161, name: 'Arbitrum', icon: '/images/arbitrum-chain.svg', nativeToken: 'ETH' },
  { id: 10, name: 'Optimism', icon: '/images/optimism-chain.svg', nativeToken: 'ETH' },
]

// With BNB added (5 chains)
const WITH_BNB: ChainOption[] = [
  ...SUPPORTED_CHAINS,
  { id: 56, name: 'BNB', icon: '/images/bsc-chain.svg', nativeToken: 'BNB' },
]

// Full mainnet vision (6 chains - with Solana)
const MAINNET_CHAINS: ChainOption[] = [
  { id: 8453, name: 'Base', icon: '/images/base-chain.svg', nativeToken: 'ETH' },
  { id: 137, name: 'Polygon', icon: '/images/polygon-chain.svg', nativeToken: 'POL' },
  { id: 42161, name: 'Arbitrum', icon: '/images/arbitrum-chain.svg', nativeToken: 'ETH' },
  { id: 10, name: 'Optimism', icon: '/images/optimism-chain.svg', nativeToken: 'ETH' },
  { id: 56, name: 'BNB', icon: '/images/bsc-chain.svg', nativeToken: 'BNB' },
  { id: 1399811149, name: 'Solana', icon: '/images/solana_logo.png', nativeToken: 'SOL' },
]

const MOCK_WALLET = '0x1234567890abcdef1234567890abcdef12345678'

/** Default - no chain selected, show grid */
export const Default: Story = {
  args: {
    chains: SUPPORTED_CHAINS,
    walletAddress: MOCK_WALLET,
  },
}

/** With chain selected - show wallet address and balances */
export const ChainSelected: Story = {
  render: () => {
    const [selectedChain, setSelectedChain] = createSignal<ChainOption | undefined>(SUPPORTED_CHAINS[0])

    return (
      <div class="w-[360px] p-4 bg-card rounded-xl">
        <ChainSelectorGrid
          chains={SUPPORTED_CHAINS}
          selectedChain={selectedChain()}
          onChainSelect={setSelectedChain}
          walletAddress={MOCK_WALLET}
          balances={{ native: 0.0234, usdc: 12.50 }}
        />
      </div>
    )
  },
}

/** Interactive - tap to select chain, shows loading then balances */
export const Interactive: Story = {
  render: () => {
    const [selectedChain, setSelectedChain] = createSignal<ChainOption | undefined>()
    const [balances, setBalances] = createSignal<{ native?: number; usdc?: number; loading?: boolean }>({})
    const [copied, setCopied] = createSignal(false)

    const handleChainSelect = (chain: ChainOption) => {
      setSelectedChain(chain)
      setBalances({ loading: true })
      // Simulate fetching balances
      setTimeout(() => {
        setBalances({ native: 0.0234, usdc: 12.50 })
      }, 1000)
    }

    const handleCopy = () => {
      navigator.clipboard.writeText(MOCK_WALLET)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    return (
      <div class="w-[360px] p-4 bg-card rounded-xl">
        <ChainSelectorGrid
          chains={SUPPORTED_CHAINS}
          selectedChain={selectedChain()}
          onChainSelect={handleChainSelect}
          walletAddress={MOCK_WALLET}
          balances={balances()}
          onCopy={handleCopy}
          copied={copied()}
        />
      </div>
    )
  },
}

/** With BNB - 5 chains */
export const WithBNB: Story = {
  render: () => {
    const [selectedChain, setSelectedChain] = createSignal<ChainOption | undefined>()

    return (
      <div class="w-[360px] p-4 bg-card rounded-xl">
        <ChainSelectorGrid
          chains={WITH_BNB}
          selectedChain={selectedChain()}
          onChainSelect={setSelectedChain}
          walletAddress={MOCK_WALLET}
        />
      </div>
    )
  },
}

/** Many chains - horizontal scroll (7 chains including Solana) */
export const ManyChains: Story = {
  render: () => {
    const [selectedChain, setSelectedChain] = createSignal<ChainOption | undefined>()

    return (
      <div class="w-[360px] p-4 bg-card rounded-xl">
        <p class="text-xs text-foreground/40 mb-2">← Scroll horizontally →</p>
        <ChainSelectorGrid
          chains={MAINNET_CHAINS}
          selectedChain={selectedChain()}
          onChainSelect={setSelectedChain}
          walletAddress={MOCK_WALLET}
        />
      </div>
    )
  },
}

/** In context - as it would appear in purchase dialog */
export const InPurchaseContext: Story = {
  render: () => {
    const [selectedChain, setSelectedChain] = createSignal<ChainOption | undefined>()
    const [copied, setCopied] = createSignal(false)

    const handleCopy = () => {
      navigator.clipboard.writeText(MOCK_WALLET)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    return (
      <div class="w-[360px] p-4 bg-background rounded-xl space-y-3">
        {/* Song info mock */}
        <div class="flex items-center gap-4 p-3 rounded-xl bg-black/30">
          <div class="w-14 h-14 rounded-lg bg-muted" />
          <div class="flex-1">
            <p class="text-base font-semibold">Blinding Lights</p>
            <p class="text-sm text-foreground/60">The Weeknd</p>
          </div>
        </div>

        {/* Price mock */}
        <div class="flex flex-col items-center py-4 rounded-xl bg-black/30">
          <span class="text-2xl font-bold">$0.10</span>
        </div>

        {/* Chain selector */}
        <ChainSelectorGrid
          chains={TESTNET_CHAINS}
          selectedChain={selectedChain()}
          onChainSelect={setSelectedChain}
          walletAddress={MOCK_WALLET}
          onCopy={handleCopy}
          copied={copied()}
        />
      </div>
    )
  },
}
