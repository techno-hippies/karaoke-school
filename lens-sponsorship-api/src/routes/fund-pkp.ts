import type { Context } from 'hono'
import { createWalletClient, http, parseEther, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { chains } from '@lens-chain/sdk/viem'
import type { Env } from '../types'

/**
 * Fund PKP Endpoint
 *
 * Sends a small amount of GRASS to a PKP wallet to cover gas for sponsored transactions
 *
 * Flow:
 * 1. Validate PKP address
 * 2. Check if PKP already has sufficient balance
 * 3. Send 0.01 GRASS from admin wallet
 * 4. Return transaction hash
 */
export async function handleFundPKP(c: Context<{ Bindings: Env }>) {
  try {
    // Parse request
    const body = await c.req.json<{ pkpAddress: string }>()
    const { pkpAddress } = body

    console.log('[Fund PKP] Request:', { pkpAddress })

    // Validate input
    if (!pkpAddress || !pkpAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return c.json(
        {
          success: false,
          error: 'Invalid PKP address',
        },
        400
      )
    }

    // Create admin wallet client
    const adminAccount = privateKeyToAccount(c.env.PRIVATE_KEY as Hex)
    const walletClient = createWalletClient({
      account: adminAccount,
      chain: chains.testnet,
      transport: http(c.env.LENS_RPC_URL),
    })

    console.log('[Fund PKP] Funding from admin wallet:', adminAccount.address)

    // Check PKP balance
    const balance = await walletClient.getBalance({
      address: pkpAddress as Hex,
    })

    const minBalance = parseEther('0.005') // 0.005 GRASS minimum
    if (balance >= minBalance) {
      console.log('[Fund PKP] PKP already funded, balance:', balance.toString())
      return c.json({
        success: true,
        alreadyFunded: true,
        balance: balance.toString(),
      })
    }

    // Send 0.01 GRASS to PKP
    const fundAmount = parseEther('0.01')
    const txHash = await walletClient.sendTransaction({
      to: pkpAddress as Hex,
      value: fundAmount,
    })

    console.log('[Fund PKP] ✓ Funded PKP with 0.01 GRASS:', txHash)

    return c.json({
      success: true,
      txHash,
      amount: fundAmount.toString(),
    })
  } catch (error: any) {
    console.error('[Fund PKP] Error:', error)

    return c.json(
      {
        success: false,
        error: error.message || 'Failed to fund PKP',
      },
      500
    )
  }
}
