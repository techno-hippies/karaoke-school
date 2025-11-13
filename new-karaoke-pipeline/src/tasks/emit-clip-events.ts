#!/usr/bin/env bun
/**
 * Emit ClipRegistered events for tracks with clip lines
 *
 * This script:
 * 1. Finds tracks with clip_lines and Grove URLs
 * 2. Emits ClipRegistered events to KaraokeEvents contract
 * 3. Verifies events were emitted successfully
 */

import { ethers } from 'ethers';
import { query } from '../db/connection';

// Contract ABI (just the functions we need)
const KARAOKE_EVENTS_ABI = [
  'function emitClipRegistered(bytes32 clipHash, string grc20WorkId, string spotifyTrackId, uint32 clipStartMs, uint32 clipEndMs, string metadataUri) external',
  'function getClipHash(string spotifyTrackId, uint32 clipStartMs) external pure returns (bytes32)',
];

const KARAOKE_EVENTS_ADDRESS = '0x51aA6987130AA7E4654218859E075D8e790f4409';
const RPC_URL = 'https://rpc.testnet.lens.xyz';

async function main() {
  // Get private key from environment
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  // Connect to Lens testnet
  console.log('🔗 Connecting to Lens testnet...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(KARAOKE_EVENTS_ADDRESS, KARAOKE_EVENTS_ABI, wallet);

  console.log('📝 Deployer:', wallet.address);
  console.log('📝 Contract:', KARAOKE_EVENTS_ADDRESS);
  console.log('');

  // Fetch tracks with clip lines and Grove URLs
  const tracks = await query<{
    spotify_track_id: string;
    title: string;
    primary_artist_name: string;
    clip_start_ms: number;
    clip_end_ms: number;
    clip_lyrics_grove_url: string;
    line_count: string;
  }>(`
    SELECT
      ks.spotify_track_id,
      t.title,
      t.primary_artist_name,
      ks.clip_start_ms,
      ks.clip_end_ms,
      ks.clip_lyrics_grove_url,
      COUNT(cl.id) as line_count
    FROM karaoke_segments ks
    JOIN tracks t ON ks.spotify_track_id = t.spotify_track_id
    LEFT JOIN clip_lines cl ON cl.spotify_track_id = ks.spotify_track_id
    WHERE ks.clip_lyrics_grove_url IS NOT NULL
    GROUP BY ks.spotify_track_id, t.title, t.primary_artist_name,
             ks.clip_start_ms, ks.clip_end_ms, ks.clip_lyrics_grove_url
    ORDER BY t.title
  `);

  if (tracks.length === 0) {
    console.log('❌ No tracks found with clip lines and Grove URLs');
    return;
  }

  console.log(`📊 Found ${tracks.length} tracks with clip lines\n`);

  let successCount = 0;
  let failCount = 0;

  for (const track of tracks) {
    console.log(`\n🎵 ${track.title} - ${track.primary_artist_name}`);
    console.log(`   Spotify: ${track.spotify_track_id}`);
    console.log(`   Clip: ${track.clip_start_ms}ms → ${track.clip_end_ms}ms`);
    console.log(`   Lines: ${track.line_count}`);
    console.log(`   Grove: ${track.clip_lyrics_grove_url}`);

    try {
      // Calculate clip hash
      const clipHash = await contract.getClipHash(track.spotify_track_id, track.clip_start_ms);
      console.log(`   Clip Hash: ${clipHash}`);

      // Emit ClipRegistered event (use spotify_track_id as work identifier)
      console.log('   📤 Emitting ClipRegistered event...');
      const tx = await contract.emitClipRegistered(
        clipHash,
        track.spotify_track_id, // Use spotify ID as work identifier
        track.spotify_track_id,
        track.clip_start_ms,
        track.clip_end_ms,
        track.clip_lyrics_grove_url
      );

      console.log(`   ⏳ Transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

      successCount++;
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
