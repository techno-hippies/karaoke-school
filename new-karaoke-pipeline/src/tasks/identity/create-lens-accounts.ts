#!/usr/bin/env bun
/**
 * Create Lens Accounts
 *
 * Creates Lens Protocol accounts for artists and TikTok creators with PKPs
 * Prerequisites:
 *   - Entity exists in spotify_artists (from Step 2) OR tiktok_creators (from Step 1)
 *   - Entity has PKP (pkp_accounts.pkp_address IS NOT NULL)
 *   - Entity has no Lens account yet (LEFT JOIN lens_accounts returns NULL)
 *
 * Process:
 *   1. Query entities with PKP but no Lens account from source tables (NOT grc20_artists)
 *   2. Generate Lens handle from artist name / TikTok username
 *   3. Build metadata JSON with all identifiers
 *   4. Upload metadata to Grove
 *   5. Create Lens account with username
 *   6. Store Lens data in lens_accounts table
 *   7. Later: populate-grc20-artists.ts will link artist Lens accounts via FK
 *
 * Architecture:
 *   spotify_artists + pkp_accounts → [THIS SCRIPT] → lens_accounts → [populate] → grc20_artists
 *   tiktok_creators + pkp_accounts → [THIS SCRIPT] → lens_accounts (stays in tiktok_creators)
 *
 * Usage:
 *   bun src/processors/create-lens-accounts.ts --limit=20
 *   bun src/processors/create-lens-accounts.ts --type=artist
 *   bun src/processors/create-lens-accounts.ts --type=tiktok_creator --username=charleenweiss
 */

import { parseArgs } from 'util';
import { query } from '../../db/connection';
import { createLensService, sanitizeHandle } from '../../services/lens-protocol';

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

  console.log(`\n🌿 Creating Lens accounts (type: ${accountType}, limit: ${limit})\n`);

  const lensService = createLensService();
  let totalSuccess = 0;
  let totalErrors = 0;

  // === ARTISTS ===
  if (accountType === 'artist' || accountType === 'both') {
    console.log('🎵 Processing ARTISTS...\n');

    const artists = await query<{
      spotify_artist_id: string;
      name: string;
      pkp_address: string;
      pkp_token_id: string;
      image_url: string | null;
    }>(`
      SELECT
        ga.spotify_artist_id,
        ga.name,
        pkp.pkp_address,
        pkp.pkp_token_id,
        ga.image_url
      FROM grc20_artists ga
      -- Must have PKP
      INNER JOIN pkp_accounts pkp ON pkp.spotify_artist_id = ga.spotify_artist_id
        AND pkp.account_type = 'artist'
      -- Must be minted to GRC-20 (this enforces the dependency)
      WHERE ga.grc20_entity_id IS NOT NULL
      -- Don't have Lens account yet
      AND NOT EXISTS (
        SELECT 1 FROM lens_accounts lens
        WHERE lens.spotify_artist_id = ga.spotify_artist_id
          AND lens.account_type = 'artist'
      )
      ORDER BY ga.name ASC
      LIMIT $1
    `, [limit]);

    if (artists.length === 0) {
      console.log('   ✅ No artists need Lens account creation\n');
    } else {
      console.log(`   Found ${artists.length} artists ready for Lens\n`);

      // Temporary: Use -ks2 suffix for artists with existing -ks1 handles on-chain
      const ks2Artists = ['Luis Fonsi', 'Muse', 'Pharrell Williams', 'Rick Astley', 'The Killers'];

      for (const artist of artists) {
        console.log(`   📍 ${artist.name} (${artist.spotify_artist_id})`);

        try {
          let handle = sanitizeHandle(artist.name);
          // Override to -ks2 for artists with existing handles
          if (ks2Artists.includes(artist.name)) {
            handle = handle.replace(/-ks1$/, '-ks2');
          }
          console.log(`      🏷️  Handle: @${handle}`);

          const attributes = [
            { type: 'String', key: 'pkpAddress', value: artist.pkp_address },
            { type: 'String', key: 'accountType', value: 'music-artist' },
            { type: 'String', key: 'spotifyArtistId', value: artist.spotify_artist_id },
          ];

          console.log('      ⏳ Creating Lens account...');
          const lensData = await lensService.createAccount({
            handle: handle,  // Use the pre-sanitized handle (may be -ks2)
            name: artist.name,
            bio: `Official Karaoke School profile for ${artist.name}`,
            pictureUri: artist.image_url || undefined,
            attributes,
            pkpAddress: artist.pkp_address,
          });

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

          console.log(`      ✅ @${lensData.lensHandle} (${lensData.lensAccountAddress})`);
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
      display_name: string | null;
      follower_count: number | null;
      avatar_url: string | null;
      pkp_address: string;
      pkp_token_id: string;
    }>(`
      SELECT
        tc.username,
        tc.display_name,
        tc.follower_count,
        tc.avatar_url,
        pkp.pkp_address,
        pkp.pkp_token_id
      FROM tiktok_creators tc
      -- Must have PKP
      INNER JOIN pkp_accounts pkp ON pkp.tiktok_handle = tc.username
        AND pkp.account_type = 'tiktok_creator'
      WHERE tc.username IS NOT NULL
        -- Don't have Lens account yet
        AND NOT EXISTS (
          SELECT 1 FROM lens_accounts lens
          WHERE lens.tiktok_handle = tc.username
            AND lens.account_type = 'tiktok_creator'
        )
        ${targetUsername ? 'AND tc.username = $2' : ''}
      ORDER BY tc.follower_count DESC NULLS LAST
      LIMIT $1
    `, targetUsername ? [limit, targetUsername] : [limit]);

    if (creators.length === 0) {
      console.log('   ✅ No TikTok creators need Lens account creation\n');
    } else {
      console.log(`   Found ${creators.length} creators ready for Lens\n`);

      for (const creator of creators) {
        console.log(`   📍 @${creator.username} ${creator.display_name ? `(${creator.display_name})` : ''}`);

        try {
          // Use TikTok username directly (already lowercase, URL-safe)
          const handle = creator.username;
          console.log(`      🏷️  Handle: @${handle}`);

          const attributes = [
            { type: 'String', key: 'pkpAddress', value: creator.pkp_address },
            { type: 'String', key: 'accountType', value: 'tiktok-creator' },
            { type: 'String', key: 'tiktokHandle', value: creator.username },
          ];

          console.log('      ⏳ Creating Lens account...');
          const lensData = await lensService.createAccount({
            handle: creator.username,
            name: creator.display_name || creator.username,
            bio: `TikTok creator @${creator.username} on Karaoke School`,
            pictureUri: creator.avatar_url || undefined,
            attributes,
            pkpAddress: creator.pkp_address,
          });

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
            creator.username,
            creator.pkp_address,
            lensData.lensHandle,
            lensData.lensAccountAddress,
            lensData.lensAccountId,
            lensData.metadataUri,
            lensData.transactionHash,
          ]);

          console.log(`      ✅ @${lensData.lensHandle} (${lensData.lensAccountAddress})`);
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
    console.log('   bun scripts/migration/populate-grc20-artists.ts');
    console.log('   (links artist PKP/Lens accounts to grc20_artists via FK)\n');
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
