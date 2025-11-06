#!/usr/bin/env bun
/**
 * Mint PKPs for Artists
 *
 * Creates Lit Protocol PKPs (Programmable Key Pairs) for artists
 * Prerequisites:
 *   - Artist exists in spotify_artists
 *   - Artist has no PKP yet (pkp_address IS NULL in pkp_accounts)
 *
 * Process:
 *   1. Query artists without PKPs from spotify_artists
 *   2. Initialize Lit Protocol client (Chronicle Yellowstone)
 *   3. Mint PKP for each artist
 *   4. Store PKP data in pkp_accounts table
 *   5. Re-populate grc20_artists to pull in new PKP data
 *
 * Usage:
 *   bun src/processors/mint-artist-pkps.ts --limit=20
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

  console.log(`\n🎨 Minting PKPs for artists (limit: ${limit})\n`);

  // 1. Find artists without PKPs
  const artists = await query<{
    spotify_artist_id: string;
    name: string;
    genius_artist_id: number | null;
  }>(`
    SELECT
      ga.spotify_artist_id,
      ga.name,
      ga.genius_artist_id
    FROM grc20_artists ga
    LEFT JOIN pkp_accounts pkp ON ga.spotify_artist_id = pkp.spotify_artist_id
      AND pkp.account_type = 'artist'
    WHERE ga.spotify_artist_id IS NOT NULL
      AND pkp.pkp_address IS NULL  -- No PKP yet
    ORDER BY ga.name ASC
    LIMIT $1
  `, [limit]);

  if (artists.length === 0) {
    console.log('✅ No artists need PKP minting\n');
    process.exit(0);
  }

  console.log(`Found ${artists.length} artists without PKPs:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const artist of artists) {
    console.log(`\n📍 ${artist.name} (${artist.spotify_artist_id})`);

    try {
      // 2. Mint PKP
      console.log('   ⏳ Minting PKP on Chronicle Yellowstone...');
      const pkpData = await mintPKP();

      // 3. Insert into pkp_accounts
      await query(`
        INSERT INTO pkp_accounts (
          account_type,
          spotify_artist_id,
          genius_artist_id,
          pkp_address,
          pkp_token_id,
          pkp_public_key,
          pkp_owner_eoa,
          transaction_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'artist',
        artist.spotify_artist_id,
        artist.genius_artist_id,
        pkpData.pkpAddress,
        pkpData.pkpTokenId,
        pkpData.pkpPublicKey,
        pkpData.ownerEOA,
        pkpData.transactionHash,
      ]);

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

  // 4. Re-populate grc20_artists (will pull in new PKP data)
  console.log('💡 Run: bun scripts/migration/populate-grc20-artists.ts');
  console.log('   to update grc20_artists with new PKP data\n');

  process.exit(errorCount > 0 ? 1 : 0);
}

main();
