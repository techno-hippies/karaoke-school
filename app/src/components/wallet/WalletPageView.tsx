import { Copy } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { UsernameUpgradeSection } from './UsernameUpgradeSection'

export interface TokenBalance {
  symbol: string
  name: string
  balance: string
  network: string
  icon?: string // URL or component
  usdValue?: string
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

      {/* Token Balances */}
      <div>
        <h2 className="text-base font-medium text-muted-foreground mb-3">Balances</h2>
        <div className="space-y-2">
          {tokens.map((token, index) => (
            <Item
              key={`${token.symbol}-${token.network}-${index}`}
              variant="muted"
            >
              {/* Token Icon */}
              <ItemMedia>
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-base md:text-lg flex-shrink-0">
                  {token.symbol.slice(0, 2)}
                </div>
              </ItemMedia>

              {/* Token Info */}
              <ItemContent>
                <ItemTitle>
                  {token.symbol}
                  <span className="text-base font-normal text-muted-foreground">
                    {token.network}
                  </span>
                </ItemTitle>
                <ItemDescription>
                  {token.name}
                </ItemDescription>
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
    </div>
  )
}
