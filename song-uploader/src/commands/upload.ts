#!/usr/bin/env bun

/**
 * Upload clips to Grove and register in ClipRegistry contract
 * Usage:
 *   bun run src/commands/upload.ts --song song-1
 *   bun run src/commands/upload.ts --all
 *   bun run src/commands/upload.ts --dry-run --song song-1
 */

import '@dotenvx/dotenvx/config';
import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { createWalletClient, createPublicClient, http, getContract, parseGwei } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { chains } from '@lens-chain/sdk/viem';
import { immutable, StorageClient } from '@lens-chain/storage-client';
import ClipRegistryABI from '../abi/ClipRegistryV1.json';
import type { ClipMetadata } from '../types.js';

const SONGS_DIR = './songs';
const CONTRACT_ADDRESS = '0x59fCAe6753041C7b2E2ad443e4F2342Af46b81bf';

let storageClient: StorageClient | null = null;

function getStorageClient(): StorageClient {
  if (!storageClient) {
    storageClient = StorageClient.create();
  }
  return storageClient;
}

/**
 * Get list of song folders
 */
async function getSongFolders(): Promise<string[]> {
  try {
    const entries = await readdir(SONGS_DIR);
    const folders: string[] = [];

    for (const entry of entries) {
      const fullPath = join(SONGS_DIR, entry);
      const stats = await stat(fullPath);
      if (stats.isDirectory() && entry !== 'sample') {
        folders.push(entry);
      }
    }

    return folders;
  } catch (error) {
    console.error('Error scanning songs directory:', error);
    return [];
  }
}

/**
 * Get clips for a song
 */
async function getClipsForSong(songId: string): Promise<string[]> {
  const clipsDir = join(SONGS_DIR, songId, 'clips');

  try {
    const files = await readdir(clipsDir);
    const clips: string[] = [];

    // Get unique clip names (without -instrumental suffix)
    for (const file of files) {
      if (file.endsWith('.json')) {
        const clipName = file.replace('.json', '');
        clips.push(clipName);
      }
    }

    return clips;
  } catch (error) {
    console.error(`  ❌ Error reading clips:`, error);
    return [];
  }
}

/**
 * Find thumbnail file in song folder
 */
