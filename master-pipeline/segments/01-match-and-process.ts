#!/usr/bin/env bun
/**
 * Match and Process Segment
 *
 * Complete pipeline:
 * 1. Match TikTok segment to song timestamp (audio matching)
 * 2. Crop audio segment
 * 3. Process stems (Demucs + fal.ai)
 * 4. Get forced alignment (ElevenLabs)
 * 5. Upload to Grove (vocals, instrumental, alignment)
 * 6. Register segment on blockchain
 *
 * Prerequisites:
 * - Song registered with metadata
 * - TikTok segment URL
 *
 * Usage:
 *   bun segments/01-match-and-process.ts \
 *     --genius-id 10047250 \
 *     --tiktok-url "https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891" \
 *     --song-path "/path/to/song.flac"
 */

import { parseArgs } from 'util';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
    'tiktok-url': { type: 'string' },
    'song-path': { type: 'string' },
    'output-dir': { type: 'string' },
  },
});

if (!values['genius-id'] || !values['tiktok-url'] || !values['song-path']) {
  console.error('❌ Missing required arguments');
  console.error('Usage: bun segments/01-match-and-process.ts \\');
  console.error('  --genius-id 10047250 \\');
  console.error('  --tiktok-url "https://www.tiktok.com/..." \\');
  console.error('  --song-path "/path/to/song.flac"');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);
const tiktokUrl = values['tiktok-url']!;
const songPath = values['song-path']!;
const outputDir = values['output-dir'] || `/tmp/karaoke-${Date.now()}`;

console.log('🎵 Complete Segment Pipeline\n');
console.log('════════════════════════════════════════════════════════════\n');
console.log(`Genius ID: ${geniusId}`);
console.log(`TikTok URL: ${tiktokUrl}`);
console.log(`Song: ${songPath}`);
console.log(`Output: ${outputDir}\n`);

// Extract TikTok ID from URL
const { extractTikTokMusicId } = await import('../services/tiktok.js');
const tiktokId = extractTikTokMusicId(tiktokUrl);

const SEGMENT_REGISTRY = process.env.SEGMENT_REGISTRY_ADDRESS;
const privateKey = process.env.PRIVATE_KEY;

if (!SEGMENT_REGISTRY || !privateKey) {
  throw new Error('Contract addresses or private key not set');
}

const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
const account = privateKeyToAccount(formattedKey as `0x${string}`);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

