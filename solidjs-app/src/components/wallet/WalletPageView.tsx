/**
 * WalletPageView - Presentational component for wallet page
 * Shows wallet address, language settings, and token balances
 */

import { For, Show, createMemo, type Component } from 'solid-js'
import { Copy } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher'
import { useTranslation } from '@/lib/i18n'
import type { TokenBalance } from '@/hooks/usePKPBalances'

// Token icon with chain overlay
const TokenIcon: Component<{
  currencyIcon?: string
  chainIcon?: string
}> = (props) => {
  return (
    <div class="relative w-12 h-12 md:w-14 md:h-14">
      <Show when={props.currencyIcon}>
        <div class="w-full h-full rounded-full bg-white p-2 flex items-center justify-center shadow-sm border border-gray-200">
          <img
            src={`/images/${props.currencyIcon}`}
            alt="Currency"
            class="w-full h-full object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />
        </div>
      </Show>

      <Show when={props.chainIcon}>
        <div class="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center">
          <img
            src={`/images/${props.chainIcon}`}
            alt="Chain"
            class="w-3/4 h-3/4 object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />
        </div>
      </Show>
    </div>
  )
}

// Loading skeleton for token items
const TokenSkeleton: Component = () => {
  return (
    <Item variant="muted">
      <ItemMedia>
        <Skeleton class="w-12 h-12 md:w-14 md:h-14 rounded-full" />
      </ItemMedia>
      <ItemContent>
        <Skeleton class="h-5 w-16 mb-1" />
      </ItemContent>
      <ItemContent class="items-end">
        <Skeleton class="h-5 w-24 mb-1" />
        <Skeleton class="h-4 w-16" />
      </ItemContent>
    </Item>
  )
}

export interface WalletPageViewProps {
  tokens: TokenBalance[]
  walletAddress: string
  onCopyAddress: () => void
  isLoading?: boolean
}

export const WalletPageView: Component<WalletPageViewProps> = (props) => {
  const { t } = useTranslation()

  // Group tokens by network
  const tokensByNetwork = createMemo(() => {
    const grouped: Record<string, TokenBalance[]> = {}
    for (const token of props.tokens) {
      if (!grouped[token.network]) {
        grouped[token.network] = []
      }
      grouped[token.network].push(token)
    }
    return grouped
  })

  // Sort networks
  const sortedNetworks = createMemo(() => {
    const networkOrder = ['Base', 'Ethereum', 'Polygon', 'Arbitrum']
    return Object.keys(tokensByNetwork()).sort((a, b) => {
      const aIndex = networkOrder.indexOf(a)
      const bIndex = networkOrder.indexOf(b)
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
  })

  // Loading state
  if (props.isLoading && props.tokens.length === 0) {
    return (
      <div class="max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <div>
          <h2 class="text-base font-medium text-muted-foreground mb-3">{t('wallet.walletAddress')}</h2>
          <div class="flex items-center gap-3">
            <Skeleton class="flex-1 h-11 rounded-full" />
            <Skeleton class="w-11 h-11 rounded-full" />
          </div>
        </div>

        <div>
          <h2 class="text-base font-medium text-muted-foreground mb-3">{t('wallet.balances')}</h2>
          <div class="space-y-2">
            <TokenSkeleton />
            <TokenSkeleton />
            <TokenSkeleton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div class="max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Wallet Address */}
      <div class="mb-8">
        <h2 class="text-base font-medium text-muted-foreground mb-3">{t('wallet.walletAddress')}</h2>
        <div class="flex items-center gap-3">
          <div class="flex-1 w-0 bg-secondary rounded-full h-11 px-4 flex items-center">
            <div class="font-mono text-base text-foreground">
              {props.walletAddress.slice(0, 10)}...{props.walletAddress.slice(-8)}
            </div>
          </div>
          <Button
            onClick={props.onCopyAddress}
            variant="secondary"
            size="icon"
          >
            <Copy class="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Language Settings */}
      <div class="mb-8">
        <LanguageSwitcher />
      </div>

      {/* Token Balances - Grouped by Network */}
      <div>
        <h2 class="text-base font-medium text-muted-foreground mb-3">{t('wallet.balances')}</h2>
        <div class="space-y-6">
          <For each={sortedNetworks()}>
            {(network) => (
              <div class="space-y-2">
                {/* Network Header */}
                <div class="flex items-center gap-2 mb-3">
                  <h3 class="text-sm font-semibold text-foreground uppercase tracking-wider">
                    {network}
                  </h3>
                  <div class="flex-1 h-px bg-border" />
                </div>

                {/* Tokens for this network */}
                <div class="space-y-2">
                  <For each={tokensByNetwork()[network]}>
                    {(token) => (
                      <Show
                        when={!token.isLoading}
                        fallback={<TokenSkeleton />}
                      >
                        <Item variant="muted">
                          <ItemMedia>
                            <TokenIcon
                              currencyIcon={token.currencyIcon}
                              chainIcon={token.chainIcon}
                            />
                          </ItemMedia>

                          <ItemContent>
                            <ItemTitle>{token.symbol}</ItemTitle>
                          </ItemContent>

                          <ItemContent class="items-end">
                            <ItemTitle>{token.balance}</ItemTitle>
                            <Show when={token.usdValue}>
                              <ItemDescription>${token.usdValue}</ItemDescription>
                            </Show>
                          </ItemContent>
                        </Item>
                      </Show>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
