/**
 * WalletPage - Container component for wallet functionality
 * Handles data fetching and connects to presentational components
 */

import { type Component, Show, Switch, Match } from 'solid-js'
import { useAuth } from '@/contexts/AuthContext'
import { usePKPBalances } from '@/hooks/usePKPBalances'
import { WalletPageView } from '@/components/wallet/WalletPageView'
import { Button } from '@/components/ui/button'
import { SignOut } from '@/components/icons'

export const WalletPage: Component = () => {
  const auth = useAuth()
  const { balances, isLoading, error, refetch } = usePKPBalances()

  const handleCopyAddress = async () => {
    const address = auth.pkpAddress()
    if (!address) return

    try {
      await navigator.clipboard.writeText(address)
      console.log('PKP address copied to clipboard')
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  return (
    <Switch>
      {/* Loading skeleton while checking stored session */}
      <Match when={auth.isCheckingSession()}>
        <WalletPageView
          tokens={[]}
          walletAddress=""
          onCopyAddress={() => {}}
          isLoading={true}
        />
      </Match>

      {/* Not connected state */}
      <Match when={!auth.isPKPReady()}>
        <div class="flex flex-col items-center justify-center h-screen gap-4 px-4">
          <h2 class="text-2xl font-bold text-center">Sign Up</h2>
          <p class="text-muted-foreground text-center">
            Create an account to access your wallet and purchases
          </p>
          <Button onClick={() => auth.openAuthDialog()}>
            Sign Up
          </Button>
        </div>
      </Match>

      {/* Error state */}
      <Match when={error()}>
        <div class="max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <div class="text-center">
            <h2 class="text-xl font-semibold mb-4 text-destructive">
              Error Loading Balances
            </h2>
            <p class="text-muted-foreground mb-4">{error()?.message}</p>
            <Button onClick={refetch} variant="outline">
              Retry
            </Button>
          </div>
        </div>
      </Match>

      {/* Connected state */}
      <Match when={auth.isPKPReady()}>
        <div>
          <WalletPageView
            tokens={balances()}
            walletAddress={auth.pkpAddress() || ''}
            onCopyAddress={handleCopyAddress}
            isLoading={isLoading()}
          />

          {/* Disconnect Button */}
          <div class="max-w-2xl mx-auto px-4 md:px-8 pb-8">
            <Button
              onClick={() => auth.logout()}
              variant="outline"
              class="w-full gap-2"
            >
              <SignOut class="h-5 w-5" />
              Disconnect
            </Button>
          </div>
        </div>
      </Match>
    </Switch>
  )
}
