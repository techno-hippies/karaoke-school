/**
 * useEOABalances - Check EOA wallet balances across multiple chains
 *
 * Scans supported chains for USDC and ETH balances to find the best
 * payment option for purchases.
 *
 * Automatically uses testnet or mainnet chains based on VITE_USE_MAINNET env var.
 */

import { createSignal, createEffect, on, createMemo } from 'solid-js'
import { getAccount, watchAccount } from '@wagmi/core'
import { createPublicClient, http, formatUnits, type Address, type Chain } from 'viem'
import {
  arbitrumSepolia,
  baseSepolia,
  optimismSepolia,
  sepolia,
  arbitrum,
  base,
  optimism,
  mainnet,
} from 'viem/chains'
import { wagmiConfig } from '@/providers/Web3Provider'

const IS_DEV = import.meta.env.DEV
const USE_MAINNET = import.meta.env.VITE_USE_MAINNET === 'true'

// ERC20 balanceOf ABI
const ERC20_BALANCE_ABI = [
  {
    inputs: [{ type: 'address', name: 'account' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ============ Network Configuration ============

// Testnet chains
const TESTNET_CHAINS = [baseSepolia, arbitrumSepolia, optimismSepolia, sepolia] as const

// Mainnet chains
const MAINNET_CHAINS = [base, arbitrum, optimism, mainnet] as const

// Select chains based on environment
const CHAINS_TO_CHECK = USE_MAINNET ? MAINNET_CHAINS : TESTNET_CHAINS

// USDC addresses per chain
const USDC_ADDRESSES: Record<number, Address> = USE_MAINNET
  ? {
      // Mainnet USDC addresses
      [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      [arbitrum.id]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      [optimism.id]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      [mainnet.id]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    }
  : {
      // Testnet USDC addresses
      [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      [arbitrumSepolia.id]: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      [optimismSepolia.id]: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
      [sepolia.id]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    }

// Chain display info
const CHAIN_DISPLAY_INFO: Record<number, { name: string; shortName: string }> = {
  // Mainnet
  [base.id]: { name: 'Base', shortName: 'Base' },
  [arbitrum.id]: { name: 'Arbitrum One', shortName: 'Arbitrum' },
  [optimism.id]: { name: 'Optimism', shortName: 'Optimism' },
  [mainnet.id]: { name: 'Ethereum', shortName: 'Ethereum' },
  // Testnet
  [baseSepolia.id]: { name: 'Base Sepolia', shortName: 'Base' },
  [arbitrumSepolia.id]: { name: 'Arbitrum Sepolia', shortName: 'Arbitrum' },
  [optimismSepolia.id]: { name: 'Optimism Sepolia', shortName: 'Optimism' },
  [sepolia.id]: { name: 'Sepolia', shortName: 'Sepolia' },
}

// Helper type for chain IDs
type SupportedChainId = (typeof CHAINS_TO_CHECK)[number]['id']

export interface TokenBalance {
  chainId: number
  chainName: string
  token: 'USDC' | 'ETH'
  balance: bigint
  balanceFormatted: number
  sufficient: boolean
}

export interface PaymentMethod {
  token: 'USDC' | 'ETH'
  chainId: number
  chainName: string
  balance: number
}

export interface UseEOABalancesResult {
  /** EOA wallet address */
  address: () => Address | undefined
  /** Whether wallet is connected */
  isConnected: () => boolean
  /** Whether balances are loading */
  isLoading: () => boolean
  /** All token balances across chains */
  balances: () => TokenBalance[]
  /** Best payment method (highest balance that covers the price) */
  bestPaymentMethod: () => PaymentMethod | undefined
  /** Whether any balance is sufficient for the price */
  hasSufficientBalance: () => boolean
  /** Refresh balances */
  refresh: () => Promise<void>
}

export interface UseEOABalancesOptions {
  /** Required amount in USD (default: 0.10) */
  requiredUsd?: number
  /** Override address (for when wagmi isn't connected but we have stored address) */
  overrideAddress?: () => Address | undefined
}

export function useEOABalances(options?: UseEOABalancesOptions): UseEOABalancesResult {
  const requiredUsd = options?.requiredUsd ?? 0.10
  const overrideAddress = options?.overrideAddress

  if (IS_DEV) {
    console.log('[useEOABalances] Hook initialized with requiredUsd:', requiredUsd)
  }

  // State
  const [wagmiAddress, setWagmiAddress] = createSignal<Address | undefined>()
  const [isConnected, setIsConnected] = createSignal(false)
  const [isLoading, setIsLoading] = createSignal(false)
  const [balances, setBalances] = createSignal<TokenBalance[]>([])

  // Effective address: override takes precedence over wagmi
  const address = createMemo(() => {
    const override = overrideAddress?.()
    const wagmi = wagmiAddress()
    if (IS_DEV && (override || wagmi)) {
      console.log('[useEOABalances] Effective address:', {
        override,
        wagmi,
        using: override || wagmi,
      })
    }
    if (override) return override
    return wagmi
  })

  // Create public clients for each chain (dynamically based on environment)
  const publicClients = Object.fromEntries(
    CHAINS_TO_CHECK.map((chain) => [
      chain.id,
      createPublicClient({ chain: chain as Chain, transport: http() }),
    ])
  ) as Record<SupportedChainId, ReturnType<typeof createPublicClient>>

  // Watch account changes from wagmi
  watchAccount(wagmiConfig, {
    onChange: (account) => {
      if (IS_DEV) {
        console.log('[useEOABalances] wagmi account changed:', {
          address: account.address,
          isConnected: account.isConnected,
          chainId: account.chainId,
        })
      }
      setWagmiAddress(account.address)
      setIsConnected(account.isConnected)
    },
  })

  // Initialize from current wagmi account
  const initAccount = () => {
    const account = getAccount(wagmiConfig)
    if (IS_DEV) {
      console.log('[useEOABalances] Initial wagmi account:', {
        address: account.address,
        isConnected: account.isConnected,
        chainId: account.chainId,
      })
    }
    setWagmiAddress(account.address)
    setIsConnected(account.isConnected)
  }
  initAccount()

  // Fetch all balances
  const fetchBalances = async () => {
    const addr = address()
    if (!addr) {
      if (IS_DEV) {
        console.log('[useEOABalances] fetchBalances: No address, skipping')
      }
      setBalances([])
      return
    }

    if (IS_DEV) {
      console.log('[useEOABalances] fetchBalances: Starting for', addr)
    }

    setIsLoading(true)
    const newBalances: TokenBalance[] = []

    try {
      // Check each chain in parallel
      await Promise.all(
        CHAINS_TO_CHECK.map(async (chain) => {
          const chainId = chain.id as SupportedChainId
          const client = publicClients[chainId]
          const chainInfo = CHAIN_DISPLAY_INFO[chainId]

          // Check USDC balance
          const usdcAddress = USDC_ADDRESSES[chainId]
          if (usdcAddress) {
            try {
              const usdcBalance = await client.readContract({
                address: usdcAddress,
                abi: ERC20_BALANCE_ABI,
                functionName: 'balanceOf',
                args: [addr],
              })
              const formatted = Number(formatUnits(usdcBalance, 6))
              newBalances.push({
                chainId,
                chainName: chainInfo.shortName,
                token: 'USDC',
                balance: usdcBalance,
                balanceFormatted: formatted,
                sufficient: formatted >= requiredUsd,
              })
            } catch (err) {
              console.warn(`[useEOABalances] Failed to fetch USDC on ${chainInfo.shortName}:`, err)
            }
          }

          // Check ETH balance
          try {
            const ethBalance = await client.getBalance({ address: addr })
            const formatted = Number(formatUnits(ethBalance, 18))
            // Rough ETH to USD conversion (assume ~$3000/ETH)
            const ethValueUsd = formatted * 3000
            newBalances.push({
              chainId,
              chainName: chainInfo.shortName,
              token: 'ETH',
              balance: ethBalance,
              balanceFormatted: formatted,
              sufficient: ethValueUsd >= requiredUsd,
            })
          } catch (err) {
            console.warn(`[useEOABalances] Failed to fetch ETH on ${chainInfo.shortName}:`, err)
          }
        })
      )

      // Sort by: sufficient first, then by balance (highest first)
      newBalances.sort((a, b) => {
        if (a.sufficient !== b.sufficient) return a.sufficient ? -1 : 1
        // Prefer USDC over ETH when both sufficient
        if (a.sufficient && b.sufficient && a.token !== b.token) {
          return a.token === 'USDC' ? -1 : 1
        }
        return b.balanceFormatted - a.balanceFormatted
      })

      if (IS_DEV) {
        console.log('[useEOABalances] fetchBalances complete:', {
          address: addr,
          balanceCount: newBalances.length,
          balances: newBalances.map(b => ({
            chain: b.chainName,
            token: b.token,
            balance: b.balanceFormatted,
            sufficient: b.sufficient,
          })),
        })
      }

      setBalances(newBalances)
    } catch (err) {
      console.error('[useEOABalances] Error fetching balances:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Refetch when address changes
  createEffect(
    on(address, (addr) => {
      if (addr) {
        fetchBalances()
      } else {
        setBalances([])
      }
    })
  )

  // Derived: best payment method
  const bestPaymentMethod = createMemo((): PaymentMethod | undefined => {
    const sufficient = balances().find((b) => b.sufficient)
    if (!sufficient) return undefined
    return {
      token: sufficient.token,
      chainId: sufficient.chainId,
      chainName: sufficient.chainName,
      balance: sufficient.balanceFormatted,
    }
  })

  // Derived: has sufficient balance
  const hasSufficientBalance = createMemo(() => balances().some((b) => b.sufficient))

  return {
    address,
    isConnected,
    isLoading,
    balances,
    bestPaymentMethod,
    hasSufficientBalance,
    refresh: fetchBalances,
  }
}
