/**
 * useUnlockSubscription
 * Hook for purchasing Unlock Protocol subscription NFTs on Base Sepolia
 * Price: 0.006 ETH
 */

import { useState } from 'react'
import { parseEther, type Address, type Hash } from 'viem'
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

// TODO: Replace with actual Unlock Protocol lock address for your subscription
const UNLOCK_LOCK_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

// Subscription price: 0.006 ETH
const SUBSCRIPTION_PRICE = parseEther('0.006')

export type SubscriptionStatus = 'idle' | 'approving' | 'purchasing' | 'complete' | 'error'

export interface UseUnlockSubscriptionResult {
  subscribe: () => Promise<void>
  status: SubscriptionStatus
  statusMessage: string
  errorMessage: string
  txHash?: Hash
  reset: () => void
}

export function useUnlockSubscription(
  recipientAddress?: Address
): UseUnlockSubscriptionResult {
  const [status, setStatus] = useState<SubscriptionStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [txHash, setTxHash] = useState<Hash | undefined>()

  const publicClient = usePublicClient({ chainId: baseSepolia.id })
  const { data: walletClient } = useWalletClient({ chainId: baseSepolia.id })

  const subscribe = async () => {
    if (!walletClient || !publicClient) {
      setStatus('error')
      setErrorMessage('Wallet not connected')
      return
    }

    if (!recipientAddress) {
      setStatus('error')
      setErrorMessage('No recipient address provided')
      return
    }

    try {
      // Step 1: Approving (wallet signature request)
      setStatus('approving')
      setStatusMessage('Approve transaction in your wallet...')
      setErrorMessage('')

      // Step 2: Purchasing
      setStatus('purchasing')
      setStatusMessage('Processing subscription...')

      // Call Unlock Protocol purchase function
      const hash = await walletClient.writeContract({
        address: UNLOCK_LOCK_ADDRESS,
        abi: UNLOCK_ABI,
        functionName: 'purchase',
        args: [
          SUBSCRIPTION_PRICE, // price
          recipientAddress, // recipient (buyer)
          '0x0000000000000000000000000000000000000000' as Address, // no referrer
          '0x' as `0x${string}`, // no extra data
        ],
        value: SUBSCRIPTION_PRICE,
        chain: baseSepolia,
      })

      setTxHash(hash)
      setStatusMessage('Confirming transaction...')

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        setStatus('complete')
        setStatusMessage('Subscription successful!')
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error) {
      console.error('[useUnlockSubscription] Error:', error)
      setStatus('error')
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
