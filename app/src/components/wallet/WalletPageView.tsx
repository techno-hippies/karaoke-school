import { useTranslation } from 'react-i18next'
import { Copy } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { UsernameUpgradeSection } from './UsernameUpgradeSection'

// Icon component that renders currency logo with chain indicator
function TokenIcon({ 
  currencyIcon, 
  chainIcon, 
  className = "" 
}: { 
  currencyIcon?: string
  chainIcon?: string
  className?: string 
}) {
  return (
    <div className={`relative w-12 h-12 md:w-14 md:h-14 ${className}`}>
      {/* Currency icon with white background */}
      {currencyIcon && (
        <div className="w-full h-full rounded-full bg-white p-2 flex items-center justify-center shadow-sm border border-gray-200">
          <img 
            src={`/images/${currencyIcon}`} 
            alt="Currency"
            className="w-full h-full object-contain"
            onError={(e) => {
              // Fallback to symbol text if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = '<span class="text-xs font-bold text-gray-600">?</span>';
              }
            }}
          />
        </div>
      )}
      
      {/* Chain indicator in top right */}
      {chainIcon && (
        <div className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center">
          <img
            src={`/images/${chainIcon}`}
            alt="Chain"
            className="w-full h-full object-contain"
            style={{
              width: chainIcon === 'base-chain.svg' ? '75%' :
                     chainIcon === 'ethereum-chain.svg' ? '65%' :
                     chainIcon === 'arbitrum-chain.svg' ? '75%' :
                     chainIcon === 'optimism-chain.svg' ? '70%' :
                     chainIcon === 'bsc-chain.svg' ? '100%' :
                     chainIcon === 'polygon-chain.svg' ? '100%' :
                     '100%',
              height: chainIcon === 'base-chain.svg' ? '75%' :
                      chainIcon === 'ethereum-chain.svg' ? '65%' :
                      chainIcon === 'arbitrum-chain.svg' ? '75%' :
                      chainIcon === 'optimism-chain.svg' ? '70%' :
                      chainIcon === 'bsc-chain.svg' ? '100%' :
                      chainIcon === 'polygon-chain.svg' ? '100%' :
                      '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              flexShrink: 0
            }}
            onError={(e) => {
              // Fallback if chain icon fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  )
}

// Skeleton component for loading token items
function TokenSkeleton() {
  return (
    <Item variant="muted">
      {/* Token Icon Skeleton */}
      <ItemMedia>
        <Skeleton className="w-12 h-12 md:w-14 md:h-14 rounded-full" />
      </ItemMedia>

      {/* Token Info Skeleton */}
      <ItemContent>
        <Skeleton className="h-5 w-16 mb-1" />
      </ItemContent>

      {/* Balance Skeleton */}
      <ItemContent className="items-end">
        <Skeleton className="h-5 w-24 mb-1" />
        <Skeleton className="h-4 w-16" />
      </ItemContent>
    </Item>
  )
}

export interface TokenBalance {
  symbol: string
  name: string
  balance: string
  network: string
  icon?: string // URL or component
  usdValue?: string
  currencyIcon?: string // Currency logo filename
  chainIcon?: string // Chain indicator filename
  isLoading?: boolean // New: indicates skeleton state
}

export interface WalletPageViewProps {
  tokens: TokenBalance[]
  walletAddress: string
  currentUsername?: string
  onCopyAddress: () => void
  onCheckUsernameAvailability?: (username: string) => Promise<boolean>
  onPurchaseUsername?: (username: string) => Promise<boolean>
  isLoading?: boolean // New: global loading state
}

export function WalletPageView({
  tokens,
  walletAddress,
  currentUsername,
  onCopyAddress,
  onCheckUsernameAvailability,
  onPurchaseUsername,
  isLoading = false,
}: WalletPageViewProps) {
  const { t } = useTranslation()
  // Group tokens by network
  const tokensByNetwork = tokens.reduce((acc, token) => {
    if (!acc[token.network]) {
      acc[token.network] = []
    }
    acc[token.network].push(token)
    return acc
  }, {} as Record<string, TokenBalance[]>)

  // Order networks logically
  const networkOrder = ['Base', 'Binance Smart Chain', 'Ethereum', 'Polygon', 'Arbitrum', 'Optimism']
  const sortedNetworks = Object.keys(tokensByNetwork).sort((a, b) => {
    const aIndex = networkOrder.indexOf(a)
    const bIndex = networkOrder.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  if (isLoading && tokens.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <div>
          <h2 className="text-base font-medium text-muted-foreground mb-3">{t('wallet.address')}</h2>
          <div className="flex items-center gap-3">
            <Skeleton className="flex-1 h-11 rounded-full" />
            <Skeleton className="w-11 h-11 rounded-full" />
          </div>
        </div>

        <div>
          <h2 className="text-base font-medium text-muted-foreground mb-3">{t('wallet.username')}</h2>
          <div className="space-y-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>

        <div>
          <h2 className="text-base font-medium text-muted-foreground mb-3">{t('wallet.balances')}</h2>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <TokenSkeleton key={`wallet-skeleton-${index}`} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Wallet Address */}
      <div className="mb-8">
        <h2 className="text-base font-medium text-muted-foreground mb-3">{t('wallet.address')}</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 w-0 bg-secondary rounded-full h-11 px-4 flex items-center">
            <div className="font-mono text-base text-foreground">
              {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
            </div>
          </div>
          <Button
            onClick={onCopyAddress}
            variant="secondary"
            size="icon"
          >
            <Copy className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Username Upgrade Section */}
      <div className="mb-8">
        <UsernameUpgradeSection
          currentUsername={currentUsername}
          onCheckAvailability={onCheckUsernameAvailability}
          onPurchase={onPurchaseUsername}
        />
      </div>

      {/* Token Balances - Grouped by Network */}
      <div>
        <h2 className="text-base font-medium text-muted-foreground mb-3">{t('wallet.balances')}</h2>
        <div className="space-y-6">
          {sortedNetworks.map((network) => (
            <div key={network} className="space-y-2">
              {/* Network Header */}
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  {network}
                </h3>
                <div className="flex-1 h-px bg-border"></div>
              </div>
              
              {/* Tokens for this network */}
              <div className="space-y-2">
                {tokensByNetwork[network].map((token, index) => {
                  // Show skeleton if token is still loading
                  if (token.isLoading) {
                    return <TokenSkeleton key={`${token.symbol}-${token.network}-${index}-skeleton`} />
                  }

                  return (
                    <Item
                      key={`${token.symbol}-${token.network}-${index}`}
                      variant="muted"
                    >
                      {/* Token Icon */}
                      <ItemMedia>
                        <TokenIcon
                          currencyIcon={token.currencyIcon}
                          chainIcon={token.chainIcon}
                        />
                      </ItemMedia>

                      {/* Token Info */}
                      <ItemContent>
                        <ItemTitle>
                          {token.symbol}
                        </ItemTitle>
                      </ItemContent>

                      {/* Balance */}
                      <ItemContent className="items-end">
                        <ItemTitle>
                          {token.balance}
                        </ItemTitle>
                        {token.usdValue && (
                          <ItemDescription>
                            ${token.usdValue}
                          </ItemDescription>
                        )}
                      </ItemContent>
                    </Item>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
