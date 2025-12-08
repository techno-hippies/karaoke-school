/**
 * ChainSelector - Select origin chain for cross-chain purchases
 *
 * Shows available chains with icons. When Base Sepolia is selected,
 * no bridging is needed (direct purchase).
 */

import { type Component, Show, createMemo } from 'solid-js'
import { Select as KobalteSelect } from '@kobalte/core/select'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { CHAIN_INFO, type SupportedChainId } from '@/lib/across'
import { baseSepolia } from 'viem/chains'
import { formatUnits } from 'viem'

export interface ChainOption {
  id: SupportedChainId
  name: string
  shortName: string
  icon: string
  color: string
}

export interface ChainSelectorProps {
  selectedChainId: SupportedChainId
  onChainChange: (chainId: SupportedChainId) => void
  availableChains: { id: SupportedChainId; name: string; icon: string }[]
  balance?: bigint
  balanceDecimals?: number
  balanceSymbol?: string
  disabled?: boolean
  class?: string
}

export const ChainSelector: Component<ChainSelectorProps> = (props) => {
  // Build chain options with full info
  const chainOptions = createMemo((): ChainOption[] => {
    return props.availableChains.map((chain) => {
      const info = CHAIN_INFO[chain.id]
      return {
        id: chain.id,
        name: info?.name || chain.name,
        shortName: info?.shortName || chain.name,
        icon: info?.icon || chain.icon,
        color: info?.color || '#888',
      }
    })
  })

  const selectedChain = createMemo(() => {
    return chainOptions().find((c) => c.id === props.selectedChainId)
  })

  const isBaseChain = createMemo(() => props.selectedChainId === baseSepolia.id)

  const formattedBalance = createMemo(() => {
    if (props.balance === undefined) return undefined
    const decimals = props.balanceDecimals ?? 18
    const value = formatUnits(props.balance, decimals)
    // Show max 4 decimal places
    const num = parseFloat(value)
    return num.toFixed(num < 0.0001 ? 6 : 4)
  })

  return (
    <div class={cn('flex flex-col gap-2', props.class)}>
      <div class="flex items-center justify-between">
        <span class="text-xs text-muted-foreground">Pay from</span>
        <Show when={!isBaseChain()}>
          <span class="text-xs text-primary flex items-center gap-1">
            <Icon name="link" class="text-xs" />
            Cross-chain via Across
          </span>
        </Show>
      </div>

      <KobalteSelect
        options={chainOptions()}
        optionValue="id"
        optionTextValue="shortName"
        value={selectedChain()}
        onChange={(option) => option && props.onChainChange(option.id)}
        disabled={props.disabled}
        itemComponent={(itemProps) => (
          <KobalteSelect.Item
            item={itemProps.item}
            class="flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer outline-none hover:bg-white/5 focus:bg-white/5 rounded-md data-[highlighted]:bg-white/5"
          >
            <div class="flex items-center gap-2">
              <img
                src={itemProps.item.rawValue.icon}
                alt={itemProps.item.rawValue.shortName}
                class="w-5 h-5 rounded-full"
                onError={(e) => {
                  // Fallback to colored circle if image fails
                  const target = e.currentTarget as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
              <span>{itemProps.item.rawValue.shortName}</span>
              <Show when={itemProps.item.rawValue.id === baseSepolia.id}>
                <span class="text-xs text-muted-foreground">(Direct)</span>
              </Show>
            </div>
            <KobalteSelect.ItemIndicator>
              <Icon name="check" class="text-base text-primary" />
            </KobalteSelect.ItemIndicator>
          </KobalteSelect.Item>
        )}
      >
        <KobalteSelect.Trigger
          class={cn(
            'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg cursor-pointer',
            'bg-secondary/50 text-foreground text-sm',
            'border border-border hover:bg-secondary/70 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <div class="flex items-center gap-2">
            <Show when={selectedChain()}>
              {(chain) => (
                <>
                  <img
                    src={chain().icon}
                    alt={chain().shortName}
                    class="w-5 h-5 rounded-full"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                  <span>{chain().shortName}</span>
                </>
              )}
            </Show>
          </div>
          <div class="flex items-center gap-2">
            <Show when={formattedBalance() !== undefined}>
              <span class="text-xs text-muted-foreground">
                {formattedBalance()} {props.balanceSymbol || ''}
              </span>
            </Show>
            <KobalteSelect.Icon>
              <Icon name="caret-down" class="text-base text-muted-foreground" />
            </KobalteSelect.Icon>
          </div>
        </KobalteSelect.Trigger>
        <KobalteSelect.Portal>
          <KobalteSelect.Content
            class={cn(
              'z-50 w-[var(--kb-select-trigger-width)] overflow-hidden rounded-lg',
              'bg-popover text-popover-foreground border border-border shadow-lg',
              'animate-in fade-in-0 zoom-in-95'
            )}
          >
            <KobalteSelect.Listbox class="p-1 max-h-64 overflow-y-auto" />
          </KobalteSelect.Content>
        </KobalteSelect.Portal>
      </KobalteSelect>

      {/* Cross-chain info banner */}
      <Show when={!isBaseChain()}>
        <div class="flex items-start gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <Icon name="info" class="text-primary text-sm mt-0.5" />
          <div class="flex flex-col gap-0.5">
            <span class="text-xs font-medium text-primary">Testnet Bridge</span>
            <span class="text-xs text-muted-foreground">
              Cross-chain fills take ~1 min on testnet (instant on mainnet)
            </span>
          </div>
        </div>
      </Show>
    </div>
  )
}
