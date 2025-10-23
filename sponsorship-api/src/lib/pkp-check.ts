import { createPublicClient, http, type Address } from 'viem'
import { defineChain } from 'viem/utils'

/**
 * Chronicle Yellowstone Testnet (Lit Protocol PKP chain)
 */
export const chronicleYellowstone = defineChain({
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'tstLPX', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com'] },
  },
  blockExplorers: {
    default: {
      name: 'Chronicle Explorer',
      url: 'https://yellowstone-explorer.litprotocol.com',
    },
  },
  testnet: true,
})

/**
 * PKP NFT Contract on Chronicle Yellowstone
 * Source: https://github.com/LIT-Protocol/lit-assets
 */
const PKP_NFT_ADDRESS = '0xc5bcc5e3200b1c8e42d3d33c9989e2e1c5d8a459' as Address

/**
 * Check if an address owns a PKP NFT
 * This verifies the address is a valid Lit Protocol PKP
 */
export async function isPKPAddress(address: Address): Promise<boolean> {
  try {
    const client = createPublicClient({
      chain: chronicleYellowstone,
      transport: http(),
    })

    // Query balanceOf(address) on PKP NFT contract
    const balance = await client.readContract({
      address: PKP_NFT_ADDRESS,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [address],
    })

    // PKP addresses have exactly 1 NFT associated
    return balance === 1n
  } catch (error) {
    console.error('[PKP Check] Error checking PKP:', error)
    return false
  }
}

/**
 * Verify account was created by a PKP
 * For now, we trust the signedBy address from Lens
 * In production, we could:
 * 1. Query Lens account creation event logs to get creator address
 * 2. Verify creator owns a PKP NFT
 * 3. Store verified PKP addresses in DB for faster lookups
 *
 * Current implementation: Check if signedBy is a valid PKP
 */
export async function verifyAccountCreatedByPKP(
  accountAddress: Address,
  signedBy: Address
): Promise<boolean> {
  // Check if signedBy address owns a PKP NFT
  return await isPKPAddress(signedBy)
}
