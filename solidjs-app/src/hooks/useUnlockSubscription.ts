/**
 * useUnlockSubscription - Hook for Unlock Protocol subscriptions (SolidJS)
 *
 * Used for recurring subscriptions like Premium AI chat (0.001 ETH / 30 days)
 * on Base Sepolia using Unlock Protocol.
 *
 * NOT for song purchases - those use SongAccess contract via useSongAccess.
 */

import { createSignal, createMemo } from 'solid-js'
import {
  type Address,
  type Hash,
  encodeFunctionData,
  createPublicClient,
  http,
} from 'viem'
import { baseSepolia } from 'viem/chains'
import { useAuth } from '@/contexts/AuthContext'
import type { PurchaseStep } from '@/components/purchase/types'

const IS_DEV = import.meta.env.DEV

// Unlock Protocol Public Lock ABI (v13 - array-based purchase)
const UNLOCK_ABI = [
  {
    inputs: [
      { type: 'uint256[]', name: '_values' },
      { type: 'address[]', name: '_recipients' },
      { type: 'address[]', name: '_referrers' },
      { type: 'address[]', name: '_keyManagers' },
      { type: 'bytes[]', name: '_data' },
    ],
    name: 'purchase',
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'keyPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxKeysPerAddress',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_tokenHolder', type: 'address' }],
    name: 'getHasValidKey',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Default lock address when none configured
const DEFAULT_LOCK_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

// ============ Types ============

export interface UseUnlockSubscriptionOptions {
  /** Lock contract address on Base Sepolia */
  lockAddress?: Address
}

export interface UseUnlockSubscriptionResult {
  // State
  status: () => PurchaseStep
  statusMessage: () => string
  errorMessage: () => string
  txHash: () => Hash | undefined
  hasValidKey: () => boolean | undefined

  // Actions
  subscribe: () => Promise<void>
  checkSubscription: () => Promise<boolean>
  reset: () => void
}

// ============ Hook Implementation ============

export function useUnlockSubscription(
  options?: UseUnlockSubscriptionOptions
): UseUnlockSubscriptionResult {
  const auth = useAuth()

  // State signals
  const [status, setStatus] = createSignal<PurchaseStep>('idle')
  const [statusMessage, setStatusMessage] = createSignal('')
  const [errorMessage, setErrorMessage] = createSignal('')
  const [txHash, setTxHash] = createSignal<Hash | undefined>(undefined)
  const [hasValidKey, setHasValidKey] = createSignal<boolean | undefined>(undefined)

  // Resolved lock address
  const lockAddress = createMemo(() => options?.lockAddress || DEFAULT_LOCK_ADDRESS)

  // Create public client for Base Sepolia
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  // ============ Check Subscription ============
  const checkSubscription = async (): Promise<boolean> => {
    const pkpAddress = auth.pkpAddress()
    const lock = lockAddress()

    if (!pkpAddress || lock === DEFAULT_LOCK_ADDRESS) {
      return false
    }

    try {
      const hasKey = await publicClient.readContract({
        address: lock,
        abi: UNLOCK_ABI,
        functionName: 'getHasValidKey',
        args: [pkpAddress as Address],
      })

      setHasValidKey(hasKey)
      return hasKey
    } catch (err) {
      console.error('[useUnlockSubscription] Error checking subscription:', err)
      return false
    }
  }

  // ============ Subscribe Action ============
  const subscribe = async () => {
    const pkpWalletClient = auth.pkpWalletClient()
    const pkpAddress = auth.pkpAddress()
    const lock = lockAddress()

    if (IS_DEV) {
      console.log('[useUnlockSubscription] subscribe() called')
      console.log('[useUnlockSubscription] pkpAddress:', pkpAddress)
      console.log('[useUnlockSubscription] lockAddress:', lock)
    }

    if (!pkpWalletClient) {
      setStatus('error')
      setErrorMessage('Wallet not connected')
      return
    }

    if (!pkpAddress) {
      setStatus('error')
      setErrorMessage('No wallet address')
      return
    }

    if (lock === DEFAULT_LOCK_ADDRESS) {
      setStatus('error')
      setErrorMessage('Subscription not available')
      return
    }

    try {
      // Step 1: Check balance
      setStatus('checking')
      setStatusMessage('Checking wallet balance...')
      setErrorMessage('')

      const balance = await publicClient.getBalance({ address: pkpAddress as Address })

      if (IS_DEV) {
        console.log('[useUnlockSubscription] Balance (wei):', balance.toString())
        console.log('[useUnlockSubscription] Balance (ETH):', Number(balance) / 1e18)
      }

      // Step 2: Get key price from contract
      const keyPrice = await publicClient.readContract({
        address: lock,
        abi: UNLOCK_ABI,
        functionName: 'keyPrice',
      })

      if (IS_DEV) {
        console.log('[useUnlockSubscription] Key price (wei):', keyPrice.toString())
        console.log('[useUnlockSubscription] Key price (ETH):', Number(keyPrice) / 1e18)
      }

      // Check if user has sufficient balance
      if (balance < keyPrice) {
        setStatus('error')
        setErrorMessage(
          'Insufficient ETH balance on Base Sepolia. Please add funds to your wallet.'
        )
        return
      }

      // Check if user already has a valid key
      const alreadyHasKey = await publicClient.readContract({
        address: lock,
        abi: UNLOCK_ABI,
        functionName: 'getHasValidKey',
        args: [pkpAddress as Address],
      })

      if (alreadyHasKey) {
        if (IS_DEV) {
          console.log('[useUnlockSubscription] User already has valid key')
        }
        setHasValidKey(true)
        setStatus('complete')
        setStatusMessage('Already subscribed!')
        return
      }

      // Step 3: Signing
      setStatus('signing')
      setStatusMessage('Sign to subscribe...')

      // Simulate the transaction first
      const { request } = await publicClient.simulateContract({
        address: lock,
        abi: UNLOCK_ABI,
        functionName: 'purchase',
        args: [
          [keyPrice], // _values (array of prices)
          [pkpAddress as Address], // _recipients
          [pkpAddress as Address], // _referrers
          [pkpAddress as Address], // _keyManagers
          ['0x' as `0x${string}`], // _data
        ],
        value: keyPrice,
        account: pkpAddress as Address,
      })

      if (IS_DEV) {
        console.log('[useUnlockSubscription] Simulation successful, gas:', request.gas)
      }

      // Step 4: Build and sign transaction
      setStatus('approving')
      setStatusMessage('Processing subscription...')

      const data = encodeFunctionData({
        abi: UNLOCK_ABI,
        functionName: 'purchase',
        args: [
          [keyPrice],
          [pkpAddress as Address],
          [pkpAddress as Address],
          [pkpAddress as Address],
          ['0x' as `0x${string}`],
        ],
      })

      const txRequest = await publicClient.prepareTransactionRequest({
        account: pkpAddress as Address,
        to: lock,
        data,
        value: keyPrice,
        gas: request.gas,
        chain: baseSepolia,
      })

      const account = pkpWalletClient.account
      if (!account || typeof account.signTransaction !== 'function') {
        throw new Error('Account does not support signing')
      }

      const signedTx = await account.signTransaction({
        ...txRequest,
        chainId: baseSepolia.id,
      } as any)

      if (IS_DEV) {
        console.log('[useUnlockSubscription] Transaction signed, sending...')
      }

      // Step 5: Send and confirm
      setStatus('purchasing')
      setStatusMessage('Confirming transaction...')

      const hash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx })
      setTxHash(hash)

      if (IS_DEV) {
        console.log('[useUnlockSubscription] Transaction hash:', hash)
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        if (IS_DEV) {
          console.log('[useUnlockSubscription] Transaction successful!')
        }
        setHasValidKey(true)
        setStatus('complete')
        setStatusMessage('Subscription activated!')
      } else {
        throw new Error('Transaction failed')
      }
    } catch (err) {
      console.error('[useUnlockSubscription] Error:', err)

      let userMessage = 'Transaction failed. Please try again.'

      if (err instanceof Error) {
        const errorMsg = err.message.toLowerCase()

        if (errorMsg.includes('exceeds the balance') || errorMsg.includes('insufficient funds')) {
          userMessage =
            'Insufficient ETH balance on Base Sepolia. Please add funds to your wallet.'
        } else if (errorMsg.includes('user rejected') || errorMsg.includes('user denied')) {
          userMessage = 'Transaction cancelled.'
        } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
          userMessage = 'Network error. Please check your connection and try again.'
        } else if (errorMsg.includes('already') || errorMsg.includes('duplicate')) {
          userMessage = 'You may already have an active subscription. Please refresh the page.'
          setHasValidKey(true)
        } else if (
          errorMsg.includes('session') ||
          errorMsg.includes('expired') ||
          errorMsg.includes('sign in')
        ) {
          userMessage = 'Session expired. Please sign out and sign back in.'
        }
      }

      setStatus('error')
      setStatusMessage('')
      setErrorMessage(userMessage)
    }
  }

  // ============ Reset Action ============
  const reset = () => {
    setStatus('idle')
    setStatusMessage('')
    setErrorMessage('')
    setTxHash(undefined)
  }

  return {
    status,
    statusMessage,
    errorMessage,
    txHash,
    hasValidKey,
    subscribe,
    checkSubscription,
    reset,
  }
}
