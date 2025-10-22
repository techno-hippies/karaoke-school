#!/usr/bin/env bun
/**
 * Create Segment Module - V2 Architecture
 *
 * Orchestrates segment creation with parent song integration:
 * 1. Verify parent song exists in Grove
 * 2. Run audio processing pipeline (01-match-and-process.ts)
 * 3. Update parent song's segments array
 *
 * Architecture:
 * - Segments are children of songs
 * - Alignment metadata stored in Grove (mutable ACL)
 * - Instrumental audio stored in Grove (immutable)
 * - Parent song references segment via segments[] array
 *
 * Requirements:
 * - Parent song MUST exist first (run songs/01-create-song.ts)
 * - Audio matching MUST succeed (no fallback)
 * - Demucs vocal separation required (no skip)
 * - Word alignment required (no skip)
 *
 * Usage:
 *   bun modules/segments/01-create-segment.ts \
 *     --genius-id 97149 \
 *     --tiktok-url "https://www.tiktok.com/music/Don't-Stop-The-Music-6921472983152199681"
 */

import { parseArgs } from 'util';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { requireEnv, paths } from '../../lib/config.js';
import { readJson, writeJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import { StorageClient, walletOnly } from '@lens-chain/storage-client';
import { chains } from '@lens-chain/sdk/viem';
import { createLensWalletClient } from '../../lib/lens.js';
import type { SongMetadata } from '../../lib/schemas/grove/song.js';

const execAsync = promisify(exec);

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'genius-id': { type: 'string' },
      'tiktok-url': { type: 'string' },
    },
  });

  if (!values['genius-id'] || !values['tiktok-url']) {
    logger.error('Missing required parameters');
    console.log('\nUsage:');
    console.log('  bun modules/segments/01-create-segment.ts \\');
    console.log('    --genius-id 97149 \\');
    console.log('    --tiktok-url "https://www.tiktok.com/music/..."');
    console.log('\nRequirements:');
    console.log('  - Parent song must exist (run songs/01-create-song.ts first)');
    console.log('  - Audio matching must succeed (no fallback)');
    console.log('  - Demucs and alignment are required (not skippable)\n');
    process.exit(1);
  }

  const geniusId = values['genius-id']!;
  const tiktokUrl = values['tiktok-url']!;

  logger.header(`Create Segment for Song ${geniusId}`);

  try {
    // ============ STEP 1: Verify Parent Song Exists ============
    logger.step('1/3', 'Verifying parent song');

    const songPath = paths.song(geniusId);
    if (!existsSync(songPath)) {
      throw new Error(
        `Parent song ${geniusId} not found. Run: bun modules/songs/01-create-song.ts --genius-id ${geniusId}`
      );
    }

    const songData = readJson<any>(songPath);
    console.log(`✅ Parent song exists:`);
    console.log(`   Title: ${songData.title}`);
    console.log(`   Artist: ${songData.artist}`);
    console.log(`   Grove URI: ${songData.metadataUri}`);
    console.log(`   Segments: ${songData.segments?.length || 0}\n`);

    // Create V1 compatibility metadata for processing pipeline
    console.log('📝 Creating V1 compatibility metadata...');
    const metadataDir = join(process.cwd(), 'data', 'metadata');
    const { mkdir } = await import('fs/promises');
    await mkdir(metadataDir, { recursive: true });

    const v1Metadata = {
      version: '1.0.0',
      geniusId: parseInt(geniusId),
      title: songData.title,
      artist: songData.artist,
      duration: songData.duration || 180,
      coverUri: songData.coverUrl,
      spotify: songData.spotifyId ? {
        id: songData.spotifyId,
        url: `https://open.spotify.com/track/${songData.spotifyId}`
      } : undefined,
    };

    const v1MetadataPath = join(metadataDir, `${geniusId}.json`);
    writeJson(v1MetadataPath, v1Metadata);
    console.log(`✅ V1 metadata created at ${v1MetadataPath}\n`);

    // ============ STEP 2: Run Audio Processing Pipeline ============
    // First check if segment already exists
    const { createHash } = await import('crypto');
    const tiktokMusicId = tiktokUrl.split('-').pop()?.split('?')[0] || '';
    const segmentHash = createHash('sha256')
      .update(`${geniusId}-${tiktokMusicId}`)
      .digest('hex')
      .substring(0, 16);

    const segmentManifestPath = join(
      process.cwd(),
      'data',
      'segments',
      segmentHash,
      'manifest.json'
    );

    if (existsSync(segmentManifestPath)) {
      logger.step('2/3', 'Segment already processed');
      console.log(`✅ Segment exists: ${segmentHash}`);
      console.log(`   Manifest: ${segmentManifestPath}\n`);
    } else {
      logger.step('2/3', 'Processing segment (audio matching + Demucs + fal.ai)');
      console.log('⏱️  This will take 2-3 minutes...\n');

      // Run existing processing script
      const processingScript = join(process.cwd(), 'modules', 'segments', '01-match-and-process.ts');
      const command = `bun ${processingScript} --genius-id ${geniusId} --tiktok-url "${tiktokUrl}"`;

      console.log(`Running: ${command}\n`);
      console.log('─'.repeat(80));

      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        env: process.env,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for long output
      });

      console.log(stdout);
      if (stderr) {
        console.error('Warnings:', stderr);
      }

      console.log('─'.repeat(80));
      console.log('✅ Segment processing complete\n');
    }

    // ============ STEP 3: Extract Segment Info and Update Parent Song ============
    logger.step('3/3', 'Updating parent song with segment reference');

    if (!existsSync(segmentManifestPath)) {
      throw new Error(
        `Segment manifest not found at ${segmentManifestPath}. Processing may have failed.`
      );
    }

    const segmentManifest = JSON.parse(readFileSync(segmentManifestPath, 'utf-8'));
    const alignmentUri = segmentManifest.grove.alignmentUri;

    console.log(`📦 Segment created:`);
    console.log(`   Hash: ${segmentHash}`);
    console.log(`   Time Range: ${segmentManifest.match.startTime.toFixed(2)}s - ${segmentManifest.match.endTime.toFixed(2)}s`);
    console.log(`   Duration: ${segmentManifest.match.duration.toFixed(2)}s`);
    console.log(`   Confidence: ${(segmentManifest.match.confidence * 100).toFixed(1)}%`);
    console.log(`   Alignment URI: ${alignmentUri}`);
    console.log(`   Instrumental URI: ${segmentManifest.grove.instrumentalUri}\n`);

    // Update local song data with segment
    console.log('📝 Updating local song data...');

    // Initialize segments array if it doesn't exist
    if (!songData.segments) {
      songData.segments = [];
    }

    // Check if segment already exists
    if (songData.segments.includes(alignmentUri)) {
      console.log('⚠️  Segment already in song data');
    } else {
      // Add segment to local song data
      songData.segments.push(alignmentUri);
      songData.updatedAt = new Date().toISOString();
      writeJson(songPath, songData);
      console.log(`✅ Added segment to song`);
      console.log(`   Total segments: ${songData.segments.length}\n`);
    }

    // Note: Grove song metadata is immutable, segments are tracked locally
    // TODO: Implement mutable song metadata or separate segment registry

    // Success
    console.log('✅ Segment created and linked to parent song!\n');
    console.log(`   Song: ${songData.title} by ${songData.artist}`);
    console.log(`   Segment: ${segmentManifest.match.startTime.toFixed(2)}s - ${segmentManifest.match.endTime.toFixed(2)}s`);
    console.log(`   Alignment: ${alignmentUri}`);
    console.log(`   Total segments: ${songData.segments.length}\n`);

    console.log('Next steps:');
    console.log('  • Create more segments for this song');
    console.log('  • Test segment in frontend');
    console.log('  • Add translations (optional)\n');
  } catch (error: any) {
    logger.error(`Failed to create segment: ${error.message}`);
    if (error.stdout) {
      console.error('\n--- Processing Output ---');
      console.error(error.stdout);
    }
    if (error.stderr) {
      console.error('\n--- Processing Errors ---');
      console.error(error.stderr);
    }
    if (error.stack) {
      console.error('\n--- Stack Trace ---');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
