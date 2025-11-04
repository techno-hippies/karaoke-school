import { Copy } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
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
              width: chainIcon === 'base-chain.svg' ? '75%' : '100%',
              height: chainIcon === 'base-chain.svg' ? '75%' : '100%',
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

export interface TokenBalance {
  symbol: string
  name: string
  balance: string
  network: string
  icon?: string // URL or component
  usdValue?: string
  currencyIcon?: string // Currency logo filename
  chainIcon?: string // Chain indicator filename
}

export interface WalletPageViewProps {
  tokens: TokenBalance[]
  walletAddress: string
  currentUsername?: string
  onCopyAddress: () => void
  onCheckUsernameAvailability?: (username: string) => Promise<boolean>
  onPurchaseUsername?: (username: string) => Promise<boolean>
}

export function WalletPageView({
  tokens,
  walletAddress,
  currentUsername,
  onCopyAddress,
  onCheckUsernameAvailability,
  onPurchaseUsername,
}: WalletPageViewProps) {
  // Group tokens by network
  const tokensByNetwork = tokens.reduce((acc, token) => {
    if (!acc[token.network]) {
      acc[token.network] = []
    }
    acc[token.network].push(token)
    return acc
  }, {} as Record<string, TokenBalance[]>)

  // Order networks logically
  const networkOrder = ['Tron', 'Base', 'Polygon', 'BSC']
  const sortedNetworks = Object.keys(tokensByNetwork).sort((a, b) => {
    const aIndex = networkOrder.indexOf(a)
    const bIndex = networkOrder.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Wallet Address */}
      <div className="mb-8">
        <h2 className="text-base font-medium text-muted-foreground mb-3">Wallet Address</h2>
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
        <h2 className="text-base font-medium text-muted-foreground mb-3">Balances</h2>
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
                {tokensByNetwork[network].map((token, index) => (
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
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
