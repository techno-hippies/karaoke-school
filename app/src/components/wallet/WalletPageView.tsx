import { Copy } from '@phosphor-icons/react'
import { DesktopSidebar } from '../navigation/DesktopSidebar'
import { MobileFooter } from '../navigation/MobileFooter'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export interface Transaction {
  id: string
  description: string
  date: string
  amount: number
  price?: string
}

export interface WalletPageViewProps {
  creditsBalance: number
  usdcBalance: string
  walletAddress: string
  onCopyAddress: () => void
  transactions: Transaction[]
  transactionsLoading?: boolean
  activeTab: 'home' | 'study' | 'post' | 'wallet' | 'profile'
  mobileTab: 'home' | 'study' | 'post' | 'wallet' | 'profile'
  onDesktopTabChange: (tab: 'home' | 'study' | 'post' | 'wallet' | 'profile') => void
  onMobileTabChange: (tab: 'home' | 'study' | 'post' | 'wallet' | 'profile') => void
  isConnected: boolean
  onConnectWallet?: () => void
  onDisconnect?: () => void
}

export function WalletPageView({
  creditsBalance,
  usdcBalance,
  walletAddress,
  onCopyAddress,
  transactions,
  transactionsLoading = false,
  activeTab,
  mobileTab,
  onDesktopTabChange,
  onMobileTabChange,
  isConnected,
  onConnectWallet,
  onDisconnect,
}: WalletPageViewProps) {
  return (
    <div className="h-screen bg-neutral-900">
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={onDesktopTabChange}
        onCreatePost={() => console.log('Create post')}
        isConnected={isConnected}
        walletAddress={walletAddress}
        onConnectWallet={onConnectWallet}
        onDisconnect={onDisconnect}
      />

      <ScrollArea className="h-full md:ml-64">
        <div className="min-h-screen bg-neutral-900 pb-20 md:pb-0">

          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between px-4 py-4 border-b border-neutral-800">
            <div className="w-12" />
            <h1 className="text-center font-semibold text-base text-foreground flex-1">
              Wallet
            </h1>
            <div className="w-9" />
          </div>

          {/* Desktop Header */}
          <div className="hidden md:block px-8 py-6 border-b border-neutral-800">
            <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
          </div>

          {/* Content */}
          <div className="mt-4 mb-4">

            {/* Balances */}
            <div className="px-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                {/* USDC Balance */}
                <div className="text-center py-6 px-4 rounded-lg border-2 border-border">
                  <p className="text-3xl font-bold">${usdcBalance}</p>
                  <p className="text-sm text-muted-foreground mt-2">USDC on Base</p>
                </div>

                {/* Song Credits Balance */}
                <div className="text-center py-6 px-4 rounded-lg border-2 border-border">
                  <p className="text-3xl font-bold">{creditsBalance.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-2">Song Credits</p>
                </div>
              </div>
            </div>

            {/* Wallet Address */}
            <div className="px-4 mb-6">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Wallet Address</h2>
              <div className="flex items-center gap-2">
                <div className="flex-1 w-0 bg-neutral-800 rounded-lg px-4 py-3">
                  <div className="font-mono text-sm text-foreground">
                    {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                  </div>
                </div>
                <Button
                  onClick={onCopyAddress}
                  variant="secondary"
                  size="icon"
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="px-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent Activity</h2>

              {transactionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No transactions yet
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-neutral-800 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 w-0">
                          <div className="text-sm font-medium text-foreground mb-1">
                            {tx.description}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {tx.date}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={cn(
                              'text-sm font-semibold',
                              tx.amount > 0 ? 'text-green-500' : 'text-foreground'
                            )}
                          >
                            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                          </div>
                          {tx.price && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {tx.price}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </ScrollArea>

      <MobileFooter
        activeTab={mobileTab}
        onTabChange={onMobileTabChange}
      />
    </div>
  )
}
