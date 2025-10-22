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
import { buildSegmentMetadataV2, addBackendTranslations } from './build-segment-metadata-v2.js';
import { validateSegmentManifest } from '../../lib/schemas/segment-v2.js';
import { buildSegmentLyrics, buildTranslatedLyrics } from '../../lib/segment-lyrics-helpers.js';
import { TranslationService } from '../../services/translation.js';
import { uploadMutableAlignment } from '../../lib/grove-acl-config.js';
import { initGroveClient, createLensWalletClient } from '../../lib/lens.js';

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
    'skip-translations': { type: 'boolean', default: false },
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
const skipTranslations = values['skip-translations'] || false;
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
        prompt: 'Instrumental',
        audioPath: instrumentalPath,
        strength: 0.33,
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


    // Step 7: Build segment metadata v2 (lines + words)
    console.log('\nStep 7: Building segment metadata v2...');

    // Build v2 metadata with lines (LRCLib) + words (ElevenLabs)
    let segmentMetadata = await buildSegmentMetadataV2({
      geniusId,
      segmentHash,
      tiktokMusicId,
      matchResult,
    });

    const englishLyrics = segmentMetadata.lyrics.languages.en;
    const totalWords = englishLyrics.lines.reduce((sum, line) => sum + line.words.length, 0);
    console.log(`  ✓ English lyrics:`);
    console.log(`    Lines: ${englishLyrics.lines.length}`);
    console.log(`    Words: ${totalWords} (nested in lines)`);
    console.log(`    Preview: ${englishLyrics.plain.substring(0, 50)}...`);

    // Step 7.1: Add default translations (vi + zh)
    if (!skipTranslations) {
      console.log('\nStep 7.1: Adding default translations (vi + zh)...');
      const translationService = new TranslationService();

      const translations = new Map();

      // Translate to Vietnamese
      console.log('  Translating to Vietnamese...');
      const viPlain = await translationService.translateText(englishLyrics.plain, 'vi');
      const viLyrics = buildTranslatedLyrics(englishLyrics, viPlain);
      translations.set('vi', viLyrics);
      console.log(`    ✓ vi: ${viPlain.substring(0, 40)}...`);

      // Translate to Mandarin
      console.log('  Translating to Mandarin...');
      const zhPlain = await translationService.translateText(englishLyrics.plain, 'zh');
      const zhLyrics = buildTranslatedLyrics(englishLyrics, zhPlain);
      translations.set('zh', zhLyrics);
      console.log(`    ✓ zh: ${zhPlain.substring(0, 40)}...`);

      // Add to metadata
      segmentMetadata = addBackendTranslations(segmentMetadata, translations);
      console.log('  ✓ Added 2 translations (vi, zh)');
    } else {
      console.log('\nStep 7.1: Skipping translations (--skip-translations)');
    }

    // Step 8: Upload to Grove
    console.log('\nStep 8: Uploading to Grove...');
    const grove = new GroveService({ chainId: 37111 }); // Lens testnet

    let instrumentalUri = '';
    let alignmentUri = '';
    let alignmentStorageKey = '';

    // Upload segment metadata with mutable ACL (allows adding translations later)
    console.log('  Uploading alignment with mutable ACL...');
    const storageClient = initGroveClient();
    const walletClient = createLensWalletClient();

    const alignmentUpload = await uploadMutableAlignment(
      storageClient,
      segmentMetadata,
      walletClient
    );

    alignmentUri = alignmentUpload.uri;
    alignmentStorageKey = alignmentUpload.storageKey;

    const metadataJSON = JSON.stringify(segmentMetadata, null, 2);
    const fileSize = (Buffer.from(metadataJSON, 'utf-8').length / 1024).toFixed(1);
    const languageCount = Object.keys(segmentMetadata.lyrics.languages).length;
    console.log(`  ✓ Alignment: ${alignmentUri}`);
    console.log(`    Size: ${fileSize} KB (${languageCount} languages)`);
    console.log(`    Storage Key: ${alignmentStorageKey}`);

    if (!skipDemucs) {
      // Only upload fal.ai enhanced instrumental (vocals are never uploaded)
      const instrumentalUpload = await grove.upload(instrumentalPath, 'audio/mp3');
      instrumentalUri = instrumentalUpload.uri;

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
        instrumentalUri,
        alignmentUri,
        alignmentStorageKey,
      },
      processing: {
        demucs: !skipDemucs,
        falEnhancement: !skipFal && !skipDemucs,
      },
      createdAt: new Date().toISOString(),
    };

    const manifestPath = join(segmentDir, 'manifest.json');
    // Validate manifest before saving
    const validatedManifest = validateSegmentManifest(manifest);

    writeFileSync(manifestPath, JSON.stringify(validatedManifest, null, 2));
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
