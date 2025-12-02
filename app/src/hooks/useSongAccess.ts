/**
 * useSongAccess - Unified State Machine for Song Access
 *
 * Consolidates ownership checking, purchase flow, and decryption into
 * a single state machine to eliminate race conditions and provide
 * deterministic state transitions.
 *
 * States:
 * - idle: Initial state
 * - checking: Querying SongAccess contract
 * - not-owned: User doesn't own the song
 * - purchasing: USDC permit + purchase transaction in progress
 * - owned-pending-decrypt: Ownership confirmed, ready to decrypt
 * - owned-decrypting: Lit Protocol decryption in progress
 * - owned-decrypted: Decryption complete, audio URL ready
 * - owned-decrypt-failed: Decryption failed, can retry
 *
 * Entitlement source: SongAccess contract ONLY (no artist Unlock for audio)
 */

import { useReducer, useEffect, useCallback, useRef } from 'react'
import {
  type Address,
  type Hash,
  type WalletClient,
  type PublicClient,
  encodeFunctionData,
  createPublicClient,
  http,
} from 'viem'
import { baseSepolia } from 'viem/chains'
import { usePublicClient, useWalletClient } from 'wagmi'
import { useAuth } from '@/contexts/AuthContext'
import { SONG_ACCESS_CONTRACT } from '@/lib/contracts/addresses'
import { formatTokenPriceWithLocal, detectCurrencyFromLocale } from '@/lib/currency'
import {
  buildCacheKey,
  getFromCache,
  saveToCache,
  getInFlightDecrypt,
  setInFlightDecrypt,
} from '@/lib/audioCache'

const IS_DEV = import.meta.env.DEV
const CONTRACT = SONG_ACCESS_CONTRACT.testnet

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

interface StateContext {
  state: SongAccessState
  purchaseSubState: PurchaseSubState
  decryptedAudioUrl?: string
  decryptProgress?: number
  error?: string
  txHash?: Hash
  statusMessage?: string
}

type Action =
  | { type: 'CHECK_ACCESS' }
  | { type: 'ACCESS_FOUND' }
  | { type: 'NO_ACCESS' }
  | { type: 'START_PURCHASE' }
  | { type: 'PURCHASE_SIGNING' }
  | { type: 'PURCHASE_CONFIRMING'; txHash: Hash }
  | { type: 'PURCHASE_SUCCESS' }
  | { type: 'PURCHASE_FAILED'; error: string }
  | { type: 'DECRYPT_STARTED' }
  | { type: 'DECRYPT_PROGRESS'; progress: number }
  | { type: 'DECRYPT_SUCCESS'; audioUrl: string }
  | { type: 'DECRYPT_FAILED'; error: string }
  | { type: 'RETRY_DECRYPT' }
  | { type: 'RESET' }

// ============ Reducer ============

function reducer(state: StateContext, action: Action): StateContext {
  switch (action.type) {
    case 'CHECK_ACCESS':
      return { ...state, state: 'checking', error: undefined }

    case 'ACCESS_FOUND':
      return { ...state, state: 'owned-pending-decrypt' }

    case 'NO_ACCESS':
      return { ...state, state: 'not-owned' }

    case 'START_PURCHASE':
      return {
        ...state,
        state: 'purchasing',
        purchaseSubState: 'checking-balance',
        error: undefined,
        statusMessage: 'Checking balance...',
      }

    case 'PURCHASE_SIGNING':
      return {
        ...state,
        purchaseSubState: 'signing',
        statusMessage: 'Sign to approve USDC...',
      }

    case 'PURCHASE_CONFIRMING':
      return {
        ...state,
        purchaseSubState: 'confirming',
        txHash: action.txHash,
        statusMessage: 'Confirming...',
      }

    case 'PURCHASE_SUCCESS':
      // Immediately transition to owned-pending-decrypt (no recheck needed!)
      return {
        ...state,
        state: 'owned-pending-decrypt',
        purchaseSubState: null,
        statusMessage: 'Song unlocked!',
      }

    case 'PURCHASE_FAILED':
      return {
        ...state,
        state: 'not-owned',
        purchaseSubState: null,
        error: action.error,
        statusMessage: undefined,
      }

    case 'DECRYPT_STARTED':
      return {
        ...state,
        state: 'owned-decrypting',
        decryptProgress: undefined,
        error: undefined,
      }

    case 'DECRYPT_PROGRESS':
      return { ...state, decryptProgress: action.progress }

    case 'DECRYPT_SUCCESS':
      return {
        ...state,
        state: 'owned-decrypted',
        decryptedAudioUrl: action.audioUrl,
        decryptProgress: 100,
      }

    case 'DECRYPT_FAILED':
      return {
        ...state,
        state: 'owned-decrypt-failed',
        error: action.error,
        decryptProgress: undefined,
      }

    case 'RETRY_DECRYPT':
      return {
        ...state,
        state: 'owned-pending-decrypt',
        error: undefined,
        decryptProgress: undefined,
      }

    case 'RESET':
      return {
        state: 'idle',
        purchaseSubState: null,
        decryptedAudioUrl: undefined,
        decryptProgress: undefined,
        error: undefined,
        txHash: undefined,
        statusMessage: undefined,
      }

    default:
      return state
  }
}

