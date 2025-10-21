#!/usr/bin/env bun
/**
 * Step 1: Match and Process TikTok Segment
 *
 * Complete pipeline:
 * 1. Download TikTok segment from music page
 * 2. Find/download full song audio
 * 3. Match segment to full song timestamps
 * 4. Crop matched segment
 * 5. Demucs vocal separation
 * 6. Optional fal.ai enhancement
 * 7. Upload to Grove storage
 * 8. Save segment metadata
 *
 * Usage:
 *   bun segments/01-match-and-process.ts \
 *     --genius-id 4712978 \
 *     --tiktok-url "https://www.tiktok.com/music/Cruel-Summer-7211414788142794754" \
 *     [--skip-demucs] \
 *     [--skip-fal]
 *
 * Next Steps:
 *   Run 02-register-segment.ts to register on blockchain
 */

import { parseArgs } from 'util';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// Services
import { AudioMatchingService } from '../../services/audio-matching.js';
import { AudioProcessingService } from '../../services/audio-processing.js';
import { DemucsModalService } from '../../services/demucs-modal.js';
import { FalAIService } from '../../services/fal-audio.js';
import { GroveService } from '../../services/grove.js';
import {
  extractTikTokMusicId,
  extractTikTokMusicSlug,
  isValidTikTokMusicUrl,
} from '../../services/tiktok.js';
import { cropAlignmentToSegment } from './build-segment-metadata.js';

const execAsync = promisify(exec);

// ============================================================================
// CLI Arguments
// ============================================================================

const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
    'tiktok-url': { type: 'string' },
    'skip-demucs': { type: 'boolean', default: false },
    'skip-fal': { type: 'boolean', default: false },
    'music-dir': { type: 'string' }, // Optional: path to music library
  },
});

if (!values['genius-id'] || !values['tiktok-url']) {
  console.error('L Missing required arguments');
  console.error('\nUsage:');
  console.error('  bun segments/01-match-and-process.ts \\');
  console.error('    --genius-id 4712978 \\');
  console.error('    --tiktok-url "https://www.tiktok.com/music/Cruel-Summer-7211414788142794754" \\');
  console.error('    [--skip-demucs] \\');
  console.error('    [--skip-fal] \\');
  console.error('    [--music-dir /path/to/music]');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);
const tiktokUrl = values['tiktok-url']!;
const skipDemucs = values['skip-demucs'] || false;
const skipFal = values['skip-fal'] || false;
const musicDir = values['music-dir'] || '/media/t42/me/Music';

// Validate TikTok URL
if (!isValidTikTokMusicUrl(tiktokUrl)) {
  console.error(`L Invalid TikTok music URL: ${tiktokUrl}`);
  console.error('Expected format: https://www.tiktok.com/music/{name}-{id}');
  process.exit(1);
}

const tiktokMusicId = extractTikTokMusicId(tiktokUrl);
const tiktokSlug = extractTikTokMusicSlug(tiktokUrl);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Run Python TikTok scraper
 */
async function downloadTikTokSegment(url: string, outputPath: string): Promise<void> {
  console.log('=� Downloading TikTok segment...');
  console.log(`  URL: ${url}`);
  console.log(`  Output: ${outputPath}`);

  // Run Python scraper
  const scriptPath = join(process.cwd(), 'lib', 'tiktok_music_scraper.py');
  const { stdout, stderr } = await execAsync(
    `DOTENV_PRIVATE_KEY='${process.env.DOTENV_PRIVATE_KEY}' python3 "${scriptPath}" "${url}" "${outputPath}"`
  );

  // Parse JSON output (last line)
  const lines = stdout.trim().split('\n');
  const jsonLine = lines[lines.length - 1];

  try {
    const result = JSON.parse(jsonLine);
    console.log(`   Downloaded (${result.duration.toFixed(1)}s)`);
  } catch {
    // Non-JSON output, just check if file exists
    if (existsSync(outputPath)) {
      console.log(`   Downloaded successfully`);
    } else {
      throw new Error('TikTok download failed');
    }
  }
}

/**
 * Find full song audio file
 * First tries local music library, then downloads from Spotify
 */