async function main() {
  try {
    await mkdir(outputDir, { recursive: true });

    // Step 1: Audio matching
    console.log('Step 1: Matching TikTok segment to song...');
    const matchResult = await import('../services/audio-matching.js');
    const audioMatchingService = new matchResult.AudioMatchingService();

    const matchData = await audioMatchingService.matchTikTokToSong(
      tiktokUrl,
      songPath,
      geniusId
    );

    console.log(`  ✅ Matched: ${matchData.startTime}s - ${matchData.endTime}s`);
    console.log(`  Duration: ${matchData.duration}s`);
    console.log(`  Confidence: ${matchData.confidence}%\n`);

    // Step 2: Crop audio segment
    console.log('Step 2: Cropping audio segment...');
    const croppedPath = path.join(outputDir, 'cropped.flac');

    execSync(
      `ffmpeg -i "${songPath}" -ss ${matchData.startTime} -t ${matchData.duration} -c copy "${croppedPath}" -y`,
      { stdio: 'inherit' }
    );
    console.log(`  ✅ Cropped: ${croppedPath}\n`);

    // Step 3: Process stems (Demucs + fal.ai)
    console.log('Step 3: Processing stems (Demucs + fal.ai)...');
    const audioProcessor = new (await import('../services/audio-processing.js')).AudioProcessingService();

    const stemResult = await audioProcessor.processStemSeparation(croppedPath, outputDir);
    console.log(`  ✅ Vocals: ${stemResult.vocalsPath}`);
    console.log(`  ✅ Instrumental: ${stemResult.instrumentalPath}\n`);

    // Step 4: Get forced alignment
    console.log('Step 4: Getting forced alignment from ElevenLabs...');

    // Load metadata for lyrics
    const metadataPath = path.join(process.cwd(), 'data', 'metadata', `${geniusId}.json`);
    const metadataRaw = await readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataRaw);

    if (!metadata.lyrics?.en?.synced) {
      console.log('  ⚠️  No synced lyrics available, skipping alignment');
      console.log('  (Segment will be registered without alignment URI)\n');
    }

    let alignmentUri = '';

    if (metadata.lyrics?.en?.synced) {
      // Extract lyrics for this time range
      const segmentLyrics = metadata.lyrics.en.synced.filter((line: any) => {
        return line.start >= matchData.startTime && line.start <= matchData.endTime;
      });

      if (segmentLyrics.length === 0) {
        console.log('  ⚠️  No lyrics in this time range\n');
      } else {
        const lyricsText = segmentLyrics.map((l: any) => l.text).join('\n');

        const elevenlabsService = new (await import('../services/elevenlabs.js')).ElevenLabsService();
        const alignmentResult = await elevenlabsService.getForcedAlignment(
          stemResult.vocalsPath,
          lyricsText
        );

        console.log(`  ✅ Alignment complete: ${alignmentResult.words.length} words`);

        // Save alignment to file and upload to Grove
        const alignmentPath = path.join(outputDir, 'alignment.json');
        await writeFile(alignmentPath, JSON.stringify(alignmentResult, null, 2));
        console.log(`  ✅ Saved: ${alignmentPath}`);

        console.log('  Uploading alignment to Grove...');
        const { GroveService } = await import('../services/grove.js');
        const groveService = new GroveService();
        const alignmentUpload = await groveService.upload(alignmentPath, 'application/json');
        alignmentUri = alignmentUpload.uri;
        console.log(`  ✅ Alignment URI: ${alignmentUri}\n`);
      }
    }

    // Step 5: Upload stems to Grove
    console.log('Step 5: Uploading stems to Grove...');
    const { GroveService } = await import('../services/grove.js');
    const groveService = new GroveService();

    console.log('  Uploading vocals...');
    const vocalsUpload = await groveService.upload(stemResult.vocalsPath, 'audio/wav');
    console.log(`  ✅ Vocals URI: ${vocalsUpload.uri}`);

    console.log('  Uploading instrumental...');
    const instrumentalUpload = await groveService.upload(stemResult.instrumentalPath, 'audio/wav');
    console.log(`  ✅ Instrumental URI: ${instrumentalUpload.uri}\n`);

    // Step 6: Register segment on blockchain
    console.log('Step 6: Registering segment on blockchain...');

    const segmentScript = path.join(process.cwd(), 'segments', '02-register-segment.ts');
    const registerCmd = [
      'bun',
      segmentScript,
      '--genius-id', geniusId.toString(),
      '--tiktok-id', tiktokId,
      '--start-time', matchData.startTime.toString(),
      '--end-time', matchData.endTime.toString(),
      '--vocals-uri', vocalsUpload.uri,
      '--instrumental-uri', instrumentalUpload.uri,
    ];

    if (alignmentUri) {
      registerCmd.push('--alignment-uri', alignmentUri);
    }

    execSync(registerCmd.join(' '), { stdio: 'inherit' });

    console.log('\n✅ Segment Pipeline Complete!\n');
    console.log('Summary:');
    console.log(`  Time Range: ${matchData.startTime}s - ${matchData.endTime}s`);
    console.log(`  Vocals: ${vocalsUpload.uri}`);
    console.log(`  Instrumental: ${instrumentalUpload.uri}`);
    if (alignmentUri) {
      console.log(`  Alignment: ${alignmentUri}`);
    }
    console.log(`  Registered: ${tiktokId}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
