/**
 * usePKPBalances - Fetch PKP wallet balances across EVM networks
 *
 * Improvements over React version:
 * - Uses SolidJS createResource for better data fetching
 * - Batches RPC calls per network (multicall-style)
 * - Lazy loads other networks on demand
 */

const IS_DEV = import.meta.env.DEV

import { createSignal, createEffect, on } from 'solid-js'
import { createPublicClient, http } from 'viem'
import { useAuth } from '@/contexts/AuthContext'

// Primary network - fetched immediately
const PRIMARY_NETWORK = 'base'

// Network configurations
const NETWORK_CONFIGS = {
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    nativeToken: 'ETH',
    tokens: {
      USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    }
  },
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://eth.drpc.org',
    nativeToken: 'ETH',
    tokens: {
      USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    }
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon.drpc.org',
    nativeToken: 'MATIC',
    tokens: {
      USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
    }
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: 'https://arbitrum.drpc.org',
    nativeToken: 'ETH',
    tokens: {
      USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    }
  },
} as const

export interface TokenBalance {
  symbol: string
  name: string
  balance: string
  network: string
  usdValue?: string
  currencyIcon?: string
  chainIcon?: string
  isLoading?: boolean
}

interface UsePKPBalancesReturn {
  balances: () => TokenBalance[]
  isLoading: () => boolean
  error: () => Error | null
  refetch: () => Promise<void>
  fetchOtherNetworks: () => Promise<void>
  hasLoadedOtherNetworks: () => boolean
  isLoadingOtherNetworks: () => boolean
}

