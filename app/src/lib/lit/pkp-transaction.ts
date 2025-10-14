/**
 * PKP Transaction Utilities
 * Helper functions for executing transactions signed by PKP
 */

import { createPKPWalletClient } from '@/lib/lit-webauthn/signer-pkp'
import type { PKPAuthContext, PKPInfo } from '@/lib/lit-webauthn/types'
import type { Hex, Address } from 'viem'
import { baseSepolia } from 'viem/chains'

const IS_DEV = import.meta.env.DEV

export interface ExecuteTransactionParams {
  to: Address
  data: Hex
  value?: bigint
  pkpAuthContext: PKPAuthContext
  pkpInfo: PKPInfo
}

/**
 * Execute a transaction signed by PKP
 * @returns Transaction hash
 */
export async function executeTransactionWithPKP({
  to,
  data,
  value = 0n,
  pkpAuthContext,
  pkpInfo,
}: ExecuteTransactionParams): Promise<Hex> {
  if (IS_DEV) {
    console.log('[PKPTransaction] Executing transaction:', {
      to,
      value: value.toString(),
      dataLength: data.length,
    })
  }

  // Create PKP wallet client
  const walletClient = await createPKPWalletClient(
    pkpInfo,
    pkpAuthContext,
    baseSepolia
  )

  // Fetch current nonce to avoid nonce collisions
  const { createPublicClient, http } = await import('viem')
  const { getTransactionCount } = await import('viem/actions')

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  const nonce = await getTransactionCount(publicClient, {
    address: pkpInfo.ethAddress as Address,
    blockTag: 'pending', // Include pending transactions
  })

  if (IS_DEV) {
    console.log('[PKPTransaction] Using nonce:', nonce)
  }

  // Send transaction with explicit nonce
  const hash = await walletClient.sendTransaction({
    account: walletClient.account!,
    to,
    data,
    value,
    chain: baseSepolia,
    nonce, // Explicitly set nonce
  })

  if (IS_DEV) {
    console.log('[PKPTransaction] ✅ Transaction sent:', hash)
  }

  return hash
}
