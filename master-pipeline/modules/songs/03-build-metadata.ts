#!/usr/bin/env bun
/**
 * Step 3: Build Complete Metadata and Upload to Grove
 *
 * Fetches synced lyrics from LRCLib, validates complete metadata,
 * uploads to Grove storage, and updates blockchain
 *
 * Usage:
 *   bun songs/03-build-metadata.ts --genius-id 10047250
 */

import { parseArgs } from 'util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { SongMetadataSchema, type LyricLine, type Lyrics } from '../../lib/schemas/index.js';
import { LRCLibService } from '../../services/lrclib.js';
import { GroveService } from '../../services/grove.js';
import { updateSongMetadata } from '../../lib/contracts.js';

// ============================================================================
// CLI Arguments
// ============================================================================

const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
  },
});

if (!values['genius-id']) {
  console.error('❌ Missing required argument');
  console.error('\nUsage:');
  console.error('  bun songs/03-build-metadata.ts --genius-id 10047250');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse LRC format to structured lyric lines
 * Format: [MM:SS.xx]Line text
 */
function parseLRCToLines(lrcText: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const lrcLines = lrcText.split('\n').filter((line) => line.trim());

  for (const line of lrcLines) {
    // Match timestamp: [MM:SS.xx] or [MM:SS]
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\]\s*(.+)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseFloat(match[2]);
      const text = match[3].trim();

      if (text) {
        // Skip empty lines
        lines.push({
          start: minutes * 60 + seconds,
          text,
        });
      }
    }
  }

  // Sort by timestamp (should already be sorted, but ensure it)
  return lines.sort((a, b) => a.start - b.start);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('📦 Build Complete Metadata\n');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Load existing metadata
    console.log(`Step 1: Loading metadata for song ${geniusId}...`);
    const metadataPath = path.join(process.cwd(), 'data', 'metadata', `${geniusId}.json`);

    if (!existsSync(metadataPath)) {
      console.error(`❌ Metadata file not found: ${metadataPath}`);
      console.error('\nRun first:');
      console.error(`  bun songs/01-register-song.ts --genius-id ${geniusId} --genius-artist-id <id>`);
      process.exit(1);
    }

    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    console.log(`  ✓ Title: ${metadata.title}`);
    console.log(`  ✓ Artist: ${metadata.artist}`);

    // Step 2: Fetch synced lyrics from LRCLib
    console.log(`\nStep 2: Fetching synced lyrics from LRCLib...`);
    const lrclib = new LRCLibService();

    const lyricsResult = await lrclib.getBestMatch(
      metadata.title,
      metadata.artist,
      metadata.album
    );

    if (!lyricsResult || !lyricsResult.syncedLyrics) {
      console.log('⚠️  No synced lyrics found');
      console.log('  Continuing without lyrics...');
      metadata.lyrics = null;
    } else {
      console.log(`  ✓ Found lyrics (ID: ${lyricsResult.id})`);
      console.log(`  ✓ Duration: ${lyricsResult.duration}s`);

      // Update duration if not set
      if (!metadata.duration || metadata.duration === 0) {
        metadata.duration = lyricsResult.duration;
        console.log(`  ✓ Updated duration: ${lyricsResult.duration}s`);
      }

      // Parse LRC to structured format
      const syncedLines = parseLRCToLines(lyricsResult.syncedLyrics);
      console.log(`  ✓ Parsed ${syncedLines.length} synced lines`);

      const lyrics: Lyrics = {
        en: {
          source: 'lrclib' as const,
          plain: lyricsResult.plainLyrics,
          synced: syncedLines,
        },
      };

      metadata.lyrics = lyrics;
    }

    // Step 3: Validate complete metadata
    console.log(`\nStep 3: Validating metadata schema...`);

    // Check required fields
    if (!metadata.licensing) {
      console.error('\n❌ Missing licensing data');
      console.error('Run first:');
      console.error(`  bun songs/02-fetch-mlc-data.ts --genius-id ${geniusId}`);
      process.exit(1);
    }

    try {
      const validatedMetadata = SongMetadataSchema.parse(metadata);
      console.log('  ✓ Schema validation passed');
      console.log(`  ✓ Version: ${validatedMetadata.version}`);
      console.log(`  ✓ Story Protocol Mintable: ${validatedMetadata.licensing.storyMintable}`);
    } catch (error: any) {
      console.error('\n❌ Schema validation failed:');
      console.error(error.errors || error.message);
      process.exit(1);
    }

    // Step 4: Upload to Grove
    console.log(`\nStep 4: Uploading metadata to Grove...`);
    const grove = new GroveService({ chainId: 84532 }); // Base Sepolia

    const metadataJSON = JSON.stringify(metadata, null, 2);
    const metadataBuffer = Buffer.from(metadataJSON, 'utf-8');

    const uploadResult = await grove.uploadBuffer(metadataBuffer, 'application/json', {
      name: `song-${geniusId}-metadata.json`,
    });

    console.log(`  ✓ Uploaded to Grove`);
    console.log(`  ✓ URI: ${uploadResult.uri}`);
    console.log(`  ✓ Gateway: ${uploadResult.gatewayUrl}`);
    console.log(`  ✓ Size: ${(uploadResult.size / 1024).toFixed(2)} KB`);

    // Step 5: Update blockchain with metadata URI
    console.log(`\nStep 5: Updating blockchain with metadata URI...`);
    const txHash = await updateSongMetadata(geniusId, uploadResult.uri);

    // Update local metadata file
    metadata.metadataUri = uploadResult.uri;
    metadata.metadataGatewayUrl = uploadResult.gatewayUrl;
    metadata.updatedAt = new Date().toISOString();

    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`  ✓ Updated local metadata file`);

    // Success
    console.log('\n✅ Complete metadata built and uploaded!\n');
    console.log('Summary:');
    console.log(`  Genius ID: ${geniusId}`);
    console.log(`  Title: ${metadata.title}`);
    console.log(`  Artist: ${metadata.artist}`);
    console.log(`  Duration: ${metadata.duration}s`);
    console.log(`  Lyrics: ${metadata.lyrics ? 'Yes' : 'No'}`);
    console.log(`  MLC Song Code: ${metadata.licensing.mlcSongCode}`);
    console.log(`  Metadata URI: ${uploadResult.uri}`);
    console.log(`  Blockchain Tx: ${txHash}`);
    console.log('\nNext steps:');
    console.log('  - Process segments with 01-match-and-process.ts');
    console.log('  - Mint derivative IP assets with 02-mint-segment-ip-asset.ts');
    console.log();
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

main();
