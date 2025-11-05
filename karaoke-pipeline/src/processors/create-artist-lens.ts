#!/usr/bin/env bun
/**
 * Create Lens Accounts for Artists
 *
 * Creates Lens Protocol accounts for artists with PKPs
 * Prerequisites:
 *   - Artist has PKP (pkp_address IS NOT NULL in pkp_accounts)
 *   - Artist has no Lens account yet (lens_handle IS NULL in lens_accounts)
 *
 * Process:
 *   1. Query artists with PKP but no Lens account
 *   2. Generate Lens handle from artist name
 *   3. Build metadata JSON with all identifiers
 *   4. Upload metadata to Grove
 *   5. Create Lens account with username
 *   6. Store Lens data in lens_accounts table
 *   7. Re-populate grc20_artists to pull in new Lens data
 *
 * Usage:
 *   bun src/processors/create-artist-lens.ts --limit=20
 */

import { parseArgs } from 'util';
import { query } from '../db/neon';
import { createLensAccount, sanitizeHandle } from '../lib/lens-protocol';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '20' },
    },
  });

  const limit = parseInt(values.limit || '20');

  console.log(`\n🌿 Creating Lens accounts for artists (limit: ${limit})\n`);

  // 1. Find artists with PKP but no Lens account
  const artists = await query<{
    spotify_artist_id: string;
    name: string;
    pkp_address: string;
    pkp_token_id: string;
    grove_image_url: string | null;
  }>(`
    SELECT
      ga.spotify_artist_id,
      ga.name,
      pkp.pkp_address,
      pkp.pkp_token_id,
      ga.grove_image_url
    FROM grc20_artists ga
    INNER JOIN pkp_accounts pkp ON ga.spotify_artist_id = pkp.spotify_artist_id
      AND pkp.account_type = 'artist'
    LEFT JOIN lens_accounts lens ON ga.spotify_artist_id = lens.spotify_artist_id
      AND lens.account_type = 'artist'
    WHERE lens.lens_handle IS NULL  -- No Lens account yet
      AND pkp.pkp_address IS NOT NULL  -- Has PKP
    ORDER BY ga.name ASC
    LIMIT $1
  `, [limit]);

  if (artists.length === 0) {
    console.log('✅ No artists need Lens account creation\n');
    process.exit(0);
  }

  console.log(`Found ${artists.length} artists ready for Lens:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const artist of artists) {
    console.log(`\n📍 ${artist.name} (${artist.spotify_artist_id})`);

    try {
      // 2. Generate handle
      const handle = sanitizeHandle(artist.name);
      console.log(`   🏷️  Handle: @${handle}`);

      // 3. Build minimal metadata attributes
      const attributes = [
        { type: 'String', key: 'pkpAddress', value: artist.pkp_address },
        { type: 'String', key: 'accountType', value: 'music-artist' },
        { type: 'String', key: 'spotifyArtistId', value: artist.spotify_artist_id },
      ];

      console.log(`   ℹ️  GRC-20 entity ID will be added to Lens metadata after GRC-20 minting`);

      // 4. Create Lens account
      console.log('   ⏳ Creating Lens account...');
      const lensData = await createLensAccount({
        handle,
        name: artist.name,
        bio: `Official Karaoke School profile for ${artist.name}`,
        pictureUri: artist.grove_image_url || undefined,
        attributes,
      });

      // 5. Insert into lens_accounts
      await query(`
        INSERT INTO lens_accounts (
          account_type,
          spotify_artist_id,
          pkp_address,
          lens_handle,
          lens_account_address,
          lens_account_id,
          lens_metadata_uri,
          transaction_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'artist',
        artist.spotify_artist_id,
        artist.pkp_address,
        lensData.lensHandle,
        lensData.lensAccountAddress,
        lensData.lensAccountId,
        lensData.metadataUri,
        lensData.transactionHash,
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

  // 6. Re-populate grc20_artists
  console.log('💡 Run: bun scripts/migration/populate-grc20-artists.ts');
  console.log('   to update grc20_artists with new Lens data\n');

  process.exit(errorCount > 0 ? 1 : 0);
}

main();
