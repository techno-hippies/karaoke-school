#!/usr/bin/env bun
/**
 * PKP Minting Task
 *
 * Creates Lit Protocol PKPs (Programmable Key Pairs) for artists and TikTok creators.
 * PKPs serve as Ethereum wallets controlled by Lit Actions, enabling WebAuthn-based auth.
 *
 * Prerequisites:
 * - Artist exists in spotify_artists (karaoke content validated)
 * - Creator exists in tiktok_creators (TikTok videos processed)
 * - PRIVATE_KEY environment variable (EOA for gas fees on Chronicle Yellowstone)
 *
 * Process:
 * 1. Query artists/creators without PKPs
 * 2. Mint PKP via Lit Protocol (Chronicle Yellowstone testnet)
 * 3. Store PKP data in pkp_accounts table
 * 4. Next step: create-lens-accounts.ts uses PKP as Lens account owner
 *
 * Architecture:
 *   spotify_artists → [THIS] → pkp_accounts → create-lens-accounts → lens_accounts
 *   tiktok_creators → [THIS] → pkp_accounts → create-lens-accounts → lens_accounts
 *
 * Usage:
 *   bun src/tasks/identity/mint-pkps.ts --limit=20
 *   bun src/tasks/identity/mint-pkps.ts --type=artist
 *   bun src/tasks/identity/mint-pkps.ts --type=creator --limit=5
 */

import { createLitService } from '../../services/lit-protocol';
import {
  findArtistsWithoutPKP,
  findCreatorsWithoutPKP,
  insertPKPAccount,
  countPKPAccounts,
  type ArtistWithoutPKP,
  type CreatorWithoutPKP,
} from '../../db/identity-queries';

type ProcessMode = 'artist' | 'creator' | 'both';

/**
 * Mint PKP for a single artist
 */
async function mintArtistPKP(
  artist: ArtistWithoutPKP,
  litService: ReturnType<typeof createLitService>
): Promise<void> {
  console.log(`\n🎵 ${artist.name} (${artist.spotify_artist_id})`);

  try {
    // Mint PKP on Chronicle Yellowstone
    console.log('   ⏳ Minting PKP on Chronicle Yellowstone...');
    const pkp = await litService.mintPKP();

    // Store in database
    await insertPKPAccount({
      account_type: 'artist',
      spotify_artist_id: artist.spotify_artist_id,
      genius_artist_id: artist.genius_artist_id || undefined,
      pkp_address: pkp.pkpAddress,
      pkp_token_id: pkp.pkpTokenId,
      pkp_public_key: pkp.pkpPublicKey,
      pkp_owner_eoa: pkp.ownerEOA,
      transaction_hash: pkp.transactionHash,
    });

    console.log(`   ✓ PKP Address: ${pkp.pkpAddress}`);
    console.log(`   ✓ Token ID: ${pkp.pkpTokenId}`);
    console.log(`   ✓ Explorer: ${litService.getExplorerUrl(pkp.transactionHash)}`);

  } catch (error: any) {
    console.error(`   ✗ Failed to mint PKP: ${error.message}`);
    throw error;
  }
}

/**
 * Mint PKP for a single TikTok creator
 */
async function mintCreatorPKP(
  creator: CreatorWithoutPKP,
  litService: ReturnType<typeof createLitService>
): Promise<void> {
  console.log(`\n📱 ${creator.display_name} (@${creator.username})`);

  try {
    // Mint PKP on Chronicle Yellowstone
    console.log('   ⏳ Minting PKP on Chronicle Yellowstone...');
    const pkp = await litService.mintPKP();

    // Store in database
    await insertPKPAccount({
      account_type: 'tiktok_creator',
      tiktok_handle: creator.username,  // Note: pkp_accounts.tiktok_handle stores the username
      pkp_address: pkp.pkpAddress,
      pkp_token_id: pkp.pkpTokenId,
      pkp_public_key: pkp.pkpPublicKey,
      pkp_owner_eoa: pkp.ownerEOA,
      transaction_hash: pkp.transactionHash,
    });

    console.log(`   ✓ PKP Address: ${pkp.pkpAddress}`);
    console.log(`   ✓ Token ID: ${pkp.pkpTokenId}`);
    console.log(`   ✓ Explorer: ${litService.getExplorerUrl(pkp.transactionHash)}`);

  } catch (error: any) {
    console.error(`   ✗ Failed to mint PKP: ${error.message}`);
    throw error;
  }
}

/**
 * Main PKP minting processor
 *
 * Finds artists/creators without PKPs and mints them on Chronicle Yellowstone
 */
export async function mintPKPs(
  mode: ProcessMode = 'both',
  limit: number = 20
): Promise<void> {
  console.log(`\n🔑 PKP Minting Task`);
  console.log(`Mode: ${mode}, Limit: ${limit}`);
  console.log(`Network: Chronicle Yellowstone (testnet)\n`);

  // Check environment
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable not set');
    console.error('   Required for paying gas fees on Chronicle Yellowstone');
    process.exit(1);
  }

  const litService = createLitService();
  let totalSuccess = 0;
  let totalFailed = 0;

  // === ARTISTS ===
  if (mode === 'artist' || mode === 'both') {
    console.log('🎵 Processing ARTISTS...');

    const artists = await findArtistsWithoutPKP(limit);

    if (artists.length === 0) {
      console.log('✓ No artists need PKP minting\n');
    } else {
      console.log(`Found ${artists.length} artists without PKPs`);

      for (const artist of artists) {
        try {
          await mintArtistPKP(artist, litService);
          totalSuccess++;
        } catch (error) {
          totalFailed++;
        }
      }
    }
  }

  // === TIKTOK CREATORS ===
  if (mode === 'creator' || mode === 'both') {
    console.log('\n📱 Processing TIKTOK CREATORS...');

    const creators = await findCreatorsWithoutPKP(limit);

    if (creators.length === 0) {
      console.log('✓ No creators need PKP minting\n');
    } else {
      console.log(`Found ${creators.length} creators without PKPs`);

      for (const creator of creators) {
        try {
          await mintCreatorPKP(creator, litService);
          totalSuccess++;
        } catch (error) {
          totalFailed++;
        }
      }
    }
  }

  // === SUMMARY ===
  const totalPKPs = await countPKPAccounts();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ PKP Minting Complete`);
  console.log(`   Success: ${totalSuccess}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Total PKPs: ${totalPKPs}`);
  console.log(`${'='.repeat(60)}\n`);
}

// ============================================================================
// CLI Runner
// ============================================================================

if (import.meta.main) {
  const { parseArgs } = await import('util');

  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      limit: {
        type: 'string',
        short: 'l',
        default: '20',
      },
      type: {
        type: 'string',
        short: 't',
        default: 'both',
      },
    },
    strict: true,
    allowPositionals: false,
  });

  const limit = parseInt(values.limit || '20', 10);
  const mode = (values.type || 'both') as ProcessMode;

  // Validate mode
  if (!['artist', 'creator', 'both'].includes(mode)) {
    console.error('❌ Invalid --type. Must be: artist, creator, or both');
    process.exit(1);
  }

  try {
    await mintPKPs(mode, limit);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}
