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
import { Spinner } from '@/components/ui/spinner'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher'
import { useTranslation } from '@/lib/i18n'
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
  following?: number
  followers?: number
  totalPoints?: number

  // Follow state (for other users' profiles)
  isFollowing?: boolean
  isFollowLoading?: boolean

  // Wallet (only shown for own profile)
  walletAddress?: string
  tokens?: TokenBalance[]
  isLoadingTokens?: boolean

  // Achievements (future)
  achievements?: Achievement[]

  // Handlers
  onBack?: () => void
  onFollow?: () => void
  onMessage?: () => void
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
 * For own profile: Shows avatar, username, wallet address, tabs (Tokens | Videos | Achievements)
 * For other profiles: Shows avatar, username, stats, follow button, tabs (Videos | Achievements)
 */
export const ProfilePageView: Component<ProfilePageViewProps> = (props) => {
  const { t } = useTranslation()
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

  const displayHandle = () => props.username || 'Anonymous'

  return (
    <div class={cn('relative w-full min-h-screen bg-background', props.class)}>
      <div class="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6">
        {/* Profile Header */}
        <div class="flex flex-col items-center gap-4 mb-6">
          {/* Avatar */}
          <Avatar
            src={props.avatarUrl}
            alt={displayHandle()}
            fallback={displayHandle()}
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

          {/* Stats (for non-own profiles or always) */}
          <Show when={!props.isOwnProfile || (props.following !== undefined || props.followers !== undefined)}>
            <div class="flex gap-6 text-base">
              <div class="flex items-center gap-2">
                <span class="font-bold">{formatNumber(props.following)}</span>
                <span class="text-muted-foreground">Following</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-bold">{formatNumber(props.followers)}</span>
                <span class="text-muted-foreground">Followers</span>
              </div>
              <Show when={props.totalPoints !== undefined}>
                <div class="flex items-center gap-2">
                  <span class="font-bold">{formatNumber(props.totalPoints)}</span>
                  <span class="text-muted-foreground">Points</span>
                </div>
              </Show>
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

          {/* Action Buttons */}
          <Show when={!props.isOwnProfile}>
            <div class="flex gap-3">
              <Show when={props.onFollow}>
                <Button
                  size="lg"
                  variant={props.isFollowing ? 'outline' : 'default'}
                  onClick={props.onFollow}
                  disabled={props.isFollowLoading}
                  class="min-w-[120px]"
                >
                  <Show when={props.isFollowLoading} fallback={props.isFollowing ? 'Following' : 'Follow'}>
                    <Spinner size="sm" />
                    <span class="ml-2">{props.isFollowing ? 'Unfollowing...' : 'Following...'}</span>
                  </Show>
                </Button>
              </Show>
              <Show when={props.onMessage}>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={props.onMessage}
                  class="min-w-[120px]"
                >
                  Message
                </Button>
              </Show>
            </div>
          </Show>
        </div>

        {/* Tabs */}
        <Show
          when={props.isOwnProfile}
          fallback={
  /* Other user's profile - Achievements only (no videos for now) */
            <div class="mt-4">
              <h3 class="text-base font-semibold mb-4">Achievements</h3>
              <Show
                when={props.achievements && props.achievements.length > 0}
                fallback={
                  <div class="text-center py-12 text-muted-foreground">
                    No achievements yet
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
              <TabsTrigger value="settings">Settings</TabsTrigger>
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
                  Disconnect
                </Button>
              </Show>
            </TabsContent>
          </Tabs>
        </Show>
      </div>
    </div>
  )
}
