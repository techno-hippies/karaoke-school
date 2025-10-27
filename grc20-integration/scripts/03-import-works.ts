/**
 * Step 3: Import Musical Works from Neon to GRC-20
 *
 * Reads validated tracks from Neon DB and creates GRC-20 entities.
 * Batches entities to minimize gas costs (50 entities per edit = ~10k gas).
 */

import { Ipfs, Graph, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import postgres from 'postgres';
import { config, validateConfig } from '../config';
import fs from 'fs';
import path from 'path';

interface NeonTrack {
  spotify_track_id: string;
  title: string;
  artists: string[];
  duration_ms: number;
  isrc: string | null;
  recording_mbid: string | null;
  work_mbid: string | null;
  iswc: string | null;
  has_iswc: boolean;
}

async function main() {
  console.log('🎵 Importing Musical Works from Neon...\n');

  validateConfig();

  if (!config.spaceId) {
    throw new Error('No GRC20_SPACE_ID found. Run: bun run setup');
  }

  // Load type IDs
  const typeIdsPath = path.join(__dirname, '../type-ids.json');
  if (!fs.existsSync(typeIdsPath)) {
    throw new Error('Type IDs not found. Run: bun run define-types');
  }

  const { properties, types } = JSON.parse(fs.readFileSync(typeIdsPath, 'utf-8'));

  // Connect to Neon
  console.log('⏳ Connecting to Neon DB...');
  const sql = postgres(config.neonConnectionString!);

  // Query validated tracks (must have karaoke segments)
  console.log('⏳ Querying validated tracks...');
  const tracks = await sql<NeonTrack[]>`
    SELECT
      st.spotify_track_id,
      st.title,
      st.artists,
      st.duration_ms,
      st.isrc,
      mr.recording_mbid,
      mw.work_mbid,
      mw.iswc,
      st.has_iswc
    FROM spotify_tracks st
    LEFT JOIN musicbrainz_recordings mr
      ON st.spotify_track_id = mr.spotify_track_id
    LEFT JOIN work_recording_links wrl
      ON mr.recording_mbid = wrl.recording_mbid
    LEFT JOIN musicbrainz_works mw
      ON wrl.work_mbid = mw.work_mbid
    WHERE EXISTS (
      SELECT 1 FROM karaoke_segments ks
      WHERE ks.spotify_track_id = st.spotify_track_id
      AND ks.fal_segment_grove_url IS NOT NULL
    )
    ORDER BY st.spotify_track_id
    LIMIT 1000
  `;

  console.log(`   Found ${tracks.length} validated tracks\n`);

  // Get wallet client
  const { address } = privateKeyToAccount(config.privateKey as `0x${string}`);
  const walletClient = await getWalletClient({
    privateKey: config.privateKey as `0x${string}`,
  });

  // Process in batches
  const batches = [];
  for (let i = 0; i < tracks.length; i += config.batchSize) {
    batches.push(tracks.slice(i, i + config.batchSize));
  }

  console.log(`📦 Processing ${batches.length} batches (${config.batchSize} per batch)\n`);

  const entityMap: Record<string, string> = {}; // spotify_track_id -> entity ID

  for (const [batchIndex, batch] of batches.entries()) {
    console.log(`[${batchIndex + 1}/${batches.length}] Processing batch...`);

    const ops = [];

    for (const track of batch) {
      // Create Musical Work entity
      const { id: workId, ops: workOps } = Graph.createEntity({
        name: track.title,
        description: `Musical work by ${track.artists.join(', ')}`,
        types: [types.musicalWork],
        values: [
          { property: properties.title, value: track.title },
          { property: properties.durationMs, value: Graph.serializeNumber(track.duration_ms) },
          { property: properties.spotifyId, value: track.spotify_track_id },
          // Optional: MusicBrainz IDs
          ...(track.work_mbid ? [{ property: properties.mbid, value: track.work_mbid }] : []),
          ...(track.iswc ? [{ property: properties.iswc, value: track.iswc }] : []),
        ],
      });

      ops.push(...workOps);
      entityMap[track.spotify_track_id] = workId;

      // If has recording, create Recording entity
      if (track.recording_mbid) {
        const { id: recordingId, ops: recordingOps } = Graph.createEntity({
          name: `${track.title} (Recording)`,
          types: [types.audioRecording],
          values: [
            { property: properties.title, value: track.title },
            { property: properties.mbid, value: track.recording_mbid },
            ...(track.isrc ? [{ property: properties.isrc, value: track.isrc }] : []),
            { property: properties.durationMs, value: Graph.serializeNumber(track.duration_ms) },
          ],
          relations: {
            [properties.recordingOf]: {
              toEntity: workId,
            },
          },
        });

        ops.push(...recordingOps);
      }
    }

    // Publish batch
    console.log(`   Publishing ${ops.length} ops to IPFS...`);
    const { cid } = await Ipfs.publishEdit({
      name: `Import Musical Works (batch ${batchIndex + 1})`,
      ops,
      author: address,
      network: config.network,
    });

    console.log(`   CID: ${cid}`);

    // Get calldata
    const response = await fetch(`${config.graphApiOrigin}/space/${config.spaceId}/edit/calldata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get calldata: ${response.statusText}`);
    }

    const { to, data } = await response.json();

    // Submit transaction
    console.log(`   Submitting transaction...`);
    const txHash = await walletClient.sendTransaction({
      account: walletClient.account,
      to: to as `0x${string}`,
      value: 0n,
      data: data as `0x${string}`,
    });

    console.log(`   ✅ Transaction: ${txHash}\n`);

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Save entity mapping
  const mapPath = path.join(__dirname, '../entity-map.json');
  fs.writeFileSync(mapPath, JSON.stringify(entityMap, null, 2));

  await sql.end();

  console.log(`\n✅ Imported ${tracks.length} musical works!`);
  console.log(`   Entity map saved to: entity-map.json`);
  const browserUrl = config.network === 'MAINNET'
    ? 'https://www.geobrowser.io'
    : 'https://testnet.geobrowser.io';
  console.log(`   View at: ${browserUrl}/space/${config.spaceId}`);

  console.log('\n📋 Next steps:');
  console.log('   1. Run: bun run import-segments');
  console.log('   2. Run: bun run link-musicbrainz (optional)');
}

main().catch(console.error);
