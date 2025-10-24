#!/usr/bin/env bun
/**
 * Auto-Create Segment - NEW Automated Pipeline
 *
 * Automatically creates iconic karaoke segment without manual TikTok URL:
 * 1. Download full song (SpotDL)
 * 2. Fetch lyrics (LRCLIB)
 * 3. AI segment selection (Gemini Flash 2.5 Lite)
 * 4. Crop segment
 * 5. Demucs vocal separation
 * 6. fal.ai audio-to-audio transformation (copyright compliance)
 * 7. Upload to Grove
 * 8. Save segment metadata
 *
 * This replaces the manual flow that required TikTok segment URLs.
 *
 * Usage:
 *   bun modules/segments/auto-create-segment.ts \
 *     --genius-id 8434253 \
 *     --spotify-id 0V3wPSX9ygBnCm8psDIegu
 *
 * Flags:
 *   [--skip-demucs]        Skip vocal separation (testing only)
 *   [--skip-fal]           Skip fal.ai (BLOCKS GROVE UPLOAD)
 *   [--skip-translations]  Skip VI/ZH translations
 *   [--target-duration]    Target segment length (default: 30s)
 */

import { parseArgs } from 'util';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// Services
import { SpotDLService } from '../../services/spotdl.js';
import { LRCLibService } from '../../services/lrclib.js';
import { SegmentSelectorService } from '../../services/segment-selector.js';
import { AudioProcessingService } from '../../services/audio-processing.js';
import { DemucsModalService } from '../../services/demucs-modal.js';
import { FalAIService } from '../../services/fal-audio.js';
import { GroveService } from '../../services/grove.js';
import { TranslationService } from '../../services/translation.js';

// Metadata & Schema
import { buildSegmentMetadataV2, addBackendTranslations } from './build-segment-metadata-v2.js';
import { validateSegmentManifest, assertCopyrightCompliance } from '../../lib/schemas/segment-v2.js';
import { buildTranslatedLyrics } from '../../lib/segment-lyrics-helpers.js';
import { uploadMutableAlignment } from '../../lib/grove-acl-config.js';
import { initGroveClient, createLensWalletClient } from '../../lib/lens.js';

// ============================================================================
// CLI Arguments
// ============================================================================

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'genius-id': { type: 'string' },
    'spotify-id': { type: 'string' },
    'skip-demucs': { type: 'boolean', default: false },
    'skip-fal': { type: 'boolean', default: false },
    'skip-translations': { type: 'boolean', default: false },
    'target-duration': { type: 'string', default: '30' },
  },
});

if (!values['genius-id'] || !values['spotify-id']) {
  console.error('❌ Missing required arguments');
  console.error('\nUsage:');
  console.error('  bun modules/segments/auto-create-segment.ts \\');
  console.error('    --genius-id 8434253 \\');
  console.error('    --spotify-id 0V3wPSX9ygBnCm8psDIegu');
  console.error('\nOptions:');
  console.error('  --skip-demucs         Skip vocal separation (testing)');
  console.error('  --skip-fal            Skip fal.ai enhancement (BLOCKS UPLOAD)');
  console.error('  --skip-translations   Skip VI/ZH translations');
  console.error('  --target-duration 30  Target segment length in seconds\n');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);
const spotifyId = values['spotify-id']!;
const skipDemucs = values['skip-demucs'] || false;
const skipFal = values['skip-fal'] || false;
const skipTranslations = values['skip-translations'] || false;
const targetDuration = parseInt(values['target-duration']!);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create segment hash for directory name
 */
