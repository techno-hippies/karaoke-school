import type { Context } from 'hono'
import { createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { chains } from '@lens-chain/sdk/viem'
import type { Env, SubmitTxRequest, SubmitTxResponse } from '../types'
import { getDb, incrementSponsoredCount, logTransaction } from '../lib/db'

/**
 * Transaction Submission Endpoint
 *
 * Frontend calls this when Lens returns REQUIRES_SIGNATURE
 * Backend submits transaction using funded admin wallet
 *
 * Flow:
 * 1. Validate request
 * 2. Create wallet client with admin key
 * 3. Submit transaction to Lens Chain
 * 4. Increment sponsored count in DB
 * 5. Log transaction
 * 6. Return tx hash
 */
export async function handleSubmitTx(c: Context<{ Bindings: Env }>) {
  try {
    // Parse request
    const body = await c.req.json<SubmitTxRequest>()
    const { account, operation, raw } = body

    console.log('[Submit TX] Request:', { account, operation })

    // Validate input
    if (!account || !operation || !raw) {
      return c.json<SubmitTxResponse>(
        {
          success: false,
          error: 'Missing required fields: account, operation, raw',
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

    console.log('[Submit TX] Submitting with admin wallet:', adminAccount.address)

    // Submit transaction
    const txHash = await walletClient.sendTransaction({
      to: raw.to,
      data: raw.data,
      value: BigInt(raw.value || '0'),
      gas: BigInt(raw.gasLimit),
      maxFeePerGas: BigInt(raw.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(raw.maxPriorityFeePerGas),
    })

    console.log('[Submit TX] ✓ Transaction submitted:', txHash)

    // Update DB
    const sql = getDb(c.env.DATABASE_URL)
    await Promise.all([
      incrementSponsoredCount(sql, account),
      logTransaction(sql, {
        account,
        txHash,
        operation,
        sponsored: true,
      }),
    ])

    return c.json<SubmitTxResponse>({
      success: true,
      txHash,
    })

  } catch (error: any) {
    console.error('[Submit TX] Error:', error)

    // Log failed transaction
    try {
      const body = await c.req.json<SubmitTxRequest>()
      const sql = getDb(c.env.DATABASE_URL)
      await logTransaction(sql, {
        account: body.account,
        operation: body.operation,
        sponsored: false,
        error: error.message,
      })
    } catch (logError) {
      console.error('[Submit TX] Failed to log error:', logError)
    }

    return c.json<SubmitTxResponse>(
      {
        success: false,
        error: error.message || 'Transaction submission failed',
      },
      500
    )
  }
}