const initialState: StateContext = {
  state: 'idle',
  purchaseSubState: null,
}

// ============ ABIs ============

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
    inputs: [{ name: 'spotifyTrackId', type: 'string' }],
    name: 'purchaseWithApproval',
    outputs: [],
    stateMutability: 'nonpayable',
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
] as const

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

// ============ Encryption Metadata Type ============

interface HybridEncryptionMetadata {
  version: string
  method: string
  aes: {
    algorithm: string
    keyBits: number
    iv: string
    authTag: string
  }
  lit: {
    network: string
    encryptedKey: string
    dataToEncryptHash: string
    unifiedAccessControlConditions: any[]
  }
  accessControl?: {
    type: 'songAccess' | 'unlock'
    contractAddress?: string
    lockAddress?: string
    chainId: number
    chainName: string
  }
  unlock?: {
    lockAddress: string
    chainId: number
    chainName: string
  }
  encryptedAudio: {
    url: string
    sizeBytes: number
  }
}

// ============ Hook Options ============

interface UseSongAccessOptions {
  spotifyTrackId?: string
  encryptionMetadataUrl?: string
  /** Optional wallet client override */
  walletClient?: WalletClient | null
  /** Optional public client override */
  publicClient?: PublicClient
}

// ============ Hook Result ============

export interface UseSongAccessResult {
  // State
  state: SongAccessState
  isOwned: boolean
  isChecking: boolean
  isPurchasing: boolean
  isDecrypting: boolean

  // Data
  decryptedAudioUrl?: string
  decryptProgress?: number
  error?: string
  txHash?: Hash
  statusMessage?: string

  // Actions
  purchase: () => Promise<void>
  retryDecrypt: () => void
  reset: () => void

  // For dialog compatibility
  purchaseSubState: PurchaseSubState
}

// ============ Hook Implementation ============

