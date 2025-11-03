/**
 * Step 4: Mint Works to GRC-20
 * Fetches unminted works from Neon and mints them to Songverse v2
 */

import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import { config, validateConfig } from '../config';
import { query } from '../../src/db/neon';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🎵 Minting Works to Songverse v2\n');

  validateConfig();

  if (!config.spaceId) {
    throw new Error('GRC20_SPACE_ID_V2 not found. Run: bun grc20-v2/scripts/01-setup-space.ts');
  }

  // Load type IDs
  const typeIdsPath = path.join(__dirname, '../type-ids.json');
  if (!fs.existsSync(typeIdsPath)) {
    throw new Error('Type IDs not found. Run: bun grc20-v2/scripts/02-define-types.ts');
  }
  const { types, properties } = JSON.parse(fs.readFileSync(typeIdsPath, 'utf-8'));

  const privateKey = config.privateKey!.startsWith('0x')
    ? config.privateKey!
    : `0x${config.privateKey!}`;
  const { address } = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = await getWalletClient({
    privateKey: privateKey as `0x${string}`
  });

  console.log(`📝 Wallet: ${address}`);
  console.log(`🌐 Space: ${config.spaceId}`);
  console.log(`🌍 Network: ${config.network}\n`);

  // Fetch unminted works (ISWC preferred, Genius ID as fallback)
  const works = await query(`
    SELECT
      gw.*,
      ga.spotify_artist_id as primary_artist_spotify_id
    FROM grc20_works gw
    LEFT JOIN grc20_artists ga ON gw.primary_artist_id = ga.id
    LEFT JOIN grc20_work_mints gwm ON (
      (gw.iswc IS NOT NULL AND gw.iswc = gwm.iswc) OR
      (gw.iswc IS NULL AND gw.genius_song_id = gwm.genius_song_id)
    )
    WHERE gwm.grc20_entity_id IS NULL  -- Not yet minted
      AND (gw.iswc IS NOT NULL OR gw.genius_song_id IS NOT NULL)  -- Has identifier
    ORDER BY gw.id
    LIMIT 100
  `);

  console.log(`📊 Found ${works.length} unminted works\n`);

  if (works.length === 0) {
    console.log('✅ All works already minted!');
    return;
  }

  const ops: any[] = [];
  const entityMap: Record<number, string> = {}; // DB ID → GRC-20 entity UUID

  for (const work of works) {
    console.log(`\n🎵 Minting: ${work.title}`);

    // Build entity properties
    const entityProps: Record<string, any> = {};

    // Helper to add property if value exists
    const addProp = (grc20Name: string, dbValue: any) => {
      if (dbValue !== null && dbValue !== undefined && dbValue !== '') {
        // Handle JSONB fields (stringify arrays/objects)
        if (typeof dbValue === 'object') {
          entityProps[properties[grc20Name]] = JSON.stringify(dbValue);
        } else {
          entityProps[properties[grc20Name]] = String(dbValue);
        }
      }
    };

    // Core
    addProp('title', work.title);

    // Industry IDs
    addProp('iswc', work.iswc);
    addProp('mbid', work.mbid);
    addProp('geniusId', work.genius_song_id);
    addProp('wikidataId', work.wikidata_id);

    // Metadata
    addProp('language', work.language);
    addProp('genres', work.genres);
    addProp('explicitContent', work.explicit_content);

    // Create entity
    const { id: entityId, ops: entityOps } = Graph.createEntity({
      type: types.musicalWork,
      properties: entityProps,
    });

    ops.push(...entityOps);
    entityMap[work.id] = entityId;
    console.log(`   ✅ Entity ID: ${entityId}`);
    console.log(`   📊 Properties: ${Object.keys(entityProps).length}`);
  }

  console.log(`\n⏳ Publishing ${works.length} works to IPFS...`);
  const { cid } = await Ipfs.publishEdit({
    name: `Mint ${works.length} works to Songverse v2`,
    ops,
    author: address,
    network: config.network,
  });
  console.log(`   CID: ipfs://${cid}`);

  console.log('\n⏳ Getting transaction calldata...');
  const response = await fetch(`${config.graphApiOrigin}/space/${config.spaceId}/edit/calldata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid }),
  });
  const { to, data } = await response.json();

  console.log('\n⏳ Submitting transaction...');
  const txHash = await walletClient.sendTransaction({
    account: walletClient.account,
    to: to as `0x${string}`,
    value: 0n,
    data: data as `0x${string}`,
  });
  console.log(`   Transaction: ${txHash}`);

  console.log('\n💾 Saving entity IDs to grc20_work_mints...');
  for (const [dbId, entityId] of Object.entries(entityMap)) {
    const work = works.find(w => w.id === parseInt(dbId));

    // Require at least one identifier
    if (!work?.iswc && !work?.genius_song_id) {
      console.warn(`⚠️  Work ${dbId} missing both ISWC and Genius ID, skipping`);
      continue;
    }

    // Use ISWC if available, otherwise genius_song_id
    if (work.iswc) {
      await query(
        `INSERT INTO grc20_work_mints (iswc, genius_song_id, grc20_entity_id, minted_at, needs_update)
         VALUES ($1, $2, $3, NOW(), FALSE)
         ON CONFLICT (iswc) WHERE iswc IS NOT NULL DO UPDATE SET
           grc20_entity_id = EXCLUDED.grc20_entity_id,
           minted_at = EXCLUDED.minted_at,
           needs_update = FALSE,
           updated_at = NOW()`,
        [work.iswc, work.genius_song_id || null, entityId]
      );
      console.log(`   ✅ ${work.title} - ISWC: ${work.iswc}`);
    } else {
      await query(
        `INSERT INTO grc20_work_mints (iswc, genius_song_id, grc20_entity_id, minted_at, needs_update)
         VALUES ($1, $2, $3, NOW(), FALSE)
         ON CONFLICT (genius_song_id) WHERE genius_song_id IS NOT NULL DO UPDATE SET
           grc20_entity_id = EXCLUDED.grc20_entity_id,
           minted_at = EXCLUDED.minted_at,
           needs_update = FALSE,
           updated_at = NOW()`,
        [null, work.genius_song_id, entityId]
      );
      console.log(`   ✅ ${work.title} - Genius ID: ${work.genius_song_id} (no ISWC)`);
    }
  }

  console.log(`\n✅ Minted ${works.length} works!`);
  console.log(`   View at: https://testnet.geobrowser.io/space/${config.spaceId}`);

  // Show minting status
  const status = await query('SELECT * FROM grc20_minting_status');
  console.log('\n📊 Minting Status:');
  console.table(status);
}

main().catch(console.error);
