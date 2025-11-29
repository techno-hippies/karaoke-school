#!/usr/bin/env bun
/**
 * Emit Clip Script
 *
 * Emits ClipRegistered event to KaraokeEvents contract on Lens testnet.
 *
 * Usage:
 *   bun src/scripts/emit-clip.ts --iswc=T0112199333
 *   bun src/scripts/emit-clip.ts --clip-id=<uuid>
 */

import { parseArgs } from 'util';
import { ethers } from 'ethers';
import { query, queryOne } from '../db/connection';
import { getSongByISWC } from '../db/queries';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv } from '../config';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'clip-id': { type: 'string' },
  },
  strict: true,
});

// Contract config - KaraokeEvents (handles both clip lifecycle and grading)
const KARAOKE_EVENTS_ADDRESS = '0x51aA6987130AA7E4654218859E075D8e790f4409';
const RPC_URL = 'https://rpc.testnet.lens.xyz';

const KARAOKE_EVENTS_ABI = [
  'function emitClipRegistered(bytes32 clipHash, string grc20WorkId, string spotifyTrackId, uint32 clipStartMs, uint32 clipEndMs, string metadataUri) external',
];

interface ClipData {
  clip_id: string;
  song_id: string;
  iswc: string;
  title: string;
  spotify_track_id: string;
  start_ms: number;
  end_ms: number;
  metadata_uri: string | null;
  emitted_at: string | null;
}

async function main() {
  validateEnv(['DATABASE_URL', 'PRIVATE_KEY']);

  if (!values.iswc && !values['clip-id']) {
    console.error('Usage: bun src/scripts/emit-clip.ts --iswc=T0112199333');
    console.error('   or: bun src/scripts/emit-clip.ts --clip-id=<uuid>');
    process.exit(1);
  }

  console.log('\n📤 Emitting Clip Event');

  // Get clip data
  let clip: ClipData | null;

  if (values['clip-id']) {
    clip = await queryOne<ClipData>(`
      SELECT c.id as clip_id, c.song_id, s.iswc, s.title, s.spotify_track_id,
             c.start_ms, c.end_ms, c.metadata_uri, c.emitted_at
      FROM clips c
      JOIN songs s ON c.song_id = s.id
      WHERE c.id = $1
    `, [values['clip-id']]);
  } else {
    const iswc = normalizeISWC(values.iswc!);
    clip = await queryOne<ClipData>(`
      SELECT c.id as clip_id, c.song_id, s.iswc, s.title, s.spotify_track_id,
             c.start_ms, c.end_ms, c.metadata_uri, c.emitted_at
      FROM clips c
      JOIN songs s ON c.song_id = s.id
      WHERE s.iswc = $1
      ORDER BY c.created_at DESC
      LIMIT 1
    `, [iswc]);
  }

  if (!clip) {
    console.error('❌ Clip not found');
    process.exit(1);
  }

  console.log(`   Clip: ${clip.clip_id}`);
  console.log(`   Song: ${clip.title} (${clip.iswc})`);
  console.log(`   Range: ${clip.start_ms}ms - ${clip.end_ms}ms`);
  console.log(`   Spotify: ${clip.spotify_track_id}`);

  if (clip.emitted_at) {
    console.log(`\n⚠️  Clip already emitted at ${clip.emitted_at}`);
    console.log('   Use --force to re-emit (not implemented)');
    process.exit(0);
  }

  // Connect to Lens testnet
  console.log('\n🔗 Connecting to Lens testnet...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(KARAOKE_EVENTS_ADDRESS, KARAOKE_EVENTS_ABI, wallet);

  console.log(`   Wallet: ${wallet.address}`);
  console.log(`   Contract: ${KARAOKE_EVENTS_ADDRESS}`);

  // Calculate clip hash: keccak256(abi.encode(spotifyTrackId, clipStartMs))
  const clipHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['string', 'uint32'],
      [clip.spotify_track_id, clip.start_ms]
    )
  );
  console.log(`   Clip Hash: ${clipHash}`);

  // Metadata URI (empty for now, can be Grove URI later)
  const metadataUri = clip.metadata_uri || '';

  // Emit event
  console.log('\n📤 Emitting ClipRegistered...');
  const tx = await contract.emitClipRegistered(
    clipHash,
    clip.iswc, // Use ISWC as grc20WorkId
    clip.spotify_track_id,
    clip.start_ms,
    clip.end_ms,
    metadataUri
  );

  console.log(`   Transaction: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`   Confirmed in block ${receipt.blockNumber}`);

  // Update database
  await query(
    `UPDATE clips SET emitted_at = NOW(), transaction_hash = $1 WHERE id = $2`,
    [tx.hash, clip.clip_id]
  );

  console.log('\n✅ Clip emitted successfully');
  console.log(`   TX: https://block-explorer.testnet.lens.dev/tx/${tx.hash}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
