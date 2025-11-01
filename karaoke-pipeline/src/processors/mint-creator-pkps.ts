#!/usr/bin/env bun
/**
 * Mint PKPs for TikTok Creators
 *
 * Creates Lit Protocol PKPs (Programmable Key Pairs) for TikTok creators
 * Prerequisites:
 *   - Creator exists in tiktok_creators
 *   - Creator has no PKP yet (pkp_address IS NULL)
 *
 * Process:
 *   1. Query creators without PKPs from tiktok_creators
 *   2. Initialize Lit Protocol client (Chronicle Yellowstone)
 *   3. Mint PKP for each creator
 *   4. Store PKP data in pkp_accounts table
 *   5. Update tiktok_creators table with PKP reference
 *
 * Usage:
 *   bun src/processors/mint-creator-pkps.ts --limit=20
 */

import { parseArgs } from 'util';
import { query } from '../db/neon';
import { mintPKP } from '../lib/lit-protocol';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '20' },
    },
  });

  const limit = parseInt(values.limit || '20');

  console.log(`\n🎬 Minting PKPs for TikTok creators (limit: ${limit})\n`);

  // 1. Find creators without PKPs
  const creators = await query<{
    tiktok_handle: string;
    name: string | null;
    sec_uid: string;
  }>(`
    SELECT
      tc.tiktok_handle,
      tc.name,
      tc.sec_uid
    FROM tiktok_creators tc
    LEFT JOIN pkp_accounts pkp ON tc.tiktok_handle = pkp.tiktok_handle
      AND pkp.account_type = 'tiktok_creator'
    WHERE tc.tiktok_handle IS NOT NULL
      AND pkp.pkp_address IS NULL  -- No PKP yet
    ORDER BY tc.name ASC
    LIMIT $1
  `, [limit]);

  if (creators.length === 0) {
    console.log('✅ No TikTok creators need PKP minting\n');
    process.exit(0);
  }

  console.log(`Found ${creators.length} creators without PKPs:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const creator of creators) {
    console.log(`\n📍 @${creator.tiktok_handle} ${creator.name ? `(${creator.name})` : ''}`);

    try {
      // 2. Mint PKP
      console.log('   ⏳ Minting PKP on Chronicle Yellowstone...');
      const pkpData = await mintPKP();

      // 3. Insert into pkp_accounts
      await query(`
        INSERT INTO pkp_accounts (
          account_type,
          tiktok_handle,
          pkp_address,
          pkp_token_id,
          pkp_public_key,
          pkp_owner_eoa,
          transaction_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        'tiktok_creator',
        creator.tiktok_handle,
        pkpData.pkpAddress,
        pkpData.pkpTokenId,
        pkpData.pkpPublicKey,
        pkpData.ownerEOA,
        pkpData.transactionHash,
      ]);

      // 4. Update tiktok_creators table
      await query(`
        UPDATE tiktok_creators
        SET pkp_address = $1
        WHERE tiktok_handle = $2
      `, [pkpData.pkpAddress, creator.tiktok_handle]);

      console.log(`   ✅ PKP minted: ${pkpData.pkpAddress}`);
      console.log(`   🔗 Token ID: ${pkpData.pkpTokenId}`);
      console.log(`   📜 Tx: ${pkpData.transactionHash}`);

      successCount++;

    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(errorCount > 0 ? 1 : 0);
}

main();
