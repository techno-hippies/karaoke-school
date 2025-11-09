#!/usr/bin/env bun
/**
 * Lens Account Creation Task
 *
 * Creates Lens Protocol accounts for artists and TikTok creators with PKPs.
 * Lens accounts serve as social profiles linked to PKPs for Web3 identity.
 *
 * Prerequisites:
 * - Entity exists in spotify_artists or tiktok_creators
 * - Entity has PKP (from mint-pkps.ts processor)
 * - PRIVATE_KEY environment variable (EOA for Lens transactions)
 *
 * Process:
 * 1. Query entities with PKP but no Lens account
 * 2. Generate Lens handle from name (sanitize, handle collisions)
 * 3. Build metadata JSON with PKP linkage
 * 4. Upload metadata to Grove (IPFS)
 * 5. Create Lens account via Lens Protocol
 * 6. Store Lens data in lens_accounts table
 *
 * Architecture:
 *   pkp_accounts → [THIS] → lens_accounts → (future: grc20_artists)
 *
 * Usage:
 *   bun src/tasks/identity/create-lens-accounts.ts --limit=20
 *   bun src/tasks/identity/create-lens-accounts.ts --type=artist
 *   bun src/tasks/identity/create-lens-accounts.ts --type=creator --limit=5
 */

import { createLensService } from '../../services/lens-protocol';
import {
  findEntitiesWithoutLens,
  insertLensAccount,
  countLensAccounts,
  type EntityWithPKP,
} from '../../db/identity-queries';

type ProcessMode = 'artist' | 'creator' | 'both';

/**
 * Create Lens account for a single entity
 */
async function createEntityLensAccount(
  entity: EntityWithPKP,
  lensService: ReturnType<typeof createLensService>
): Promise<void> {
  const icon = entity.account_type === 'artist' ? '🎵' : '📱';
  const identifier = entity.spotify_artist_id || entity.tiktok_handle;

  console.log(`\n${icon} ${entity.name} (${identifier})`);
  console.log(`   PKP: ${entity.pkp_address}`);

  try {
    // Build metadata attributes (links PKP to Lens account)
    const attributes = [
      { type: 'String', key: 'pkpAddress', value: entity.pkp_address },
      { type: 'String', key: 'accountType', value: entity.account_type },
    ];

    // Add type-specific identifiers
    if (entity.account_type === 'artist' && entity.spotify_artist_id) {
      attributes.push({
        type: 'String',
        key: 'spotifyArtistId',
        value: entity.spotify_artist_id,
      });
    } else if (entity.account_type === 'tiktok_creator' && entity.tiktok_handle) {
      attributes.push({
        type: 'String',
        key: 'tiktokHandle',
        value: entity.tiktok_handle,
      });
    }

    // Create Lens account
    const account = await lensService.createAccount({
      handle: entity.name,
      name: entity.name,
      bio: `Official Karaoke School profile for ${entity.name}`,
      pictureUri: entity.image_url || undefined,
      attributes,
      pkpAddress: entity.pkp_address,
    });

    // Store in database
    await insertLensAccount({
      account_type: entity.account_type,
      spotify_artist_id: entity.spotify_artist_id || undefined,
      tiktok_handle: entity.tiktok_handle || undefined,
      pkp_address: entity.pkp_address,
      lens_handle: account.lensHandle,
      lens_account_address: account.lensAccountAddress,
      lens_account_id: account.lensAccountId,
      lens_metadata_uri: account.metadataUri,
      transaction_hash: account.transactionHash,
    });

    console.log(`   ✓ Lens Handle: @${account.lensHandle}`);
    console.log(`   ✓ Account Address: ${account.lensAccountAddress}`);
    console.log(`   ✓ Metadata URI: ${account.metadataUri}`);

  } catch (error: any) {
    console.error(`   ✗ Failed to create Lens account: ${error.message}`);
    throw error;
  }
}

/**
 * Main Lens account creation processor
 *
 * Finds entities with PKPs but no Lens accounts and creates Lens profiles
 */
export async function createLensAccounts(
  mode: ProcessMode = 'both',
  limit: number = 20
): Promise<void> {
  console.log(`\n🌿 Lens Account Creation Task`);
  console.log(`Mode: ${mode}, Limit: ${limit}`);
  console.log(`Network: Lens testnet\n`);

  // Check environment
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable not set');
    console.error('   Required for signing Lens transactions');
    process.exit(1);
  }

  const lensService = createLensService();
  let totalSuccess = 0;
  let totalFailed = 0;

  // Map mode to accountType for SQL filtering
  const accountType = mode === 'both' ? undefined : mode === 'artist' ? 'artist' : 'tiktok_creator';

  // Find entities with PKP but no Lens account (filtered at SQL level)
  const filteredEntities = await findEntitiesWithoutLens(limit, accountType);

  if (filteredEntities.length === 0) {
    console.log('✓ No entities need Lens account creation\n');
    return;
  }

  console.log(`Found ${filteredEntities.length} entities ready for Lens accounts`);

  // Process each entity
  for (const entity of filteredEntities) {
    try {
      await createEntityLensAccount(entity, lensService);
      totalSuccess++;
    } catch (error) {
      totalFailed++;
    }
  }

  // === SUMMARY ===
  const totalLensAccounts = await countLensAccounts();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Lens Account Creation Complete`);
  console.log(`   Success: ${totalSuccess}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Total Lens Accounts: ${totalLensAccounts}`);
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
    await createLensAccounts(mode, limit);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}
