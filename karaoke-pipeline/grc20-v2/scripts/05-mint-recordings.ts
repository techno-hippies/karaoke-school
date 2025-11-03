/**
 * Step 5: Mint Recordings to GRC-20
 * Fetches unminted recordings from Neon and mints them to Songverse v2
 */

import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import { config, validateConfig } from '../config';
import { query } from '../../src/db/neon';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🎧 Minting Recordings to Songverse v2\n');

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

  // Fetch unminted recordings
  const recordings = await query(`
    SELECT
      gwr.*,
      gw.iswc as work_iswc
    FROM grc20_work_recordings gwr
    LEFT JOIN grc20_works gw ON gwr.work_id = gw.id
    LEFT JOIN grc20_recording_mints grm ON gwr.spotify_track_id = grm.spotify_track_id
    WHERE grm.grc20_entity_id IS NULL  -- Not yet minted
      AND gwr.spotify_track_id IS NOT NULL
    ORDER BY gwr.id
    LIMIT 100
  `);

  console.log(`📊 Found ${recordings.length} unminted recordings\n`);

  if (recordings.length === 0) {
    console.log('✅ All recordings already minted!');
    return;
  }

  const ops: any[] = [];
  const entityMap: Record<number, string> = {}; // DB ID → GRC-20 entity UUID

  for (const recording of recordings) {
    console.log(`\n🎧 Minting: ${recording.title || recording.spotify_track_id}`);

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
    addProp('title', recording.title);

    // Industry IDs
    addProp('spotifyId', recording.spotify_track_id);
    addProp('spotifyUrl', recording.spotify_url);

    // Platform URLs
    addProp('appleMusicUrl', recording.apple_music_url);
    addProp('deezerUrl', recording.deezer_url);
    addProp('tidalUrl', recording.tidal_url);
    addProp('qobuzUrl', recording.qobuz_url);
    addProp('soundcloudUrl', recording.soundcloud_url);
    addProp('youtubeMusicUrl', recording.youtube_music_url);
    addProp('melonUrl', recording.melon_url);
    addProp('amazonMusicUrl', recording.amazon_music_url);

    // Metadata
    addProp('releaseDate', recording.spotify_release_date || recording.musicbrainz_first_release_date);
    addProp('durationMs', recording.spotify_duration_ms);

    // Images
    addProp('imageUrl', recording.grove_image_url);

    // Create entity
    const { id: entityId, ops: entityOps } = Graph.createEntity({
      type: types.audioRecording,
      properties: entityProps,
    });

    ops.push(...entityOps);
    entityMap[recording.id] = entityId;
    console.log(`   ✅ Entity ID: ${entityId}`);
    console.log(`   📊 Properties: ${Object.keys(entityProps).length}`);
  }

  console.log(`\n⏳ Publishing ${recordings.length} recordings to IPFS...`);
  const { cid } = await Ipfs.publishEdit({
    name: `Mint ${recordings.length} recordings to Songverse v2`,
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

  console.log('\n💾 Saving entity IDs to grc20_recording_mints...');
  for (const [dbId, entityId] of Object.entries(entityMap)) {
    // Get spotify_track_id for this recording
    const recording = recordings.find(r => r.id === parseInt(dbId));
    if (!recording?.spotify_track_id) {
      console.warn(`⚠️  Recording ${dbId} missing spotify_track_id, skipping`);
      continue;
    }

    await query(
      `INSERT INTO grc20_recording_mints (spotify_track_id, grc20_entity_id, minted_at, needs_update)
       VALUES ($1, $2, NOW(), FALSE)
       ON CONFLICT (spotify_track_id) DO UPDATE SET
         grc20_entity_id = EXCLUDED.grc20_entity_id,
         minted_at = EXCLUDED.minted_at,
         needs_update = FALSE,
         updated_at = NOW()`,
      [recording.spotify_track_id, entityId]
    );
  }

  console.log(`\n✅ Minted ${recordings.length} recordings!`);
  console.log(`   View at: https://testnet.geobrowser.io/space/${config.spaceId}`);

  // Show minting status
  const status = await query('SELECT * FROM grc20_minting_status');
  console.log('\n📊 Minting Status:');
  console.table(status);
}

main().catch(console.error);
