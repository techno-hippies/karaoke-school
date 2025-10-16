/**
 * Subscription Query Module
 * Read-only operations for Unlock Protocol locks
 */

import { createPublicClient, http, formatEther } from 'viem'
import { baseSepolia } from 'viem/chains'

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

/**
 * Minimal PublicLock ABI for reading state
 */
const PUBLIC_LOCK_ABI = [
  {
    inputs: [{ type: 'address', name: '_keyOwner' }],
    name: 'getHasValidKey',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'keyPrice',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'expirationDuration',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tokenAddress',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ type: 'address', name: '_keyOwner' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export interface LockInfo {
  keyPrice: bigint
  keyPriceFormatted: string
  expirationDuration: bigint
  durationDays: number
  tokenAddress: string
  isNativePayment: boolean
}

/**
 * Check if user has valid subscription key
 * Similar to checkSongOwnership in credits/queries.ts
 */
export async function checkSubscription(
  lockAddress: string,
  userAddress: string
): Promise<boolean> {
  try {
    const hasKey = await publicClient.readContract({
      address: lockAddress as `0x${string}`,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'getHasValidKey',
      args: [userAddress as `0x${string}`],
    })

    console.log('[Subscription] Check subscription:', {
      lockAddress,
      userAddress,
      hasValidKey: hasKey,
    })

    return hasKey as boolean
  } catch (error) {
    console.error('[Subscription] Failed to check subscription:', error)
    return false
  }
}

/**
 * Get lock pricing and duration info
 */
export async function getLockInfo(lockAddress: string): Promise<LockInfo> {
  const [keyPrice, expirationDuration, tokenAddress] = await Promise.all([
    publicClient.readContract({
      address: lockAddress as `0x${string}`,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'keyPrice',
    }),
    publicClient.readContract({
      address: lockAddress as `0x${string}`,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'expirationDuration',
    }),
    publicClient.readContract({
      address: lockAddress as `0x${string}`,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'tokenAddress',
    }),
  ])

  const isNativePayment = tokenAddress === '0x0000000000000000000000000000000000000000'
  const durationDays = Number(expirationDuration) / (60 * 60 * 24)

  return {
    keyPrice: keyPrice as bigint,
    keyPriceFormatted: formatEther(keyPrice as bigint),
    expirationDuration: expirationDuration as bigint,
    durationDays,
    tokenAddress: tokenAddress as string,
    isNativePayment,
  }
}

/**
 * Get number of keys owned by address
 */
export async function getKeyBalance(
  lockAddress: string,
  userAddress: string
): Promise<number> {
  try {
    const balance = await publicClient.readContract({
      address: lockAddress as `0x${string}`,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    })

    return Number(balance)
  } catch (error) {
    console.error('[Subscription] Failed to get key balance:', error)
    return 0
  }
}
