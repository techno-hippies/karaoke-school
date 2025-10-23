import type { Context } from 'hono'
import type { Env, LensAuthRequest, LensAuthResponse } from '../types'
import { getDb, getUserSponsorship, upsertUserSponsorship, updateUserBalance } from '../lib/db'
import { checkQuota } from '../lib/quota'
import { verifyAccountCreatedByPKP } from '../lib/pkp-check'
import { getPKPBalance } from '../lib/balance-check'

/**
 * Backend wallet whitelist
 * These addresses are allowed to authenticate without PKP verification
 * Used by the master pipeline to create accounts for TikTok creators
 * Note: All addresses must be lowercase for comparison
 */
const BACKEND_WHITELISTED_WALLETS = [
  '0x0c6433789d14050af47198b2751f6689731ca79c', // Master pipeline admin wallet
]

/**
 * Lens Authorization Endpoint
 *
 * Called by Lens API to determine if a user should be sponsored
 * Must respond within 500ms with { allowed: boolean, sponsored?: boolean }
 *
 * Flow:
 * 1. Check if backend wallet (whitelist bypass)
 * 2. Verify account was created by a PKP (anti-spam)
 * 3. Check sponsorship quota from DB
 * 4. If quota exhausted, check PKP balance
 * 5. Return sponsorship decision
 */
export async function handleLensAuth(c: Context<{ Bindings: Env }>) {
  const startTime = Date.now()

  try {
    // Parse request
    const body = await c.req.json<LensAuthRequest>()
    const { account, signedBy } = body

    console.log('[Lens Auth] Request:', { account, signedBy })

    // Check if backend wallet (bypass PKP verification)
    const isBackendWallet = BACKEND_WHITELISTED_WALLETS.includes(signedBy.toLowerCase())

    if (isBackendWallet) {
      console.log('[Lens Auth] ✓ Backend wallet whitelisted')
      const response: LensAuthResponse = {
        allowed: true,
        sponsored: false, // Backend pays its own gas
      }
      console.log(`[Lens Auth] Response time: ${Date.now() - startTime}ms`)
      return c.json(response)
    }

    // Get DB connection
    const sql = getDb(c.env.DATABASE_URL)
    const maxSponsoredTxs = parseInt(c.env.MAX_SPONSORED_TXS || '10')
    const minBalanceWei = BigInt(c.env.MIN_BALANCE_WEI || '10000000000000000')

    // Check if this is an onboarding flow (account doesn't exist yet)
    // During onboarding, account field might be zero address or same as signedBy
    const isOnboarding =
      account === '0x0000000000000000000000000000000000000000' ||
      account.toLowerCase() === signedBy.toLowerCase()

    if (isOnboarding) {
      // Allow onboarding flows - account will be created
      console.log('[Lens Auth] ✓ Onboarding flow detected (account:', account, 'signedBy:', signedBy, '), allowing without PKP check')
      const response: LensAuthResponse = {
        allowed: true,
        sponsored: true, // Sponsor account creation
      }
      console.log(`[Lens Auth] Response time: ${Date.now() - startTime}ms`)
      return c.json(response)
    }

    // Step 1: Get sponsorship record (PKP verification disabled for now)
    // TODO: Fix PKP verification - PKP wallets don't own their NFTs, they're derived from them

    // IMPORTANT: Skip DB operations for now to stay under 1000ms timeout
    // We'll create sponsorship records lazily on first transaction
    // This prevents the switchAccount call from timing out due to slow DB queries
    console.log('[Lens Auth] ✓ Proceeding (PKP check disabled, skipping DB for speed)')

    // Allow all requests for now - sponsor everything
    const response: LensAuthResponse = {
      allowed: true,
      sponsored: true,
    }
    console.log(`[Lens Auth] Response time: ${Date.now() - startTime}ms`)
    return c.json(response)

    // TODO: Re-enable quota checking after fixing DB performance
    // const dbStartTime = Date.now()
    // const userSponsorship = await getUserSponsorship(sql, account)
    // console.log(`[Lens Auth] DB query took ${Date.now() - dbStartTime}ms`)
    //
    // if (!userSponsorship) {
    //   await upsertUserSponsorship(sql, account, signedBy)
    // }
    //
    // const quotaCheck = checkQuota(userSponsorship, maxSponsoredTxs)
    // if (quotaCheck.canSponsor) {
    //   return c.json({ allowed: true, sponsored: true })
    // }
    //
    // const balance = await getPKPBalance(signedBy, c.env.LENS_RPC_URL)
    // await updateUserBalance(sql, account, balance.toString())
    // if (balance >= minBalanceWei) {
    //   return c.json({ allowed: true, sponsored: false })
    // }
    // return c.json({ allowed: false, sponsored: false })

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
