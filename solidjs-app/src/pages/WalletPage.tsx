/**
 * WalletPage - Container component for wallet/profile functionality
 * Shows the current user's unified profile with wallet info
 */

const IS_DEV = import.meta.env.DEV

import { type Component, Switch, Match } from 'solid-js'
import { useAuth } from '@/contexts/AuthContext'
import { usePKPBalances } from '@/hooks/usePKPBalances'
import { ProfilePageView } from '@/components/profile/ProfilePageView'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const WalletPage: Component = () => {
  const auth = useAuth()
  const { balances, isLoading, error, refetch } = usePKPBalances()

  const handleCopyAddress = async () => {
    const address = auth.pkpAddress()
    if (!address) return

    try {
      await navigator.clipboard.writeText(address)
      if (IS_DEV) {
        console.log('PKP address copied to clipboard')
      }
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  // Get username handle from Lens account
  const username = () => {
    const lensAccount = auth.lensAccount()
    return lensAccount?.username?.localName || undefined
  }

  const avatarUrl = () => {
    const lensAccount = auth.lensAccount()
    return lensAccount?.metadata?.picture || undefined
  }

  const bio = () => {
    const lensAccount = auth.lensAccount()
    return lensAccount?.metadata?.bio || undefined
  }

  return (
    <Switch>
      {/* Loading skeleton while checking stored session */}
      <Match when={auth.isCheckingSession()}>
        <div class="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6">
          <div class="flex flex-col items-center gap-4 mb-6">
            <Skeleton class="w-28 h-28 md:w-36 md:h-36 rounded-full" />
            <Skeleton class="h-6 w-32" />
            <Skeleton class="h-10 w-48 rounded-full" />
          </div>
          <div class="space-y-4">
            <Skeleton class="h-12 w-full rounded-full" />
            <Skeleton class="h-40 w-full rounded-xl" />
          </div>
        </div>
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
        <div class="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-12">
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

      {/* Connected state - Show unified profile */}
      <Match when={auth.isPKPReady()}>
        <ProfilePageView
          username={username()}
          avatarUrl={avatarUrl()}
          bio={bio()}
          walletAddress={auth.pkpAddress() || ''}
          tokens={balances()}
          isLoadingTokens={isLoading()}
          isOwnProfile={true}
          onCopyAddress={handleCopyAddress}
          onDisconnect={() => auth.logout()}
        />
      </Match>
    </Switch>
  )
}
