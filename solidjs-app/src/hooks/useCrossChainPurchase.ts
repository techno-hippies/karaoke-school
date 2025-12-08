/**
 * useCrossChainPurchase - Cross-chain purchase via Across Protocol
 *
 * Enables users to pay from any supported chain (Ethereum, Arbitrum, Optimism)
 * and bridge funds to Base Sepolia for song/subscription purchases.
 *
 * Supports both EOA wallets (via wagmi) and PKP wallets (via Lit Protocol).
 *
 * On testnet: Fills take ~1 minute (vs ~2 seconds on mainnet)
 */

import { createSignal, createMemo, createEffect, on } from 'solid-js'
import type { Address, Hash, WalletClient } from 'viem'
import { formatUnits } from 'viem'
import { baseSepolia } from 'viem/chains'
import type { SwapExecutionProgress } from '@across-protocol/app-sdk'
import { getAccount, getWalletClient } from '@wagmi/core'
import {
  getAcrossClient,
  isDestinationChain,
  TESTNET_TOKENS,
  CHAIN_INFO,
  type SupportedChainId,
} from '@/lib/across'
import { wagmiConfig } from '@/providers/Web3Provider'
import { useAuth } from '@/contexts/AuthContext'
import type { PurchaseStep } from '@/components/purchase/types'

const IS_DEV = import.meta.env.DEV

// ============ Types ============

export type PaymentToken = 'usdc' | 'eth'

export interface CrossChainRoute {
  originChainId: SupportedChainId
  inputToken: Address
  outputToken: Address
}

export interface UseCrossChainPurchaseOptions {
  /** Target contract on Base Sepolia */
  destinationContract: Address
  /** Function to call after bridging (e.g., "function purchase(string trackId)") */
  destinationFunction?: string
  /** Arguments for the destination function */
  destinationArgs?: { value: unknown }[]
  /** Amount in token's smallest unit (e.g., 100000 for $0.10 USDC) */
  amount: bigint
  /** Token type: 'usdc' for songs, 'eth' for premium subscription */
  paymentToken: PaymentToken
  /** Whether to populate call value dynamically (for ETH payments) */
  populateCallValueDynamically?: boolean
  /** Wallet type to use: 'eoa' (wagmi) or 'pkp' (Lit Protocol). Default: 'eoa' */
  walletType?: 'eoa' | 'pkp'
}

export interface CrossChainQuote {
  originChainId: number
  inputAmount: bigint
  outputAmount: bigint
  estimatedFillTime: number // seconds
  fees: {
    totalFee: bigint
    relayerFee: bigint
    lpFee: bigint
  }
}

export interface UseCrossChainPurchaseResult {
  // State
  status: () => PurchaseStep
  statusMessage: () => string
  errorMessage: () => string
  txHash: () => Hash | undefined
  fillTxHash: () => Hash | undefined
  quote: () => CrossChainQuote | undefined

  // Chain selection
  selectedChainId: () => SupportedChainId
  setSelectedChainId: (chainId: SupportedChainId) => void
  availableChains: () => { id: SupportedChainId; name: string; icon: string }[]

  // Balance
  originBalance: () => bigint | undefined
  hasInsufficientBalance: () => boolean

  // Actions
  fetchQuote: () => Promise<void>
  execute: () => Promise<void>
  reset: () => void

  // Helpers
  isCrossChain: () => boolean
  formattedFee: () => string
}

// ============ Constants ============

const DESTINATION_CHAIN_ID = baseSepolia.id

// ============ Hook Implementation ============

