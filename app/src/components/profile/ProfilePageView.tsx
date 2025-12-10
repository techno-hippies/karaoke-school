/**
 * ProfilePageView - Unified profile and wallet view
 * Combines user profile info, stats, and wallet tokens
 * SolidJS implementation
 */

import { type Component, Show, For, createSignal, createEffect } from 'solid-js'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { BackButton } from '@/components/ui/back-button'
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher'
import { useTranslation } from '@/lib/i18n'
import { useCurrency } from '@/contexts/CurrencyContext'
import { cn } from '@/lib/utils'
import type { TokenBalance } from '@/hooks/usePKPBalances'

// Achievement interface
export interface Achievement {
  id: string
  title: string
  description: string
  iconUrl?: string
  unlockedAt?: Date
  isLocked?: boolean
}

export interface ProfilePageViewProps {
  // Profile data
  username?: string
  avatarUrl?: string
  bio?: string
  isVerified?: boolean
  isOwnProfile?: boolean

  // Stats
  totalPoints?: number

  // Wallet (only shown for own profile)
  walletAddress?: string
  tokens?: TokenBalance[]
  isLoadingTokens?: boolean

  // Achievements (future)
  achievements?: Achievement[]

  // Handlers
  onBack?: () => void
  onEditProfile?: () => void
  onCopyAddress?: () => void
  onSettings?: () => void
  onDisconnect?: () => void

  class?: string
}

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