async function findOrDownloadFullSong(
  geniusId: number,
  musicDir: string
): Promise<string> {
  console.log('\n<� Finding full song audio...');

  // Load song metadata
  const metadataPath = join(process.cwd(), 'data', 'metadata', `${geniusId}.json`);
  if (!existsSync(metadataPath)) {
    throw new Error(`Metadata not found for song ${geniusId}. Run 01-register-song.ts first.`);
  }

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
  const { title, artist, spotify } = metadata;

  console.log(`  Title: ${title}`);
  console.log(`  Artist: ${artist}`);

  // Try to find in local music library
  if (existsSync(musicDir)) {
    console.log(`  Searching music library: ${musicDir}`);

    // Search for matching file
    const { stdout } = await execAsync(
      `find "${musicDir}" -type f \\( -name "*.flac" -o -name "*.mp3" -o -name "*.m4a" \\) | grep -i "${artist.replace(/[^a-z0-9]/gi, '.')}" | grep -i "${title.replace(/[^a-z0-9]/gi, '.')}"`
    ).catch(() => ({ stdout: '' }));

    const matches = stdout.trim().split('\n').filter((line) => line);

    if (matches.length > 0) {
      const songPath = matches[0];
      console.log(`   Found: ${songPath}\n`);
      return songPath;
    }
  }

  // Download from Spotify using spotdl
  if (!spotify?.url) {
    throw new Error('No Spotify URL found in metadata. Cannot download song.');
  }

  console.log(`  Downloading from Spotify: ${spotify.url}`);

  const downloadDir = join(process.cwd(), 'data', 'songs', geniusId.toString());
  mkdirSync(downloadDir, { recursive: true });

  const { stdout } = await execAsync(
    `DOTENV_PRIVATE_KEY='${process.env.DOTENV_PRIVATE_KEY}' dotenvx run -f .env -- spotdl download "${spotify.url}" --output "${join(downloadDir, 'original')}"`
  );

  // Find downloaded file
  const { stdout: findStdout } = await execAsync(`find "${downloadDir}" -name "*.flac" -o -name "*.mp3"`);
  const downloadedFile = findStdout.trim().split('\n')[0];

  if (!downloadedFile || !existsSync(downloadedFile)) {
    throw new Error('spotdl download failed');
  }

  console.log(`   Downloaded: ${downloadedFile}\n`);
  return downloadedFile;
}

/**
 * Create segment hash for directory name
 */
