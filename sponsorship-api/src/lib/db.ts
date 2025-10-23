import { neon } from '@neondatabase/serverless'
import type { Address, Hex } from 'viem'
import type { UserSponsorship, TransactionLog } from '../types'

/**
 * Get Neon SQL client
 * Uses HTTP-based connection pooling (optimized for serverless)
 */
export function getDb(databaseUrl: string) {
  return neon(databaseUrl)
}

/**
 * Get user sponsorship record
 */
export async function getUserSponsorship(
  sql: any,
  account: Address
): Promise<UserSponsorship | null> {
  const result = await sql`
    SELECT * FROM user_sponsorships WHERE account = ${account.toLowerCase()}
  ` as any[]
  return result[0] ? (result[0] as UserSponsorship) : null
}

/**
 * Create or update user sponsorship record
 */
export async function upsertUserSponsorship(
  sql: any,
  account: Address,
  pkpAddress: Address
): Promise<void> {
  await sql`
    INSERT INTO user_sponsorships (account, pkp_address)
    VALUES (${account.toLowerCase()}, ${pkpAddress.toLowerCase()})
    ON CONFLICT (account) DO NOTHING
  `
}

/**
 * Increment sponsored transaction count
 */
export async function incrementSponsoredCount(
  sql: any,
  account: Address
): Promise<void> {
  await sql`
    UPDATE user_sponsorships
    SET sponsored_count = sponsored_count + 1,
        last_tx_at = NOW()
    WHERE account = ${account.toLowerCase()}
  `
}

/**
 * Update user balance
 */
export async function updateUserBalance(
  sql: any,
  account: Address,
  balanceWei: string
): Promise<void> {
  await sql`
    UPDATE user_sponsorships
    SET balance_wei = ${balanceWei}
    WHERE account = ${account.toLowerCase()}
  `
}

/**
 * Update POH score
 */
export async function updatePohScore(
  sql: any,
  account: Address,
  pohScore: number
): Promise<void> {
  await sql`
    UPDATE user_sponsorships
    SET poh_score = ${pohScore}
    WHERE account = ${account.toLowerCase()}
  `
}

/**
 * Log transaction
 */
export async function logTransaction(
  sql: any,
  params: {
    account: Address
    txHash?: Hex
    operation: string
    sponsored: boolean
    error?: string
  }
): Promise<void> {
  await sql`
    INSERT INTO transaction_log (account, tx_hash, operation, sponsored, error)
    VALUES (
      ${params.account.toLowerCase()},
      ${params.txHash || null},
      ${params.operation},
      ${params.sponsored},
      ${params.error || null}
    )
  `
}

/**
 * Get transaction count for user (last 24 hours)
 */
export async function getRecentTxCount(
  sql: any,
  account: Address
): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM transaction_log
    WHERE account = ${account.toLowerCase()}
    AND timestamp > NOW() - INTERVAL '24 hours'
  ` as any[]
  return Number(result[0]?.count || 0)
}
