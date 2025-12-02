/**
 * useSongPurchase
 * Hook for purchasing songs via SongAccess contract with USDC permit
 * Single-signature UX - no separate approve transaction needed
 */

import { useState, useCallback } from 'react'
import {
  type Address,
  type Hash,
  type WalletClient,
  type PublicClient,
  encodeFunctionData,
} from 'viem'
import { baseSepolia } from 'viem/chains'
import { usePublicClient, useWalletClient } from 'wagmi'
import { SONG_ACCESS_CONTRACT } from '@/lib/contracts/addresses'
import { formatTokenPriceWithLocal, detectCurrencyFromLocale } from '@/lib/currency'

// Use testnet for now
const CONTRACT = SONG_ACCESS_CONTRACT.testnet

// SongAccess ABI (minimal)
const SONG_ACCESS_ABI = [
  {
    inputs: [
      { name: 'spotifyTrackId', type: 'string' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    name: 'purchase',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spotifyTrackId', type: 'string' },
    ],
    name: 'purchaseWithApproval',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'songId', type: 'bytes32' },
    ],
    name: 'ownsSong',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'spotifyTrackId', type: 'string' },
    ],
    name: 'ownsSongByTrackId',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'price',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// USDC Permit ABI (EIP-2612)
const USDC_PERMIT_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export type PurchaseStatus = 'idle' | 'checking' | 'signing' | 'purchasing' | 'complete' | 'error'

interface UseSongPurchaseOptions {
  walletClient?: WalletClient | null
  publicClient?: PublicClient
}

export interface UseSongPurchaseResult {
  purchase: () => Promise<void>
  checkOwnership: () => Promise<boolean>
  status: PurchaseStatus
  statusMessage: string
  errorMessage: string
  txHash?: Hash
  reset: () => void
  isOwned: boolean
}

