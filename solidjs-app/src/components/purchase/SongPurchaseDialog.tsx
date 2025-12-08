/**
 * SongPurchaseDialog
 * One-time purchase dialog for full song access (~$0.10 USDC)
 * Uses SongAccess ERC-721 contract (NOT Unlock Protocol)
 *
 * Flow:
 * 1. User sees song info + price
 * 2. User selects chain to pay from
 * 3. Balances fetched for that chain (native + USDC)
 * 4. User clicks Buy
 */

import { Show, type Component, createSignal } from 'solid-js'
import { PurchaseDialog } from './PurchaseDialog'
import { ChainSelectorGrid, type ChainOption, type ChainBalances } from './ChainSelectorGrid'
import { Icon } from '@/components/icons'
import { useCurrency } from '@/contexts/CurrencyContext'
import { haptic } from '@/lib/utils'
import type { PurchaseStep } from './types'

// Supported chains ordered by: cheapest fees first
// NO Ethereum L1 - fees would exceed purchase price for $0.10
const SUPPORTED_CHAINS: ChainOption[] = [
  { id: 8453, name: 'Base', icon: '/images/base-chain.svg', nativeToken: 'ETH' },
  { id: 137, name: 'Polygon', icon: '/images/polygon-chain.svg', nativeToken: 'POL' },
  { id: 42161, name: 'Arbitrum', icon: '/images/arbitrum-chain.svg', nativeToken: 'ETH' },
  { id: 10, name: 'Optimism', icon: '/images/optimism-chain.svg', nativeToken: 'ETH' },
]

export interface SongPurchaseDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void

  /** Song title to display */
  songTitle: string
  /** Artist name */
  artistName?: string
  /** Cover image URL */
  coverUrl?: string

  /** Current purchase step */
  currentStep: PurchaseStep
  /** Status message during processing */
  statusMessage?: string
  /** Error message if purchase fails */
  errorMessage?: string

  /** Price in USD (default: 0.10) */
  priceUsd?: number

  /** Called when user initiates purchase */
  onPurchase?: () => void
  /** Called when user retries after error */
  onRetry?: () => void
  /** Called when user selects a chain - parent should fetch balances */
  onChainSelect?: (chain: ChainOption) => void

  /** User's wallet address */
  walletAddress?: string
  /** Currently selected chain */
  selectedChain?: ChainOption
  /** Balances on selected chain */
  balances?: ChainBalances
}

export const SongPurchaseDialog: Component<SongPurchaseDialogProps> = (props) => {
  const { currency, formatLocal } = useCurrency()
  const price = () => props.priceUsd ?? 0.10
  const [copied, setCopied] = createSignal(false)

  const handleCopy = async () => {
    if (!props.walletAddress) return
    await navigator.clipboard.writeText(props.walletAddress)
    setCopied(true)
    haptic.light()
    setTimeout(() => setCopied(false), 2000)
  }

  const idleContent = (
    <div class="space-y-3">
      {/* Song Info Card */}
      <div class="flex items-center gap-4 p-3 rounded-xl bg-black/30">
        <Show
          when={props.coverUrl}
          fallback={
            <div class="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Icon name="music-note" class="text-2xl text-muted-foreground" />
            </div>
          }
        >
          <img
            src={props.coverUrl}
            alt={props.songTitle}
            class="w-14 h-14 rounded-lg object-cover flex-shrink-0"
          />
        </Show>
        <div class="flex-1 min-w-0">
          <p class="text-base font-semibold truncate">{props.songTitle}</p>
          <Show when={props.artistName}>
            <p class="text-base text-muted-foreground truncate">{props.artistName}</p>
          </Show>
        </div>
      </div>

      {/* Price Display */}
      <div class="flex flex-col items-center gap-1 py-4 px-6 rounded-xl bg-black/30">
        <div class="flex items-center justify-center">
          <span class="text-2xl font-bold">${price().toFixed(2)}</span>
          <Show when={currency() !== 'USD'}>
            <span class="text-2xl text-muted-foreground mx-3">≈</span>
            <span class="text-2xl font-bold">{formatLocal(price()).replace('≈', '')}</span>
          </Show>
        </div>
      </div>

      {/* Chain selector - always shown when wallet connected */}
      <Show when={props.walletAddress}>
        <ChainSelectorGrid
          chains={SUPPORTED_CHAINS}
          selectedChain={props.selectedChain}
          onChainSelect={props.onChainSelect}
          walletAddress={props.walletAddress!}
          balances={props.balances}
          onCopy={handleCopy}
          copied={copied()}
        />
      </Show>
    </div>
  )

  return (
    <PurchaseDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Unlock Song"
      subtitle="Full song with word-by-word lyrics. One-time purchase."
      currentStep={props.currentStep}
      statusMessage={props.statusMessage}
      errorMessage={props.errorMessage}
      onPurchase={props.onPurchase}
      onRetry={props.onRetry}
      idleContent={idleContent}
      actionText="Buy"
      successMessage={`${props.songTitle} unlocked! Start practicing now.`}
    />
  )
}
