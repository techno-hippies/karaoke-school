import { useState, useEffect, useCallback } from 'react'
import { Copy, Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ProfileAvatar } from './ProfileAvatar'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Primary tokens that are always shown (main app currencies)
const PRIMARY_TOKENS = [
  { symbol: 'ETH', network: 'Base' },
  { symbol: 'USDC', network: 'Base' },
]

function isPrimaryToken(token: TokenBalance): boolean {
  return PRIMARY_TOKENS.some(
    (p) => p.symbol === token.symbol && p.network === token.network
  )
}

export interface TokenBalance {
  symbol: string
  name: string
  balance: string
  network: string
  usdValue?: string
  currencyIcon?: string
  chainIcon?: string
  isLoading?: boolean
}

export interface Achievement {
  id: string
  title: string
  description: string
  iconUrl?: string
  unlockedAt?: Date
  isLocked?: boolean
}

export interface ProfileWalletPageProps {
  // Identity
  username?: string
  avatarUrl?: string
  walletAddress: string

  // Tokens (only non-zero shown, or empty state)
  tokens?: TokenBalance[]

  // Achievements
  achievements?: Achievement[]

  // Handlers
  onCopyAddress?: () => void
  onSettings?: () => void
  onLoadMoreTokens?: () => void

  // Loading state for other networks
  hasLoadedOtherNetworks?: boolean
  isLoadingOtherNetworks?: boolean

  className?: string
}

function TokenIcon({
  currencyIcon,
  chainIcon,
}: {
  currencyIcon?: string
  chainIcon?: string
}) {
  return (
    <div className="relative w-12 h-12 md:w-14 md:h-14">
      {currencyIcon ? (
        <div className="w-full h-full rounded-full bg-white p-2 flex items-center justify-center border border-border">
          <img
            src={`/images/${currencyIcon}`}
            alt="Currency"
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="w-full h-full rounded-full bg-muted flex items-center justify-center">
          <span className="text-sm font-bold text-muted-foreground">?</span>
        </div>
      )}
      {chainIcon && (
        <div className="absolute -top-1 -right-1 w-6 h-6">
          <img
            src={`/images/${chainIcon}`}
            alt="Chain"
            className="w-full h-full object-contain"
          />
        </div>
      )}
    </div>
  )
}

function TokenSkeleton() {
  return (
    <Item variant="muted">
      <ItemMedia>
        <Skeleton className="w-12 h-12 md:w-14 md:h-14 rounded-full" />
      </ItemMedia>
      <ItemContent>
        <Skeleton className="h-5 w-14 mb-1" />
        <Skeleton className="h-4 w-20" />
      </ItemContent>
      <ItemContent className="items-end">
        <Skeleton className="h-5 w-20 mb-1" />
        <Skeleton className="h-4 w-14" />
      </ItemContent>
    </Item>
  )
}

function TokenItem({ token, index }: { token: TokenBalance; index: number }) {
  if (token.isLoading) {
    return <TokenSkeleton key={`${token.symbol}-${token.network}-${index}-skeleton`} />
  }

  return (
    <Item
      key={`${token.symbol}-${token.network}-${index}`}
      variant="muted"
    >
      <ItemMedia>
        <TokenIcon
          currencyIcon={token.currencyIcon}
          chainIcon={token.chainIcon}
        />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{token.symbol}</ItemTitle>
        <ItemDescription>{token.network}</ItemDescription>
      </ItemContent>
      <ItemContent className="items-end">
        <ItemTitle>{token.balance}</ItemTitle>
        {token.usdValue && (
          <ItemDescription>${token.usdValue}</ItemDescription>
        )}
      </ItemContent>
    </Item>
  )
}

/**
 * ProfileWalletPage - Combined profile and wallet view
 *
 * Simplified for new users:
 * - Avatar + username + wallet address
 * - Two tabs: Tokens | Achievements
 * - Only shows non-zero token balances
 * - No username upgrade (not ready)
 * - No dances (users won't have any yet)
 */
export function ProfileWalletPage({
  username,
  avatarUrl,
  walletAddress,
  tokens = [],
  achievements = [],
  onCopyAddress,
  onSettings,
  onLoadMoreTokens,
  hasLoadedOtherNetworks = false,
  isLoadingOtherNetworks = false,
  className,
}: ProfileWalletPageProps) {
  const [copied, setCopied] = useState(false)

  // Reset copied state after delay
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopy = useCallback(() => {
    onCopyAddress?.()
    setCopied(true)
  }, [onCopyAddress])

  // Categorize tokens:
  // 1. Primary tokens (Base ETH, Base USDC) - always shown
  // 2. Other tokens with non-zero balance
  // 3. Zero-balance tokens (shown in accordion)
  const primaryTokens = tokens.filter((t) => isPrimaryToken(t))
  const otherNonZeroTokens = tokens.filter(
    (t) => !isPrimaryToken(t) && (t.isLoading || parseFloat(t.balance) > 0)
  )
  const zeroBalanceTokens = tokens.filter(
    (t) => !isPrimaryToken(t) && !t.isLoading && parseFloat(t.balance) === 0
  )

  const truncatedAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`

  return (
    <div className={cn('relative w-full min-h-screen bg-background', className)}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <ProfileAvatar
            src={avatarUrl}
            alt={username || 'Profile'}
            size="xl"
          />

          {username && (
            <h1 className="text-xl font-semibold">@{username}</h1>
          )}

          {/* Wallet Address */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <span className="font-mono text-sm text-muted-foreground">
              {truncatedAddress}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Tabs: Tokens | Achievements */}
        <Tabs defaultValue="tokens" className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-muted/50">
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          <TabsContent value="tokens" className="mt-4">
            <div className="space-y-2">
              {/* Primary tokens (Base ETH, Base USDC) - always shown */}
              {primaryTokens.map((token, index) => (
                <TokenItem key={`primary-${token.symbol}-${index}`} token={token} index={index} />
              ))}

              {/* Other tokens with non-zero balance */}
              {otherNonZeroTokens.map((token, index) => (
                <TokenItem key={`other-${token.symbol}-${token.network}-${index}`} token={token} index={index} />
              ))}

              {/* Load more networks accordion */}
              {!hasLoadedOtherNetworks && onLoadMoreTokens && (
                <Accordion
                  type="single"
                  collapsible
                  className="mt-4"
                  onValueChange={(value) => {
                    if (value === 'other-networks') {
                      onLoadMoreTokens()
                    }
                  }}
                >
                  <AccordionItem value="other-networks" className="border-none">
                    <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline py-2">
                      {isLoadingOtherNetworks ? 'Loading other networks...' : 'Show balances on other networks'}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 pt-2">
                      {isLoadingOtherNetworks && (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {/* Empty state when no tokens at all */}
              {primaryTokens.length === 0 && otherNonZeroTokens.length === 0 && zeroBalanceTokens.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No tokens yet</p>
                  <Button variant="outline" size="sm">
                    Add funds
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="achievements" className="mt-4">
            {achievements.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-2xl border transition-colors',
                      achievement.isLocked
                        ? 'bg-muted/30 border-border opacity-60'
                        : 'bg-card border-primary/20'
                    )}
                  >
                    {achievement.iconUrl ? (
                      <img
                        src={achievement.iconUrl}
                        alt={achievement.title}
                        className="w-12 h-12 object-contain"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="text-xl">🏆</span>
                      </div>
                    )}
                    <h3 className="text-sm font-semibold text-center">
                      {achievement.title}
                    </h3>
                    <p className="text-xs text-muted-foreground text-center line-clamp-2">
                      {achievement.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No achievements yet
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
