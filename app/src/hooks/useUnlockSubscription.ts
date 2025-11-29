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
    console.log('[useUnlockSubscription] 🔐 subscribe() called')
    console.log('[useUnlockSubscription] 🔐 resolvedWalletClient:', resolvedWalletClient)
    console.log('[useUnlockSubscription] 🔐 publicClient:', publicClient)
    console.log('[useUnlockSubscription] 🔐 resolvedRecipient:', resolvedRecipient)
    console.log('[useUnlockSubscription] 🔐 resolvedLockAddress:', resolvedLockAddress)
    console.log('[useUnlockSubscription] 🔐 Lock address type check:', typeof resolvedLockAddress)
    console.log('[useUnlockSubscription] 🔐 Lock address length:', resolvedLockAddress?.length)

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
      setStatusMessage('Signing transaction...')
      setErrorMessage('')
      console.log('[useUnlockSubscription] Status: approving')

      // Step 2: First check the lock's key price
      console.log('[useUnlockSubscription] 🔐 Checking lock contract details...')
      console.log('[useUnlockSubscription] 🔐 Lock contract address:', resolvedLockAddress)
      console.log('[useUnlockSubscription] 🔐 Is default address?', resolvedLockAddress === DEFAULT_LOCK_ADDRESS)

      // Get the actual key price from the contract
    // @ts-expect-error - viem version mismatch
      const keyPrice = await publicClient.readContract({
        address: resolvedLockAddress,
        abi: [
          {
            inputs: [],
            name: 'keyPrice',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ] as const,
        functionName: 'keyPrice',
      })
      console.log('[useUnlockSubscription] 🔐 Lock keyPrice (wei):', keyPrice.toString())
      console.log('[useUnlockSubscription] 🔐 Lock keyPrice (ETH):', Number(keyPrice) / 1e18)

    // @ts-expect-error - viem version mismatch
      // Check max keys per address
      const maxKeys = await publicClient.readContract({
        address: resolvedLockAddress,
        abi: [
          {
            inputs: [],
            name: 'maxKeysPerAddress',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ] as const,
        functionName: 'maxKeysPerAddress',
      })
      console.log('[useUnlockSubscription] 🔐 maxKeysPerAddress:', maxKeys.toString())
    // @ts-expect-error - viem version mismatch

      // Check current balance of keys
      const keyBalance = await publicClient.readContract({
        address: resolvedLockAddress,
        abi: [
          {
            inputs: [{ name: '_owner', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ] as const,
        functionName: 'balanceOf',
        args: [resolvedRecipient],
      })
      console.log('[useUnlockSubscription] 🔐 Current key balance:', keyBalance.toString())

      // Step 3: Simulate the contract call on Base Sepolia to get gas estimate
      console.log('[useUnlockSubscription] 🔐 Simulating contract on Base Sepolia...')

      const { request } = await publicClient.simulateContract({
        address: resolvedLockAddress,
        abi: UNLOCK_ABI,
        functionName: 'purchase',
        args: [
          [keyPrice], // _values (array of prices)
          [resolvedRecipient], // _recipients (who receives the key)
          [resolvedRecipient], // _referrers (referral address)
          [resolvedRecipient], // _keyManagers (who can manage the key)
          ['0x' as `0x${string}`], // _data (additional data, none needed)
        ],
        value: keyPrice,
        account: resolvedRecipient,
      })

      console.log('[useUnlockSubscription] Simulation successful, gas:', request.gas)

      // Step 4: Purchasing
      setStatus('purchasing')
      setStatusMessage('Processing subscription...')
      console.log('[useUnlockSubscription] Status: purchasing')

      // Encode the purchase call
      const { encodeFunctionData } = await import('viem')
      const data = encodeFunctionData({
        abi: UNLOCK_ABI,
        functionName: 'purchase',
        args: [
          [keyPrice], // _values (array of prices)
          [resolvedRecipient], // _recipients (who receives the key)
          [resolvedRecipient], // _referrers (referral address)
          [resolvedRecipient], // _keyManagers (who can manage the key)
          ['0x' as `0x${string}`], // _data (additional data, none needed)
        ],
      })

      // Build transaction for Base Sepolia
      const txRequest = await publicClient.prepareTransactionRequest({
        account: resolvedRecipient,
        to: resolvedLockAddress,
        data,
        value: keyPrice,
        gas: request.gas,
        chain: undefined as any,
        kzg: undefined as any
      } as any)

      console.log('[useUnlockSubscription] 🔐 Signing transaction with PKP...')
      console.log('[useUnlockSubscription] 🔐 Transaction request:', txRequest)

      // Sign transaction using the account's signTransaction method (PKP custom implementation)
      const account = resolvedWalletClient.account
      if (!account || typeof account.signTransaction !== 'function') {
        throw new Error('PKP account does not have signTransaction method')
      }

      const signedTx = await account.signTransaction({
        ...txRequest,
        chainId: baseSepolia.id,
      })

      console.log('[useUnlockSubscription] 🔐 Sending signed transaction to Base Sepolia...')

      // Send raw transaction to Base Sepolia
      const hash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx })

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
      console.error('[useUnlockSubscription] 🔐 Error details:', error)
      console.error('[useUnlockSubscription] 🔐 Error type:', typeof error)
      console.error('[useUnlockSubscription] 🔐 Error message:', error instanceof Error ? error.message : 'Unknown error')
      console.error('[useUnlockSubscription] 🔐 Error stack:', error instanceof Error ? error.stack : 'No stack')
      setStatus('error')
      setStatusMessage('')

      // Parse error message to provide user-friendly feedback
      let userMessage = 'Transaction failed. Please try again.'

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase()

        // Check for insufficient balance
        if (errorMsg.includes('exceeds the balance') || errorMsg.includes('insufficient funds')) {
          userMessage = 'Insufficient balance. Please add more ETH to your wallet on Base Sepolia to complete this transaction.'
        }
        // Check for user rejection
        else if (errorMsg.includes('user rejected') || errorMsg.includes('user denied')) {
          userMessage = 'Transaction cancelled.'
        }
        // Check for network issues
        else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
          userMessage = 'Network error. Please check your connection and try again.'
        }
        // Check for already subscribed
        else if (errorMsg.includes('already') || errorMsg.includes('duplicate')) {
          userMessage = 'You may already be subscribed. Please refresh the page.'
        }
      }

      setErrorMessage(userMessage)
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
