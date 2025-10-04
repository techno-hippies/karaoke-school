#!/usr/bin/env bun

/**
 * Configure Track in KaraokeScoreboardV4
 *
 * Reads song metadata from SongCatalogV1 and configures the corresponding
 * track in KaraokeScoreboardV4 with its segment IDs.
 *
 * Usage:
 *   bun run configure-track <songId>
 *
 * Example:
 *   bun run configure-track heat-of-the-night-scarlett-x
 */

import { createWalletClient, http, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { lensTestnet } from './chains.js';

// Contract addresses
const SONG_CATALOG_ADDRESS = '0x88996135809cc745E6d8966e3a7A01389C774910' as const;
const SCOREBOARD_ADDRESS = '0x8301E4bbe0C244870a4BC44ccF0241A908293d36' as const;

// ABIs
const SONG_CATALOG_ABI = [
  {
    inputs: [{ name: 'id', type: 'string' }],
    name: 'getSong',
    outputs: [
      {
        components: [
          { name: 'id', type: 'string' },
          { name: 'geniusId', type: 'uint32' },
          { name: 'geniusArtistId', type: 'uint32' },
          { name: 'title', type: 'string' },
          { name: 'artist', type: 'string' },
          { name: 'duration', type: 'uint32' },
          { name: 'audioUri', type: 'string' },
          { name: 'metadataUri', type: 'string' },
          { name: 'coverUri', type: 'string' },
          { name: 'thumbnailUri', type: 'string' },
          { name: 'musicVideoUri', type: 'string' },
          { name: 'segmentIds', type: 'string' },
          { name: 'languages', type: 'string' },
          { name: 'enabled', type: 'bool' },
          { name: 'addedAt', type: 'uint64' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const SCOREBOARD_ABI = [
  {
    inputs: [
      { name: 'source', type: 'uint8' },
      { name: 'trackId', type: 'string' },
      { name: 'segmentIds', type: 'string[]' },
    ],
    name: 'configureTrack',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'bytes32' }],
    name: 'trackExists',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'source', type: 'uint8' },
      { name: 'id', type: 'string' },
    ],
    name: 'getContentHash',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function',
  },
] as const;

async function main() {
  const songId = process.argv[2];

  if (!songId) {
    console.error('❌ Usage: bun run configure-track <songId>');
    console.error('   Example: bun run configure-track heat-of-the-night-scarlett-x');
    process.exit(1);
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(cleanPrivateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: lensTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: lensTestnet,
    transport: http(),
  });

  console.log('🎵 Configure KaraokeScoreboardV4 Track\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📝 Song ID: ${songId}`);
  console.log(`📍 SongCatalog: ${SONG_CATALOG_ADDRESS}`);
  console.log(`📍 Scoreboard: ${SCOREBOARD_ADDRESS}`);
  console.log(`👤 Account: ${account.address}\n`);

  // 1. Fetch song from SongCatalogV1
  console.log('🔍 Fetching song from SongCatalogV1...');
  const song = await publicClient.readContract({
    address: SONG_CATALOG_ADDRESS,
    abi: SONG_CATALOG_ABI,
    functionName: 'getSong',
    args: [songId],
  });

  if (!song.enabled) {
    console.error('❌ Song is disabled');
    process.exit(1);
  }

  console.log(`✅ Found song: "${song.title}" by ${song.artist}`);
  console.log(`   Segment IDs: ${song.segmentIds}\n`);

  // 2. Parse segment IDs
  const segmentIds = song.segmentIds
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segmentIds.length === 0) {
    console.error('❌ No segment IDs found for this song');
    process.exit(1);
  }

  console.log(`📊 Found ${segmentIds.length} segments: ${segmentIds.join(', ')}\n`);

  // 3. Check if track already configured
  const trackHash = await publicClient.readContract({
    address: SCOREBOARD_ADDRESS,
    abi: SCOREBOARD_ABI,
    functionName: 'getContentHash',
    args: [0, songId], // source = 0 (Native)
  });

  const trackExists = await publicClient.readContract({
    address: SCOREBOARD_ADDRESS,
    abi: SCOREBOARD_ABI,
    functionName: 'trackExists',
    args: [trackHash],
  });

  if (trackExists) {
    console.log('⚠️  Track already configured in scoreboard');
    console.log('   To reconfigure, use updateTrackSegments() instead\n');
    process.exit(0);
  }

  // 4. Configure track
  console.log('📤 Configuring track in KaraokeScoreboardV4...');

  const hash = await walletClient.writeContract({
    address: SCOREBOARD_ADDRESS,
    abi: SCOREBOARD_ABI,
    functionName: 'configureTrack',
    args: [
      0, // source = 0 (Native - from SongCatalogV1)
      songId,
      segmentIds,
    ],
  });

  console.log(`✅ Transaction sent: ${hash}`);
  console.log('⏳ Waiting for confirmation...\n');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TRACK CONFIGURED SUCCESSFULLY!\n');
    console.log(`📦 Block: ${receipt.blockNumber}`);
    console.log(`⛽ Gas Used: ${receipt.gasUsed}`);
    console.log(`🔗 Explorer: https://explorer.testnet.lens.xyz/tx/${hash}\n`);
    console.log('🎯 Next Steps:');
    console.log('   1. Test karaoke scoring with this track');
    console.log('   2. Verify segments appear in leaderboards\n');
  } else {
    console.error('❌ Transaction failed');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
