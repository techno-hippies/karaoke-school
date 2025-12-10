import { createPublicClient, http, type Address } from 'viem'
import { chains } from '@lens-chain/sdk/viem'

/**
 * Check PKP balance on Lens Chain
 */
export async function getPKPBalance(
  pkpAddress: Address,
  rpcUrl: string
): Promise<bigint> {
  try {
    const client = createPublicClient({
      chain: chains.testnet,
      transport: http(rpcUrl),
    })

    const balance = await client.getBalance({ address: pkpAddress })
    return balance
  } catch (error) {
    console.error('[Balance Check] Error fetching balance:', error)
    return 0n
  }
}

/**
 * Check if PKP has minimum balance for self-funded transactions
 */
export async function hasMinimumBalance(
  pkpAddress: Address,
  minBalanceWei: bigint,
  rpcUrl: string
): Promise<boolean> {
  const balance = await getPKPBalance(pkpAddress, rpcUrl)
  return balance >= minBalanceWei
}
