/**
 * SongPurchaseDialog
 * One-time purchase dialog for full song access (0.000033 ETH ~$0.10)
 * Uses SongAccess ERC-721 contract on Base
 *
 * Flow:
 * 1. User sees song info + price in ETH
 * 2. User selects chain (Base only for now)
 * 3. Balance fetched for that chain
 * 4. User clicks Buy
 */

import { Show, type Component, createSignal } from 'solid-js'
import { PurchaseDialog } from './PurchaseDialog'
import { ChainSelectorGrid, type ChainOption, type ChainBalances } from './ChainSelectorGrid'
import { Icon } from '@/components/icons'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useTranslation } from '@/lib/i18n'
import { haptic } from '@/lib/utils'
import type { PurchaseStep } from './types'

// Supported chains ordered by: cheapest fees first
// NO Ethereum L1 - fees would exceed purchase price for $0.10
// Currently only Base is enabled - others coming soon
const SUPPORTED_CHAINS: ChainOption[] = [
  { id: 8453, name: 'Base', icon: '/images/base-chain.svg', nativeToken: 'ETH' },
  { id: 1399811149, name: 'Solana', icon: '/images/solana_logo.png', nativeToken: 'SOL', disabled: true },
  { id: 137, name: 'Polygon', icon: '/images/polygon-chain.svg', nativeToken: 'POL', disabled: true },
  { id: 10, name: 'Optimism', icon: '/images/optimism-chain.svg', nativeToken: 'ETH', disabled: true },
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

  /** Price in ETH (default: 0.000033 ~$0.10) */
  priceEth?: number

  /** Called when user initiates purchase */
  onPurchase?: () => void
  /** Called when user retries after error */
  onRetry?: () => void
  /** Called when user selects a chain - parent should fetch balances */
  onChainSelect?: (chain: ChainOption) => void
  /** Called when user requests balance refresh (after sending funds) */
  onRefresh?: () => void

  /** User's wallet address */
  walletAddress?: string
  /** Currently selected chain */
  selectedChain?: ChainOption
  /** Balances on selected chain */
  balances?: ChainBalances
}

// Approximate ETH price in USD for display purposes
const ETH_PRICE_USD = 3000

export const SongPurchaseDialog: Component<SongPurchaseDialogProps> = (props) => {
  const { formatLocal } = useCurrency()
  const { t } = useTranslation()
  const priceEth = () => props.priceEth ?? 0.000033
  const priceUsd = () => priceEth() * ETH_PRICE_USD
  const [copied, setCopied] = createSignal(false)

  const handleCopy = async () => {
    if (!props.walletAddress) return
    await navigator.clipboard.writeText(props.walletAddress)
    setCopied(true)
    haptic.light()
    setTimeout(() => setCopied(false), 2000)
  }

  // Check if user needs to fund their wallet or we're still checking
  // Show refresh button when: loading balance OR balance is zero
  // Only show Buy when we've confirmed they have funds
  const needsFunding = () => {
    if (!props.selectedChain) return false
    if (props.balances?.loading) return true // Still checking - don't show Buy yet
    const native = props.balances?.native ?? 0
    return native === 0
  }

  // Song card - shown in ALL states for visual continuity
  const songCard = (
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
  )

  // Content shown only in idle/processing/error states
  const idleContent = (
    <div class="space-y-3">
      {/* Price Display */}
      <div class="flex flex-col items-center gap-1 py-4 px-6 rounded-xl bg-black/30">
        <span class="text-2xl font-bold">{priceEth()} ETH</span>
        <span class="text-base text-muted-foreground">
          {formatLocal(priceUsd())}
        </span>
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
      title={t('song.unlockSong')}
      subtitle={t('song.unlockSubtitle')}
      currentStep={props.currentStep}
      statusMessage={props.statusMessage}
      errorMessage={props.errorMessage}
      onPurchase={props.onPurchase}
      onRetry={props.onRetry}
      onRefresh={props.onRefresh}
      idleContent={<>{songCard}{idleContent}</>}
      actionText={t('song.buy')}
      needsFunding={needsFunding()}
      isRefreshing={props.balances?.loading}
    />
  )
}
