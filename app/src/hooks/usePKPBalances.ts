import { useState, useEffect, useCallback, useRef } from 'react'
import { createPublicClient, http } from 'viem'
import { useAuth } from '@/contexts/AuthContext'
import type { TokenBalance } from '@/components/wallet/WalletPageView'

// Primary tokens - fetched immediately on load
const PRIMARY_NETWORK = 'base'
const PRIMARY_TOKENS = ['ETH', 'USDC'] as const

// Network configurations for EVM-compatible chains
const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/base/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'ETH',
    icon: 'base-logo.png',
    tokens: {
      USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      USDT: { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6, additional: true },
      WBTC: { address: '0xCBa20e4bB3D7D8a9f49B6b806c2D9aa870596be5', decimals: 8, additional: true },
      DAI: { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, additional: true }
    }
  },
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/eth/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'ETH',
    icon: 'ethereum-logo.png',
    additional: true,
    tokens: {
      USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      USDT: { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
      WBTC: { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', decimals: 8, additional: true },
      DAI: { address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18, additional: true }
    }
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/polygon/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'MATIC',
    icon: 'polygon-logo.png',
    additional: true,
    tokens: {
      USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
      USDT: { address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', decimals: 6 },
      WBTC: { address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8, additional: true },
      DAI: { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18, additional: true }
    }
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/arbitrum/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'ETH',
    icon: 'arbitrum-logo.png',
    additional: true,
    tokens: {
      USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
      USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
      WBTC: { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5b0f', decimals: 8, additional: true },
      DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18, additional: true }
    }
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/optm/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'ETH',
    icon: 'ethereum-logo.png',
    additional: true,
    tokens: {
      USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
      WBTC: { address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095', decimals: 8, additional: true },
      DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18, additional: true }
    }
  },
  bsc: {
    name: 'Binance Smart Chain',
    chainId: 56,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/bsc/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'BNB',
    icon: 'bsc-logo.png',
    additional: true,
    tokens: {
      USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
      USDT: { address: '0x55d398326f99059fF77548524699939b9D89e7c1', decimals: 18 },
      WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, additional: true },
      DAI: { address: '0x1AF3F329e8BE154074D8769D5737D75A2c938A83', decimals: 18, additional: true }
    }
  },
} as const

interface TokenConfig {
  address: string
  decimals: number
  additional?: boolean
}

interface NetworkConfig {
  name: string
  chainId: number
  rpcUrl: string
  nativeToken: string
  icon: string
  tokens: Record<string, TokenConfig>
  additional?: boolean
}

interface UsePKPBalancesReturn {
  balances: TokenBalance[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
  fetchOtherNetworks: () => Promise<void>
  hasLoadedOtherNetworks: boolean
  isLoadingOtherNetworks: boolean
}

/**
 * Hook to fetch PKP balances across multiple EVM networks
 * Initially only fetches primary tokens (Base ETH, Base USDC)
 * Other networks are loaded on demand via fetchOtherNetworks()
 */
export function usePKPBalances(): UsePKPBalancesReturn {
  const { pkpAddress, isPKPReady } = useAuth()
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingOtherNetworks, setIsLoadingOtherNetworks] = useState(false)
  const [hasLoadedOtherNetworks, setHasLoadedOtherNetworks] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const fetchedRef = useRef(false)