export function useCrossChainPurchase(
  options: () => UseCrossChainPurchaseOptions
): UseCrossChainPurchaseResult {
  const auth = useAuth()

  // Helper to get wallet address based on wallet type
  const getWalletAddress = (): Address | undefined => {
    const walletType = options().walletType ?? 'eoa'
    if (walletType === 'pkp') {
      return auth.pkpAddress() as Address | undefined
    }
    // EOA wallet via wagmi
    const account = getAccount(wagmiConfig)
    return account.address
  }

  // Helper to get wallet client based on wallet type
  const getWallet = async (): Promise<WalletClient | undefined> => {
    const walletType = options().walletType ?? 'eoa'
    if (walletType === 'pkp') {
      return auth.pkpWalletClient() as WalletClient | undefined
    }
    // EOA wallet via wagmi
    try {
      return await getWalletClient(wagmiConfig)
    } catch {
      return undefined
    }
  }

  // State signals
  const [status, setStatus] = createSignal<PurchaseStep>('idle')
  const [statusMessage, setStatusMessage] = createSignal('')
  const [errorMessage, setErrorMessage] = createSignal('')
  const [txHash, setTxHash] = createSignal<Hash | undefined>()
  const [fillTxHash, setFillTxHash] = createSignal<Hash | undefined>()
  const [quote, setQuote] = createSignal<CrossChainQuote | undefined>()
  const [selectedChainId, setSelectedChainId] = createSignal<SupportedChainId>(baseSepolia.id)
  const [originBalance, setOriginBalance] = createSignal<bigint | undefined>()

  // Derived state
  const isCrossChain = createMemo(() => !isDestinationChain(selectedChainId()))

  const availableChains = createMemo(() => {
    const chains: { id: SupportedChainId; name: string; icon: string }[] = []
    for (const [chainIdStr, info] of Object.entries(CHAIN_INFO)) {
      const chainId = Number(chainIdStr) as SupportedChainId
      chains.push({
        id: chainId,
        name: info.shortName,
        icon: info.icon,
      })
    }
    return chains
  })

  const hasInsufficientBalance = createMemo(() => {
    const balance = originBalance()
    const q = quote()
    if (balance === undefined) return false
    const required = q?.inputAmount ?? options().amount
    return balance < required
  })

  const formattedFee = createMemo(() => {
    const q = quote()
    if (!q) return '~'
    const token = options().paymentToken
    const decimals = token === 'usdc' ? 6 : 18
    const symbol = token === 'usdc' ? 'USDC' : 'ETH'
    return `${formatUnits(q.fees.totalFee, decimals)} ${symbol}`
  })

  // Get input token address for selected chain
  const getInputToken = (): Address => {
    const token = options().paymentToken
    const chainId = selectedChainId()
    if (token === 'usdc') {
      return TESTNET_TOKENS.usdc[chainId] as Address
    }
    return TESTNET_TOKENS.eth[chainId] as Address
  }

  // Get output token address (always on Base Sepolia)
  const getOutputToken = (): Address => {
    const token = options().paymentToken
    if (token === 'usdc') {
      return TESTNET_TOKENS.usdc[baseSepolia.id] as Address
    }
    return TESTNET_TOKENS.eth[baseSepolia.id] as Address
  }

  // Fetch balance on selected chain
  const fetchBalance = async () => {
    const walletAddress = getWalletAddress()
    if (!walletAddress) return

    try {
      const client = getAcrossClient()
      const publicClient = client.getPublicClient(selectedChainId())
      const token = options().paymentToken

      if (token === 'eth') {
        const balance = await publicClient.getBalance({
          address: walletAddress,
        })
        setOriginBalance(balance)
      } else {
        // Read ERC20 balance
        const tokenAddress = getInputToken()
        const balance = await publicClient.readContract({
          address: tokenAddress,
          abi: [
            {
              inputs: [{ type: 'address', name: 'account' }],
              name: 'balanceOf',
              outputs: [{ type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'balanceOf',
          args: [walletAddress],
        })
        setOriginBalance(balance)
      }
    } catch (err) {
      console.error('[useCrossChainPurchase] Error fetching balance:', err)
    }
  }

  // Refetch balance when chain changes
  createEffect(
    on(selectedChainId, () => {
      fetchBalance()
    })
  )

  // Fetch quote from Across API
  const fetchQuote = async () => {
    if (!isCrossChain()) {
      // No bridging needed for same-chain
      setQuote(undefined)
      return
    }

    const walletAddress = getWalletAddress()
    if (!walletAddress) {
      setErrorMessage('Wallet not connected')
      return
    }

    try {
      setStatus('checking')
      setStatusMessage('Getting quote...')

      const client = getAcrossClient()
      const opts = options()

      const route = {
        originChainId: selectedChainId(),
        destinationChainId: DESTINATION_CHAIN_ID,
        inputToken: getInputToken(),
        outputToken: getOutputToken(),
      }

      // Build actions for destination chain call
      const actions = opts.destinationFunction
        ? [
            {
              target: opts.destinationContract,
              functionSignature: opts.destinationFunction,
              args: opts.destinationArgs || [],
              ...(opts.populateCallValueDynamically
                ? { populateCallValueDynamically: true as const }
                : { value: 0n }),
            },
          ]
        : undefined

      const swapQuote = await client.getSwapQuote({
        route,
        amount: opts.amount.toString(),
        depositor: walletAddress,
        recipient: walletAddress,
        actions,
      })

      if (IS_DEV) {
        console.log('[useCrossChainPurchase] Quote:', swapQuote)
      }

      // Parse quote response - fees.total contains the total fee amount
      const totalFeeAmount = swapQuote.fees?.total?.amount || '0'
      const fees = {
        totalFee: BigInt(totalFeeAmount),
        relayerFee: BigInt(swapQuote.fees?.total?.details?.bridge?.details?.relayerCapital?.amount || '0'),
        lpFee: BigInt(swapQuote.fees?.total?.details?.bridge?.details?.lp?.amount || '0'),
      }

      setQuote({
        originChainId: selectedChainId(),
        inputAmount: BigInt(swapQuote.inputAmount || opts.amount.toString()),
        outputAmount: BigInt(swapQuote.minOutputAmount || '0'),
        estimatedFillTime: swapQuote.expectedFillTime || 60, // Default 1 min on testnet
        fees,
      })

      setStatus('idle')
      setStatusMessage('')
    } catch (err) {
      console.error('[useCrossChainPurchase] Error fetching quote:', err)
      setStatus('error')
      setErrorMessage('Failed to get bridge quote. Please try again.')
    }
  }

  // Execute cross-chain purchase
  const execute = async () => {
    const walletAddress = getWalletAddress()
    const walletClient = await getWallet()

    if (!walletClient || !walletAddress) {
      setStatus('error')
      setErrorMessage('Wallet not connected')
      return
    }

    // If same chain, caller should use direct purchase instead
    if (!isCrossChain()) {
      setStatus('error')
      setErrorMessage('Use direct purchase for same-chain transactions')
      return
    }

    try {
      setStatus('signing')
      setStatusMessage('Preparing...')
      setErrorMessage('')

      const client = getAcrossClient()
      const opts = options()

      const route = {
        originChainId: selectedChainId(),
        destinationChainId: DESTINATION_CHAIN_ID,
        inputToken: getInputToken(),
        outputToken: getOutputToken(),
      }

      // Build actions
      const actions = opts.destinationFunction
        ? [
            {
              target: opts.destinationContract,
              functionSignature: opts.destinationFunction,
              args: opts.destinationArgs || [],
              ...(opts.populateCallValueDynamically
                ? { populateCallValueDynamically: true as const }
                : { value: 0n }),
            },
          ]
        : undefined

      // Get fresh quote
      const swapQuote = await client.getSwapQuote({
        route,
        amount: opts.amount.toString(),
        depositor: walletAddress,
        recipient: walletAddress,
        actions,
      })

      if (IS_DEV) {
        console.log('[useCrossChainPurchase] Executing swap quote:', swapQuote)
      }

      // Execute the swap
      // The SDK expects a wallet client with a defined account
      const result = await client.executeSwapQuote({
        walletClient: walletClient as any,
        swapQuote,
        onProgress: (progress: SwapExecutionProgress) => {
          handleProgress(progress)
        },
      })

      if (result.error) {
        throw result.error
      }

      if (result.swapTxReceipt) {
        setTxHash(result.swapTxReceipt.transactionHash)
      }

      if (result.fillTxReceipt) {
        setFillTxHash(result.fillTxReceipt.transactionHash)
        setStatus('complete')
        setStatusMessage('Cross-chain purchase complete!')
      }
    } catch (err) {
      console.error('[useCrossChainPurchase] Error:', err)
      handleError(err)
    }
  }

  // Handle progress updates from Across SDK
  const handleProgress = (progress: SwapExecutionProgress) => {
    if (IS_DEV) {
      console.log('[useCrossChainPurchase] Progress:', progress.step, progress.status)
    }

    switch (progress.step) {
      case 'approve':
        if (progress.status === 'txPending') {
          setStatus('approving')
          setStatusMessage('Approving...')
          setTxHash(progress.txHash)
        } else if (progress.status === 'txSuccess') {
          setStatusMessage('Approved!')
        } else if (progress.status === 'txError' || progress.status === 'error') {
          handleError(progress.error)
        }
        break

      case 'swap':
        if (progress.status === 'simulationPending') {
          setStatus('signing')
          setStatusMessage('Preparing...')
        } else if (progress.status === 'txPending') {
          setStatus('purchasing')
          setStatusMessage('Bridging...')
          setTxHash(progress.txHash)
        } else if (progress.status === 'txSuccess') {
          setStatusMessage('Confirming...')
        } else if (progress.status === 'txError' || progress.status === 'error') {
          handleError(progress.error)
        }
        break

      case 'fill':
        if (progress.status === 'txPending') {
          setStatusMessage('Finalizing...')
        } else if (progress.status === 'txSuccess') {
          setFillTxHash(progress.txReceipt.transactionHash)
          if (progress.actionSuccess === false) {
            setStatus('error')
            setErrorMessage('Bridge succeeded but purchase failed')
          } else {
            setStatus('complete')
            setStatusMessage('Complete!')
          }
        } else if (progress.status === 'txError' || progress.status === 'error') {
          handleError(progress.error)
        }
        break
    }
  }

  // Handle errors
  const handleError = (err: unknown) => {
    let userMessage = 'Transaction failed. Please try again.'

    if (err instanceof Error) {
      const errorMsg = err.message.toLowerCase()

      if (errorMsg.includes('user rejected') || errorMsg.includes('user denied')) {
        userMessage = 'Transaction cancelled.'
      } else if (errorMsg.includes('insufficient') || errorMsg.includes('balance')) {
        userMessage = 'Insufficient balance. Please add funds.'
      } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
        userMessage = 'Network error. Please check your connection.'
      } else if (errorMsg.includes('no routes') || errorMsg.includes('route not found')) {
        userMessage = 'Bridge route not available. Try a different chain.'
      }
    }

    setStatus('error')
    setStatusMessage('')
    setErrorMessage(userMessage)
  }

  // Reset state
  const reset = () => {
    setStatus('idle')
    setStatusMessage('')
    setErrorMessage('')
    setTxHash(undefined)
    setFillTxHash(undefined)
    setQuote(undefined)
  }

  return {
    status,
    statusMessage,
    errorMessage,
    txHash,
    fillTxHash,
    quote,
    selectedChainId,
    setSelectedChainId,
    availableChains,
    originBalance,
    hasInsufficientBalance,
    fetchQuote,
    execute,
    reset,
    isCrossChain,
    formattedFee,
  }
}