// Format large numbers with K/M suffixes
const formatNumber = (num: number | undefined): string => {
  if (!num && num !== 0) return '0'
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

/**
 * ProfilePageView - Unified profile and wallet view
 *
 * For own profile: Shows avatar, username, wallet address, tabs (Tokens | Settings)
 * For other profiles: Shows avatar, username, stats, achievements
 */
export const ProfilePageView: Component<ProfilePageViewProps> = (props) => {
  const { t } = useTranslation()
  const { formatLocal } = useCurrency()
  const [copied, setCopied] = createSignal(false)

  // Reset copied state after delay
  createEffect(() => {
    if (copied()) {
      const timer = setTimeout(() => setCopied(false), 1500)
      return () => clearTimeout(timer)
    }
  })

  const handleCopy = () => {
    props.onCopyAddress?.()
    setCopied(true)
  }

  const truncatedAddress = () => {
    if (!props.walletAddress) return ''
    return `${props.walletAddress.slice(0, 6)}...${props.walletAddress.slice(-4)}`
  }

  // Group tokens by network
  const tokensByNetwork = () => {
    const grouped: Record<string, TokenBalance[]> = {}
    for (const token of props.tokens || []) {
      if (!grouped[token.network]) {
        grouped[token.network] = []
      }
      grouped[token.network].push(token)
    }
    return grouped
  }

  // Sort networks
  const sortedNetworks = () => {
    const networkOrder = ['Base', 'Ethereum', 'Polygon', 'Arbitrum']
    return Object.keys(tokensByNetwork()).sort((a, b) => {
      const aIndex = networkOrder.indexOf(a)
      const bIndex = networkOrder.indexOf(b)
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
  }

  // Show username if available, otherwise show truncated address
  const displayHandle = () => {
    if (props.username) return props.username
    if (props.walletAddress) {
      return `${props.walletAddress.slice(0, 6)}...${props.walletAddress.slice(-4)}`
    }
    return 'Anonymous'
  }

  return (
    <div class={cn('relative w-full min-h-screen bg-background', props.class)}>
      {/* Back button header */}
      <Show when={props.onBack}>
        <div class="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
          <div class="max-w-4xl mx-auto px-2 py-2">
            <BackButton onClick={props.onBack} />
          </div>
        </div>
      </Show>

      <div class="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6">
        {/* Profile Header */}
        <div class="flex flex-col items-center gap-4 mb-6">
          {/* Avatar */}
          <Avatar
            src={props.avatarUrl}
            alt={displayHandle()}
            fallback={displayHandle().slice(0, 2).toUpperCase()}
            size="2xl"
            class="w-28 h-28 md:w-36 md:h-36"
          />

          {/* Username handle and verified badge */}
          <div class="flex items-center gap-2">
            <h1 class="text-xl md:text-2xl font-bold">@{displayHandle()}</h1>
            <Show when={props.isVerified}>
              <Icon name="seal-check" class="text-xl md:text-2xl text-blue-500" weight="fill" />
            </Show>
          </div>

          {/* Bio */}
          <Show when={props.bio}>
            <p class="text-center text-base text-muted-foreground max-w-md">{props.bio}</p>
          </Show>

          {/* Stats - only show if totalPoints is provided */}
          <Show when={props.totalPoints !== undefined}>
            <div class="flex gap-6 text-base">
              <div class="flex items-center gap-2">
                <span class="font-bold">{formatNumber(props.totalPoints)}</span>
                <span class="text-muted-foreground">{t('wallet.points')}</span>
              </div>
            </div>
          </Show>

          {/* Wallet Address */}
          <Show when={props.walletAddress}>
            <button
              onClick={handleCopy}
              class="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full hover:bg-secondary/90 transition-colors cursor-pointer"
            >
              <span class="font-mono text-base text-muted-foreground">
                {truncatedAddress()}
              </span>
              {copied() ? (
                <Icon name="check" class="text-base text-green-500" />
              ) : (
                <Icon name="copy" class="text-base text-muted-foreground" />
              )}
            </button>
          </Show>

        </div>

        {/* Tabs */}
        <Show
          when={props.isOwnProfile}
          fallback={
  /* Other user's profile - Achievements only (no videos for now) */
            <div class="mt-4">
              <h3 class="text-base font-semibold mb-4">{t('wallet.achievements')}</h3>
              <Show
                when={props.achievements && props.achievements.length > 0}
                fallback={
                  <div class="text-center py-12 text-muted-foreground">
                    {t('wallet.noAchievements')}
                  </div>
                }
              >
                <div class="grid grid-cols-2 gap-4">
                  <For each={props.achievements}>
                    {(achievement) => (
                      <div
                        class={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-2xl border transition-colors',
                          achievement.isLocked
                            ? 'bg-muted/30 border-border opacity-60'
                            : 'bg-card border-primary/20'
                        )}
                      >
                        <Show
                          when={achievement.iconUrl}
                          fallback={
                            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                              <span class="text-xl">&#127942;</span>
                            </div>
                          }
                        >
                          <img
                            src={achievement.iconUrl}
                            alt={achievement.title}
                            class="w-12 h-12 object-contain"
                          />
                        </Show>
                        <h3 class="text-base font-semibold text-center">
                          {achievement.title}
                        </h3>
                        <p class="text-base text-muted-foreground text-center line-clamp-2">
                          {achievement.description}
                        </p>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          }
        >
          {/* Own profile - Tokens and Settings tabs */}
          <Tabs defaultValue="tokens" class="w-full">
            <TabsList class="w-full grid grid-cols-2">
              <TabsTrigger value="tokens">{t('wallet.balances')}</TabsTrigger>
              <TabsTrigger value="settings">{t('wallet.settings')}</TabsTrigger>
            </TabsList>

            <TabsContent value="tokens" class="mt-4">
              <Show
                when={!props.isLoadingTokens || (props.tokens && props.tokens.length > 0)}
                fallback={
                  <div class="space-y-2">
                    <TokenSkeleton />
                    <TokenSkeleton />
                    <TokenSkeleton />
                  </div>
                }
              >
                <div class="space-y-6">
                  <For each={sortedNetworks()}>
                    {(network) => (
                      <div class="space-y-2">
                        {/* Network Header */}
                        <div class="flex items-center gap-2 mb-3">
                          <h3 class="text-base font-semibold text-foreground uppercase tracking-wider">
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
                                    <Show when={token.usdValue !== undefined && token.usdValue > 0}>
                                      <ItemDescription>{formatLocal(token.usdValue!)}</ItemDescription>
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
              </Show>
            </TabsContent>

            <TabsContent value="settings" class="mt-4 space-y-6">
              {/* Language Settings */}
              <LanguageSwitcher />

              {/* Disconnect Button */}
              <Show when={props.onDisconnect}>
                <Button
                  onClick={props.onDisconnect}
                  variant="outline"
                  class="w-full"
                >
                  {t('wallet.disconnect')}
                </Button>
              </Show>
            </TabsContent>
          </Tabs>
        </Show>
      </div>
    </div>
  )
}
