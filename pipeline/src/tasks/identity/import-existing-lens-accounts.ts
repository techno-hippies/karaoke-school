#!/usr/bin/env bun
import { query } from '../../db/connection';
import { createLensService } from '../../services/lens-protocol';

const accounts = [
  { spotifyId: '4V8Sr092TqfHkfAA5fXXqG', handle: 'luis-fonsi-ks2', name: 'Luis Fonsi' },
  { spotifyId: '12Chz98pHFMPJEknJQMWvI', handle: 'muse-ks2', name: 'Muse' },
  { spotifyId: '2RdwBSPQiwcmiDo9kixcl8', handle: 'pharrell-williams-ks2', name: 'Pharrell Williams' },
  { spotifyId: '0gxyHStUsqpMadRV0Di1Qt', handle: 'rick-astley-ks2', name: 'Rick Astley' },
  { spotifyId: '0C0XlULifJtAgn6ZNCW2eu', handle: 'the-killers-ks2', name: 'The Killers' },
];

async function importAccounts() {
  console.log('\n📥 Importing existing Lens accounts from on-chain\n');

  const lensService = createLensService();

  for (const account of accounts) {
    console.log(`📍 ${account.name} (@${account.handle})`);

    try {
      // Check if handle exists and get account details
      const { available, account: lensAccount } = await lensService.isHandleAvailable(account.handle);

      if (available) {
        console.log(`   ⚠️  Account does not exist on-chain, skipping\n`);
        continue;
      }

      // Get PKP address from database
      const pkpResult = await query<{ pkp_address: string }>(`
        SELECT pkp_address FROM pkp_accounts
        WHERE spotify_artist_id = $1 AND account_type = 'artist'
      `, [account.spotifyId]);

      if (pkpResult.length === 0) {
        console.log(`   ⚠️  No PKP found, skipping\n`);
        continue;
      }

      const pkpAddress = pkpResult[0].pkp_address;
      const metadataId = lensAccount.metadata?.id || '';

      console.log(`   PKP: ${pkpAddress}`);
      console.log(`   Lens Address: ${lensAccount.address}`);
      console.log(`   Metadata: ${metadataId}`);

      // Insert into database (use spotify_artist_id unique constraint for artists)
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
        ON CONFLICT (spotify_artist_id) WHERE (account_type = 'artist') DO UPDATE SET
          lens_handle = EXCLUDED.lens_handle,
          lens_account_address = EXCLUDED.lens_account_address,
          lens_account_id = EXCLUDED.lens_account_id,
          lens_metadata_uri = EXCLUDED.lens_metadata_uri
      `, [
        'artist',
        account.spotifyId,
        pkpAddress,
        account.handle,
        lensAccount.address,
        lensAccount.address,
        metadataId,
        '0x0' // Unknown transaction hash for imported accounts
      ]);

      console.log(`   ✅ Imported to database\n`);

    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}\n`);
    }
  }

  console.log('✅ Import complete\n');
}

importAccounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
