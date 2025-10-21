#!/usr/bin/env bun
/**
 * Master Pipeline: Process Song from Scratch
 *
 * Complete end-to-end pipeline:
 * 1. Register artist (if needed)
 * 2. Register song with Spotify metadata
 * 3. Fetch MLC licensing data
 * 4. Build complete metadata JSON with lyrics
 * 5. Process TikTok segment (match + audio + alignment)
 * 6. Register segment on blockchain
 *
 * Prerequisites:
 * - PRIVATE_KEY in .env
 * - SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
 * - GENIUS_API_KEY
 * - OPENROUTER_API_KEY (for matching)
 * - ELEVENLABS_API_KEY (for alignment)
 * - FAL_KEY (for audio enhancement)
 * - Modal Demucs deployed
 *
 * Usage:
 *   bun 00-process-song-complete.ts \
 *     --genius-id 10047250 \
 *     --genius-artist-id 498 \
 *     --tiktok-url "https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891" \
 *     --song-path "/path/to/song.flac"
 */

import { parseArgs } from 'util';
import { execSync } from 'child_process';
import path from 'path';

const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
    'genius-artist-id': { type: 'string' },
    'tiktok-url': { type: 'string' },
    'song-path': { type: 'string' },
    'skip-artist': { type: 'boolean' },
    'skip-song': { type: 'boolean' },
    'skip-mlc': { type: 'boolean' },
    'skip-metadata': { type: 'boolean' },
    'mint-story': { type: 'boolean' },
    'skip-segment': { type: 'boolean' },
  },
  strict: false,
  allowPositionals: true,
});

if (!values['genius-id'] || !values['genius-artist-id'] || !values['tiktok-url'] || !values['song-path']) {
  console.error('❌ Missing required arguments');
  console.error('\nUsage: bun 00-process-song-complete.ts \\');
  console.error('  --genius-id 10047250 \\');
  console.error('  --genius-artist-id 498 \\');
  console.error('  --tiktok-url "https://www.tiktok.com/music/..." \\');
  console.error('  --song-path "/path/to/song.flac"');
  console.error('\nOptional flags:');
  console.error('  --skip-artist     Skip artist registration');
  console.error('  --skip-song       Skip song registration');
  console.error('  --skip-mlc        Skip MLC data fetching (cannot be used with --mint-story)');
  console.error('  --skip-metadata   Skip metadata building');
  console.error('  --mint-story      Mint Story Protocol IP Asset (REQUIRES MLC data ≥98%)');
  console.error('  --skip-segment    Skip segment processing');
  process.exit(1);
}

const geniusId = values['genius-id']!;
const geniusArtistId = values['genius-artist-id']!;
const tiktokUrl = values['tiktok-url']!;
const songPath = values['song-path']!;

console.log('\n🎵 MASTER PIPELINE: Complete Song Processing\n');
console.log('════════════════════════════════════════════════════════════\n');
console.log(`Genius Song ID: ${geniusId}`);
console.log(`Genius Artist ID: ${geniusArtistId}`);
console.log(`TikTok URL: ${tiktokUrl}`);
console.log(`Song File: ${songPath}\n`);
console.log('════════════════════════════════════════════════════════════\n');

const cwd = process.cwd();

function runStep(name: string, command: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(60) + '\n');

  try {
    execSync(command, { stdio: 'inherit', cwd });
    console.log(`\n✅ ${name} complete\n`);
  } catch (error) {
    console.error(`\n❌ ${name} failed\n`);
    throw error;
  }
}

async function main() {
  try {
    const startTime = Date.now();

    // Step 1: Register artist
    if (!values['skip-artist']) {
      runStep(
        'STEP 1: Register Artist',
        `bun artists/01-register-artist.ts --genius-id ${geniusArtistId} --pkp-address 0x0000000000000000000000000000000000000001 --lens-handle artist-${geniusArtistId} --lens-account 0x0000000000000000000000000000000000000002`
      );
    } else {
      console.log('\n⏭️  Skipping artist registration\n');
    }

    // Step 2: Register song
    if (!values['skip-song']) {
      runStep(
        'STEP 2: Register Song',
        `bun songs/01-register-song.ts --genius-id ${geniusId} --genius-artist-id ${geniusArtistId}`
      );
    } else {
      console.log('\n⏭️  Skipping song registration\n');
    }

    // Step 3: Fetch MLC data
    if (!values['skip-mlc']) {
      runStep(
        'STEP 3: Fetch MLC Licensing Data',
        `bun songs/02-fetch-mlc-data.ts --genius-id ${geniusId}`
      );
    } else {
      console.log('\n⏭️  Skipping MLC data fetching\n');
    }

    // Step 4: Build metadata
    if (!values['skip-metadata']) {
      runStep(
        'STEP 4: Build Metadata JSON',
        `bun songs/03-build-metadata.ts --genius-id ${geniusId}`
      );
    } else {
      console.log('\n⏭️  Skipping metadata building\n');
    }

    // Step 5: Mint Story Protocol IP Asset (optional)
    if (values['mint-story']) {
      // Enforce MLC data requirement
      if (values['skip-mlc']) {
        console.log('\n❌ ERROR: Cannot mint Story Protocol IP Asset without MLC data\n');
        console.log('Story Protocol requires complete MLC licensing data (≥98% publisher shares).');
        console.log('');
        console.log('Fix: Remove --skip-mlc flag or run MLC step separately:');
        console.log(`  bun songs/02-fetch-mlc-data.ts --genius-id ${geniusId}\n`);
        throw new Error('MLC data required for Story Protocol minting');
      }

      runStep(
        'STEP 5: Mint Story Protocol IP Asset',
        `bun story/01-mint-ip-asset.ts --genius-id ${geniusId}`
      );
    } else {
      console.log('\n⏭️  Skipping Story Protocol minting (use --mint-story to enable)\n');
    }

    // Step 6: Process segment
    if (!values['skip-segment']) {
      runStep(
        'STEP 6: Process Segment (Match + Audio + Alignment)',
        `bun segments/01-match-and-process.ts --genius-id ${geniusId} --tiktok-url "${tiktokUrl}" --song-path "${songPath}"`
      );
    } else {
      console.log('\n⏭️  Skipping segment processing\n');
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n' + '═'.repeat(60));
    console.log('  ✨ PIPELINE COMPLETE ✨');
    console.log('═'.repeat(60) + '\n');
    console.log(`⏱️  Total time: ${duration}s\n`);
    console.log('📊 Summary:');
    console.log('  ✅ Artist registered');
    console.log('  ✅ Song registered with metadata');
    console.log('  ✅ MLC licensing data fetched');
    console.log('  ✅ Metadata JSON built and uploaded');
    if (values['mint-story']) {
      console.log('  ✅ Story Protocol IP Asset minted');
    }
    if (!values['skip-segment']) {
      console.log('  ✅ Segment processed and registered');
    }
    console.log('\nNext steps:');
    console.log('  - Add more segments: bun segments/01-match-and-process.ts');
    if (!values['mint-story']) {
      console.log('  - Mint Story Protocol IP: bun story/01-mint-ip-asset.ts --genius-id ' + geniusId);
      if (values['skip-mlc']) {
        console.log('    (Requires MLC data: bun songs/02-fetch-mlc-data.ts --genius-id ' + geniusId + ')');
      }
    }
    console.log('  - Create Lens posts: (coming soon)\n');

  } catch (error: any) {
    console.error('\n❌ Pipeline failed:', error.message);
    process.exit(1);
  }
}

main();
