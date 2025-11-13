/**
 * useUnlockSubscription
 * Hook for purchasing Unlock Protocol subscription NFTs on Base Sepolia
 * Price: 0.006 ETH
 *
 * Supports both PKP wallet (from AuthContext) and wagmi wallet clients
 */

import { useState } from 'react'
import { parseEther, type Address, type Hash, type WalletClient, type PublicClient } from 'viem'
import { baseSepolia } from 'viem/chains'
import { usePublicClient, useWalletClient } from 'wagmi'

// Unlock Protocol Public Lock ABI (simplified - only purchase function)
const UNLOCK_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: '_value', type: 'uint256' },
      { internalType: 'address', name: '_recipient', type: 'address' },
      { internalType: 'address', name: '_referrer', type: 'address' },
      { internalType: 'bytes', name: '_data', type: 'bytes' },
    ],
    name: 'purchase',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

// Unlock lock address is passed per creator (fetched from Neon lens_accounts table)
// If not provided, subscription is disabled
const DEFAULT_LOCK_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

// Subscription price: 0.006 ETH
const SUBSCRIPTION_PRICE = parseEther('0.006')

export type SubscriptionStatus = 'idle' | 'approving' | 'purchasing' | 'complete' | 'error'

interface UseUnlockSubscriptionOptions {
  walletClient?: WalletClient | null
  publicClient?: PublicClient
}

export interface UseUnlockSubscriptionResult {
  subscribe: () => Promise<void>
  status: SubscriptionStatus
  statusMessage: string
  errorMessage: string
  txHash?: Hash
  reset: () => void
}