export function useSongAccess(options: UseSongAccessOptions): UseSongAccessResult {
  const { spotifyTrackId, encryptionMetadataUrl, walletClient: optWalletClient, publicClient: optPublicClient } = options
  const { pkpInfo, authData, pkpAddress, pkpWalletClient } = useAuth()

  const [ctx, dispatch] = useReducer(reducer, initialState)

  // Track URL for cleanup
  const prevUrlRef = useRef<string | undefined>(undefined)

  // Wallet setup
  const chainId = CONTRACT.chainId
  const wagmiPublicClient = usePublicClient({ chainId })
  const { data: wagmiWalletClient } = useWalletClient({ chainId })

  const publicClient = optPublicClient ?? wagmiPublicClient
  const resolvedWalletClient = optWalletClient ?? pkpWalletClient ?? wagmiWalletClient ?? null
  const resolvedRecipient = pkpAddress ?? resolvedWalletClient?.account?.address

  // Cleanup decrypted URL on unmount or change
  useEffect(() => {
    if (prevUrlRef.current && prevUrlRef.current !== ctx.decryptedAudioUrl) {
      URL.revokeObjectURL(prevUrlRef.current)
    }
    prevUrlRef.current = ctx.decryptedAudioUrl

    return () => {
      if (ctx.decryptedAudioUrl) {
        URL.revokeObjectURL(ctx.decryptedAudioUrl)
      }
    }
  }, [ctx.decryptedAudioUrl])

  // Reset when track changes
  useEffect(() => {
    dispatch({ type: 'RESET' })
  }, [spotifyTrackId])

  // ============ Check Access Effect ============
  // Runs on mount and when spotifyTrackId changes
  useEffect(() => {
    if (!spotifyTrackId || !resolvedRecipient) {
      return
    }

    // Only check if idle
    if (ctx.state !== 'idle') {
      return
    }

    const checkAccess = async () => {
      dispatch({ type: 'CHECK_ACCESS' })

      try {
        const songAccessClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        })

        // @ts-expect-error - viem version mismatch
        const ownsSong = await songAccessClient.readContract({
          address: CONTRACT.address,
          abi: SONG_ACCESS_ABI,
          functionName: 'ownsSongByTrackId',
          args: [resolvedRecipient as Address, spotifyTrackId],
        })

        if (ownsSong) {
          dispatch({ type: 'ACCESS_FOUND' })
        } else {
          dispatch({ type: 'NO_ACCESS' })
        }
      } catch (err) {
        console.error('[useSongAccess] Error checking access:', err)
        dispatch({ type: 'NO_ACCESS' })
      }
    }

    checkAccess()
  }, [spotifyTrackId, resolvedRecipient, ctx.state])

  // ============ Decrypt Effect ============
  // Runs when entering owned-pending-decrypt
  useEffect(() => {
    if (ctx.state !== 'owned-pending-decrypt') {
      return
    }

    if (!encryptionMetadataUrl || !spotifyTrackId || !pkpInfo || !authData) {
      // No encryption metadata - stay in owned-pending-decrypt
      // This is valid for unencrypted songs
      return
    }

    const performDecrypt = async () => {
      dispatch({ type: 'DECRYPT_STARTED' })

      try {
        // Step 1: Fetch encryption metadata
        const metadataResponse = await fetch(encryptionMetadataUrl)
        if (!metadataResponse.ok) {
          throw new Error(`Failed to fetch encryption metadata: ${metadataResponse.status}`)
        }

        const metadata: HybridEncryptionMetadata = await metadataResponse.json()

        if (!['2.0.0', '2.1.0'].includes(metadata.version) || metadata.method !== 'hybrid-aes-gcm-lit') {
          throw new Error(`Unsupported encryption version: ${metadata.version} / ${metadata.method}`)
        }

        // Step 2: Check cache
        const cacheKey = buildCacheKey(spotifyTrackId, metadata.lit.dataToEncryptHash)

        const inFlight = getInFlightDecrypt(cacheKey)
        if (inFlight) {
          const cachedBlob = await inFlight
          const objectUrl = URL.createObjectURL(cachedBlob)
          dispatch({ type: 'DECRYPT_SUCCESS', audioUrl: objectUrl })
          return
        }

        const cachedBlob = await getFromCache(cacheKey)
        if (cachedBlob) {
          const objectUrl = URL.createObjectURL(cachedBlob)
          dispatch({ type: 'DECRYPT_SUCCESS', audioUrl: objectUrl })
          return
        }

        // Step 3: Perform Lit decryption
        const decryptPromise = performLitDecryption(metadata, pkpInfo, authData, dispatch)
        setInFlightDecrypt(cacheKey, decryptPromise)

        const decryptedBlob = await decryptPromise

        // Save to cache
        saveToCache(cacheKey, decryptedBlob).catch(() => {})

        const objectUrl = URL.createObjectURL(decryptedBlob)
        dispatch({ type: 'DECRYPT_SUCCESS', audioUrl: objectUrl })
      } catch (err) {
        console.error('[useSongAccess] Decrypt error:', err)
        const errorMsg = err instanceof Error ? err.message : 'Failed to decrypt audio'
        dispatch({ type: 'DECRYPT_FAILED', error: errorMsg })
      }
    }

    performDecrypt()
  }, [ctx.state, encryptionMetadataUrl, spotifyTrackId, pkpInfo, authData])

  // ============ Purchase Action ============
  const purchase = useCallback(async () => {
    if (!resolvedWalletClient || !publicClient) {
      dispatch({ type: 'PURCHASE_FAILED', error: 'Wallet not connected' })
      return
    }

    if (!resolvedRecipient) {
      dispatch({ type: 'PURCHASE_FAILED', error: 'No wallet address' })
      return
    }

    if (!spotifyTrackId) {
      dispatch({ type: 'PURCHASE_FAILED', error: 'No song selected' })
      return
    }

    dispatch({ type: 'START_PURCHASE' })

    try {
      // Check if already owned (defensive)
      const songAccessClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      // @ts-expect-error - viem version mismatch
      const alreadyOwned = await songAccessClient.readContract({
        address: CONTRACT.address,
        abi: SONG_ACCESS_ABI,
        functionName: 'ownsSongByTrackId',
        args: [resolvedRecipient as Address, spotifyTrackId],
      })

      if (alreadyOwned) {
        dispatch({ type: 'PURCHASE_SUCCESS' })
        return
      }

      // Check USDC balance
      // @ts-expect-error - viem version mismatch
      const balance = await publicClient.readContract({
        address: CONTRACT.usdc,
        abi: USDC_PERMIT_ABI,
        functionName: 'balanceOf',
        args: [resolvedRecipient],
      }) as bigint

      if (balance < CONTRACT.price) {
        const priceFormatted = formatTokenPriceWithLocal(0.10, 'USDC', detectCurrencyFromLocale())
        dispatch({ type: 'PURCHASE_FAILED', error: `Insufficient USDC balance. Need ${priceFormatted}` })
        return
      }

      // Check existing allowance
      // @ts-expect-error - viem version mismatch
      const allowance = await publicClient.readContract({
        address: CONTRACT.usdc,
        abi: USDC_PERMIT_ABI,
        functionName: 'allowance',
        args: [resolvedRecipient, CONTRACT.address],
      }) as bigint

      // If sufficient allowance, use purchaseWithApproval
      if (allowance >= CONTRACT.price) {
        dispatch({ type: 'PURCHASE_SIGNING' })

        const data = encodeFunctionData({
          abi: SONG_ACCESS_ABI,
          functionName: 'purchaseWithApproval',
          args: [spotifyTrackId],
        })

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
        dispatch({ type: 'PURCHASE_CONFIRMING', txHash: hash })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status === 'success') {
          dispatch({ type: 'PURCHASE_SUCCESS' })
        } else {
          throw new Error('Transaction failed')
        }
        return
      }

      // Need permit signature
      dispatch({ type: 'PURCHASE_SIGNING' })

      // @ts-expect-error - viem version mismatch
      const nonce = await publicClient.readContract({
        address: CONTRACT.usdc,
        abi: USDC_PERMIT_ABI,
        functionName: 'nonces',
        args: [resolvedRecipient],
      }) as bigint

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)

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

      const r = `0x${signature.slice(2, 66)}` as `0x${string}`
      const s = `0x${signature.slice(66, 130)}` as `0x${string}`
      const v = parseInt(signature.slice(130, 132), 16)

      const data = encodeFunctionData({
        abi: SONG_ACCESS_ABI,
        functionName: 'purchase',
        args: [spotifyTrackId, deadline, v, r, s],
      })

      const gas = await publicClient.estimateGas({
        account: resolvedRecipient,
        to: CONTRACT.address,
        data,
      })

      const txRequest = await publicClient.prepareTransactionRequest({
        account: resolvedRecipient,
        to: CONTRACT.address,
        data,
        gas,
        chain: baseSepolia,
      } as any)

      if (typeof account.signTransaction !== 'function') {
        throw new Error('Account does not support transaction signing')
      }

      const signedTx = await account.signTransaction({
        ...txRequest,
        chainId: CONTRACT.chainId,
      } as any)

      const hash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx })
      dispatch({ type: 'PURCHASE_CONFIRMING', txHash: hash })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status === 'success') {
        dispatch({ type: 'PURCHASE_SUCCESS' })
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error) {
      console.error('[useSongAccess] Purchase error:', error)

      let errorMsg = 'Transaction failed'
      if (error instanceof Error) {
        if (error.name === 'SessionExpiredError') {
          errorMsg = 'Session expired. Please sign out and sign back in.'
        } else {
          const msg = error.message.toLowerCase()
          if (msg.includes('user rejected') || msg.includes('user denied')) {
            errorMsg = 'Transaction cancelled'
          } else if (msg.includes('insufficient')) {
            errorMsg = 'Insufficient USDC balance'
          } else if (msg.includes('already')) {
            errorMsg = 'You already own this song'
            // Still transition to owned state
            dispatch({ type: 'PURCHASE_SUCCESS' })
            return
          } else if (msg.includes('session') || msg.includes('expired') || msg.includes('sign in')) {
            errorMsg = 'Session expired. Please sign out and sign back in.'
          } else {
            errorMsg = error.message.slice(0, 100)
          }
        }
      }

      dispatch({ type: 'PURCHASE_FAILED', error: errorMsg })
    }
  }, [resolvedWalletClient, publicClient, resolvedRecipient, spotifyTrackId])

  // ============ Retry Decrypt Action ============
  const retryDecrypt = useCallback(() => {
    if (ctx.state === 'owned-decrypt-failed') {
      dispatch({ type: 'RETRY_DECRYPT' })
    }
  }, [ctx.state])

  // ============ Reset Action ============
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  // ============ Computed Properties ============
  const isOwned = ctx.state.startsWith('owned-')
  const isChecking = ctx.state === 'checking'
  const isPurchasing = ctx.state === 'purchasing'
  const isDecrypting = ctx.state === 'owned-decrypting'

  return {
    state: ctx.state,
    isOwned,
    isChecking,
    isPurchasing,
    isDecrypting,
    decryptedAudioUrl: ctx.decryptedAudioUrl,
    decryptProgress: ctx.decryptProgress,
    error: ctx.error,
    txHash: ctx.txHash,
    statusMessage: ctx.statusMessage,
    purchase,
    retryDecrypt,
    reset,
    purchaseSubState: ctx.purchaseSubState,
  }
}

