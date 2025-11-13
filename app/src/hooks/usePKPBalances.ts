import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http } from 'viem'
import { useAuth } from '@/contexts/AuthContext'
import type { TokenBalance } from '@/components/wallet/WalletPageView'

// Network configurations for EVM-compatible chains
// Network configurations for EVM-compatible chains
const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/eth/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'ETH',
    icon: 'ethereum-logo.png',
    tokens: {
      // Default tokens (always show, even with 0 balance)
      USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      USDT: { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
      // Additional tokens (only show if balance > 0)
      WBTC: { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', decimals: 8, additional: true },
      DAI: { address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18, additional: true }
    }
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/base/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'ETH',
    icon: 'base-logo.png',
    tokens: {
      // Default tokens (always show, even with 0 balance)
      USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      USDT: { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6 },  // Bridged USDT on Base
      // Additional tokens (only show if balance > 0)
      WBTC: { address: '0xCBa20e4bB3D7D8a9f49B6b806c2D9aa870596be5', decimals: 8, additional: true },
      DAI: { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, additional: true }
    }
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/polygon/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'MATIC',
    icon: 'polygon-logo.png',
    tokens: {
      // Default tokens (always show, even with 0 balance)
      USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
      USDT: { address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', decimals: 6 },
      // Additional tokens (only show if balance > 0)
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
    additional: true,  // Only show if balance > 0
    tokens: {
      // Default tokens (always show, even with 0 balance)
      USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
      USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
      // Additional tokens (only show if balance > 0)
      WBTC: { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5b0f', decimals: 8, additional: true },
      DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18, additional: true }
    }
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/optm/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'ETH',
    icon: 'ethereum-logo.png', // Use ETH logo for now (no optimism-logo.png)
    additional: true,  // Only show if balance > 0
    tokens: {
      // Only ETH and USDC for Optimism (no USDT, no OP token)
      USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
      // Additional tokens (only show if balance > 0)
      WBTC: { address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095', decimals: 8, additional: true },
      DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18, additional: true }
    }
  },
  bsc: {
    name: 'Binance Smart Chain',  // Use full name
    chainId: 56,
    rpcUrl: 'https://g.w.lavanet.xyz:443/gateway/bsc/rpc-http/15a52e89f0ceb72b359c3b2f773b78cd',
    nativeToken: 'BNB',
    icon: 'bsc-logo.png',
    tokens: {
      // Default tokens (always show, even with 0 balance)
      USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
      USDT: { address: '0x55d398326f99059fF77548524699939b9D89e7c1', decimals: 18 },
      // Additional tokens (only show if balance > 0)
      WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, additional: true },
      DAI: { address: '0x1AF3F329e8BE154074D8769D5737D75A2c938A83', decimals: 18, additional: true }
    }
  },
} as const

type NetworkKey = keyof typeof NETWORK_CONFIGS

interface TokenConfig {
  address: string
  decimals: number
  additional?: boolean  // true = only show if balance > 0
}

interface NetworkConfig {
  name: string
  chainId: number
  rpcUrl: string
  nativeToken: string
  icon: string
  tokens: Record<string, TokenConfig>
  additional?: boolean  // true = only show if balance > 0
}

interface NetworkBalance {
  network: string
  nativeBalance: string
  nativeUsdValue: string
  tokens: Array<{
    symbol: string
    name: string
    balance: string
    usdValue: string
    currencyIcon: string
    chainIcon: string
    network: string
  }>
  error?: string
}

interface UsePKPBalancesReturn {
  balances: TokenBalance[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to fetch PKP balances across multiple EVM networks
 */
export function usePKPBalances(): UsePKPBalancesReturn {
  const { pkpAddress, isPKPReady } = useAuth()
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchBalances = useCallback(async () => {
    if (!pkpAddress || !isPKPReady) {
      setBalances([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('[usePKPBalances] Fetching balances for:', pkpAddress)

      const networkPromises = Object.entries(NETWORK_CONFIGS).map(
        async ([, config]): Promise<NetworkBalance> => {
          try {
            console.log(`[usePKPBalances] Querying ${config.name}...`)

            // Create public client for this network
            const publicClient = createPublicClient({
              chain: {
                id: config.chainId,
                name: config.name,
                nativeCurrency: { name: config.nativeToken, symbol: config.nativeToken, decimals: 18 },
                rpcUrls: { default: { http: [config.rpcUrl] } },
              } as const,
              transport: http(),
            })

            // Fetch native token balance using eth_getBalance RPC
            const nativeBalanceHex = await publicClient.request({
              method: 'eth_getBalance',
              params: [pkpAddress, 'latest'],
            })

      // @ts-expect-error - BigInt formatting
            const nativeBalance = BigInt(nativeBalanceHex)

            const nativeBalanceFormatted = formatBalance(nativeBalance, 18)
            const nativeUsdValue = await estimateUsdValue(nativeBalanceFormatted, config.nativeToken)

            console.log(`[usePKPBalances] ${config.name} native:`, nativeBalanceFormatted, config.nativeToken)

            // Fetch ERC-20 token balances using raw eth_call
            const tokenBalances: NetworkBalance['tokens'] = []
            
            for (const [tokenSymbol, tokenConfig] of Object.entries(config.tokens)) {
              const tokenAddress = tokenConfig.address
              const decimals = tokenConfig.decimals
              
              // Hardcode balanceOf selector to avoid imports
              const balanceOfSelector = '0x70a08231' // keccak256('balanceOf(address)')
              const paddedAddress = pkpAddress.slice(2).padStart(64, '0') // 0x + 32 bytes
              const data = balanceOfSelector + paddedAddress
              
              try {
                const tokenBalanceHex = await publicClient.request({
                  method: 'eth_call',
                  params: [{
                    to: tokenAddress,
                    data: data
                  }, 'latest']
                })
                
                // Handle various response formats and errors
                let tokenBalance: bigint
                if (!tokenBalanceHex || tokenBalanceHex === '0x') {
                  tokenBalance = 0n
                } else if (typeof tokenBalanceHex === 'string' && tokenBalanceHex.startsWith('0x')) {
                  try {
                    tokenBalance = BigInt(tokenBalanceHex)
                  } catch (parseError) {
                    console.warn(`[usePKPBalances] Failed to parse ${tokenSymbol} balance on ${config.name}:`, parseError)
                    continue
                  }
                } else {
                  console.warn(`[usePKPBalances] Unexpected response format for ${tokenSymbol} on ${config.name}:`, tokenBalanceHex)
                  continue
                }
                
                // Check if we should show this token:
                // - Default tokens: always show (even with 0 balance)
                // - Additional tokens: only show if balance > 0
                const shouldShow = !tokenConfig.additional || tokenBalance > 0n
                
                if (shouldShow) {
                  const formattedBalance = formatBalance(tokenBalance, decimals)
                  const usdValue = await estimateUsdValue(formattedBalance, tokenSymbol)
                  
                  tokenBalances.push({
                    symbol: tokenSymbol,
                    name: tokenSymbol,
                    balance: formattedBalance,
                    usdValue,
                    currencyIcon: getTokenIcon(tokenSymbol),
                    chainIcon: getNetworkOverlayIcon(config.name),
                    network: config.name,  // Add network field for consistency
                  })
                  
                  console.log(`[usePKPBalances] ${config.name} ${tokenSymbol}:`, formattedBalance)
                } else {
                  console.log(`[usePKPBalances] ${config.name} ${tokenSymbol}: hidden (additional token with 0 balance)`)
                }
              } catch (tokenError) {
                console.warn(`[usePKPBalances] Failed to fetch ${tokenSymbol} on ${config.name}:`, tokenError)
              }
            }

            return {
              network: config.name,
              nativeBalance: nativeBalanceFormatted,
              nativeUsdValue,
              tokens: tokenBalances,
            }
          } catch (networkError) {
            console.error(`[usePKPBalances] Failed to fetch ${config.name} balances:`, networkError)
            return {
              network: config.name,
              nativeBalance: '0',
              nativeUsdValue: '0',
              tokens: [],
              error: networkError instanceof Error ? networkError.message : 'Unknown error',
            }
          }
        }
      )

      const networkResults = await Promise.all(networkPromises)

      // Combine all balances into the format expected by WalletPageView
      const allBalances: TokenBalance[] = []

      for (const result of networkResults) {
        console.log('[DEBUG] Processing network result:', {
          network: result.network,
          nativeBalance: result.nativeBalance,
          tokenCount: result.tokens.length
        })

        // Always show native token balance (for app's supported networks)
        if (parseFloat(result.nativeBalance) >= 0) {
          // Find network config by matching the name field
          const networkConfig = Object.values(NETWORK_CONFIGS).find(
            config => config.name === result.network
          )
          console.log('[DEBUG] Network config lookup:', {
            network: result.network,
            found: !!networkConfig,
            nativeToken: networkConfig?.nativeToken
          })

          allBalances.push({
            symbol: networkConfig?.nativeToken || 'ETH',
            name: networkConfig?.nativeToken || 'Ether',
            balance: result.nativeBalance,
            network: result.network,
            usdValue: result.nativeUsdValue,
            currencyIcon: getNativeTokenIcon(result.network),
            chainIcon: getNetworkOverlayIcon(result.network),
          })

          console.log('[DEBUG] Added native token:', {
            symbol: networkConfig?.nativeToken,
            network: result.network,
            currencyIcon: getNativeTokenIcon(result.network),
            chainIcon: getNetworkOverlayIcon(result.network)
          })
        }

        // Add token balances
        for (const token of result.tokens) {
          console.log('[DEBUG] Adding token:', token)
        }
        allBalances.push(...result.tokens)
      }

      setBalances(allBalances)
      console.log('[usePKPBalances] Total balances:', allBalances.length, 'assets')
      console.log('[usePKPBalances] Balance objects:', allBalances.map(b => ({
        symbol: b.symbol,
        network: b.network,
        currencyIcon: b.currencyIcon,
        chainIcon: b.chainIcon,
        balance: b.balance
      })))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch balances')
      setError(error)
      console.error('[usePKPBalances] Error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [pkpAddress, isPKPReady])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  return {
    balances,
    isLoading,
    error,
    refetch: fetchBalances,
  }
}

/**
 * Format balance with appropriate decimal places
 */
function formatBalance(balance: bigint, decimals: number): string {
  const formatted = Number(balance) / Math.pow(10, decimals)
  
  if (formatted === 0) return '0'
  if (formatted < 0.0001) return formatted.toFixed(8)
  if (formatted < 1) return formatted.toFixed(4)
  if (formatted < 1000) return formatted.toFixed(2)
  
  return formatted.toLocaleString('en-US', { 
    maximumFractionDigits: 2 
  })
}

/**
 * Estimate USD value (simplified - would need real price feeds in production)
 */
async function estimateUsdValue(amount: string, symbol: string): Promise<string> {
  // Simplified pricing - in production would use price oracles like Chainlink
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
  
  return value.toLocaleString('en-US', { 
    maximumFractionDigits: 2 
  })
}

/**
 * Get token icon filename (circle PNGs) - only for tokens that have images
 */
function getTokenIcon(symbol: string): string {
  const iconMap: Record<string, string> = {
    USDC: 'usdc-logo.png',
    USDT: 'tether-logo.png',  // Using existing tether-logo.png
    WBTC: 'ethereum-logo.png', // Fallback to ETH icon for now
    DAI: 'ethereum-logo.png',  // Fallback to ETH icon for now
  }
  
  return iconMap[symbol] || 'ethereum-logo.png'  // Default to ETH icon
}

/**
 * Get native token icon (circle PNGs)
 */
function getNativeTokenIcon(network: string): string {
  const iconMap: Record<string, string> = {
    Ethereum: 'ethereum-logo.png',
    Base: 'ethereum-logo.png',  // ETH on Base
    Polygon: 'polygon-logo.png',
    Arbitrum: 'arbitrum-logo.png',
    Optimism: 'ethereum-logo.png',  // ETH on Optimism
    'Binance Smart Chain': 'bsc-logo.png',  // BNB on BSC
  }

  return iconMap[network] || 'ethereum-logo.png'
}

/**
 * Get network overlay icon (top-right SVG)
 */
function getNetworkOverlayIcon(network: string): string {
  const iconMap: Record<string, string> = {
    Ethereum: 'ethereum-chain.svg',
    Base: 'base-chain.svg', 
    Polygon: 'polygon-chain.svg',
    Arbitrum: 'arbitrum-chain.svg',  // Use new file
    Optimism: 'optimism-chain.svg',   // Use new file
    'Binance Smart Chain': 'bsc-chain.svg',
  }
  
  return iconMap[network] || 'ethereum-chain.svg'
}
