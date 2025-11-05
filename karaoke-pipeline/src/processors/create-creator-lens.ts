#!/usr/bin/env bun
/**
 * Create Lens Accounts for TikTok Creators
 *
 * Creates Lens Protocol accounts for TikTok creators with PKPs
 * Prerequisites:
 *   - Creator has PKP (pkp_address IS NOT NULL)
 *   - Creator has no Lens account yet (lens_handle IS NULL)
 *
 * Process:
 *   1. Query creators with PKP but no Lens account
 *   2. Use TikTok handle as Lens handle (already sanitized)
 *   3. Build metadata JSON with creator identifiers
 *   4. Upload metadata to Grove
 *   5. Create Lens account with username
 *   6. Store Lens data in lens_accounts table
 *   7. Update tiktok_creators table with Lens references
 *
 * Usage:
 *   bun src/processors/create-creator-lens.ts --limit=20
 *   bun src/processors/create-creator-lens.ts --username=charleenweiss
 */

import { parseArgs } from 'util';
import { query } from '../db/neon';
import { createLensAccount } from '../lib/lens-protocol';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '20' },
      username: { type: 'string' },
    },
  });

  const limit = parseInt(values.limit || '20');
  const targetUsername = values.username;

  if (targetUsername) {
    console.log(`\n🌿 Creating Lens account for @${targetUsername}\n`);
  } else {
    console.log(`\n🌿 Creating Lens accounts for TikTok creators (limit: ${limit})\n`);
  }

  // 1. Find creators with PKP but no Lens account
  const creators = await query<{
    username: string;
    nickname: string | null;
    sec_uid: string;
    follower_count: number | null;
    pkp_address: string;
    pkp_token_id: string;
    grove_avatar_url: string | null;
  }>(`
    SELECT
      tc.username,
      tc.nickname,
      tc.sec_uid,
      tc.follower_count,
      tc.grove_avatar_url,
      pkp.pkp_address,
      pkp.pkp_token_id
    FROM tiktok_creators tc
    INNER JOIN pkp_accounts pkp ON tc.pkp_account_id = pkp.id
    WHERE tc.pkp_account_id IS NOT NULL  -- Has PKP
      AND tc.lens_account_id IS NULL  -- No Lens account yet
      ${targetUsername ? 'AND tc.username = $2' : ''}
    ORDER BY tc.follower_count DESC NULLS LAST
    LIMIT $1
  `, targetUsername ? [limit, targetUsername] : [limit]);

  if (creators.length === 0) {
    console.log('✅ No TikTok creators need Lens account creation\n');
    process.exit(0);
  }

  console.log(`Found ${creators.length} creators ready for Lens:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const creator of creators) {
    console.log(`\n📍 @${creator.username} ${creator.nickname ? `(${creator.nickname})` : ''}`);

    try {
      // 2. Use TikTok username directly (already lowercase, URL-safe)
      const handle = creator.username;
      console.log(`   🏷️  Handle: @${handle}`);

      // 3. Build minimal metadata attributes
      // Strategy: Lens metadata just references basic creator info
      // TikTok creators don't have GRC-20 entities (only artists do)
      const attributes = [
        { type: 'String', key: 'pkpAddress', value: creator.pkp_address },
        { type: 'String', key: 'accountType', value: 'tiktok-creator' },
        { type: 'String', key: 'tiktokHandle', value: creator.username },
      ];

      // 4. Create Lens account
      console.log('   ⏳ Creating Lens account...');
      const lensData = await createLensAccount({
        handle,
        name: creator.nickname || creator.username,
        bio: `TikTok creator @${creator.username} on Karaoke School`,
        // Use Grove avatar if available
        pictureUri: creator.grove_avatar_url || undefined,
        attributes,
      });

      // 5. Insert into lens_accounts and get ID
      const lensAccountResult = await query<{ id: number }>(`
        INSERT INTO lens_accounts (
          account_type,
          tiktok_handle,
          pkp_address,
          lens_handle,
          lens_account_address,
          lens_account_id,
          lens_metadata_uri,
          transaction_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        'tiktok_creator',
        creator.username,
        creator.pkp_address,
        lensData.lensHandle,
        lensData.lensAccountAddress,
        lensData.lensAccountId,
        lensData.metadataUri,
        lensData.transactionHash,
      ]);

      const lensAccountId = lensAccountResult[0].id;

      // 6. Update tiktok_creators table with foreign key
      await query(`
        UPDATE tiktok_creators
        SET lens_account_id = $1
        WHERE username = $2
      `, [lensAccountId, creator.username]);

      console.log(`   ✅ Lens account created: @${lensData.lensHandle}`);
      console.log(`   📍 Address: ${lensData.lensAccountAddress}`);
      console.log(`   📜 Tx: ${lensData.transactionHash}`);
      console.log(`   🗄️  Metadata: ${lensData.metadataUri}`);
      console.log(`   💾 Lens Account ID: ${lensAccountId}`);

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