async function findThumbnail(songId: string): Promise<string | null> {
  const songDir = join(SONGS_DIR, songId);

  try {
    const files = await readdir(songDir);

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (ext === '.jpg' || ext === '.png' || ext === '.webp' || ext === '.jpeg') {
        return join(songDir, file);
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Upload a single clip to Grove
 */
async function uploadClipToGrove(
  songId: string,
  clipName: string,
  dryRun: boolean
): Promise<{
  audioUri: string;
  instrumentalUri: string;
  timestampsUri: string;
  thumbnailUri: string;
} | null> {
  const clipsDir = join(SONGS_DIR, songId, 'clips');

  try {
    // Load files
    const vocalPath = join(clipsDir, `${clipName}.mp3`);
    const instrumentalPath = join(clipsDir, `${clipName}-instrumental.mp3`);
    const metadataPath = join(clipsDir, `${clipName}.json`);
    const thumbnailPath = await findThumbnail(songId);

    // Read vocal audio
    const vocalAudio = await Bun.file(vocalPath).arrayBuffer();
    const vocalFile = new File([vocalAudio], 'audio.mp3', { type: 'audio/mpeg' });

    // Read instrumental audio (if exists)
    let instrumentalFile: File | null = null;
    try {
      const instrumentalAudio = await Bun.file(instrumentalPath).arrayBuffer();
      instrumentalFile = new File([instrumentalAudio], 'instrumental.mp3', { type: 'audio/mpeg' });
    } catch {
      // Instrumental doesn't exist - that's OK
    }

    // Read metadata
    const metadataContent = await Bun.file(metadataPath).text();
    const metadataFile = new File([metadataContent], 'metadata.json', { type: 'application/json' });

    // Read thumbnail (if exists)
    let thumbnailFile: File | null = null;
    if (thumbnailPath) {
      const thumbnailData = await Bun.file(thumbnailPath).arrayBuffer();
      const ext = extname(thumbnailPath).slice(1);
      thumbnailFile = new File([thumbnailData], `thumbnail.${ext}`, { type: `image/${ext}` });
    }

    if (dryRun) {
      console.log(`    [DRY RUN] Would upload:`);
      console.log(`      - audio.mp3 (${vocalFile.size} bytes)`);
      if (instrumentalFile) {
        console.log(`      - instrumental.mp3 (${instrumentalFile.size} bytes)`);
      }
      console.log(`      - metadata.json (${metadataFile.size} bytes)`);
      if (thumbnailFile) {
        console.log(`      - thumbnail (${thumbnailFile.size} bytes)`);
      }
      return {
        audioUri: 'lens://dry-run-audio',
        instrumentalUri: instrumentalFile ? 'lens://dry-run-instrumental' : '',
        timestampsUri: 'lens://dry-run-metadata',
        thumbnailUri: thumbnailFile ? 'lens://dry-run-thumbnail' : ''
      };
    }

    // Upload to Grove
    const files = [vocalFile, metadataFile];
    if (instrumentalFile) files.push(instrumentalFile);
    if (thumbnailFile) files.push(thumbnailFile);

    const storage = getStorageClient();
    const acl = immutable(chains.mainnet.id);

    console.log(`    📤 Uploading to Grove...`);
    const response = await storage.uploadFolder(files, { acl });

    // Parse URIs based on file order
    const audioUri = response.files[0]?.uri || '';
    const timestampsUri = response.files[1]?.uri || '';
    let instrumentalUri = '';
    let thumbnailUri = '';

    if (instrumentalFile && thumbnailFile) {
      instrumentalUri = response.files[2]?.uri || '';
      thumbnailUri = response.files[3]?.uri || '';
    } else if (instrumentalFile) {
      instrumentalUri = response.files[2]?.uri || '';
    } else if (thumbnailFile) {
      thumbnailUri = response.files[2]?.uri || '';
    }

    console.log(`    ✅ Uploaded to Grove`);

    return {
      audioUri,
      instrumentalUri,
      timestampsUri,
      thumbnailUri
    };
  } catch (error) {
    console.error(`    ❌ Upload failed:`, error);
    return null;
  }
}

/**
 * Register clip in contract
 */
async function registerClipInContract(
  clipMetadata: ClipMetadata,
  uris: {
    audioUri: string;
    instrumentalUri: string;
    timestampsUri: string;
    thumbnailUri: string;
  },
  walletClient: any,
  publicClient: any,
  dryRun: boolean
): Promise<boolean> {
  try {
    const contract = getContract({
      address: CONTRACT_ADDRESS,
      abi: ClipRegistryABI,
      client: walletClient
    });

    // Check if clip already exists
    const exists = await contract.read.clipExists([clipMetadata.id]) as boolean;
    if (exists) {
      console.log(`    ⚠️  Clip already exists in registry`);
      return false;
    }

    if (dryRun) {
      console.log(`    [DRY RUN] Would call addClip with:`);
      console.log(`      - id: ${clipMetadata.id}`);
      console.log(`      - title: ${clipMetadata.title}`);
      console.log(`      - artist: ${clipMetadata.artist}`);
      console.log(`      - sectionType: ${clipMetadata.sectionType}`);
      console.log(`      - duration: ${Math.floor(clipMetadata.duration)}s`);
      console.log(`      - difficulty: ${clipMetadata.learningMetrics.difficultyLevel}/5`);
      console.log(`      - wps: ${Math.round(clipMetadata.learningMetrics.pace.wordsPerSecond * 10)}`);
      return true;
    }

    console.log(`    📝 Registering in contract...`);

    const tx = await contract.write.addClip([
      clipMetadata.id,
      clipMetadata.title,
      clipMetadata.artist,
      clipMetadata.sectionType,
      clipMetadata.sectionIndex,
      Math.floor(clipMetadata.duration),
      uris.audioUri,
      uris.instrumentalUri,
      uris.timestampsUri,
      uris.thumbnailUri,
      clipMetadata.availableLanguages.join(','),
      clipMetadata.learningMetrics.difficultyLevel,
      Math.round(clipMetadata.learningMetrics.pace.wordsPerSecond * 10)
    ], {
      gas: 2000000n
      // Let viem estimate gas price automatically
    });

    console.log(`    ⏳ Waiting for confirmation...`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status === 'success') {
      console.log(`    ✅ Registered in contract`);
      return true;
    } else {
      console.error(`    ❌ Transaction failed`);
      return false;
    }
  } catch (error) {
    console.error(`    ❌ Contract registration failed:`, error);
    return false;
  }
}

/**
 * Upload a single clip (Grove + Contract)
 */
async function uploadClip(
  songId: string,
  clipName: string,
  walletClient: any,
  publicClient: any,
  dryRun: boolean
): Promise<boolean> {
  console.log(`  🎵 ${clipName}`);

  // Load metadata
  const metadataPath = join(SONGS_DIR, songId, 'clips', `${clipName}.json`);
  const metadata: ClipMetadata = await Bun.file(metadataPath).json();

  // Upload to Grove
  const uris = await uploadClipToGrove(songId, clipName, dryRun);
  if (!uris) {
    return false;
  }

  // Register in contract
  const registered = await registerClipInContract(metadata, uris, walletClient, publicClient, dryRun);

  return registered;
}

/**
 * Main command
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  // Parse arguments
  let targetSongs: string[] = [];

  if (args.includes('--all')) {
    targetSongs = await getSongFolders();
  } else if (args.includes('--song')) {
    const songIndex = args.indexOf('--song');
    const songId = args[songIndex + 1];
    if (!songId) {
      console.error('❌ --song requires a song ID');
      process.exit(1);
    }
    targetSongs = [songId];
  } else {
    console.error('Usage:');
    console.error('  bun run src/commands/upload.ts --song <songId>');
    console.error('  bun run src/commands/upload.ts --all');
    console.error('  bun run src/commands/upload.ts --dry-run --song <songId>');
    process.exit(1);
  }

  if (targetSongs.length === 0) {
    console.log('No songs found to upload');
    return;
  }

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No uploads or transactions will be made\n');
  }

  // Initialize wallet
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}`);
  const walletClient = createWalletClient({
    account,
    chain: chains.testnet,
    transport: http()
  });

  const publicClient = createPublicClient({
    chain: chains.testnet,
    transport: http()
  });

  console.log(`💼 Wallet: ${account.address}`);
  console.log(`📝 Contract: ${CONTRACT_ADDRESS}\n`);

  console.log(`📤 Uploading ${targetSongs.length} song(s)...\n`);

  // Upload each song
  let totalClips = 0;
  let uploadedClips = 0;
  let failedClips = 0;

  for (const songId of targetSongs) {
    console.log(`📀 ${songId}`);

    const clips = await getClipsForSong(songId);
    if (clips.length === 0) {
      console.log(`  ⚠️  No clips found\n`);
      continue;
    }

    console.log(`  Found ${clips.length} clip(s)`);
    totalClips += clips.length;

    for (const clipName of clips) {
      const success = await uploadClip(songId, clipName, walletClient, publicClient, dryRun);
      if (success) {
        uploadedClips++;
      } else {
        failedClips++;
      }
    }

    console.log();
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Upload Summary:`);
  console.log(`   Total clips: ${totalClips}`);
  console.log(`   Uploaded: ${uploadedClips}`);
  console.log(`   Failed: ${failedClips}\n`);

  if (failedClips > 0) {
    console.error('❌ Some clips failed to upload');
    process.exit(1);
  } else if (dryRun) {
    console.log('🔍 Dry run complete - ready for real upload!');
  } else {
    console.log('✅ All clips uploaded successfully!');
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
