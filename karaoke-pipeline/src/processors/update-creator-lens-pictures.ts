#!/usr/bin/env bun
/**
 * Update Lens Account Profile Pictures for TikTok Creators
 *
 * Updates existing Lens accounts with Grove profile pictures
 * Prerequisites:
 *   - Creator has Lens account (in lens_accounts table)
 *   - Creator has Grove avatar URL (grove_avatar_url IS NOT NULL)
 *
 * Process:
 *   1. Query creators with Lens accounts and Grove avatars
 *   2. Re-upload metadata with profile picture
 *   3. Update lens_metadata_uri in lens_accounts table
 *
 * Usage:
 *   DOTENV_PRIVATE_KEY='...' dotenvx run -f .env -- bun src/processors/update-creator-lens-pictures.ts --limit=10
 *   DOTENV_PRIVATE_KEY='...' dotenvx run -f .env -- bun src/processors/update-creator-lens-pictures.ts --username=charleenweiss
 */

import { parseArgs } from 'util';
import { query } from '../db/neon';
import { updateLensAccountMetadata } from '../lib/lens-protocol';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '10' },
      username: { type: 'string' },
    },
  });

  const limit = parseInt(values.limit || '10');
  const username = values.username;

  console.log(`\n🖼️  Updating TikTok creator Lens account profile pictures\n`);

  // 1. Find creators with Lens accounts and Grove avatars
  const whereClause = username
    ? `AND tc.username = $2`
    : '';

  const params = username ? [limit, username] : [limit];

  const creators = await query<{
    username: string;
    nickname: string | null;
    grove_avatar_url: string;
    lens_handle: string;
    lens_account_address: string;
    current_metadata_uri: string;
  }>(`
    SELECT
      tc.username,
      tc.nickname,
      tc.grove_avatar_url,
      la.lens_handle,
      la.lens_account_address,
      la.lens_metadata_uri as current_metadata_uri
    FROM tiktok_creators tc
    INNER JOIN lens_accounts la ON tc.username = la.tiktok_handle
    WHERE la.lens_handle IS NOT NULL
      AND tc.grove_avatar_url IS NOT NULL
      ${whereClause}
    ORDER BY tc.username ASC
    LIMIT $1
  `, params);

  if (creators.length === 0) {
    console.log('✅ No creators need profile picture updates\n');
    process.exit(0);
  }

  console.log(`Found ${creators.length} creator(s) to update:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const creator of creators) {
    console.log(`\n📍 @${creator.username} (${creator.nickname || creator.username})`);
    console.log(`   🖼️  Avatar: ${creator.grove_avatar_url.substring(0, 60)}...`);
    console.log(`   📛 Lens: @${creator.lens_handle}`);

    try {
      // 2. Update metadata with profile picture
      console.log('   ⏳ Re-uploading metadata with profile picture...');

      const attributes = [
        { type: 'String', key: 'accountType', value: 'tiktok-creator' },
        { type: 'String', key: 'tiktokUsername', value: creator.username },
      ];

      const result = await updateLensAccountMetadata({
        accountAddress: creator.lens_account_address as `0x${string}`,
        handle: creator.lens_handle,
        name: creator.nickname || creator.username,
        bio: `TikTok creator @${creator.username} on Karaoke School`,
        pictureUri: creator.grove_avatar_url,
        attributes,
      });

      // 3. Update lens_accounts table
      await query(`
        UPDATE lens_accounts
        SET lens_metadata_uri = $1,
            updated_at = NOW()
        WHERE lens_handle = $2
      `, [result.metadataUri, creator.lens_handle]);

      console.log(`   ✅ Profile picture updated`);
      console.log(`   🗄️  New metadata: ${result.metadataUri}`);
      console.log(`   📜 Tx: ${result.transactionHash}`);

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
