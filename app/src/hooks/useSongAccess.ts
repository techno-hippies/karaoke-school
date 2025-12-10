/**
 * useSongAccess - Unified State Machine for Song Access (SolidJS)
 *
 * Consolidates ownership checking, purchase flow, and decryption into
 * a single state machine to eliminate race conditions and provide
 * deterministic state transitions.
 *
 * States:
 * - idle: Initial state
 * - checking: Querying SongAccess contract
 * - not-owned: User doesn't own the song
 * - purchasing: ETH purchase transaction in progress
 * - owned-pending-decrypt: Ownership confirmed, ready to decrypt
 * - owned-decrypting: Lit Protocol decryption in progress
 * - owned-decrypted: Decryption complete, audio URL ready
 * - owned-decrypt-failed: Decryption failed, can retry
 *
 * Smart Wallet Selection:
 * - EOA users (authMethodType: 1): Pay from EOA, NFT minted to PKP
 * - Social/Passkey users: Pay from PKP, NFT minted to PKP
 *
 * Entitlement source: SongAccess contract ONLY (no artist Unlock for audio)
 */

import { createSignal, createEffect, onCleanup, createMemo } from 'solid-js'
import {
  type Address,
  type Hash,
  encodeFunctionData,
  createPublicClient,
  http,
} from 'viem'
import { baseSepolia } from 'viem/chains'
import { sendTransaction, waitForTransactionReceipt } from '@wagmi/core'
import { useAuth } from '@/contexts/AuthContext'
import { SONG_ACCESS_CONTRACT } from '@/lib/contracts/addresses'
import { SONG_ACCESS_ABI } from '@/lib/contracts/song-access-abi'
import {
  performLitDecryption,
  type HybridEncryptionMetadata,
} from '@/lib/lit/decrypt-audio'
import { buildManifest, fetchJson } from '@/lib/storage'
import { wagmiConfig } from '@/providers/Web3Provider'

const IS_DEV = import.meta.env.DEV
const CONTRACT = SONG_ACCESS_CONTRACT.testnet

// Lit Protocol auth method type for EOA wallet
const AUTH_METHOD_ETH_WALLET = 1

// ============ Types ============

export type SongAccessState =
  | 'idle'
  | 'checking'
  | 'not-owned'
  | 'purchasing'
  | 'owned-pending-decrypt'
  | 'owned-decrypting'
  | 'owned-decrypted'
  | 'owned-decrypt-failed'

export type PurchaseSubState = 'checking-balance' | 'signing' | 'confirming' | null

// ============ Hook Options ============

interface UseSongAccessOptions {
  spotifyTrackId: () => string | undefined
  encryptionMetadataUrl: () => string | undefined
}

// ============ Hook Result ============

export interface UseSongAccessResult {
  // State
  state: () => SongAccessState
  isOwned: () => boolean
  isChecking: () => boolean
  isPurchasing: () => boolean
  isDecrypting: () => boolean

  // Data
  decryptedAudioUrl: () => string | undefined
  decryptProgress: () => number | undefined
  error: () => string | undefined
  txHash: () => Hash | undefined
  statusMessage: () => string | undefined

  // Actions
  purchase: () => Promise<void>
  retryDecrypt: () => void
  reset: () => void

  // For dialog compatibility
  purchaseSubState: () => PurchaseSubState
}

// ============ Hook Implementation ============