export function useSongPurchase(
  spotifyTrackId?: string,
  recipientAddress?: Address,
  options?: UseSongPurchaseOptions
): UseSongPurchaseResult {
  const [status, setStatus] = useState<PurchaseStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [txHash, setTxHash] = useState<Hash | undefined>()
  const [isOwned, setIsOwned] = useState(false)

  const chainId = CONTRACT.chainId
  const wagmiPublicClient = usePublicClient({ chainId })
  const { data: wagmiWalletClient } = useWalletClient({ chainId })

  const publicClient = options?.publicClient ?? wagmiPublicClient
  const resolvedWalletClient = options?.walletClient ?? wagmiWalletClient ?? null
  const resolvedRecipient = recipientAddress ?? resolvedWalletClient?.account?.address

  const checkOwnership = useCallback(async (): Promise<boolean> => {
    if (!publicClient || !resolvedRecipient || !spotifyTrackId) {
      return false
    }

    try {
      // @ts-expect-error - viem version mismatch
      const owned = await publicClient.readContract({
        address: CONTRACT.address,
        abi: SONG_ACCESS_ABI,
        functionName: 'ownsSongByTrackId',
        args: [resolvedRecipient, spotifyTrackId],
      })
      setIsOwned(owned as boolean)
      return owned as boolean
    } catch (error) {
      console.error('[useSongPurchase] Error checking ownership:', error)
      return false
    }
  }, [publicClient, resolvedRecipient, spotifyTrackId])

  const purchase = async () => {
    console.log('[useSongPurchase] purchase() called')
    console.log('[useSongPurchase] spotifyTrackId:', spotifyTrackId)
    console.log('[useSongPurchase] resolvedRecipient:', resolvedRecipient)

    if (!resolvedWalletClient || !publicClient) {
      setStatus('error')
      setErrorMessage('Wallet not connected')
      return
    }

    if (!resolvedRecipient) {
      setStatus('error')
      setErrorMessage('No wallet address')
      return
    }

    if (!spotifyTrackId) {
      setStatus('error')
      setErrorMessage('No song selected')
      return
    }

    try {
      // Step 1: Check if already owned
      setStatus('checking')
      setStatusMessage('Checking ownership...')
      setErrorMessage('')

      const alreadyOwned = await checkOwnership()
      if (alreadyOwned) {
        setStatus('complete')
        setStatusMessage('You already own this song!')
        setIsOwned(true)
        return
      }

      // Step 2: Check USDC balance
      // @ts-expect-error - viem version mismatch
      const balance = await publicClient.readContract({
        address: CONTRACT.usdc,
        abi: USDC_PERMIT_ABI,
        functionName: 'balanceOf',
        args: [resolvedRecipient],
      }) as bigint

      console.log('[useSongPurchase] USDC balance:', balance.toString())

      if (balance < CONTRACT.price) {
        setStatus('error')
        const priceFormatted = formatTokenPriceWithLocal(0.10, 'USDC', detectCurrencyFromLocale())
        setErrorMessage(`Insufficient USDC balance. Need ${priceFormatted}`)
        return
      }

      // Step 3: Check existing allowance
      // @ts-expect-error - viem version mismatch
      const allowance = await publicClient.readContract({
        address: CONTRACT.usdc,
        abi: USDC_PERMIT_ABI,
        functionName: 'allowance',
        args: [resolvedRecipient, CONTRACT.address],
      }) as bigint

      console.log('[useSongPurchase] USDC allowance:', allowance.toString())

      // If sufficient allowance exists, use purchaseWithApproval (no permit needed)
      if (allowance >= CONTRACT.price) {
        setStatus('purchasing')
        setStatusMessage('Processing purchase...')

        const data = encodeFunctionData({
          abi: SONG_ACCESS_ABI,
          functionName: 'purchaseWithApproval',
          args: [spotifyTrackId],
        })

        // Build and send transaction
        const txRequest = await publicClient.prepareTransactionRequest({
          account: resolvedRecipient,
          to: CONTRACT.address,
          data,
          chain: baseSepolia,
        } as any)

        const account = resolvedWalletClient.account
        if (!account || typeof account.signTransaction !== 'function') {
          throw new Error('Account does not support signing')
        }

        const signedTx = await account.signTransaction({
          ...txRequest,
          chainId: CONTRACT.chainId,
        } as any)

        const hash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx })
        setTxHash(hash)
        setStatusMessage('Confirming...')

        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status === 'success') {
          setStatus('complete')
          setStatusMessage('Song unlocked!')
          setIsOwned(true)
        } else {
          throw new Error('Transaction failed')
        }
        return
      }

      // Step 4: Get nonce for permit
      setStatus('signing')
      setStatusMessage('Sign to approve USDC...')

      // @ts-expect-error - viem version mismatch
      const nonce = await publicClient.readContract({
        address: CONTRACT.usdc,
        abi: USDC_PERMIT_ABI,
        functionName: 'nonces',
        args: [resolvedRecipient],
      }) as bigint

      // @ts-expect-error - viem version mismatch
      const domainSeparator = await publicClient.readContract({
        address: CONTRACT.usdc,
        abi: USDC_PERMIT_ABI,
        functionName: 'DOMAIN_SEPARATOR',
      }) as `0x${string}`

      console.log('[useSongPurchase] Nonce:', nonce.toString())
      console.log('[useSongPurchase] Domain separator:', domainSeparator)

      // Deadline: 1 hour from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)

      // EIP-2612 Permit signature
      const permitTypes = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      }

      const permitMessage = {
        owner: resolvedRecipient,
        spender: CONTRACT.address,
        value: CONTRACT.price,
        nonce,
        deadline,
      }

      // Sign the permit (this is the only user signature!)
      const account = resolvedWalletClient.account
      if (!account || typeof account.signTypedData !== 'function') {
        throw new Error('Account does not support typed data signing')
      }

      const signature = await account.signTypedData({
        domain: {
          name: 'USDC',
          version: '2',
          chainId: CONTRACT.chainId,
          verifyingContract: CONTRACT.usdc,
        },
        types: permitTypes,
        primaryType: 'Permit',
        message: permitMessage,
      })

      console.log('[useSongPurchase] Permit signature:', signature)

      // Parse signature into v, r, s
      const r = `0x${signature.slice(2, 66)}` as `0x${string}`
      const s = `0x${signature.slice(66, 130)}` as `0x${string}`
      const v = parseInt(signature.slice(130, 132), 16)

      // Step 5: Call purchase with permit
      setStatus('purchasing')
      setStatusMessage('Processing purchase...')

      const data = encodeFunctionData({
        abi: SONG_ACCESS_ABI,
        functionName: 'purchase',
        args: [spotifyTrackId, deadline, v, r, s],
      })

      // Estimate gas
      const gas = await publicClient.estimateGas({
        account: resolvedRecipient,
        to: CONTRACT.address,
        data,
      })

      console.log('[useSongPurchase] Estimated gas:', gas)

      // Build transaction
      const txRequest = await publicClient.prepareTransactionRequest({
        account: resolvedRecipient,
        to: CONTRACT.address,
        data,
        gas,
        chain: baseSepolia,
      } as any)

      // Sign and send transaction
      if (typeof account.signTransaction !== 'function') {
        throw new Error('Account does not support transaction signing')
      }

      const signedTx = await account.signTransaction({
        ...txRequest,
        chainId: CONTRACT.chainId,
      } as any)

      const hash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx })
      console.log('[useSongPurchase] Transaction hash:', hash)
      setTxHash(hash)
      setStatusMessage('Confirming...')

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      console.log('[useSongPurchase] Receipt:', receipt)

      if (receipt.status === 'success') {
        setStatus('complete')
        setStatusMessage('Song unlocked!')
        setIsOwned(true)
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error) {
      console.error('[useSongPurchase] Error:', error)
      setStatus('error')
      setStatusMessage('')

      if (error instanceof Error) {
        // Check for session expiration first
        if (error.name === 'SessionExpiredError') {
          setErrorMessage('Session expired. Please sign out and sign back in.')
        } else {
          const msg = error.message.toLowerCase()
          if (msg.includes('user rejected') || msg.includes('user denied')) {
            setErrorMessage('Transaction cancelled')
          } else if (msg.includes('insufficient')) {
            setErrorMessage('Insufficient USDC balance')
          } else if (msg.includes('already')) {
            setErrorMessage('You already own this song')
            setIsOwned(true)
          } else if (msg.includes('session') || msg.includes('expired') || msg.includes('sign in')) {
            setErrorMessage('Session expired. Please sign out and sign back in.')
          } else {
            setErrorMessage(error.message.slice(0, 100))
          }
        }
      } else {
        setErrorMessage('Transaction failed')
      }
    }
  }

  const reset = () => {
    setStatus('idle')
    setStatusMessage('')
    setErrorMessage('')
    setTxHash(undefined)
  }

  return {
    purchase,
    checkOwnership,
    status,
    statusMessage,
    errorMessage,
    txHash,
    reset,
    isOwned,
  }
}
