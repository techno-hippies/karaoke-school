import type { Context } from 'hono'
import type { Env, LensAuthRequest, LensAuthResponse } from '../types'
import { getDb, getUserSponsorship, upsertUserSponsorship, updateUserBalance } from '../lib/db'
import { checkQuota } from '../lib/quota'
import { verifyAccountCreatedByPKP } from '../lib/pkp-check'
import { getPKPBalance } from '../lib/balance-check'

/**
 * Lens Authorization Endpoint
 *
 * Called by Lens API to determine if a user should be sponsored
 * Must respond within 500ms with { allowed: boolean, sponsored?: boolean }
 *
 * Flow:
 * 1. Verify account was created by a PKP (anti-spam)
 * 2. Check sponsorship quota from DB
 * 3. If quota exhausted, check PKP balance
 * 4. Return sponsorship decision
 */
export async function handleLensAuth(c: Context<{ Bindings: Env }>) {
  const startTime = Date.now()

  try {
    // Parse request
    const body = await c.req.json<LensAuthRequest>()
    const { account, signedBy } = body

    console.log('[Lens Auth] Request:', { account, signedBy })

    // Get DB connection
    const sql = getDb(c.env.DATABASE_URL)
    const maxSponsoredTxs = parseInt(c.env.MAX_SPONSORED_TXS || '10')
    const minBalanceWei = BigInt(c.env.MIN_BALANCE_WEI || '10000000000000000')

    // Step 1: Verify PKP (parallel with DB query for speed)
    const [isPKP, userSponsorship] = await Promise.all([
      verifyAccountCreatedByPKP(account, signedBy),
      getUserSponsorship(sql, account),
    ])

    if (!isPKP) {
      console.log('[Lens Auth] ❌ Account not created by PKP')
      const response: LensAuthResponse = {
        allowed: false,
        sponsored: false
      }
      return c.json(response)
    }

    console.log('[Lens Auth] ✓ PKP verified')

    // Create sponsorship record if first time
    if (!userSponsorship) {
      await upsertUserSponsorship(sql, account, signedBy)
    }

    // Step 2: Check quota
    const quotaCheck = checkQuota(userSponsorship, maxSponsoredTxs)

    if (quotaCheck.canSponsor) {
      console.log('[Lens Auth] ✓ Can sponsor:', quotaCheck.reason)
      const response: LensAuthResponse = {
        allowed: true,
        sponsored: true,
      }
      console.log(`[Lens Auth] Response time: ${Date.now() - startTime}ms`)
      return c.json(response)
    }

    // Step 3: Quota exhausted - check PKP balance
    console.log('[Lens Auth] Quota exhausted, checking balance...')
    const balance = await getPKPBalance(signedBy, c.env.LENS_RPC_URL)

    // Update balance in DB (for caching)
    await updateUserBalance(sql, account, balance.toString())

    if (balance >= minBalanceWei) {
      console.log('[Lens Auth] ✓ Sufficient balance for self-funding')
      const response: LensAuthResponse = {
        allowed: true,
        sponsored: false, // User pays own gas
      }
      console.log(`[Lens Auth] Response time: ${Date.now() - startTime}ms`)
      return c.json(response)
    }

    // Step 4: Insufficient balance - deny
    console.log('[Lens Auth] ❌ Insufficient balance')
    const response: LensAuthResponse = {
      allowed: false,
      sponsored: false
    }
    console.log(`[Lens Auth] Response time: ${Date.now() - startTime}ms`)
    return c.json(response)

  } catch (error) {
    console.error('[Lens Auth] Error:', error)
    // On error, deny to be safe
    const response: LensAuthResponse = {
      allowed: false,
      sponsored: false
    }
    return c.json(response, 500)
  }
}