export function useUnlockSubscription(
  recipientAddress?: Address,
  lockAddress?: Address,
  options?: UseUnlockSubscriptionOptions
): UseUnlockSubscriptionResult {
  const [status, setStatus] = useState<SubscriptionStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [txHash, setTxHash] = useState<Hash | undefined>()

  const chainId = baseSepolia.id
  const wagmiPublicClient = usePublicClient({ chainId })
  const { data: wagmiWalletClient } = useWalletClient({ chainId })

  const publicClient = options?.publicClient ?? wagmiPublicClient

  const resolvedWalletClient = options?.walletClient ?? wagmiWalletClient ?? null
  const resolvedRecipient = recipientAddress ?? resolvedWalletClient?.account?.address

  // Use provided lock address or default
  const resolvedLockAddress = lockAddress || DEFAULT_LOCK_ADDRESS

  const subscribe = async () => {
    console.log('[useUnlockSubscription] subscribe() called')
    console.log('[useUnlockSubscription] resolvedWalletClient:', resolvedWalletClient)
    console.log('[useUnlockSubscription] publicClient:', publicClient)
    console.log('[useUnlockSubscription] resolvedRecipient:', resolvedRecipient)
    console.log('[useUnlockSubscription] resolvedLockAddress:', resolvedLockAddress)

    if (!resolvedWalletClient || !publicClient) {
      console.error('[useUnlockSubscription] Wallet or public client not available')
      setStatus('error')
      setErrorMessage('Wallet not connected')
      return
    }

    if (!resolvedRecipient) {
      console.error('[useUnlockSubscription] No recipient address')
      setStatus('error')
      setErrorMessage('No recipient address provided')
      return
    }

    if (resolvedLockAddress === DEFAULT_LOCK_ADDRESS) {
      console.error('[useUnlockSubscription] Default lock address - subscription not configured')
      setStatus('error')
      setErrorMessage('Subscription not available for this creator')
      return
    }

    try {
      // Check balance on Base Sepolia (where the contract is)
      console.log('[useUnlockSubscription] Checking balance for address:', resolvedRecipient)
      console.log('[useUnlockSubscription] Checking balance on Base Sepolia (chain ID:', baseSepolia.id, ')')
      const balance = await publicClient.getBalance({ address: resolvedRecipient })
      console.log('[useUnlockSubscription] Base Sepolia balance (wei):', balance.toString())
      console.log('[useUnlockSubscription] Base Sepolia balance (ETH):', Number(balance) / 1e18)
      console.log('[useUnlockSubscription] Required amount (wei):', SUBSCRIPTION_PRICE.toString())
      console.log('[useUnlockSubscription] Required amount (ETH):', Number(SUBSCRIPTION_PRICE) / 1e18)
      console.log('[useUnlockSubscription] Has sufficient balance:', balance >= SUBSCRIPTION_PRICE)

      // Check chain mismatch
      console.log('[useUnlockSubscription] ⚠️ Wallet chain ID:', resolvedWalletClient.chain?.id)
      console.log('[useUnlockSubscription] ⚠️ Wallet chain name:', resolvedWalletClient.chain?.name)
      console.log('[useUnlockSubscription] ⚠️ Expected chain (Base Sepolia) ID:', baseSepolia.id)
      console.log('[useUnlockSubscription] ⚠️ Expected chain (Base Sepolia) name:', baseSepolia.name)
      console.log('[useUnlockSubscription] ⚠️ CHAIN MISMATCH:', resolvedWalletClient.chain?.id !== baseSepolia.id)
      console.log('[useUnlockSubscription] Account:', resolvedWalletClient.account)

      // Step 1: Approving (wallet signature request)
      setStatus('approving')
      setStatusMessage('Approve transaction in your wallet...')
      setErrorMessage('')
      console.log('[useUnlockSubscription] Status: approving')

      // Step 2: Purchasing
      setStatus('purchasing')
      setStatusMessage('Processing subscription...')
      console.log('[useUnlockSubscription] Status: purchasing')

      // Call Unlock Protocol purchase function
      console.log('[useUnlockSubscription] Calling writeContract with params:', {
        address: resolvedLockAddress,
        functionName: 'purchase',
        args: [
          SUBSCRIPTION_PRICE.toString(),
          resolvedRecipient,
          '0x0000000000000000000000000000000000000000',
          '0x'
        ],
        value: SUBSCRIPTION_PRICE.toString(),
        chain: baseSepolia.id
      })

      const hash = await resolvedWalletClient.writeContract({
        address: resolvedLockAddress,
        abi: UNLOCK_ABI,
        functionName: 'purchase',
        args: [
          SUBSCRIPTION_PRICE, // price
          resolvedRecipient, // recipient (buyer)
          '0x0000000000000000000000000000000000000000' as Address, // no referrer
          '0x' as `0x${string}`, // no extra data
        ],
        value: SUBSCRIPTION_PRICE,
        chain: baseSepolia,
        account: resolvedWalletClient.account,
      })

      console.log('[useUnlockSubscription] Transaction hash:', hash)
      setTxHash(hash)
      setStatusMessage('Confirming transaction...')

      // Wait for transaction confirmation
      console.log('[useUnlockSubscription] Waiting for transaction receipt...')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      console.log('[useUnlockSubscription] Transaction receipt:', receipt)

      if (receipt.status === 'success') {
        console.log('[useUnlockSubscription] Transaction successful!')
        setStatus('complete')
        setStatusMessage('Subscription successful!')
      } else {
        console.error('[useUnlockSubscription] Transaction failed - receipt status:', receipt.status)
        throw new Error('Transaction failed')
      }
    } catch (error) {
      console.error('[useUnlockSubscription] Error details:', error)
      console.error('[useUnlockSubscription] Error type:', typeof error)
      console.error('[useUnlockSubscription] Error message:', error instanceof Error ? error.message : 'Unknown error')
      console.error('[useUnlockSubscription] Error stack:', error instanceof Error ? error.stack : 'No stack')
      setStatus('error')
      setStatusMessage('')
      setErrorMessage(
        error instanceof Error ? error.message : 'Transaction failed. Please try again.'
      )
    }
  }

  const reset = () => {
    setStatus('idle')
    setStatusMessage('')
    setErrorMessage('')
    setTxHash(undefined)
  }

  return {
    subscribe,
    status,
    statusMessage,
    errorMessage,
    txHash,
    reset,
  }
}
