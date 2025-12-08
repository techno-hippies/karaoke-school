/**
 * WalletPage - Container component for wallet/profile functionality
 * Shows the current user's unified profile with wallet info
 *
 * Uses smart wallet selection:
 * - EOA users see their EOA wallet balances
 * - Social/passkey users see their PKP wallet balances
 */

const IS_DEV = import.meta.env.DEV

import { type Component, Switch, Match, createEffect, createMemo } from 'solid-js'
import { useAuth } from '@/contexts/AuthContext'
import { usePKPBalances, type TokenBalance } from '@/hooks/usePKPBalances'
import { usePaymentWallet } from '@/hooks/usePaymentWallet'
import { useEOABalances } from '@/hooks/useEOABalances'
import { useTranslation } from '@/lib/i18n'
import { ProfilePageView } from '@/components/profile/ProfilePageView'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const WalletPage: Component = () => {
  const { t } = useTranslation()
  const auth = useAuth()
  const pkpBalances = usePKPBalances()
  const paymentWallet = usePaymentWallet({ requiredUsd: 0.10 })

  // Get stored EOA address for balance fetching
  const storedEoaAddress = createMemo(() => auth.authData()?.eoaAddress)

  // EOA balances (only used if user signed up with EOA)
  const eoaBalances = useEOABalances({
    requiredUsd: 0.10,
    overrideAddress: storedEoaAddress,
  })

  // Debug: log wallet selection
  createEffect(() => {
    if (IS_DEV) {
      console.log('[WalletPage] Payment wallet state:', {
        walletType: paymentWallet.walletType(),
        walletAddress: paymentWallet.walletAddress(),
        isEOAUser: paymentWallet.isEOAUser(),
        hasSufficientBalance: paymentWallet.hasSufficientBalance(),
        bestPaymentMethod: paymentWallet.bestPaymentMethod(),
        isLoading: paymentWallet.isLoading(),
        eoaBalancesCount: eoaBalances.balances().length,
      })
    }
  })

  // Map chain names to icon filenames
  const chainIconMap: Record<string, string> = {
    'Base': 'base-chain.svg',
    'Arbitrum': 'arbitrum-chain.svg',
    'Optimism': 'optimism-chain.svg',
    'Sepolia': 'ethereum-chain.svg',
    'Ethereum': 'ethereum-chain.svg',
  }

  // Convert EOA balances to ProfilePageView format
  const eoaTokensForDisplay = createMemo((): TokenBalance[] => {
    return eoaBalances.balances().map(b => ({
      symbol: b.token,
      name: b.token === 'ETH' ? 'Ethereum' : 'USD Coin',
      balance: b.balanceFormatted.toFixed(b.token === 'USDC' ? 2 : 6),
      network: b.chainName,
      // Don't include $ prefix - ProfilePageView adds it
      usdValue: b.token === 'ETH' ? (b.balanceFormatted * 3000).toFixed(2) : b.balanceFormatted.toFixed(2),
      // Icons for display
      currencyIcon: b.token === 'ETH' ? 'ethereum-logo.png' : 'usdc-logo.png',
      chainIcon: chainIconMap[b.chainName] || 'ethereum-chain.svg',
    }))
  })

  // Get wallet address to display (EOA or PKP)
  const displayWalletAddress = createMemo(() => {
    if (paymentWallet.isEOAUser()) {
      return paymentWallet.walletAddress() || ''
    }
    return auth.pkpAddress() || ''
  })

  // Get tokens to display (EOA or PKP balances)
  const displayTokens = createMemo(() => {
    if (paymentWallet.isEOAUser()) {
      return eoaTokensForDisplay()
    }
    return pkpBalances.balances()
  })

  // Loading state
  const isLoadingTokens = createMemo(() => {
    if (paymentWallet.isEOAUser()) {
      return eoaBalances.isLoading()
    }
    return pkpBalances.isLoading()
  })

  const handleCopyAddress = async () => {
    const address = displayWalletAddress()
    if (!address) return

    try {
      await navigator.clipboard.writeText(address)
      if (IS_DEV) {
        console.log('Wallet address copied to clipboard:', address)
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
          <h2 class="text-2xl font-bold text-center">{t('walletPage.signUpTitle')}</h2>
          <p class="text-muted-foreground text-center">
            {t('walletPage.signUpDescription')}
          </p>
          <Button onClick={() => auth.openAuthDialog()}>
            {t('auth.signUp')}
          </Button>
        </div>
      </Match>

      {/* Error state */}
      <Match when={pkpBalances.error()}>
        <div class="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-12">
          <div class="text-center">
            <h2 class="text-xl font-semibold mb-4 text-destructive">
              {t('common.error')}
            </h2>
            <p class="text-muted-foreground mb-4">{pkpBalances.error()?.message}</p>
            <Button onClick={pkpBalances.refetch} variant="outline">
              {t('common.retry')}
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
          walletAddress={displayWalletAddress()}
          tokens={displayTokens()}
          isLoadingTokens={isLoadingTokens()}
          isOwnProfile={true}
          onCopyAddress={handleCopyAddress}
          onDisconnect={() => auth.logout()}
        />
      </Match>
    </Switch>
  )
}
