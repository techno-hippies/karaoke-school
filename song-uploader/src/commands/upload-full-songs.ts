#!/usr/bin/env bun

/**
 * Upload full songs to Grove with all assets:
 * - Full audio file
 * - Full-song karaoke metadata (word-level timestamps)
 * - High-res cover image
 * - 300x300 thumbnail
 * - Optional: Music video URI
 *
 * Usage:
 *   bun run src/commands/upload-full-songs.ts --song "Artist - Title"
 *   bun run src/commands/upload-full-songs.ts --all
 *   bun run src/commands/upload-full-songs.ts --dry-run --song "Artist - Title"
 */

import '@dotenvx/dotenvx/config';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { chains } from '@lens-chain/sdk/viem';
import { immutable, StorageClient } from '@lens-chain/storage-client';
import { getImageFilesForUpload } from '../processors/image-processor.js';
import type { FullSongUploadResult } from '../types.js';

const SONGS_DIR = './songs';

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
 * Find full audio file (not vocals/instrumental)
 */
async function findFullAudio(songDir: string): Promise<string | null> {
  try {
    const files = await readdir(songDir);

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if ((ext === '.mp3' || ext === '.wav' || ext === '.m4a') &&
          !file.toLowerCase().includes('vocal') &&
          !file.toLowerCase().includes('stem') &&
          !file.toLowerCase().includes('instrumental')) {
        return join(songDir, file);
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Upload a single full song to Grove
 */
async function uploadFullSong(
  songId: string,
  dryRun: boolean
): Promise<FullSongUploadResult | null> {
  console.log(`  🔄 Processing full song...`);

  const songDir = join(SONGS_DIR, songId);

  // Required files
  const audioPath = await findFullAudio(songDir);
  const metadataPath = join(songDir, 'full-song-metadata.json');

  if (!audioPath) {
    console.log(`  ❌ No full audio file found`);
    return null;
  }

  if (!await existsSync(metadataPath)) {
    console.log(`  ❌ No full-song-metadata.json (run generate-full-metadata first)`);
    return null;
  }

  // Load required files
  const audioData = await Bun.file(audioPath).arrayBuffer();
  const audioFile = new File([audioData], 'audio.mp3', { type: 'audio/mpeg' });

  const metadataData = await Bun.file(metadataPath).text();
  const metadataFile = new File([metadataData], 'metadata.json', { type: 'application/json' });

  // Load images
  const images = await getImageFilesForUpload(songDir);

  // Check for music video URI (optional)
  let musicVideoUri: string | undefined;
  const videoUriPath = join(songDir, 'music-video-uri.txt');
  if (await existsSync(videoUriPath)) {
    musicVideoUri = (await Bun.file(videoUriPath).text()).trim();
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would upload:`);
    console.log(`    - audio.mp3 (${audioFile.size} bytes)`);
    console.log(`    - metadata.json (${metadataFile.size} bytes)`);
    if (images.cover) console.log(`    - song-cover.png (${images.cover.size} bytes)`);
    if (images.thumbnail) console.log(`    - song-cover-thumb.png (${images.thumbnail.size} bytes)`);
    if (musicVideoUri) console.log(`    - Music video URI: ${musicVideoUri}`);

    return {
      songId,
      folderUri: 'lens://dry-run',
      audioUri: 'lens://dry-run-audio',
      metadataUri: 'lens://dry-run-metadata',
      coverUri: images.cover ? 'lens://dry-run-cover' : undefined,
      thumbnailUri: images.thumbnail ? 'lens://dry-run-thumb' : undefined,
      musicVideoUri
    };
  }

  // Prepare files for upload
  const files: File[] = [audioFile, metadataFile];
  if (images.cover) files.push(images.cover);
  if (images.thumbnail) files.push(images.thumbnail);

  console.log(`  📤 Uploading to Grove...`);

  const storage = getStorageClient();
  const acl = immutable(chains.mainnet.id);

  const response = await storage.uploadFolder(files, { acl });

  console.log(`  ✅ Uploaded to Grove`);

  // Parse URIs based on upload order
  const audioUri = response.files[0]?.uri || '';
  const metadataUri = response.files[1]?.uri || '';
  let coverUri: string | undefined;
  let thumbnailUri: string | undefined;

  if (images.cover && images.thumbnail) {
    coverUri = response.files[2]?.uri;
    thumbnailUri = response.files[3]?.uri;
  } else if (images.cover) {
    coverUri = response.files[2]?.uri;
  } else if (images.thumbnail) {
    thumbnailUri = response.files[2]?.uri;
  }

  return {
    songId,
    folderUri: response.folder.uri,
    audioUri,
    metadataUri,
    coverUri,
    thumbnailUri,
    musicVideoUri
  };
}

/**
 * Main command
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('🎵 Full Song Uploader\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No uploads will be made\n');
  }

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
    console.error('  bun run src/commands/upload-full-songs.ts --song <songId>');
    console.error('  bun run src/commands/upload-full-songs.ts --all');
    console.error('  bun run src/commands/upload-full-songs.ts --dry-run --song <songId>');
    process.exit(1);
  }

  if (targetSongs.length === 0) {
    console.log('No songs found to upload');
    return;
  }

  console.log(`📤 Uploading ${targetSongs.length} song(s)...\n`);

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const songId of targetSongs) {
    console.log(`📀 ${songId}`);

    try {
      const result = await uploadFullSong(songId, dryRun);

      if (result) {
        uploaded++;
        console.log(`\n  📋 Upload Result:`);
        console.log(`     Folder: ${result.folderUri}`);
        console.log(`     Audio: ${result.audioUri}`);
        console.log(`     Metadata: ${result.metadataUri}`);
        if (result.coverUri) console.log(`     Cover: ${result.coverUri}`);
        if (result.thumbnailUri) console.log(`     Thumbnail: ${result.thumbnailUri}`);
        if (result.musicVideoUri) console.log(`     Music Video: ${result.musicVideoUri}`);
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`  ❌ Upload failed:`, error);
      errors++;
    }

    console.log();
  }

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n📊 Upload Summary:`);
  console.log(`   Uploaded: ${uploaded}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}\n`);

  if (errors > 0) {
    console.error('❌ Some songs failed to upload');
    process.exit(1);
  } else if (dryRun) {
    console.log('🔍 Dry run complete - ready for real upload!');
  } else {
    console.log('✅ All songs uploaded successfully!');
    console.log('\n⚠️  TODO: Store these URIs in your song registry/contract');
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