export function useSongAccess(options: UseSongAccessOptions): UseSongAccessResult {
  const { spotifyTrackId, encryptionMetadataUrl } = options
  const auth = useAuth()

  // State signals
  const [state, setState] = createSignal<SongAccessState>('idle')
  const [purchaseSubState, setPurchaseSubState] = createSignal<PurchaseSubState>(null)
  const [decryptedAudioUrl, setDecryptedAudioUrl] = createSignal<string | undefined>(undefined)
  const [decryptProgress, setDecryptProgress] = createSignal<number | undefined>(undefined)
  const [error, setError] = createSignal<string | undefined>(undefined)
  const [txHash, setTxHash] = createSignal<Hash | undefined>(undefined)
  const [statusMessage, setStatusMessage] = createSignal<string | undefined>(undefined)

  // Track URL for cleanup
  let prevUrl: string | undefined = undefined

  // Create public client for Base Sepolia
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  // Cleanup decrypted URL on unmount
  onCleanup(() => {
    const url = decryptedAudioUrl()
    if (url) {
      URL.revokeObjectURL(url)
    }
  })

  // Reset when track changes
  createEffect(() => {
    const trackId = spotifyTrackId()
    if (trackId) {
      // Reset state when track changes
      setState('idle')
      setPurchaseSubState(null)
      setError(undefined)
      setTxHash(undefined)
      setStatusMessage(undefined)
      setDecryptProgress(undefined)
      // Don't clear decrypted URL here - let cleanup handle it
    }
  })

  // ============ Check Access Effect ============
  createEffect(() => {
    const trackId = spotifyTrackId()
    const pkpAddress = auth.pkpAddress()

    if (!trackId || !pkpAddress) {
      return
    }

    // Only check if idle
    if (state() !== 'idle') {
      return
    }

    const checkAccess = async () => {
      setState('checking')
      setError(undefined)

      if (IS_DEV) {
        console.log('[useSongAccess] Checking ownership for:', trackId, 'user:', pkpAddress)
      }

      try {
        const ownsSong = await publicClient.readContract({
          address: CONTRACT.address,
          abi: SONG_ACCESS_ABI,
          functionName: 'ownsSongByTrackId',
          args: [pkpAddress as Address, trackId],
        })

        if (IS_DEV) {
          console.log('[useSongAccess] Ownership result:', ownsSong)
        }

        if (ownsSong) {
          setState('owned-pending-decrypt')
        } else {
          setState('not-owned')
        }
      } catch (err) {
        console.error('[useSongAccess] Error checking access:', err)
        setState('not-owned')
      }
    }

    checkAccess()
  })

  // ============ Decrypt Effect ============
  createEffect(() => {
    if (state() !== 'owned-pending-decrypt') {
      return
    }

    const metadataUrl = encryptionMetadataUrl()
    const trackId = spotifyTrackId()
    const pkpInfo = auth.pkpInfo()
    const authData = auth.authData()

    if (!metadataUrl || !trackId || !pkpInfo || !authData) {
      // No encryption metadata - stay in owned-pending-decrypt
      // This is valid for unencrypted songs
      if (IS_DEV) {
        console.log('[useSongAccess] No encryption metadata or auth data, skipping decrypt')
      }
      return
    }

    const performDecrypt = async () => {
      setState('owned-decrypting')
      setDecryptProgress(undefined)
      setError(undefined)

      if (IS_DEV) {
        console.log('[useSongAccess] Starting decryption from:', metadataUrl)
      }

      try {
        // Step 1: Fetch encryption metadata using multi-gateway fallback
        const manifest = buildManifest(metadataUrl)
        const metadata = await fetchJson<HybridEncryptionMetadata>(manifest)

        if (!['2.0.0', '2.1.0'].includes(metadata.version) || metadata.method !== 'hybrid-aes-gcm-lit') {
          throw new Error(`Unsupported encryption version: ${metadata.version} / ${metadata.method}`)
        }

        setDecryptProgress(20)

        // Step 2: Perform Lit decryption
        const decryptedBlob = await performLitDecryption(metadata, pkpInfo, authData, setDecryptProgress)

        // Clean up previous URL
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl)
        }

        const objectUrl = URL.createObjectURL(decryptedBlob)
        prevUrl = objectUrl
        setDecryptedAudioUrl(objectUrl)
        setDecryptProgress(100)
        setState('owned-decrypted')

        if (IS_DEV) {
          console.log('[useSongAccess] Decryption complete')
        }
      } catch (err) {
        console.error('[useSongAccess] Decrypt error:', err)
        const errorMsg = err instanceof Error ? err.message : 'Failed to decrypt audio'
        setError(errorMsg)
        setState('owned-decrypt-failed')
      }
    }

    performDecrypt()
  })

  // ============ Determine if EOA User ============
  const isEOAUser = createMemo(() => {
    const authData = auth.authData()
    return authData?.authMethodType === AUTH_METHOD_ETH_WALLET
  })

  // Get EOA address from stored auth data
  const eoaAddress = createMemo(() => {
    const authData = auth.authData()
    return authData?.eoaAddress as Address | undefined
  })

  // ============ Purchase Action ============
  const purchase = async () => {
    const pkpAddress = auth.pkpAddress()
    const trackId = spotifyTrackId()

    if (!pkpAddress) {
      setError('No wallet address')
      return
    }

    if (!trackId) {
      setError('No song selected')
      return
    }

    // Route to appropriate purchase flow
    if (isEOAUser()) {
      await purchaseWithEOA(trackId, pkpAddress as Address)
    } else {
      await purchaseWithPKP(trackId, pkpAddress as Address)
    }
  }

  // ============ EOA Purchase Flow ============
  // EOA pays ETH, NFT minted to PKP (for Lit decryption)
  // Single signature - no permit needed!
  const purchaseWithEOA = async (trackId: string, pkpAddress: Address) => {
    const eoa = eoaAddress()
    if (!eoa) {
      setError('EOA wallet not found')
      return
    }

    setState('purchasing')
    setPurchaseSubState('checking-balance')
    setError(undefined)
    setStatusMessage('Checking balance...')

    if (IS_DEV) {
      console.log('[useSongAccess] Starting EOA purchase for:', trackId, {
        eoaAddress: eoa,
        pkpAddress,
      })
    }

    try {
      // Check if PKP already owns (defensive)
      const alreadyOwned = await publicClient.readContract({
        address: CONTRACT.address,
        abi: SONG_ACCESS_ABI,
        functionName: 'ownsSongByTrackId',
        args: [pkpAddress, trackId],
      })

      if (alreadyOwned) {
        setState('owned-pending-decrypt')
        setPurchaseSubState(null)
        setStatusMessage('Song unlocked!')
        return
      }

      // Check EOA's ETH balance on Base Sepolia
      const balance = await publicClient.getBalance({ address: eoa })

      if (IS_DEV) {
        console.log('[useSongAccess] EOA ETH balance:', balance.toString())
      }

      if (balance < CONTRACT.price) {
        setError('Insufficient ETH balance on Base Sepolia')
        setState('not-owned')
        setPurchaseSubState(null)
        setStatusMessage(undefined)
        return
      }

      // Single signature - send ETH to purchaseFor
      setPurchaseSubState('signing')
      setStatusMessage('Sign to purchase...')

      const hash = await sendTransaction(wagmiConfig, {
        to: CONTRACT.address,
        data: encodeFunctionData({
          abi: SONG_ACCESS_ABI,
          functionName: 'purchaseFor',
          args: [trackId, pkpAddress],
        }),
        value: CONTRACT.price,
        chainId: baseSepolia.id,
      })

      setPurchaseSubState('confirming')
      setTxHash(hash)
      setStatusMessage('Confirming...')

      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
      if (receipt.status === 'success') {
        setState('owned-pending-decrypt')
        setPurchaseSubState(null)
        setStatusMessage('Song unlocked!')
      } else {
        throw new Error('Transaction failed')
      }
    } catch (err) {
      handlePurchaseError(err)
    }
  }

  // ============ PKP Purchase Flow ============
  // PKP pays ETH and receives NFT (original flow for social/passkey users)
  const purchaseWithPKP = async (trackId: string, pkpAddress: Address) => {
    const pkpWalletClient = auth.pkpWalletClient()

    if (!pkpWalletClient) {
      setError('Wallet not connected')
      return
    }

    setState('purchasing')
    setPurchaseSubState('checking-balance')
    setError(undefined)
    setStatusMessage('Checking balance...')

    if (IS_DEV) {
      console.log('[useSongAccess] Starting PKP purchase for:', trackId)
    }

    try {
      // Check if already owned (defensive)
      const alreadyOwned = await publicClient.readContract({
        address: CONTRACT.address,
        abi: SONG_ACCESS_ABI,
        functionName: 'ownsSongByTrackId',
        args: [pkpAddress, trackId],
      })

      if (alreadyOwned) {
        setState('owned-pending-decrypt')
        setPurchaseSubState(null)
        setStatusMessage('Song unlocked!')
        return
      }

      // Check ETH balance
      const balance = await publicClient.getBalance({ address: pkpAddress })

      if (balance < CONTRACT.price) {
        setError('Insufficient ETH balance on Base Sepolia')
        setState('not-owned')
        setPurchaseSubState(null)
        setStatusMessage(undefined)
        return
      }

      // Build and sign transaction
      setPurchaseSubState('signing')
      setStatusMessage('Sign to purchase...')

      const data = encodeFunctionData({
        abi: SONG_ACCESS_ABI,
        functionName: 'purchase',
        args: [trackId],
      })

      const txRequest = await publicClient.prepareTransactionRequest({
        account: pkpAddress,
        to: CONTRACT.address,
        data,
        value: CONTRACT.price,
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

      const hash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx })
      setPurchaseSubState('confirming')
      setTxHash(hash)
      setStatusMessage('Confirming...')

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status === 'success') {
        setState('owned-pending-decrypt')
        setPurchaseSubState(null)
        setStatusMessage('Song unlocked!')
      } else {
        throw new Error('Transaction failed')
      }
    } catch (err) {
      handlePurchaseError(err)
    }
  }

  // ============ Error Handler ============
  const handlePurchaseError = (err: unknown) => {
    console.error('[useSongAccess] Purchase error:', err)

    let errorMsg = 'Transaction failed'
    if (err instanceof Error) {
      const msg = err.message.toLowerCase()
      if (msg.includes('user rejected') || msg.includes('user denied')) {
        errorMsg = 'Transaction cancelled'
      } else if (msg.includes('insufficient')) {
        errorMsg = 'Insufficient ETH balance'
      } else if (msg.includes('already')) {
        errorMsg = 'You already own this song'
        // Still transition to owned state
        setState('owned-pending-decrypt')
        setPurchaseSubState(null)
        return
      } else if (msg.includes('session') || msg.includes('expired') || msg.includes('sign in')) {
        errorMsg = 'Session expired. Please sign out and sign back in.'
      } else {
        errorMsg = err.message.slice(0, 100)
      }
    }

    setError(errorMsg)
    setState('not-owned')
    setPurchaseSubState(null)
    setStatusMessage(undefined)
  }

  // ============ Retry Decrypt Action ============
  const retryDecrypt = () => {
    if (state() === 'owned-decrypt-failed') {
      setState('owned-pending-decrypt')
      setError(undefined)
      setDecryptProgress(undefined)
    }
  }

  // ============ Reset Action ============
  const reset = () => {
    setState('idle')
    setPurchaseSubState(null)
    setError(undefined)
    setTxHash(undefined)
    setStatusMessage(undefined)
    setDecryptProgress(undefined)
    // Keep decrypted URL if we have it
  }

  // ============ Computed Properties ============
  const isOwned = createMemo(() => state().startsWith('owned-'))
  const isChecking = createMemo(() => state() === 'checking')
  const isPurchasing = createMemo(() => state() === 'purchasing')
  const isDecrypting = createMemo(() => state() === 'owned-decrypting')

  return {
    state,
    isOwned,
    isChecking,
    isPurchasing,
    isDecrypting,
    decryptedAudioUrl,
    decryptProgress,
    error,
    txHash,
    statusMessage,
    purchase,
    retryDecrypt,
    reset,
    purchaseSubState,
  }
}
