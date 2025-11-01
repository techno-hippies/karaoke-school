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
 */

import { parseArgs } from 'util';
import { query } from '../db/neon';
import { createLensAccount } from '../lib/lens-protocol';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '20' },
    },
  });

  const limit = parseInt(values.limit || '20');

  console.log(`\n🌿 Creating Lens accounts for TikTok creators (limit: ${limit})\n`);

  // 1. Find creators with PKP but no Lens account
  const creators = await query<{
    tiktok_handle: string;
    name: string | null;
    sec_uid: string;
    follower_count: number | null;
    pkp_address: string;
    pkp_token_id: string;
  }>(`
    SELECT
      tc.tiktok_handle,
      tc.name,
      tc.sec_uid,
      tc.follower_count,
      pkp.pkp_address,
      pkp.pkp_token_id
    FROM tiktok_creators tc
    INNER JOIN pkp_accounts pkp ON tc.tiktok_handle = pkp.tiktok_handle
      AND pkp.account_type = 'tiktok_creator'
    LEFT JOIN lens_accounts lens ON tc.tiktok_handle = lens.tiktok_handle
      AND lens.account_type = 'tiktok_creator'
    WHERE lens.lens_handle IS NULL  -- No Lens account yet
      AND pkp.pkp_address IS NOT NULL  -- Has PKP
    ORDER BY tc.follower_count DESC NULLS LAST
    LIMIT $1
  `, [limit]);

  if (creators.length === 0) {
    console.log('✅ No TikTok creators need Lens account creation\n');
    process.exit(0);
  }

  console.log(`Found ${creators.length} creators ready for Lens:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const creator of creators) {
    console.log(`\n📍 @${creator.tiktok_handle} ${creator.name ? `(${creator.name})` : ''}`);

    try {
      // 2. Use TikTok handle directly (already lowercase, URL-safe)
      const handle = creator.tiktok_handle;
      console.log(`   🏷️  Handle: @${handle}`);

      // 3. Build metadata attributes
      const attributes = [
        { type: 'String', key: 'pkpAddress', value: creator.pkp_address },
        { type: 'String', key: 'tiktokHandle', value: creator.tiktok_handle },
        { type: 'String', key: 'tiktokSecUid', value: creator.sec_uid },
        { type: 'String', key: 'creatorType', value: 'tiktok-creator' },
      ];

      if (creator.follower_count) {
        attributes.push({
          type: 'Number',
          key: 'followerCount',
          value: creator.follower_count.toString()
        });
      }

      // 4. Create Lens account
      console.log('   ⏳ Creating Lens account...');
      const lensData = await createLensAccount({
        handle,
        name: creator.name || creator.tiktok_handle,
        bio: `TikTok creator @${creator.tiktok_handle} on Karaoke School`,
        // TikTok creators might not have Grove images yet
        pictureUri: undefined,
        attributes,
      });

      // 5. Insert into lens_accounts
      await query(`
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
      `, [
        'tiktok_creator',
        creator.tiktok_handle,
        creator.pkp_address,
        lensData.lensHandle,
        lensData.lensAccountAddress,
        lensData.lensAccountId,
        lensData.metadataUri,
        lensData.transactionHash,
      ]);

      // 6. Update tiktok_creators table
      await query(`
        UPDATE tiktok_creators
        SET lens_handle = $1,
            lens_account_address = $2
        WHERE tiktok_handle = $3
      `, [
        lensData.lensHandle,
        lensData.lensAccountAddress,
        creator.tiktok_handle,
      ]);

      console.log(`   ✅ Lens account created: @${lensData.lensHandle}`);
      console.log(`   📍 Address: ${lensData.lensAccountAddress}`);
      console.log(`   📜 Tx: ${lensData.transactionHash}`);
      console.log(`   🗄️  Metadata: ${lensData.metadataUri}`);

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
