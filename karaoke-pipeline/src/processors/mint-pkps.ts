#!/usr/bin/env bun
/**
 * Mint PKPs
 *
 * Creates Lit Protocol PKPs (Programmable Key Pairs) for artists and TikTok creators
 * Prerequisites:
 *   - Artist exists in spotify_artists (from pipeline Step 2) OR
 *   - Creator exists in tiktok_creators (from pipeline Step 1)
 *   - Entity has no PKP yet (LEFT JOIN pkp_accounts returns NULL)
 *
 * Process:
 *   1. Query artists/creators without PKPs from source tables (NOT grc20_artists)
 *   2. Initialize Lit Protocol client (Chronicle Yellowstone)
 *   3. Mint PKP for each entity
 *   4. Store PKP data in pkp_accounts table
 *   5. Later: populate-grc20-artists.ts will link artist PKPs via FK
 *
 * Architecture:
 *   spotify_artists → [THIS SCRIPT] → pkp_accounts → [populate] → grc20_artists
 *   tiktok_creators → [THIS SCRIPT] → pkp_accounts (stays in tiktok_creators)
 *
 * Usage:
 *   bun src/processors/mint-pkps.ts --limit=20
 *   bun src/processors/mint-pkps.ts --type=artist
 *   bun src/processors/mint-pkps.ts --type=tiktok_creator --username=charleenweiss
 */

import { parseArgs } from 'util';
import { query } from '../db/neon';
import { mintPKP } from '../lib/lit-protocol';

type AccountType = 'artist' | 'tiktok_creator' | 'both';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '20' },
      type: { type: 'string', default: 'both' }, // 'artist', 'tiktok_creator', or 'both'
      username: { type: 'string' }, // For specific TikTok creator
    },
  });

  const limit = parseInt(values.limit || '20');
  const accountType = (values.type || 'both') as AccountType;
  const targetUsername = values.username;

  console.log(`\n🎨 Minting PKPs (type: ${accountType}, limit: ${limit})\n`);

  let totalSuccess = 0;
  let totalErrors = 0;

  // === ARTISTS ===
  if (accountType === 'artist' || accountType === 'both') {
    console.log('🎵 Processing ARTISTS...\n');

    const artists = await query<{
      spotify_artist_id: string;
      name: string;
    }>(`
      SELECT DISTINCT
        sa.spotify_artist_id,
        sa.name
      FROM spotify_artists sa
      -- Only artists that appear in our pipeline (have processed tracks)
      WHERE EXISTS (
        SELECT 1 FROM karaoke_segments ks
        JOIN spotify_tracks st ON st.spotify_track_id = ks.spotify_track_id
        WHERE st.artists @> jsonb_build_array(jsonb_build_object('id', sa.spotify_artist_id))
      )
      -- Don't have PKP yet
      AND NOT EXISTS (
        SELECT 1 FROM pkp_accounts pkp
        WHERE pkp.spotify_artist_id = sa.spotify_artist_id
          AND pkp.account_type = 'artist'
      )
      ORDER BY sa.name ASC
      LIMIT $1
    `, [limit]);

    if (artists.length === 0) {
      console.log('   ✅ No artists need PKP minting\n');
    } else {
      console.log(`   Found ${artists.length} artists without PKPs\n`);

      for (const artist of artists) {
        console.log(`   📍 ${artist.name} (${artist.spotify_artist_id})`);

        try {
          console.log('      ⏳ Minting PKP...');
          const pkpData = await mintPKP();

          await query(`
            INSERT INTO pkp_accounts (
              account_type,
              spotify_artist_id,
              pkp_address,
              pkp_token_id,
              pkp_public_key,
              pkp_owner_eoa,
              transaction_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            'artist',
            artist.spotify_artist_id,
            pkpData.pkpAddress,
            pkpData.pkpTokenId,
            pkpData.pkpPublicKey,
            pkpData.ownerEOA,
            pkpData.transactionHash,
          ]);

          console.log(`      ✅ ${pkpData.pkpAddress} (Token: ${pkpData.pkpTokenId})`);
          totalSuccess++;

        } catch (error: any) {
          console.error(`      ❌ Failed: ${error.message}`);
          totalErrors++;
        }
      }
    }
  }

  // === TIKTOK CREATORS ===
  if (accountType === 'tiktok_creator' || accountType === 'both') {
    console.log('\n🎬 Processing TIKTOK CREATORS...\n');

    const creators = await query<{
      username: string;
      nickname: string | null;
      sec_uid: string;
    }>(`
      SELECT
        tc.username,
        tc.nickname,
        tc.sec_uid
      FROM tiktok_creators tc
      WHERE tc.username IS NOT NULL
        -- Don't have PKP yet
        AND NOT EXISTS (
          SELECT 1 FROM pkp_accounts pkp
          WHERE pkp.tiktok_handle = tc.username
            AND pkp.account_type = 'tiktok_creator'
        )
        ${targetUsername ? 'AND tc.username = $2' : ''}
      ORDER BY tc.nickname ASC
      LIMIT $1
    `, targetUsername ? [limit, targetUsername] : [limit]);

    if (creators.length === 0) {
      console.log('   ✅ No TikTok creators need PKP minting\n');
    } else {
      console.log(`   Found ${creators.length} creators without PKPs\n`);

      for (const creator of creators) {
        console.log(`   📍 @${creator.username} ${creator.nickname ? `(${creator.nickname})` : ''}`);

        try {
          console.log('      ⏳ Minting PKP...');
          const pkpData = await mintPKP();

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
            creator.username,
            pkpData.pkpAddress,
            pkpData.pkpTokenId,
            pkpData.pkpPublicKey,
            pkpData.ownerEOA,
            pkpData.transactionHash,
          ]);

          console.log(`      ✅ ${pkpData.pkpAddress} (Token: ${pkpData.pkpTokenId})`);
          totalSuccess++;

        } catch (error: any) {
          console.error(`      ❌ Failed: ${error.message}`);
          totalErrors++;
        }
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Total Success: ${totalSuccess}`);
  console.log(`❌ Total Errors: ${totalErrors}`);
  console.log(`${'='.repeat(60)}\n`);

  if (totalSuccess > 0) {
    console.log('💡 Next steps:');
    console.log('   1. bun src/processors/create-lens-accounts.ts');
    console.log('   2. bun scripts/migration/populate-grc20-artists.ts');
    console.log('      (links artist PKP/Lens accounts to grc20_artists via FK)\n');
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
