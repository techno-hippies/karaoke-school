#!/usr/bin/env bun
/**
 * Update Lens Account Profile Pictures for Artists
 *
 * Updates existing Lens accounts with Grove profile pictures
 * Prerequisites:
 *   - Artist has Lens account (lens_account_id IS NOT NULL)
 *   - Artist has Grove image URL (grove_image_url IS NOT NULL)
 *
 * Process:
 *   1. Query artists with Lens accounts and Grove images
 *   2. Re-upload metadata with profile picture
 *   3. Update lens_metadata_uri in lens_accounts table
 *
 * Usage:
 *   DOTENV_PRIVATE_KEY='...' dotenvx run -f .env -- bun src/processors/update-artist-lens-pictures.ts --limit=52
 */

import { parseArgs } from 'util';
import { query } from '../db/neon';
import { updateLensAccountMetadata } from '../lib/lens-protocol';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '52' },
    },
  });

  const limit = parseInt(values.limit || '52');

  console.log(`\n🖼️  Updating Lens account profile pictures (limit: ${limit})\n`);

  // 1. Find artists with Lens accounts and Grove images
  const artists = await query<{
    spotify_artist_id: string;
    name: string;
    grove_image_url: string;
    lens_handle: string;
    lens_account_address: string;
    current_metadata_uri: string;
  }>(`
    SELECT
      ga.spotify_artist_id,
      ga.name,
      ga.grove_image_url,
      la.lens_handle,
      la.lens_account_address,
      la.lens_metadata_uri as current_metadata_uri
    FROM grc20_artists ga
    INNER JOIN lens_accounts la ON ga.lens_account_id = la.id
    WHERE la.lens_handle IS NOT NULL
      AND ga.grove_image_url IS NOT NULL
    ORDER BY ga.name ASC
    LIMIT $1
  `, [limit]);

  if (artists.length === 0) {
    console.log('✅ No artists need profile picture updates\n');
    process.exit(0);
  }

  console.log(`Found ${artists.length} artists to update:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const artist of artists) {
    console.log(`\n📍 ${artist.name} (@${artist.lens_handle})`);
    console.log(`   🖼️  Image: ${artist.grove_image_url.substring(0, 60)}...`);

    try {
      // 2. Update metadata with profile picture
      console.log('   ⏳ Re-uploading metadata with profile picture...');

      const attributes = [
        { type: 'String', key: 'accountType', value: 'music-artist' },
        { type: 'String', key: 'spotifyArtistId', value: artist.spotify_artist_id },
      ];

      const result = await updateLensAccountMetadata({
        accountAddress: artist.lens_account_address as `0x${string}`,
        handle: artist.lens_handle,
        name: artist.name,
        bio: `Official Karaoke School profile for ${artist.name}`,
        pictureUri: artist.grove_image_url,
        attributes,
      });

      // 3. Update lens_accounts table
      await query(`
        UPDATE lens_accounts
        SET lens_metadata_uri = $1,
            updated_at = NOW()
        WHERE lens_handle = $2
      `, [result.metadataUri, artist.lens_handle]);

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
