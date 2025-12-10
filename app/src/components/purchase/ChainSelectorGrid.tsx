/**
 * ChainSelectorGrid - Horizontal scrolling grid of supported chains
 *
 * Users tap a chain to reveal their wallet address for that chain.
 * Builds confidence by explicitly showing supported chains with icons.
 *
 * Future-proof: When Solana is added, the address will differ from EVM chains
 * (Lit PKP wraps Solana differently), so this UI pattern supports that.
 */

import { Show, For, type Component, createSignal } from 'solid-js'
import { Icon } from '@/components/icons'
import { cn, haptic } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

export interface ChainOption {
  id: number
  name: string
  icon: string
  /** Native token symbol (e.g., 'ETH', 'POL', 'BNB') */
  nativeToken: string
  /** Whether this chain is disabled (coming soon) */
  disabled?: boolean
}

export interface ChainBalances {
  /** Native token balance (e.g., ETH, POL) */
  native?: number
  /** Whether balances are loading */
  loading?: boolean
}

export interface ChainSelectorGridProps {
  /** Available chains to display */
  chains: ChainOption[]
  /** Currently selected chain (undefined = none selected) */
  selectedChain?: ChainOption
  /** Called when user selects a chain */
  onChainSelect?: (chain: ChainOption) => void
  /** Wallet address to display after chain selection */
  walletAddress: string
  /** Balances on selected chain */
  balances?: ChainBalances
  /** Called when user copies address */
  onCopy?: () => void
  /** Whether address was just copied */
  copied?: boolean
  class?: string
}

export const ChainSelectorGrid: Component<ChainSelectorGridProps> = (props) => {
  const { t } = useTranslation()
  const [localCopied, setLocalCopied] = createSignal(false)

  const copied = () => props.copied ?? localCopied()

  const shortAddress = () => {
    if (!props.walletAddress) return ''
    return `${props.walletAddress.slice(0, 6)}...${props.walletAddress.slice(-4)}`
  }

  const handleChainClick = (chain: ChainOption) => {
    if (chain.disabled) return
    haptic.light()
    props.onChainSelect?.(chain)
  }

  const handleCopy = async () => {
    if (!props.walletAddress) return
    await navigator.clipboard.writeText(props.walletAddress)
    haptic.light()

    if (props.onCopy) {
      props.onCopy()
    } else {
      setLocalCopied(true)
      setTimeout(() => setLocalCopied(false), 2000)
    }
  }

  return (
    <div class={cn('space-y-3', props.class)}>
      {/* Chain grid - flex with scroll when needed */}
      {/* Extra padding prevents ring from being clipped by overflow */}
      <div class="flex gap-2 overflow-x-auto p-1 -mx-1 scrollbar-hide">
        <For each={props.chains}>
          {(chain) => {
            const isSelected = () => props.selectedChain?.id === chain.id
            const isDisabled = () => chain.disabled

            return (
              <button
                type="button"
                onClick={() => handleChainClick(chain)}
                disabled={isDisabled()}
                class={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl',
                  'flex-1 min-w-[72px]',
                  'transition-all duration-150',
                  isDisabled()
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-white/10 hover:ring-1 hover:ring-white/10 active:scale-95',
                  isSelected()
                    ? 'bg-white/10 ring-1 ring-white/20'
                    : 'bg-black/30'
                )}
              >
                <img
                  src={chain.icon}
                  alt={chain.name}
                  class={cn(
                    'w-8 h-8 rounded-full',
                    isDisabled() && 'grayscale'
                  )}
                  onError={(e) => {
                    // Fallback to placeholder
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23444"/></svg>'
                  }}
                />
                <span class={cn(
                  'text-xs whitespace-nowrap',
                  isDisabled() ? 'text-foreground/40' : 'text-foreground/80'
                )}>
                  {chain.name}
                </span>
                <Show when={isDisabled()}>
                  <span class="text-[10px] text-foreground/30">{t('common.soon')}</span>
                </Show>
              </button>
            )
          }}
        </For>
      </div>

      {/* Wallet address and balances - shown after chain selection */}
      <Show when={props.selectedChain}>
        {(chain) => (
          <div class="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Copy address button */}
            <button
              type="button"
              onClick={handleCopy}
              class={cn(
                'w-full flex items-center justify-between gap-2 p-3 rounded-xl',
                'bg-black/30',
                'hover:bg-black/40 active:bg-black/50 transition-colors cursor-pointer'
              )}
            >
              <div class="flex items-center gap-2">
                <Icon name="wallet" class="text-lg text-foreground/50" />
                <code class="text-base font-mono text-foreground/80">{shortAddress()}</code>
              </div>
              <Show
                when={copied()}
                fallback={<Icon name="copy" class="text-lg text-foreground/50" />}
              >
                <Icon name="check" class="text-lg text-green-500" />
              </Show>
            </button>

            {/* Balance */}
            <div class="flex items-center justify-between p-3 rounded-xl bg-black/30">
              <span class="text-base text-foreground/70">{t('wallet.balance')}</span>
              <Show
                when={!props.balances?.loading}
                fallback={<Icon name="circle-notch" class="text-base text-foreground/50 animate-spin" />}
              >
                <span class="text-base font-medium">
                  {props.balances?.native?.toFixed(4) ?? '0.0000'} {chain().nativeToken}
                </span>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
