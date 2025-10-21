#!/usr/bin/env bun
/**
 * Test Audio Processing Pipeline
 *
 * Tests the full audio processing workflow:
 * 1. Crop original song to matched segment
 * 2. Separate vocals/instrumental with Demucs
 * 3. Enhance instrumental with fal.ai
 *
 * Usage:
 *   bun run test-audio-processing.ts \
 *     --song <path> \
 *     --start <seconds> \
 *     --end <seconds> \
 *     --output-dir <path>
 *
 * Example:
 *   bun run test-audio-processing.ts \
 *     --song "/media/t42/me/Music/Beyoncé - COWBOY CARTER/07 TEXAS HOLD 'EM.flac" \
 *     --start 0 \
 *     --end 60.56 \
 *     --output-dir /tmp/karaoke-test
 */

import { parseArgs } from 'util';
import {
  AudioProcessingService,
  DemucsService,
  DemucsModalService,
  FalAIService,
  GroveService,
} from './services/index.js';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      song: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      'output-dir': { type: 'string' },
      'skip-demucs': { type: 'boolean' }, // For testing without Demucs installed
      'skip-fal': { type: 'boolean' }, // For testing without fal.ai API key
    },
  });

  if (!values.song || !values.start || !values.end) {
    console.error('❌ Missing required arguments\n');
    console.log('Usage:');
    console.log('  bun run test-audio-processing.ts \\');
    console.log('    --song <path> \\');
    console.log('    --start <seconds> \\');
    console.log('    --end <seconds> \\');
    console.log('    [--output-dir <path>] \\');
    console.log('    [--skip-demucs] \\');
    console.log('    [--skip-fal]\n');
    console.log('Example:');
    console.log('  bun run test-audio-processing.ts \\');
    console.log('    --song "/path/to/song.flac" \\');
    console.log('    --start 0 \\');
    console.log('    --end 60.56 \\');
    console.log('    --output-dir /tmp/karaoke-test');
    process.exit(1);
  }

  const songPath = values.song;
  const startTime = parseFloat(values.start);
  const endTime = parseFloat(values.end);
  const outputDir = values['output-dir'] || '/tmp/karaoke-processing';
  const skipDemucs = values['skip-demucs'] || false;
  const skipFal = values['skip-fal'] || false;

  if (!existsSync(songPath)) {
    console.error(`❌ Song file not found: ${songPath}`);
    process.exit(1);
  }

  console.log('🎵 Audio Processing Pipeline Test\n');
  console.log('═'.repeat(60));
  console.log();

  console.log('Input:');
  console.log(`  Song: ${songPath}`);
  console.log(`  Time: ${startTime}s - ${endTime}s (${(endTime - startTime).toFixed(2)}s)`);
  console.log(`  Output: ${outputDir}`);
  console.log();

  // Create output directory
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  try {
    // Step 1: Crop audio
    console.log('Step 1: Cropping audio segment...');
    const audioProcessor = new AudioProcessingService();
    const croppedPath = join(outputDir, 'segment.mp3');

    await audioProcessor.crop(songPath, croppedPath, {
      startTime,
      endTime,
      outputFormat: 'mp3',
      bitrate: 192,
    });

    console.log(`✓ Segment saved: ${croppedPath}\n`);

    if (skipDemucs) {
      console.log('⏭️  Skipping Demucs (--skip-demucs flag set)\n');
      console.log('✅ Test completed (partial)');
      return;
    }

    // Step 2: Demucs separation
    console.log('Step 2: Separating vocals and instrumental with Demucs...');

    // Use Modal if MODAL_DEMUCS_ENDPOINT is set, otherwise fall back to local
    const useModal = !!process.env.MODAL_DEMUCS_ENDPOINT;

    if (useModal) {
      console.log('Using Modal (GPU-accelerated)...\n');

      const demucsModal = new DemucsModalService({
        model: 'mdx_extra',
        outputFormat: 'mp3',
        mp3Bitrate: 192,
      });

      const result = await demucsModal.separate(croppedPath);

      // Write files to output directory
      const { vocalsPath, instrumentalPath } = await demucsModal.writeToFiles(
        result,
        outputDir
      );

      var demucsResult = {
        ...result,
        vocalsPath,
        instrumentalPath,
      };
    } else {
      console.log('Using local Demucs (CPU)...');
      console.log('(This may take 30-60 seconds...)\n');

      const demucs = new DemucsService({
        model: 'mdx_extra',
        outputFormat: 'mp3',
        mp3Bitrate: 192,
        device: 'cpu', // Change to 'cuda' if GPU available
      });

      var demucsResult = await demucs.separate(croppedPath, outputDir);
    }

    console.log(`✓ Vocals: ${demucsResult.vocalsPath}`);
    console.log(`✓ Instrumental: ${demucsResult.instrumentalPath}`);
    console.log(`  Duration: ${demucsResult.duration.toFixed(1)}s\n`);

    if (skipFal) {
      console.log('⏭️  Skipping fal.ai enhancement (--skip-fal flag set)\n');

      // Save results summary
      const summary = {
        input: {
          song: songPath,
          startTime,
          endTime,
          duration: endTime - startTime,
        },
        outputs: {
          cropped: croppedPath,
          vocals: demucsResult.vocalsPath,
          instrumental: demucsResult.instrumentalPath,
        },
        timing: {
          demucs: demucsResult.duration,
        },
        note: 'fal.ai enhancement skipped',
      };

      const summaryPath = join(outputDir, 'processing-summary.json');
      await writeFile(summaryPath, JSON.stringify(summary, null, 2));

      console.log('✅ Test completed (partial)');
      console.log(`📄 Summary: ${summaryPath}`);
      return;
    }

    // Step 3: fal.ai enhancement (using Base64 data URI)
    console.log('Step 3: Enhancing instrumental with fal.ai...');
    console.log('(This may take 30-60 seconds...)\n');

    const falai = new FalAIService();

    // Use Base64 data URI (no Grove upload needed!)
    const falResult = await falai.audioToAudio({
      prompt: 'instrumental',
      audioPath: demucsResult.instrumentalPath, // Encodes as Base64 internally
      strength: 0.3,
    });

    console.log(`✓ Enhancement complete in ${falResult.duration.toFixed(1)}s`);
    console.log(`  Cost: $${falResult.cost.toFixed(2)}\n`);

    // Download enhanced audio
    console.log('Downloading enhanced instrumental...');
    const enhancedBuffer = await falai.downloadAudio(falResult.audioUrl);
    const enhancedPath = join(outputDir, 'instrumental_enhanced.mp3');
    await writeFile(enhancedPath, enhancedBuffer);
    console.log(`✓ Saved: ${enhancedPath}\n`);

    // Step 4: Upload to Grove
    console.log('Step 4: Uploading to Grove storage...');

    const grove = new GroveService({ chainId: 37111 }); // Lens testnet

    console.log('Uploading vocals...');
    const vocalsGrove = await grove.upload(demucsResult.vocalsPath);

    console.log('Uploading enhanced instrumental...');
    const instrumentalGrove = await grove.uploadBuffer(enhancedBuffer);

    console.log();

    // Save results summary
    const summary = {
      input: {
        song: songPath,
        startTime,
        endTime,
        duration: endTime - startTime,
      },
      outputs: {
        local: {
          cropped: croppedPath,
          vocalsOriginal: demucsResult.vocalsPath,
          instrumentalOriginal: demucsResult.instrumentalPath,
          instrumentalEnhanced: enhancedPath,
        },
        grove: {
          vocals: {
            uri: vocalsGrove.uri,
            cid: vocalsGrove.cid,
            gatewayUrl: vocalsGrove.gatewayUrl,
          },
          instrumental: {
            uri: instrumentalGrove.uri,
            cid: instrumentalGrove.cid,
            gatewayUrl: instrumentalGrove.gatewayUrl,
          },
        },
      },
      timing: {
        demucs: demucsResult.duration,
        falEnhancement: falResult.duration,
      },
      costs: {
        falEnhancement: falResult.cost,
      },
      next_steps: ['Register segment on-chain with Grove URIs', 'Link to song in contracts'],
    };

    const summaryPath = join(outputDir, 'processing-summary.json');
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📄 Summary saved: ${summaryPath}\n`);

    console.log('✅ Test completed successfully!');
    console.log();
    console.log('Local files:');
    console.log(`  Cropped segment: ${croppedPath}`);
    console.log(`  Vocals (original): ${demucsResult.vocalsPath}`);
    console.log(`  Instrumental (original): ${demucsResult.instrumentalPath}`);
    console.log(`  Instrumental (enhanced): ${enhancedPath}`);
    console.log();
    console.log('Grove URIs:');
    console.log(`  Vocals: ${vocalsGrove.uri}`);
    console.log(`  Instrumental: ${instrumentalGrove.uri}`);
    console.log();
    console.log(`📄 Summary: ${summaryPath}`);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
