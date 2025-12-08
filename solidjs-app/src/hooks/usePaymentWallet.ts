/**
 * usePaymentWallet - Unified hook for payment wallet logic
 *
 * Smart wallet selection based on how the user signed up:
 * - EOA users (authMethodType: 1) → use their connected EOA wallet
 * - Social/Passkey users → use their PKP wallet
 *
 * This reduces friction for EOA users who already have funds in their wallet.
 */

import { createMemo, createEffect } from 'solid-js'
import type { Address } from 'viem'
import { useAuth } from '@/contexts/AuthContext'
import { useEOABalances } from './useEOABalances'
import { usePKPBalances } from './usePKPBalances'

const IS_DEV = import.meta.env.DEV

// Lit Protocol auth method types
const AUTH_METHOD_ETH_WALLET = 1

export type WalletType = 'eoa' | 'pkp'

/** Payment method info for display */
export interface PaymentMethodInfo {
  token: 'USDC' | 'ETH'
  chainName: string
  balance: number
}

export interface UsePaymentWalletResult {
  /** The wallet type being used for payments */
  walletType: () => WalletType
  /** The wallet address for payments */
  walletAddress: () => Address | undefined
  /** Whether user signed up with EOA */
  isEOAUser: () => boolean
  /** Whether any wallet has sufficient balance */
  hasSufficientBalance: () => boolean
  /** Best payment method (token + chain + balance) */
  bestPaymentMethod: () => PaymentMethodInfo | undefined
  /** Whether balances are loading */
  isLoading: () => boolean
  /** Refresh balances */
  refresh: () => Promise<void>
}

export interface UsePaymentWalletOptions {
  /** Required amount in USD (default: 0.10) */
  requiredUsd?: number
}

export function usePaymentWallet(options?: UsePaymentWalletOptions): UsePaymentWalletResult {
  const requiredUsd = options?.requiredUsd ?? 0.10
  const auth = useAuth()

  // Check if user signed up with EOA (authMethodType: 1)
  const isEOAUser = createMemo(() => {
    const authData = auth.authData()
    return authData?.authMethodType === AUTH_METHOD_ETH_WALLET
  })

  // Get stored EOA address from auth data (for when wagmi isn't connected)
  const storedEoaAddress = createMemo(() => {
    const authData = auth.authData()
    return authData?.eoaAddress as Address | undefined
  })

  // Get balances from both sources
  // Pass stored EOA address as override for when wagmi loses connection
  const eoaBalances = useEOABalances({
    requiredUsd,
    overrideAddress: storedEoaAddress,
  })
  const pkpBalances = usePKPBalances()

  // Debug logging
  createEffect(() => {
    if (IS_DEV) {
      const authData = auth.authData()
      console.log('[usePaymentWallet] Auth state:', {
        authMethodType: authData?.authMethodType,
        isEOAUser: isEOAUser(),
        walletType: isEOAUser() ? 'eoa' : 'pkp',
        eoaAddress: eoaBalances.address(),
        eoaConnected: eoaBalances.isConnected(),
        eoaBalancesCount: eoaBalances.balances().length,
        eoaLoading: eoaBalances.isLoading(),
        pkpAddress: auth.pkpAddress(),
        // Check if AuthContext has the EOA address stored
        authDataEoaAddress: authData?.eoaAddress,
      })
    }
  })

  // Determine wallet type based on auth method
  const walletType = createMemo((): WalletType => {
    return isEOAUser() ? 'eoa' : 'pkp'
  })

  // Get the appropriate wallet address
  const walletAddress = createMemo((): Address | undefined => {
    if (isEOAUser()) {
      // For EOA users, use stored EOA address from authData
      // (wagmi may not maintain connection after auth flow)
      const authData = auth.authData()
      if (authData?.eoaAddress) {
        return authData.eoaAddress as Address
      }
      // Fallback to wagmi if available (live connection)
      return eoaBalances.address()
    }
    // For social/passkey users, use PKP
    return auth.pkpAddress() as Address | undefined
  })

  // Check if has sufficient balance
  const hasSufficientBalance = createMemo(() => {
    if (isEOAUser()) {
      return eoaBalances.hasSufficientBalance()
    }
    // For PKP users, check if any balance >= required amount
    const balances = pkpBalances.balances()
    // Convert USD requirement - for now just check USDC directly
    const usdcBalance = balances.find(b => b.symbol === 'USDC')
    if (usdcBalance) {
      const amount = parseFloat(usdcBalance.balance)
      if (amount >= requiredUsd) return true
    }
    // Also check ETH (rough conversion ~$3000/ETH)
    const ethBalance = balances.find(b => b.symbol === 'ETH')
    if (ethBalance) {
      const amount = parseFloat(ethBalance.balance)
      const ethValueUsd = amount * 3000
      if (ethValueUsd >= requiredUsd) return true
    }
    return false
  })

  // Get best payment method
  const bestPaymentMethod = createMemo((): PaymentMethodInfo | undefined => {
    if (isEOAUser()) {
      const method = eoaBalances.bestPaymentMethod()
      if (method) {
        return {
          token: method.token,
          chainName: method.chainName,
          balance: method.balance,
        }
      }
      return undefined
    }
    // For PKP users, construct from PKP balances
    const balances = pkpBalances.balances()
    // Prefer USDC
    const usdcBalance = balances.find(b => b.symbol === 'USDC' && parseFloat(b.balance) >= requiredUsd)
    if (usdcBalance) {
      return {
        token: 'USDC',
        chainName: usdcBalance.network,
        balance: parseFloat(usdcBalance.balance),
      }
    }
    // Fall back to ETH if enough value
    const ethBalance = balances.find(b => b.symbol === 'ETH')
    if (ethBalance) {
      const amount = parseFloat(ethBalance.balance)
      const ethValueUsd = amount * 3000
      if (ethValueUsd >= requiredUsd) {
        return {
          token: 'ETH',
          chainName: ethBalance.network,
          balance: amount,
        }
      }
    }
    return undefined
  })

  // Loading state
  const isLoading = createMemo(() => {
    if (isEOAUser()) {
      return eoaBalances.isLoading()
    }
    return pkpBalances.isLoading()
  })

  // Refresh function
  const refresh = async () => {
    if (isEOAUser()) {
      await eoaBalances.refresh()
    } else {
      await pkpBalances.refetch()
    }
  }

  return {
    walletType,
    walletAddress,
    isEOAUser,
    hasSufficientBalance,
    bestPaymentMethod,
    isLoading,
    refresh,
  }
}