function createSegmentHash(geniusId: number, spotifyId: string): string {
  return createHash('sha256')
    .update(`auto-${geniusId}-${spotifyId}`)
    .digest('hex')
    .substring(0, 16);
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main() {
  console.log('🎵 Automated Segment Creation Pipeline\n');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    // Load song metadata
    const metadataPath = join(process.cwd(), 'data', 'songs', `${geniusId}.json`);
    if (!existsSync(metadataPath)) {
      throw new Error(
        `Song metadata not found for Genius ID ${geniusId}.\n` +
        `Run: bun modules/songs/01-create-song.ts --genius-id ${geniusId}`
      );
    }

    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    const { title, artist, duration } = metadata;

    console.log(`Song: ${title} by ${artist}`);
    console.log(`Genius ID: ${geniusId}`);
    console.log(`Spotify ID: ${spotifyId}`);
    console.log(`Duration: ${duration}s`);
    console.log(`Target segment: ${targetDuration}s\n`);

    // Create segment directory
    const segmentHash = createSegmentHash(geniusId, spotifyId);
    const segmentDir = join(process.cwd(), 'data', 'segments', segmentHash);
    mkdirSync(segmentDir, { recursive: true });

    console.log(`Segment Hash: ${segmentHash}`);
    console.log(`Directory: ${segmentDir}\n`);

    // Check if already processed
    const manifestPath = join(segmentDir, 'manifest.json');
    if (existsSync(manifestPath)) {
      console.log('⚠️  Segment already exists!');
      const existing = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      console.log(`   Created: ${existing.createdAt}`);
      console.log(`   Instrumental: ${existing.grove?.instrumentalUri}`);
      console.log(`   Alignment: ${existing.grove?.alignmentUri}\n`);
      console.log('Delete the manifest to recreate this segment.');
      return;
    }

    // ========================================================================
    // STEP 1: Download Full Song (SpotDL)
    // ========================================================================

    console.log('Step 1: Downloading full song from Spotify...\n');

    const spotdl = new SpotDLService(segmentDir);
    const downloadResult = await spotdl.download(spotifyId, 'flac');

    console.log(`✓ Downloaded: ${downloadResult.path}`);
    console.log(`  Artist: ${downloadResult.artist}`);
    console.log(`  Title: ${downloadResult.title}\n`);

    const fullSongPath = downloadResult.path;

    // ========================================================================
    // STEP 2: Fetch Lyrics (LRCLIB)
    // ========================================================================

    console.log('Step 2: Fetching synced lyrics from LRCLIB...\n');

    const lrclib = new LRCLibService();
    const lyricsResult = await lrclib.getBestMatch(title, artist);

    if (!lyricsResult) {
      throw new Error('No lyrics found in LRCLIB. Cannot auto-select segment.');
    }

    if (!lyricsResult.syncedLyrics) {
      throw new Error('No synced lyrics available. Cannot determine timestamps.');
    }

    console.log(`✓ Found: ${lyricsResult.trackName} by ${lyricsResult.artistName}`);
    console.log(`  Duration: ${lyricsResult.duration}s`);
    console.log(`  Synced lyrics: Yes\n`);

    // ========================================================================
    // STEP 3: AI Segment Selection (Gemini)
    // ========================================================================

    console.log('Step 3: Asking Gemini to select iconic segment...\n');

    const selector = new SegmentSelectorService();
    const selection = await selector.selectIconicSegment(
      lyricsResult.syncedLyrics,
      title,
      artist,
      lyricsResult.duration,
      targetDuration
    );

    console.log(`✓ Selected segment:`);
    console.log(`  Start: ${selection.startTime.toFixed(2)}s`);
    console.log(`  End: ${selection.endTime.toFixed(2)}s`);
    console.log(`  Duration: ${selection.duration.toFixed(2)}s`);
    console.log(`  Reason: ${selection.reason}\n`);

    // Save selection for reference
    const selectionPath = join(segmentDir, 'ai_selection.json');
    writeFileSync(
      selectionPath,
      JSON.stringify(
        {
          ...selection,
          model: 'google/gemini-2.5-flash-lite-preview-09-2025',
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );

    // ========================================================================
    // STEP 4: Crop Full Song to Selected Segment
    // ========================================================================

    console.log('Step 4: Cropping full song to selected segment...\n');

    const audioProcessing = new AudioProcessingService();
    const croppedPath = join(segmentDir, 'cropped.flac');

    await audioProcessing.crop(fullSongPath, croppedPath, {
      startTime: selection.startTime,
      endTime: selection.endTime,
      outputFormat: 'flac',
    });

    console.log(`✓ Cropped: ${croppedPath}\n`);

    // ========================================================================
    // STEP 4.5: Generate Word-Level Alignment (ElevenLabs STT)
    // ========================================================================

    console.log('Step 4.5: Generating word-level alignment with ElevenLabs STT...\n');

    const { ElevenLabsService } = await import('../../services/elevenlabs.js');
    const elevenlabs = new ElevenLabsService();

    const sttResult = await elevenlabs.transcribe(croppedPath, 'en');

    console.log(`✓ Transcribed: ${sttResult.words.length} words`);
    console.log(`  Preview: "${sttResult.text.substring(0, 60)}..."\n`);

    // ========================================================================
    // STEP 5: Demucs Vocal Separation
    // ========================================================================

    let vocalsPath = croppedPath;
    let instrumentalPath = croppedPath;

    if (!skipDemucs) {
      console.log('Step 5: Demucs vocal separation...\n');

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

      console.log(`✓ Vocals: ${vocalsPath}`);
      console.log(`✓ Instrumental: ${instrumentalPath}\n`);
    } else {
      console.log('Step 5: Skipping Demucs separation (--skip-demucs)\n');
    }

    // ========================================================================
    // STEP 6: fal.ai Enhancement (Copyright Compliance)
    // ========================================================================

    if (!skipFal && !skipDemucs) {
      console.log('Step 6: fal.ai audio enhancement...\n');

      const falAI = new FalAIService();

      const enhancedResult = await falAI.audioToAudio({
        prompt: 'Instrumental',
        audioPath: instrumentalPath,
        strength: 0.33,
      });

      const enhancedBuffer = await falAI.downloadAudio(enhancedResult.audioUrl);
      const enhancedPath = join(segmentDir, 'instrumental_enhanced.mp3');
      writeFileSync(enhancedPath, enhancedBuffer);

      instrumentalPath = enhancedPath;
      console.log(`✓ Enhanced: ${enhancedPath}\n`);
    } else {
      console.log('Step 6: Skipping fal.ai enhancement\n');
    }

    // ========================================================================
    // STEP 7: Build Segment Metadata
    // ========================================================================

    console.log('Step 7: Building segment metadata...\n');

    // Create match result object compatible with buildSegmentMetadataV2
    // We construct this from our AI selection + ElevenLabs STT data
    const matchResult = {
      startTime: selection.startTime,
      endTime: selection.endTime,
      duration: selection.duration,
      confidence: 1.0,
      method: 'ai-selection-gemini',

      // LRCLib data (required by buildSegmentMetadataV2)
      lrcMatch: {
        id: lyricsResult.id,
        syncedLyrics: lyricsResult.syncedLyrics,
      },

      // ElevenLabs word-level alignment (required by buildSegmentMetadataV2)
      fullAlignment: sttResult.words.map((word) => ({
        text: word.text,
        start: word.start,
        end: word.end,
      })),

      // Word indices (for buildSegmentMetadataV2)
      // Since we transcribed the cropped segment, we use all words (0 to length)
      startIdx: 0,
      endIdx: sttResult.words.length - 1,
    };

    let segmentMetadata = await buildSegmentMetadataV2({
      geniusId,
      segmentHash,
      tiktokMusicId: `auto-${spotifyId}`, // No TikTok, use Spotify ID
      matchResult,
    });

    const englishLyrics = segmentMetadata.lyrics.languages.en;
    const totalWords = englishLyrics.lines.reduce((sum, line) => sum + line.words.length, 0);
    console.log(`✓ English lyrics:`);
    console.log(`  Lines: ${englishLyrics.lines.length}`);
    console.log(`  Words: ${totalWords}`);
    console.log(`  Preview: ${englishLyrics.plain.substring(0, 50)}...\n`);

    // ========================================================================
    // STEP 7.1: Add Translations (VI + ZH)
    // ========================================================================

    if (!skipTranslations) {
      console.log('Step 7.1: Adding translations (vi + zh)...\n');

      const translationService = new TranslationService();
      const translations = new Map();

      // Vietnamese
      console.log('  Translating to Vietnamese...');
      const viPlain = await translationService.translateText(englishLyrics.plain, 'vi');
      const viLyrics = buildTranslatedLyrics(englishLyrics, viPlain);
      translations.set('vi', viLyrics);
      console.log(`  ✓ vi: ${viPlain.substring(0, 40)}...`);

      // Mandarin
      console.log('  Translating to Mandarin...');
      const zhPlain = await translationService.translateText(englishLyrics.plain, 'zh');
      const zhLyrics = buildTranslatedLyrics(englishLyrics, zhPlain);
      translations.set('zh', zhLyrics);
      console.log(`  ✓ zh: ${zhPlain.substring(0, 40)}...\n`);

      segmentMetadata = addBackendTranslations(segmentMetadata, translations);
      console.log('✓ Added 2 translations (vi, zh)\n');
    } else {
      console.log('Step 7.1: Skipping translations (--skip-translations)\n');
    }

    // ========================================================================
    // COPYRIGHT COMPLIANCE CHECK
    // ========================================================================

    if (!skipDemucs && skipFal) {
      throw new Error(
        '\n❌ COPYRIGHT VIOLATION: Cannot upload segment without fal.ai transformation.\n' +
        '   The instrumental track contains copyrighted audio.\n' +
        '   Remove --skip-fal flag to enable fal.ai enhancement.\n'
      );
    }

    // ========================================================================
    // STEP 8: Upload to Grove
    // ========================================================================

    console.log('Step 8: Uploading to Grove...\n');

    const grove = new GroveService({ chainId: 37111 }); // Lens testnet

    let instrumentalUri = '';
    let alignmentUri = '';
    let alignmentStorageKey = '';

    // Upload alignment with mutable ACL
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
      const instrumentalUpload = await grove.upload(instrumentalPath, 'audio/mp3');
      instrumentalUri = instrumentalUpload.uri;
      console.log(`  ✓ Instrumental: ${instrumentalUri}\n`);
    } else {
      console.log('  ⚠️  Skipping audio upload (Demucs was skipped)\n');
    }

    // ========================================================================
    // STEP 9: Save Segment Manifest
    // ========================================================================

    console.log('Step 9: Saving segment manifest...\n');

    const manifest = {
      segmentHash,
      geniusId,
      spotifyId,

      // TikTok fields (placeholder values for auto-created segments)
      tiktokMusicId: `auto-spotify-${spotifyId}`,
      tiktokUrl: `https://open.spotify.com/track/${spotifyId}`,
      tiktokSlug: `auto-${title.toLowerCase().replace(/\s+/g, '-')}`,

      autoCreated: true, // Flag to indicate this was auto-created
      aiSelection: {
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        targetDuration,
        reason: selection.reason,
      },
      match: {
        startTime: matchResult.startTime,
        endTime: matchResult.endTime,
        duration: matchResult.duration,
        confidence: matchResult.confidence,
        method: 'manual', // Use valid enum value (closest match to AI selection)
      },
      files: {
        tiktokClip: fullSongPath, // Use full song as placeholder
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

    // Validate manifest
    const validatedManifest = validateSegmentManifest(manifest);
    assertCopyrightCompliance(validatedManifest);

    writeFileSync(manifestPath, JSON.stringify(validatedManifest, null, 2));
    console.log(`✓ Saved: ${manifestPath}\n`);

    // ========================================================================
    // SUCCESS
    // ========================================================================

    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ Automated segment creation complete!\n');
    console.log('Segment Details:');
    console.log(`  Hash: ${segmentHash}`);
    console.log(`  Song: ${title} by ${artist}`);
    console.log(`  Segment: ${selection.startTime.toFixed(1)}s - ${selection.endTime.toFixed(1)}s`);
    console.log(`  Duration: ${selection.duration.toFixed(1)}s`);
    console.log(`  Reason: ${selection.reason}\n`);
    console.log('Grove URIs:');
    console.log(`  Instrumental: ${instrumentalUri}`);
    console.log(`  Alignment: ${alignmentUri}\n`);
    console.log('Next Steps:');
    console.log(`  1. Register on blockchain: bun modules/segments/02-register-segment.ts --segment-hash ${segmentHash}`);
    console.log(`  2. Mint Story IP: bun modules/segments/02-mint-segment-ip-asset.ts --segment-hash ${segmentHash}\n`);

  } catch (error: any) {
    console.error('\n❌ Pipeline failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