  // Fetch only primary tokens (Base ETH + Base USDC)
  const fetchPrimaryBalances = useCallback(async () => {
    if (!pkpAddress || !isPKPReady) {
      setBalances([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('[usePKPBalances] Fetching primary balances for:', pkpAddress)

      const config = NETWORK_CONFIGS[PRIMARY_NETWORK]
      const publicClient = createPublicClient({
        chain: {
          id: config.chainId,
          name: config.name,
          nativeCurrency: { name: config.nativeToken, symbol: config.nativeToken, decimals: 18 },
          rpcUrls: { default: { http: [config.rpcUrl] } },
        } as const,
        transport: http(),
      })

      const primaryBalances: TokenBalance[] = []

      // Fetch ETH balance
      const nativeBalanceHex = await publicClient.request({
        method: 'eth_getBalance',
        params: [pkpAddress, 'latest'],
      })
      // @ts-expect-error - BigInt formatting
      const nativeBalance = BigInt(nativeBalanceHex)
      const nativeBalanceFormatted = formatBalance(nativeBalance, 18)
      const nativeUsdValue = await estimateUsdValue(nativeBalanceFormatted, 'ETH')

      primaryBalances.push({
        symbol: 'ETH',
        name: 'ETH',
        balance: nativeBalanceFormatted,
        network: config.name,
        usdValue: nativeUsdValue,
        currencyIcon: getNativeTokenIcon(config.name),
        chainIcon: getNetworkOverlayIcon(config.name),
      })

      // Fetch USDC balance
      const usdcConfig = config.tokens.USDC
      const balanceOfSelector = '0x70a08231'
      const paddedAddress = pkpAddress.slice(2).padStart(64, '0')
      const data = balanceOfSelector + paddedAddress

      const usdcBalanceHex = await publicClient.request({
        method: 'eth_call',
        params: [{ to: usdcConfig.address, data }, 'latest']
      })

      let usdcBalance = 0n
      if (usdcBalanceHex && usdcBalanceHex !== '0x' && typeof usdcBalanceHex === 'string') {
        try {
          usdcBalance = BigInt(usdcBalanceHex)
        } catch {
          // ignore parse errors
        }
      }

      const usdcFormatted = formatBalance(usdcBalance, usdcConfig.decimals)
      const usdcUsdValue = await estimateUsdValue(usdcFormatted, 'USDC')

      primaryBalances.push({
        symbol: 'USDC',
        name: 'USDC',
        balance: usdcFormatted,
        network: config.name,
        usdValue: usdcUsdValue,
        currencyIcon: getTokenIcon('USDC'),
        chainIcon: getNetworkOverlayIcon(config.name),
      })

      console.log('[usePKPBalances] Primary balances loaded:', primaryBalances)
      setBalances(primaryBalances)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch balances')
      setError(error)
      console.error('[usePKPBalances] Error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [pkpAddress, isPKPReady])

  // Fetch other networks on demand
  const fetchOtherNetworks = useCallback(async () => {
    if (!pkpAddress || !isPKPReady || hasLoadedOtherNetworks || isLoadingOtherNetworks) {
      return
    }

    setIsLoadingOtherNetworks(true)

    try {
      console.log('[usePKPBalances] Fetching other networks...')

      const otherBalances: TokenBalance[] = []

      for (const [networkKey, config] of Object.entries(NETWORK_CONFIGS)) {
        // Skip primary network (already loaded)
        if (networkKey === PRIMARY_NETWORK) continue

        try {
          console.log(`[usePKPBalances] Querying ${config.name}...`)

          const publicClient = createPublicClient({
            chain: {
              id: config.chainId,
              name: config.name,
              nativeCurrency: { name: config.nativeToken, symbol: config.nativeToken, decimals: 18 },
              rpcUrls: { default: { http: [config.rpcUrl] } },
            } as const,
            transport: http(),
          })

          // Fetch native token balance
          const nativeBalanceHex = await publicClient.request({
            method: 'eth_getBalance',
            params: [pkpAddress, 'latest'],
          })
          // @ts-expect-error - BigInt formatting
          const nativeBalance = BigInt(nativeBalanceHex)

          // Only add if balance > 0 (since these are additional networks)
          if (nativeBalance > 0n) {
            const nativeBalanceFormatted = formatBalance(nativeBalance, 18)
            const nativeUsdValue = await estimateUsdValue(nativeBalanceFormatted, config.nativeToken)

            otherBalances.push({
              symbol: config.nativeToken,
              name: config.nativeToken,
              balance: nativeBalanceFormatted,
              network: config.name,
              usdValue: nativeUsdValue,
              currencyIcon: getNativeTokenIcon(config.name),
              chainIcon: getNetworkOverlayIcon(config.name),
            })
          }

          // Fetch ERC-20 token balances
          const balanceOfSelector = '0x70a08231'
          const paddedAddress = pkpAddress.slice(2).padStart(64, '0')
          const data = balanceOfSelector + paddedAddress

          for (const [tokenSymbol, tokenConfig] of Object.entries(config.tokens)) {
            try {
              const tokenBalanceHex = await publicClient.request({
                method: 'eth_call',
                params: [{ to: tokenConfig.address, data }, 'latest']
              })

              let tokenBalance = 0n
              if (tokenBalanceHex && tokenBalanceHex !== '0x' && typeof tokenBalanceHex === 'string') {
                try {
                  tokenBalance = BigInt(tokenBalanceHex)
                } catch {
                  continue
                }
              }

              // Only show tokens with balance > 0
              if (tokenBalance > 0n) {
                const formattedBalance = formatBalance(tokenBalance, tokenConfig.decimals)
                const usdValue = await estimateUsdValue(formattedBalance, tokenSymbol)

                otherBalances.push({
                  symbol: tokenSymbol,
                  name: tokenSymbol,
                  balance: formattedBalance,
                  network: config.name,
                  usdValue,
                  currencyIcon: getTokenIcon(tokenSymbol),
                  chainIcon: getNetworkOverlayIcon(config.name),
                })
              }
            } catch {
              // Skip failed token fetches
            }
          }

          // Small delay between networks
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (networkError) {
          console.warn(`[usePKPBalances] Failed to fetch ${config.name}:`, networkError)
        }
      }

      console.log('[usePKPBalances] Other networks loaded:', otherBalances.length, 'tokens with balance')

      // Merge with existing primary balances
      setBalances(prev => [...prev, ...otherBalances])
      setHasLoadedOtherNetworks(true)
    } catch (err) {
      console.error('[usePKPBalances] Error fetching other networks:', err)
    } finally {
      setIsLoadingOtherNetworks(false)
    }
  }, [pkpAddress, isPKPReady, hasLoadedOtherNetworks, isLoadingOtherNetworks])

  // Auto-fetch primary balances on mount
  useEffect(() => {
    if (!fetchedRef.current && isPKPReady && pkpAddress) {
      fetchedRef.current = true
      fetchPrimaryBalances()
    }
  }, [fetchPrimaryBalances, isPKPReady, pkpAddress])

  // Reset when address changes
  useEffect(() => {
    if (!pkpAddress) {
      fetchedRef.current = false
      setBalances([])
      setHasLoadedOtherNetworks(false)
    }
  }, [pkpAddress])

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

function formatBalance(balance: bigint, decimals: number): string {
  const formatted = Number(balance) / Math.pow(10, decimals)

  if (formatted === 0) return '0'
  if (formatted < 0.0001) return formatted.toFixed(8)
  if (formatted < 1) return formatted.toFixed(4)
  if (formatted < 1000) return formatted.toFixed(2)

  return formatted.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

async function estimateUsdValue(amount: string, symbol: string): Promise<string> {
  const prices: Record<string, number> = {
    ETH: 3000,
    MATIC: 0.8,
    BNB: 600,
    USDC: 1,
    USDT: 1,
    DAI: 1,
    WBTC: 90000,
  }

  const price = prices[symbol] || 0
  const value = parseFloat(amount) * price

  if (value === 0) return '0'
  if (value < 1) return value.toFixed(6)
  if (value < 1000) return value.toFixed(2)

  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function getTokenIcon(symbol: string): string {
  const iconMap: Record<string, string> = {
    USDC: 'usdc-logo.png',
    USDT: 'tether-logo.png',
    WBTC: 'ethereum-logo.png',
    DAI: 'ethereum-logo.png',
  }
  return iconMap[symbol] || 'ethereum-logo.png'
}

function getNativeTokenIcon(network: string): string {
  const iconMap: Record<string, string> = {
    Ethereum: 'ethereum-logo.png',
    Base: 'ethereum-logo.png',
    Polygon: 'polygon-logo.png',
    Arbitrum: 'arbitrum-logo.png',
    Optimism: 'ethereum-logo.png',
    'Binance Smart Chain': 'bsc-logo.png',
  }
  return iconMap[network] || 'ethereum-logo.png'
}

function getNetworkOverlayIcon(network: string): string {
  const iconMap: Record<string, string> = {
    Ethereum: 'ethereum-chain.svg',
    Base: 'base-chain.svg',
    Polygon: 'polygon-chain.svg',
    Arbitrum: 'arbitrum-chain.svg',
    Optimism: 'optimism-chain.svg',
    'Binance Smart Chain': 'bsc-chain.svg',
  }
  return iconMap[network] || 'ethereum-chain.svg'
}
