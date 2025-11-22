#!/usr/bin/env bun
/**
 * Update Lens Account Avatars
 * Updates existing Lens account metadata to include avatar pictures from TikTok creators
 *
 * Usage:
 *   bun src/scripts/update-lens-account-avatars.ts [username]
 */

import { query } from '../db/connection';
import { createLensService } from '../services/lens-protocol';
import { ensureCreatorAvatarCached } from '../lib/avatar-cache';
import { groveUriToHttps } from '../utils/grove';

async function main() {
  const args = process.argv.slice(2);
  const targetUsername = args[0];

  console.log('🖼️  Updating Lens Account Avatars\n');

  // Get TikTok creators with avatars but Lens accounts without pictures
  const creators = await query<{
    username: string;
    display_name: string;
    avatar_url: string;
    avatar_source_url: string | null;
    avatar_uploaded_at: string | null;
    lens_account_address: string;
    lens_handle: string;
    pkp_address: string;
  }>(`
    SELECT
      tc.username,
      tc.display_name,
      tc.avatar_url,
      tc.avatar_source_url,
      tc.avatar_uploaded_at,
      la.lens_account_address,
      la.lens_handle,
      la.pkp_address
    FROM tiktok_creators tc
    INNER JOIN lens_accounts la ON la.tiktok_handle = tc.username
    WHERE tc.avatar_url IS NOT NULL
      ${targetUsername ? 'AND tc.username = $1' : ''}
    ORDER BY tc.username
  `, targetUsername ? [targetUsername] : []);

  if (creators.length === 0) {
    console.log('✅ No creators need avatar updates\n');
    return;
  }

  console.log(`Found ${creators.length} creators to update\n`);

  const lensService = createLensService();
  let successCount = 0;
  let errorCount = 0;

  for (const creator of creators) {
    console.log(`📍 @${creator.username} (${creator.lens_handle})`);

    const avatarCache = await ensureCreatorAvatarCached({
      username: creator.username,
      sourceUrl: creator.avatar_source_url || creator.avatar_url,
      existingAvatarUrl: creator.avatar_url,
      existingSourceUrl: creator.avatar_source_url,
      existingUploadedAt: creator.avatar_uploaded_at,
    });

    if (!avatarCache.avatarUrl) {
      console.log('   ⚠️  No avatar available, skipping Lens update\n');
      continue;
    }

    if (avatarCache.uploaded) {
      console.log(`   🆕 Uploaded avatar to Grove: ${avatarCache.avatarUrl}`);
      await query(
        `UPDATE tiktok_creators
         SET avatar_url = $1,
             avatar_source_url = $2,
             avatar_uploaded_at = $3,
             updated_at = NOW()
         WHERE username = $4`,
        [
          avatarCache.avatarUrl,
          avatarCache.avatarSourceUrl,
          avatarCache.avatarUploadedAt,
          creator.username,
        ]
      );
    } else {
      console.log('   ♻️  Reusing cached Grove avatar');
    }

    const pictureUri = groveUriToHttps(avatarCache.avatarUrl);
    console.log(`   Avatar URI: ${pictureUri}`);

    try {
      // Update account metadata with avatar
      const result = await lensService.updateAccountMetadata({
        accountAddress: creator.lens_account_address,
        name: creator.display_name || creator.username,
        bio: `TikTok creator @${creator.username} on Karaoke School`,
        pictureUri: pictureUri || undefined,
        pkpAddress: creator.pkp_address,
      });

      console.log(`   ✅ Updated: ${result.metadataUri}\n`);

      // Update lens_accounts table with new metadata URI
      await query(`
        UPDATE lens_accounts
        SET lens_metadata_uri = $1,
            updated_at = NOW()
        WHERE lens_account_address = $2
      `, [result.metadataUri, creator.lens_account_address]);

      successCount++;
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}\n`);
      errorCount++;
    }
  }

  console.log('📊 Summary:');
  console.log(`   - Success: ${successCount}`);
  console.log(`   - Errors: ${errorCount}`);
  console.log(`   - Total: ${creators.length}\n`);
}

main().catch(console.error);
