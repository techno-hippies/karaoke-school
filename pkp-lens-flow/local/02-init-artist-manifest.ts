#!/usr/bin/env bun
/**
 * Step 2: Initialize Artist Manifest
 *
 * Creates a minimal manifest structure for a new artist.
 * This allows subsequent steps to work even when no videos have been added yet.
 *
 * Prerequisites:
 * - PKP minted (step 1)
 *
 * Usage:
 *   bun run local/02-init-artist-manifest.ts --creator @eminem --genius-id 45
 *
 * Output:
 *   data/videos/{handle}/manifest.json (minimal structure)
 */

import { writeFile, mkdir } from 'fs/promises';
import { parseArgs } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
    'genius-id': { type: 'string' },
  },
});

interface Manifest {
  tiktokHandle: string;
  profile: {
    nickname: string;
    geniusArtistId: number;
    bio: string;
    stats: {
      followerCount: number;
      followingCount: number;
      videoCount: number;
    };
    localFiles: {};
    groveUris: {};
  };
  videos: any[];
  createdAt: string;
  updatedAt: string;
}

async function initArtistManifest(handle: string, geniusArtistId: number): Promise<void> {
  console.log('\n📁 Step 2: Initialize Artist Manifest');
  console.log('═══════════════════════════════════════\n');

  const videosDir = path.join(process.cwd(), 'data', 'videos', handle);
  const manifestPath = path.join(videosDir, 'manifest.json');

  // Check if manifest already exists
  if (existsSync(manifestPath)) {
    console.log(`⚠️  Manifest already exists at: ${manifestPath}`);
    console.log('Skipping initialization.\n');
    return;
  }

  // Create videos directory
  await mkdir(videosDir, { recursive: true });

  // Load PKP data to get Lens account if it exists
  const pkpPath = path.join(process.cwd(), 'data', 'pkps', `${handle}.json`);
  let lensAccountAddress = '';
  let lensHandle = '';

  if (existsSync(pkpPath)) {
    const pkpData = JSON.parse(await readFile(pkpPath, 'utf-8'));
    lensAccountAddress = pkpData.lensAccountAddress || '';
    lensHandle = pkpData.lensHandle || `@${handle}`;
  }

  // Create minimal manifest structure
  const manifest: Manifest = {
    tiktokHandle: `@${handle}`,
    lensHandle,
    lensAccountAddress,
    profile: {
      nickname: handle,
      geniusArtistId,
      bio: '',
      stats: {
        followerCount: 0,
        followingCount: 0,
        videoCount: 0,
      },
      localFiles: {},
      groveUris: {},
    },
    videos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`✅ Initialized manifest for @${handle}`);
  console.log(`   Genius Artist ID: ${geniusArtistId}`);
  console.log(`   Path: ${manifestPath}`);
  console.log(`   Videos: 0 (will be added via pipeline-video)`);
  console.log('\n✨ Done!\n');
}

async function main() {
  if (!values.creator || !values['genius-id']) {
    console.error('❌ Error: --creator and --genius-id required');
    console.error('Usage: bun run local/02-init-artist-manifest.ts --creator @eminem --genius-id 45');
    process.exit(1);
  }

  const handle = values.creator.replace('@', '');
  const geniusId = parseInt(values['genius-id']);

  try {
    await initArtistManifest(handle, geniusId);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}\n`);
    throw error;
  }
}

main();
