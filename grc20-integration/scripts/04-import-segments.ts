/**
 * Step 4: Import Karaoke Segments from Neon to GRC-20
 *
 * Creates segment entities linked to parent works.
 * Includes Grove URIs for instrumental and alignment data.
 */

import { Ipfs, Graph, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import postgres from 'postgres';
import { config, validateConfig } from '../config';
import fs from 'fs';
import path from 'path';

interface NeonSegment {
  spotify_track_id: string;
  title: string;
  fal_segment_start_ms: number;
  fal_segment_end_ms: number;
  fal_segment_duration_ms: number;
  fal_segment_grove_url: string;
  tiktok_clip_grove_url: string | null;
  alignment_uri: string | null;
}

async function main() {
  console.log('🎵 Importing Karaoke Segments from Neon...\n');

  validateConfig();

  if (!config.spaceId) {
    throw new Error('No GRC20_SPACE_ID found. Run: bun run setup');
  }

  // Load type IDs and entity map
  const typeIdsPath = path.join(__dirname, '../type-ids.json');
  const entityMapPath = path.join(__dirname, '../entity-map.json');

  if (!fs.existsSync(typeIdsPath)) {
    throw new Error('Type IDs not found. Run: bun run define-types');
  }

  if (!fs.existsSync(entityMapPath)) {
    throw new Error('Entity map not found. Run: bun run import-works first');
  }

  const { properties, types } = JSON.parse(fs.readFileSync(typeIdsPath, 'utf-8'));
  const entityMap: Record<string, string> = JSON.parse(fs.readFileSync(entityMapPath, 'utf-8'));

  // Connect to Neon
  console.log('⏳ Connecting to Neon DB...');
  const sql = postgres(config.neonConnectionString!);

  // Query segments
  console.log('⏳ Querying karaoke segments...');
  const segments = await sql<NeonSegment[]>`
    SELECT
      st.spotify_track_id,
      st.title,
      ks.fal_segment_start_ms,
      ks.fal_segment_end_ms,
      ks.fal_segment_duration_ms,
      ks.fal_segment_grove_url,
      ks.tiktok_clip_grove_url,
      ea.elevenlabs_alignment_grove_url as alignment_uri
    FROM karaoke_segments ks
    JOIN spotify_tracks st ON ks.spotify_track_id = st.spotify_track_id
    LEFT JOIN elevenlabs_word_alignments ea
      ON st.spotify_track_id = ea.spotify_track_id
    WHERE ks.fal_segment_grove_url IS NOT NULL
    ORDER BY st.spotify_track_id
    LIMIT 1000
  `;

  console.log(`   Found ${segments.length} segments\n`);

  // Get wallet client
  const { address } = privateKeyToAccount(config.privateKey as `0x${string}`);
  const walletClient = await getWalletClient({
    privateKey: config.privateKey as `0x${string}`,
  });

  // Process in batches
  const batches = [];
  for (let i = 0; i < segments.length; i += config.batchSize) {
    batches.push(segments.slice(i, i + config.batchSize));
  }

  console.log(`📦 Processing ${batches.length} batches (${config.batchSize} per batch)\n`);

  const segmentEntityMap: Record<string, string> = {}; // spotify_track_id -> segment entity ID

  for (const [batchIndex, batch] of batches.entries()) {
    console.log(`[${batchIndex + 1}/${batches.length}] Processing batch...`);

    const ops = [];

    for (const segment of batch) {
      const parentWorkId = entityMap[segment.spotify_track_id];

      if (!parentWorkId) {
        console.warn(`   ⚠️  No parent work for ${segment.spotify_track_id}, skipping`);
        continue;
      }

      // Create Karaoke Segment entity
      const { id: segmentId, ops: segmentOps } = Graph.createEntity({
        name: `${segment.title} (Karaoke Segment)`,
        types: [types.karaokeSegment],
        values: [
          { property: properties.title, value: segment.title },
          { property: properties.startMs, value: Graph.serializeNumber(segment.fal_segment_start_ms) },
          { property: properties.endMs, value: Graph.serializeNumber(segment.fal_segment_end_ms) },
          { property: properties.durationMs, value: Graph.serializeNumber(segment.fal_segment_duration_ms) },
          { property: properties.instrumentalUri, value: segment.fal_segment_grove_url },
          ...(segment.alignment_uri ? [{ property: properties.alignmentUri, value: segment.alignment_uri }] : []),
        ],
        relations: {
          [properties.recordingOf]: {
            toEntity: parentWorkId,  // Link to parent work
          },
        },
      });

      ops.push(...segmentOps);
      segmentEntityMap[segment.spotify_track_id] = segmentId;
    }

    // Publish batch
    console.log(`   Publishing ${ops.length} ops to IPFS...`);
    const { cid } = await Ipfs.publishEdit({
      name: `Import Karaoke Segments (batch ${batchIndex + 1})`,
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

  // Save segment entity mapping
  const segmentMapPath = path.join(__dirname, '../segment-map.json');
  fs.writeFileSync(segmentMapPath, JSON.stringify(segmentEntityMap, null, 2));

  await sql.end();

  console.log(`\n✅ Imported ${segments.length} karaoke segments!`);
  console.log(`   Segment map saved to: segment-map.json`);
  const browserUrl = config.network === 'MAINNET'
    ? 'https://www.geobrowser.io'
    : 'https://testnet.geobrowser.io';
  console.log(`   View at: ${browserUrl}/space/${config.spaceId}`);

  console.log('\n📋 Next steps:');
  console.log('   Query your data with GraphQL');
  console.log('   Integrate with app frontend');
}

main().catch(console.error);
