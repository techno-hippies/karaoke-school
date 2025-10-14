/**
 * Credit Query Module
 * Read-only operations for credits, balances, and packages
 */

import { createPublicClient, http, formatUnits } from 'viem'
import { baseSepolia } from 'viem/chains'

const KARAOKE_CREDITS_CONTRACT = import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT as `0x${string}`
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`

/**
 * Fetch USDC balance for an address
 */
export async function getUSDCBalance(address: string): Promise<string> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: [{
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  }) as bigint

  return formatUnits(balance, 6)
}

/**
 * Get credit balance for a user
 */
export async function getCreditBalance(address: string): Promise<number> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  const balance = await publicClient.readContract({
    address: KARAOKE_CREDITS_CONTRACT,
    abi: [{
      name: 'credits',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'user', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'credits',
    args: [address as `0x${string}`],
  }) as bigint

  return Number(balance)
}

/**
 * Check if user owns a song (song-level ownership)
 */
export async function checkSongOwnership(address: string, geniusId: number): Promise<boolean> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  const owned = await publicClient.readContract({
    address: KARAOKE_CREDITS_CONTRACT,
    abi: [{
      name: 'ownsSong',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'user', type: 'address' },
        { name: 'geniusId', type: 'uint32' }
      ],
      outputs: [{ name: '', type: 'bool' }],
    }],
    functionName: 'ownsSong',
    args: [address as `0x${string}`, geniusId],
  }) as boolean

  return owned
}

/**
 * Get all credit packages from contract
 */
export async function getAllPackages() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  // Get package count first
  const packageCount = await publicClient.readContract({
    address: KARAOKE_CREDITS_CONTRACT,
    abi: [{
      name: 'packageCount',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint8' }],
    }],
    functionName: 'packageCount',
  }) as number

  // Fetch all packages
  const packages = []
  for (let i = 0; i < packageCount; i++) {
    const data = await publicClient.readContract({
      address: KARAOKE_CREDITS_CONTRACT,
      abi: [{
        name: 'packages',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'packageId', type: 'uint8' }],
        outputs: [
          { name: 'credits', type: 'uint16' },
          { name: 'priceUSDC', type: 'uint256' },
          { name: 'priceETH', type: 'uint256' },
          { name: 'enabled', type: 'bool' },
        ],
      }],
      functionName: 'packages',
      args: [i],
    }) as [number, bigint, bigint, boolean]

    const [credits, priceUSDC, priceETH, enabled] = data

    packages.push({
      id: i,
      credits,
      priceUSDC: formatUnits(priceUSDC, 6),
      priceETH: formatUnits(priceETH, 18),
      enabled,
    })
  }

  return packages
}