function createSegmentHash(geniusId: number, tiktokMusicId: string): string {
  return createHash('sha256')
    .update(`${geniusId}-${tiktokMusicId}`)
    .digest('hex')
    .substring(0, 16);
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main() {
  console.log('<� TikTok Segment Processing Pipeline\n');
  console.log('PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP\n');

  try {
    // Create segment directory
    const segmentHash = createSegmentHash(geniusId, tiktokMusicId);
    const segmentDir = join(process.cwd(), 'data', 'segments', segmentHash);
    mkdirSync(segmentDir, { recursive: true });

    console.log(`Segment ID: ${segmentHash}`);
    console.log(`Directory: ${segmentDir}\n`);

    // Step 1: Download TikTok segment
    console.log('Step 1: Downloading TikTok segment...');
    const tiktokClipPath = join(segmentDir, 'tiktok_clip.mp4');

    if (existsSync(tiktokClipPath)) {
      console.log(`  �  Already downloaded: ${tiktokClipPath}`);
    } else {
      await downloadTikTokSegment(tiktokUrl, tiktokClipPath);
    }

    // Step 2: Find/download full song
    console.log('Step 2: Finding full song audio...');
    const fullSongPath = await findOrDownloadFullSong(geniusId, musicDir);

    // Load metadata for song info
    const metadataPath = join(process.cwd(), 'data', 'metadata', `${geniusId}.json`);
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

    // Step 3: Match clip to full song
    console.log('\nStep 3: Matching clip to full song...');
    const matchingService = new AudioMatchingService();

    const matchResult = await matchingService.matchClipToSong(
      tiktokClipPath,
      fullSongPath,
      metadata.title,
      metadata.artist,
      metadata.album
    );

    console.log(`\n Match Result:`);
    console.log(`  Start: ${matchResult.startTime.toFixed(2)}s`);
    console.log(`  End: ${matchResult.endTime.toFixed(2)}s`);
    console.log(`  Duration: ${matchResult.duration.toFixed(2)}s`);
    console.log(`  Confidence: ${(matchResult.confidence * 100).toFixed(1)}%\n`);

    // Save match result
    const matchPath = join(segmentDir, 'match.json');
    writeFileSync(matchPath, JSON.stringify(matchResult, null, 2));

    // Step 4: Crop full song to matched segment
    console.log('Step 4: Cropping full song to matched timestamps...');
    const audioProcessing = new AudioProcessingService();
    const croppedPath = join(segmentDir, 'cropped.flac');

    await audioProcessing.crop(fullSongPath, croppedPath, {
      startTime: matchResult.startTime,
      endTime: matchResult.endTime,
      outputFormat: 'flac',
    });

    // Step 5: Demucs vocal separation (optional)
    let vocalsPath = croppedPath;
    let instrumentalPath = croppedPath;

    if (!skipDemucs) {
      console.log('\nStep 5: Demucs vocal separation...');
      const demucs = new DemucsModalService({
        model: 'mdx_extra',
        outputFormat: 'mp3',
        mp3Bitrate: 192,
      });

      const separationResult = await demucs.separate(croppedPath);
      const { vocalsPath: vPath, instrumentalPath: iPath } = await demucs.writeToFiles(
        separationResult,
        segmentDir
      );

      vocalsPath = vPath;
      instrumentalPath = iPath;

      console.log(`   Vocals: ${vocalsPath}`);
      console.log(`   Instrumental: ${instrumentalPath}`);
    } else {
      console.log('\nStep 5: Skipping Demucs separation (--skip-demucs)');
    }

    // Step 6: fal.ai enhancement (optional)
    if (!skipFal && !skipDemucs) {
      console.log('\nStep 6: fal.ai enhancement...');
      const falAI = new FalAIService();

      // Enhance instrumental
      const enhancedResult = await falAI.audioToAudio({
        prompt: 'instrumental',
        audioPath: instrumentalPath,
        strength: 0.3,
      });

      // Download enhanced audio
      const enhancedBuffer = await falAI.downloadAudio(enhancedResult.audioUrl);
      const enhancedPath = join(segmentDir, 'instrumental_enhanced.mp3');
      writeFileSync(enhancedPath, enhancedBuffer);

      instrumentalPath = enhancedPath;
      console.log(`   Enhanced: ${enhancedPath}`);
    } else {
      console.log('\nStep 6: Skipping fal.ai enhancement');
    }


    // Step 7: Build segment metadata with cropped lyrics
    console.log('\nStep 7: Building segment metadata...');

    // Crop alignment to segment timeframe only (copyright compliance)
    const croppedLyrics = cropAlignmentToSegment(
      matchResult.fullAlignment || [],
      matchResult.startTime,
      matchResult.endTime
    );

    const segmentMetadata = {
      version: '1.0.0',
      geniusId,
      segmentHash,
      tiktokMusicId,
      timeRange: {
        startTime: matchResult.startTime,
        endTime: matchResult.endTime,
        duration: matchResult.duration,
      },
      lyrics: {
        en: croppedLyrics,
        lrclib: {
          id: matchResult.lrcMatch?.id || 0,
          source: 'lrclib',
        },
      },
      createdAt: new Date().toISOString(),
    };

    console.log(`  ✓ Cropped lyrics to segment timeframe`);
    console.log(`  ✓ Words in segment: ${croppedLyrics.synced.length}`);
    console.log(`  ⚠️  Full song lyrics NOT included (copyright)`);

    // Step 8: Upload to Grove
    console.log('\nStep 8: Uploading to Grove...');
    const grove = new GroveService({ chainId: 37111 }); // Lens testnet

    let vocalsUri = '';
    let instrumentalUri = '';
    let alignmentUri = '';

    // Upload segment metadata (cropped lyrics + alignment)
    const metadataJSON = JSON.stringify(segmentMetadata, null, 2);
    const metadataBuffer = Buffer.from(metadataJSON, 'utf-8');
    const alignmentUpload = await grove.uploadBuffer(metadataBuffer, 'application/json');
    alignmentUri = alignmentUpload.uri;

    console.log(`  ✓ Alignment: ${alignmentUri}`);

    if (!skipDemucs) {
      const vocalsUpload = await grove.upload(vocalsPath, 'audio/mp3');
      const instrumentalUpload = await grove.upload(instrumentalPath, 'audio/mp3');

      vocalsUri = vocalsUpload.uri;
      instrumentalUri = instrumentalUpload.uri;

      console.log(`  ✓ Vocals: ${vocalsUri}`);
      console.log(`  ✓ Instrumental: ${instrumentalUri}`);
    } else {
      console.log('  ⚠️  Skipping audio upload (Demucs was skipped)');
    }

    // Step 9: Save segment manifest
    console.log('\nStep 9: Saving segment manifest...');
    const manifest = {
      segmentHash,
      geniusId,
      tiktokMusicId,
      tiktokUrl,
      tiktokSlug,
      match: {
        startTime: matchResult.startTime,
        endTime: matchResult.endTime,
        duration: matchResult.duration,
        confidence: matchResult.confidence,
        method: matchResult.method,
      },
      files: {
        tiktokClip: tiktokClipPath,
        fullSong: fullSongPath,
        cropped: croppedPath,
        vocals: vocalsPath,
        instrumental: instrumentalPath,
      },
      grove: {
        vocalsUri,
        instrumentalUri,
        alignmentUri,
      },
      processing: {
        demucs: !skipDemucs,
        falEnhancement: !skipFal && !skipDemucs,
      },
      createdAt: new Date().toISOString(),
    };

    const manifestPath = join(segmentDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`   Saved: ${manifestPath}`);

    // Success
    console.log('\n Segment processing complete!\n');
    console.log('Next step:');
    console.log(`  bun segments/02-register-segment.ts --segment-hash ${segmentHash}`);
    console.log();
  } catch (error: any) {
    console.error('\nL Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