// ============ Lit Decryption Helper ============

async function performLitDecryption(
  metadata: HybridEncryptionMetadata,
  pkpInfo: NonNullable<ReturnType<typeof useAuth>['pkpInfo']>,
  authData: NonNullable<ReturnType<typeof useAuth>['authData']>,
  dispatch: React.Dispatch<Action>
): Promise<Blob> {
  const { getLitClient } = await import('@/lib/lit/client')
  const { createPKPAuthContext } = await import('@/lib/lit/auth-pkp')

  const litClient = await getLitClient()
  const authContext = await createPKPAuthContext(pkpInfo, authData)

  const chainName = metadata.accessControl?.chainName || metadata.unlock?.chainName || 'baseSepolia'
  const litChain = chainName === 'base-sepolia' ? 'baseSepolia' : chainName

  const decryptedKeyResponse = await litClient.decrypt({
    ciphertext: metadata.lit.encryptedKey,
    dataToEncryptHash: metadata.lit.dataToEncryptHash,
    unifiedAccessControlConditions: metadata.lit.unifiedAccessControlConditions,
    chain: litChain,
    authContext: authContext,
  })

  const symmetricKey = decryptedKeyResponse.decryptedData

  // Progress: Lit auth succeeded
  dispatch({ type: 'DECRYPT_PROGRESS', progress: 60 })

  // Fetch encrypted audio
  const audioResponse = await fetch(metadata.encryptedAudio.url)
  if (!audioResponse.ok) {
    throw new Error(`Failed to fetch encrypted audio: ${audioResponse.status}`)
  }

  const encryptedAudio = await audioResponse.arrayBuffer()

  // Decrypt with AES-GCM
  dispatch({ type: 'DECRYPT_PROGRESS', progress: 80 })

  const decryptedAudio = await decryptAudioWithAesGcm(
    encryptedAudio,
    symmetricKey,
    metadata.aes.iv,
    metadata.aes.authTag
  )

  return new Blob([decryptedAudio], { type: 'audio/mpeg' })
}

// ============ AES Decryption Helper ============

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function decryptAudioWithAesGcm(
  encryptedAudio: ArrayBuffer,
  symmetricKey: Uint8Array,
  iv: string,
  authTag: string
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    symmetricKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const ivBytes = fromBase64(iv)
  const authTagBytes = fromBase64(authTag)

  const ciphertextWithTag = new Uint8Array(
    encryptedAudio.byteLength + authTagBytes.byteLength
  )
  ciphertextWithTag.set(new Uint8Array(encryptedAudio), 0)
  ciphertextWithTag.set(authTagBytes, encryptedAudio.byteLength)

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    cryptoKey,
    ciphertextWithTag
  )

  return decryptedBuffer
}