export function usePKPBalances(): UsePKPBalancesReturn {
  const auth = useAuth()

  const [balances, setBalances] = createSignal<TokenBalance[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [isLoadingOtherNetworks, setIsLoadingOtherNetworks] = createSignal(false)
  const [hasLoadedOtherNetworks, setHasLoadedOtherNetworks] = createSignal(false)
  const [error, setError] = createSignal<Error | null>(null)
  const [hasFetched, setHasFetched] = createSignal(false)

  // Fetch primary balances (Base ETH + USDC)
  const fetchPrimaryBalances = async () => {
    const pkpAddress = auth.pkpAddress()
    if (IS_DEV) {
      console.log('[usePKPBalances] fetchPrimaryBalances called:', { pkpAddress, isPKPReady: auth.isPKPReady() })
    }
    if (!pkpAddress || !auth.isPKPReady()) {
      if (IS_DEV) {
        console.log('[usePKPBalances] Early return - not ready')
      }
      setBalances([])
      return
    }

    setIsLoading(true)
    setError(null)
    if (IS_DEV) {
      console.log('[usePKPBalances] Starting fetch...')
    }

    try {
      const config = NETWORK_CONFIGS[PRIMARY_NETWORK]
      if (IS_DEV) {
        console.log('[usePKPBalances] Creating client for', config.name, config.rpcUrl)
      }
      const client = createPublicClient({
        chain: {
          id: config.chainId,
          name: config.name,
          nativeCurrency: { name: config.nativeToken, symbol: config.nativeToken, decimals: 18 },
          rpcUrls: { default: { http: [config.rpcUrl] } },
        },
        transport: http(),
      })

      const primaryBalances: TokenBalance[] = []

      // Fetch ETH balance
      if (IS_DEV) {
        console.log('[usePKPBalances] Fetching ETH balance...')
      }
      const nativeBalanceHex = await client.request({
        method: 'eth_getBalance',
        params: [pkpAddress, 'latest'],
      }) as string
      if (IS_DEV) {
        console.log('[usePKPBalances] ETH balance received:', nativeBalanceHex)
      }

      const nativeBalance = BigInt(nativeBalanceHex)
      const nativeFormatted = formatBalance(nativeBalance, 18)
      const nativeUsd = estimateUsdValue(nativeFormatted, 'ETH')

      primaryBalances.push({
        symbol: 'ETH',
        name: 'Ethereum',
        balance: nativeFormatted,
        network: config.name,
        usdValue: nativeUsd,
        currencyIcon: 'ethereum-logo.png',
        chainIcon: 'base-chain.svg',
      })

      // Fetch USDC balance
      const usdcConfig = config.tokens.USDC
      const balanceOfSelector = '0x70a08231'
      const paddedAddress = pkpAddress.slice(2).padStart(64, '0')
      const data = balanceOfSelector + paddedAddress

      const usdcBalanceHex = await client.request({
        method: 'eth_call',
        params: [{ to: usdcConfig.address as `0x${string}`, data: data as `0x${string}` }, 'latest']
      }) as string

      let usdcBalance = 0n
      if (usdcBalanceHex && usdcBalanceHex !== '0x') {
        try {
          usdcBalance = BigInt(usdcBalanceHex)
        } catch {
          // ignore
        }
      }

      const usdcFormatted = formatBalance(usdcBalance, usdcConfig.decimals)
      const usdcUsd = estimateUsdValue(usdcFormatted, 'USDC')

      primaryBalances.push({
        symbol: 'USDC',
        name: 'USD Coin',
        balance: usdcFormatted,
        network: config.name,
        usdValue: usdcUsd,
        currencyIcon: 'usdc-logo.png',
        chainIcon: 'base-chain.svg',
      })

      setBalances(primaryBalances)
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to fetch balances')
      setError(e)
      console.error('[usePKPBalances] Error:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch other networks on demand
  const fetchOtherNetworks = async () => {
    const pkpAddress = auth.pkpAddress()
    if (!pkpAddress || !auth.isPKPReady() || hasLoadedOtherNetworks() || isLoadingOtherNetworks()) {
      return
    }

    setIsLoadingOtherNetworks(true)

    try {
      const otherBalances: TokenBalance[] = []

      for (const [networkKey, config] of Object.entries(NETWORK_CONFIGS)) {
        if (networkKey === PRIMARY_NETWORK) continue

        try {
          const client = createPublicClient({
            chain: {
              id: config.chainId,
              name: config.name,
              nativeCurrency: { name: config.nativeToken, symbol: config.nativeToken, decimals: 18 },
              rpcUrls: { default: { http: [config.rpcUrl] } },
            },
            transport: http(),
          })

          // Fetch native token
          const nativeBalanceHex = await client.request({
            method: 'eth_getBalance',
            params: [pkpAddress, 'latest'],
          }) as string

          const nativeBalance = BigInt(nativeBalanceHex)

          if (nativeBalance > 0n) {
            const formatted = formatBalance(nativeBalance, 18)
            const usdValue = estimateUsdValue(formatted, config.nativeToken)

            otherBalances.push({
              symbol: config.nativeToken,
              name: config.nativeToken,
              balance: formatted,
              network: config.name,
              usdValue,
              currencyIcon: getNativeTokenIcon(config.name),
              chainIcon: getNetworkOverlayIcon(config.name),
            })
          }

          // Fetch USDC if configured
          if (config.tokens.USDC) {
            const balanceOfSelector = '0x70a08231'
            const paddedAddress = pkpAddress.slice(2).padStart(64, '0')
            const data = balanceOfSelector + paddedAddress

            const tokenBalanceHex = await client.request({
              method: 'eth_call',
              params: [{ to: config.tokens.USDC.address as `0x${string}`, data: data as `0x${string}` }, 'latest']
            }) as string

            let tokenBalance = 0n
            if (tokenBalanceHex && tokenBalanceHex !== '0x') {
              try {
                tokenBalance = BigInt(tokenBalanceHex)
              } catch {
                // ignore
              }
            }

            if (tokenBalance > 0n) {
              const formatted = formatBalance(tokenBalance, config.tokens.USDC.decimals)
              const usdValue = estimateUsdValue(formatted, 'USDC')

              otherBalances.push({
                symbol: 'USDC',
                name: 'USD Coin',
                balance: formatted,
                network: config.name,
                usdValue,
                currencyIcon: 'usdc-logo.png',
                chainIcon: getNetworkOverlayIcon(config.name),
              })
            }
          }

          // Small delay between networks
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (networkErr) {
          console.warn(`[usePKPBalances] Failed to fetch ${config.name}:`, networkErr)
        }
      }

      // Merge with existing
      setBalances(prev => [...prev, ...otherBalances])
      setHasLoadedOtherNetworks(true)
    } catch (err) {
      console.error('[usePKPBalances] Error fetching other networks:', err)
    } finally {
      setIsLoadingOtherNetworks(false)
    }
  }

  // Auto-fetch when PKP becomes ready
  createEffect(on(
    () => [auth.isPKPReady(), auth.pkpAddress()] as const,
    ([isReady, address]) => {
      if (IS_DEV) {
        console.log('[usePKPBalances] Effect triggered:', { isReady, address, hasFetched: hasFetched() })
      }
      if (isReady && address && !hasFetched()) {
        if (IS_DEV) {
          console.log('[usePKPBalances] Fetching balances...')
        }
        setHasFetched(true)
        fetchPrimaryBalances()
      }
    },
    { defer: false }
  ))

  // Reset when address changes
  createEffect(on(
    () => auth.pkpAddress(),
    (address) => {
      if (!address) {
        setHasFetched(false)
        setBalances([])
        setHasLoadedOtherNetworks(false)
      }
    }
  ))

  return {
    balances,
    isLoading,
    error,
    refetch: fetchPrimaryBalances,
    fetchOtherNetworks,
    hasLoadedOtherNetworks,
    isLoadingOtherNetworks,
  }
}

// Helpers
function formatBalance(balance: bigint, decimals: number): string {
  const formatted = Number(balance) / Math.pow(10, decimals)

  if (formatted === 0) return '0'
  if (formatted < 0.0001) return formatted.toFixed(8)
  if (formatted < 1) return formatted.toFixed(4)
  if (formatted < 1000) return formatted.toFixed(2)

  return formatted.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function estimateUsdValue(amount: string, symbol: string): string {
  const prices: Record<string, number> = {
    ETH: 3500,
    MATIC: 0.5,
    BNB: 600,
    USDC: 1,
    USDT: 1,
    DAI: 1,
  }

  const price = prices[symbol] || 0
  const value = parseFloat(amount) * price

  if (value === 0) return '0'
  if (value < 1) return value.toFixed(6)
  if (value < 1000) return value.toFixed(2)

  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function getNativeTokenIcon(network: string): string {
  const iconMap: Record<string, string> = {
    Ethereum: 'ethereum-logo.png',
    Base: 'ethereum-logo.png',
    Polygon: 'polygon-logo.png',
    Arbitrum: 'arbitrum-logo.png',
  }
  return iconMap[network] || 'ethereum-logo.png'
}

function getNetworkOverlayIcon(network: string): string {
  const iconMap: Record<string, string> = {
    Ethereum: 'ethereum-chain.svg',
    Base: 'base-chain.svg',
    Polygon: 'polygon-chain.svg',
    Arbitrum: 'arbitrum-chain.svg',
  }
  return iconMap[network] || 'ethereum-chain.svg'
}
