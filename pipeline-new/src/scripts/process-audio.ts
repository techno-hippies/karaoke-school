#!/usr/bin/env bun
/**
 * Process Audio Script
 *
 * Processes audio for karaoke:
 *   1. Separate vocals and instrumental (Demucs)
 *   2. Enhance instrumental (FAL.ai)
 *   3. Save to local files and optionally upload to Grove
 *
 * Prerequisites:
 *   - Original audio file in song directory
 *
 * Usage:
 *   bun src/scripts/process-audio.ts --iswc=T0704563291
 *   bun src/scripts/process-audio.ts --iswc=T0704563291 --audio-path=./songs/T0704563291/original.mp3
 *   bun src/scripts/process-audio.ts --iswc=T0704563291 --skip-enhance
 */

import { parseArgs } from 'util';
import path from 'path';
import { getSongByISWC, updateSongAudio, updateSongStage } from '../db/queries';
import { separateAudio, type DemucsResult } from '../services/demucs';
import { enhanceInstrumental } from '../services/fal';
import { uploadAudioToGrove } from '../services/grove';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv } from '../config';

// FAL.ai has a 3:10 (190s) limit - use 180s segments with 5s overlap
const FAL_MAX_DURATION = 180;
const CROSSFADE_DURATION = 5;

/**
 * Get audio duration in seconds using ffprobe
 */
async function getAudioDuration(audioPath: string): Promise<number> {
  const proc = Bun.spawn(['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return parseFloat(output.trim());
}

/**
 * Split audio file into segments for FAL processing
 */
async function splitAudioForFal(inputPath: string, duration: number, iswc: string): Promise<string[]> {
  const segments: string[] = [];
  let start = 0;
  let segmentIndex = 0;

  while (start < duration) {
    const segmentPath = `/tmp/${iswc}-segment-${segmentIndex}.mp3`;
    const segmentDuration = Math.min(FAL_MAX_DURATION, duration - start + CROSSFADE_DURATION);

    const ffmpeg = Bun.spawn([
      'ffmpeg', '-y', '-i', inputPath,
      '-ss', start.toString(),
      '-t', segmentDuration.toString(),
      '-b:a', '192k',
      segmentPath
    ], { stdout: 'pipe', stderr: 'pipe' });
    await ffmpeg.exited;

    segments.push(segmentPath);
    start += FAL_MAX_DURATION - CROSSFADE_DURATION; // Overlap for crossfade
    segmentIndex++;
  }

  return segments;
}

/**
 * Crossfade and merge enhanced segments back together
 */
async function crossfadeMergeSegments(segmentPaths: string[], outputPath: string): Promise<void> {
  if (segmentPaths.length === 1) {
    // Single segment, just copy
    const data = await Bun.file(segmentPaths[0]).arrayBuffer();
    await Bun.write(outputPath, data);
    return;
  }

  // Build ffmpeg filter for crossfade
  // acrossfade between each pair of segments
  let filterComplex = '';
  let currentInput = '[0:a]';

  for (let i = 1; i < segmentPaths.length; i++) {
    const nextInput = `[${i}:a]`;
    const outputLabel = i === segmentPaths.length - 1 ? '[out]' : `[a${i}]`;
    filterComplex += `${currentInput}${nextInput}acrossfade=d=${CROSSFADE_DURATION}:c1=tri:c2=tri${outputLabel}`;
    if (i < segmentPaths.length - 1) {
      filterComplex += ';';
      currentInput = `[a${i}]`;
    }
  }

  const args = ['ffmpeg', '-y'];
  for (const seg of segmentPaths) {
    args.push('-i', seg);
  }
  args.push('-filter_complex', filterComplex, '-map', '[out]', '-b:a', '192k', outputPath);

  const ffmpeg = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
  await ffmpeg.exited;
}

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'audio-path': { type: 'string' },
    'songs-dir': { type: 'string', default: './songs' },
    'skip-enhance': { type: 'boolean', default: false },
    'skip-upload': { type: 'boolean', default: false },
  },
  strict: true,
});

async function main() {
  // Validate required env
  validateEnv(['DATABASE_URL', 'RUNPOD_API_KEY', 'RUNPOD_DEMUCS_ENDPOINT_ID']);

  // Validate required args
  if (!values.iswc) {
    console.error('❌ Missing required argument: --iswc');
    console.log('\nUsage:');
    console.log('  bun src/scripts/process-audio.ts --iswc=T0704563291');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  console.log('\n🔊 Processing Audio');
  console.log(`   ISWC: ${iswc}`);

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
    process.exit(1);
  }

  console.log(`   Title: ${song.title}`);
  console.log(`   Stage: ${song.stage}`);

  // Find original audio
  const songDir = path.join(values['songs-dir']!, iswc);
  let audioPath = values['audio-path'];

  if (!audioPath) {
    // Check common filenames
    const candidates = ['original.mp3', 'audio.mp3', `${iswc}.mp3`];
    for (const candidate of candidates) {
      const candidatePath = path.join(songDir, candidate);
      if (await Bun.file(candidatePath).exists()) {
        audioPath = candidatePath;
        break;
      }
    }
  }

  if (!audioPath || !(await Bun.file(audioPath).exists())) {
    console.error('❌ Original audio not found.');
    console.log('   Place original.mp3 in the song folder or use --audio-path');
    process.exit(1);
  }

  console.log(`   Audio: ${audioPath}`);

  // Load audio
  const audioFile = Bun.file(audioPath);
  const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
  console.log(`   Size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  // -------------------------------------------------------------------------
  // STEP 1: Upload original audio to Grove (required for Demucs)
  // -------------------------------------------------------------------------
  console.log('\n☁️  Step 1: Upload original to Grove');

  const uploadResult = await uploadAudioToGrove(audioBuffer, `${iswc}-original.mp3`);
  const originalAudioUrl = uploadResult.url;
  console.log(`   URL: ${originalAudioUrl}`);

  // -------------------------------------------------------------------------
  // STEP 2: Demucs Separation
  // -------------------------------------------------------------------------
  console.log('\n🎛️  Step 2: Audio Separation (Demucs)');

  let demucsResult: DemucsResult;
  let vocalsUrl: string;
  let instrumentalUrl: string;

  // Check if already separated (URLs in DB)
  if (song.vocals_url && song.instrumental_url) {
    console.log('   ⏭️  Already separated, using existing URLs');
    vocalsUrl = song.vocals_url;
    instrumentalUrl = song.instrumental_url;
  } else {
    const startTime = Date.now();
    demucsResult = await separateAudio(iswc, originalAudioUrl);
    const duration = (Date.now() - startTime) / 1000;

    vocalsUrl = demucsResult.vocals_grove_url;
    instrumentalUrl = demucsResult.instrumental_grove_url;

    console.log(`   ✅ Separation complete in ${duration.toFixed(1)}s`);
    console.log(`   Vocals: ${vocalsUrl}`);
    console.log(`   Instrumental: ${instrumentalUrl}`);
  }

  // -------------------------------------------------------------------------
  // STEP 3: FAL Enhancement (optional)
  // -------------------------------------------------------------------------
  let enhancedInstrumentalUrl: string | undefined;

  if (!values['skip-enhance']) {
    console.log('\n✨ Step 3: Audio Enhancement (FAL.ai)');
    validateEnv(['FAL_API_KEY']);

    // Check if already enhanced (and stored on Grove)
    if (song.enhanced_instrumental_url?.includes('grove.storage')) {
      console.log('   ⏭️  Already enhanced, using existing URL');
      enhancedInstrumentalUrl = song.enhanced_instrumental_url;
    } else {
      // Download instrumental to check duration
      console.log('   Downloading instrumental...');
      const instResponse = await fetch(instrumentalUrl);
      const instBuffer = Buffer.from(await instResponse.arrayBuffer());
      const tmpInstrumental = `/tmp/${iswc}-instrumental.mp3`;
      await Bun.write(tmpInstrumental, instBuffer);

      const duration = await getAudioDuration(tmpInstrumental);
      console.log(`   Duration: ${duration.toFixed(1)}s (FAL limit: ${FAL_MAX_DURATION}s)`);

      const tmpMp3 = `/tmp/${iswc}-enhanced.mp3`;
      const startTime = Date.now();

      if (duration <= FAL_MAX_DURATION) {
        // Single segment - process directly
        console.log('   Enhancing with FAL.ai (single segment)...');
        const falResult = await enhanceInstrumental(instrumentalUrl);
        console.log(`   FAL CDN: ${falResult.audioUrl}`);

        // Download and convert
        const falResponse = await fetch(falResult.audioUrl);
        const wavBuffer = Buffer.from(await falResponse.arrayBuffer());
        const tmpWav = `/tmp/${iswc}-enhanced.wav`;
        await Bun.write(tmpWav, wavBuffer);

        const ffmpeg = Bun.spawn(['ffmpeg', '-y', '-i', tmpWav, '-b:a', '192k', tmpMp3], {
          stdout: 'pipe', stderr: 'pipe'
        });
        await ffmpeg.exited;
      } else {
        // Multi-segment processing with crossfade
        console.log(`   ⚠️  Song > ${FAL_MAX_DURATION}s - splitting into segments...`);
        const segmentPaths = await splitAudioForFal(tmpInstrumental, duration, iswc);
        console.log(`   Created ${segmentPaths.length} segments`);

        const enhancedSegments: string[] = [];

        for (let i = 0; i < segmentPaths.length; i++) {
          console.log(`   Processing segment ${i + 1}/${segmentPaths.length}...`);

          // Upload segment to Grove for FAL
          const segBuffer = Buffer.from(await Bun.file(segmentPaths[i]).arrayBuffer());
          const segUpload = await uploadAudioToGrove(segBuffer, `${iswc}-segment-${i}.mp3`);

          // Enhance with FAL
          const falResult = await enhanceInstrumental(segUpload.url);

          // Download enhanced segment
          const falResponse = await fetch(falResult.audioUrl);
          const wavBuffer = Buffer.from(await falResponse.arrayBuffer());
          const tmpWav = `/tmp/${iswc}-enhanced-${i}.wav`;
          const tmpSegMp3 = `/tmp/${iswc}-enhanced-${i}.mp3`;
          await Bun.write(tmpWav, wavBuffer);

          // Convert to mp3
          const ffmpeg = Bun.spawn(['ffmpeg', '-y', '-i', tmpWav, '-b:a', '192k', tmpSegMp3], {
            stdout: 'pipe', stderr: 'pipe'
          });
          await ffmpeg.exited;

          enhancedSegments.push(tmpSegMp3);
          console.log(`   ✅ Segment ${i + 1} enhanced`);
        }

        // Crossfade merge all segments
        console.log('   Crossfade merging segments...');
        await crossfadeMergeSegments(enhancedSegments, tmpMp3);
      }

      const falDuration = (Date.now() - startTime) / 1000;
      console.log(`   ✅ FAL processing complete in ${falDuration.toFixed(1)}s`);

      // Read final mp3 and upload to Grove
      const mp3File = Bun.file(tmpMp3);
      if (!(await mp3File.exists())) {
        throw new Error('FFmpeg conversion failed');
      }
      const mp3Buffer = Buffer.from(await mp3File.arrayBuffer());
      console.log(`   Final size: ${(mp3Buffer.length / 1024 / 1024).toFixed(2)} MB`);

      const groveResult = await uploadAudioToGrove(mp3Buffer, `${iswc}-enhanced.mp3`);
      enhancedInstrumentalUrl = groveResult.url;
      console.log(`   ✅ Uploaded to Grove: ${enhancedInstrumentalUrl}`);
    }
  } else {
    console.log('\n⏭️  Step 3: Skipping enhancement (--skip-enhance)');
  }

  // -------------------------------------------------------------------------
  // STEP 4: Update Database
  // -------------------------------------------------------------------------
  console.log('\n💾 Updating database...');

  await updateSongAudio(iswc, {
    original_audio_url: originalAudioUrl,
    vocals_url: vocalsUrl,
    instrumental_url: instrumentalUrl,
    enhanced_instrumental_url: enhancedInstrumentalUrl,
  });

  // Update stage
  const newStage = enhancedInstrumentalUrl ? 'enhanced' : 'aligned';
  await updateSongStage(iswc, newStage);

  console.log(`   Stage: ${newStage}`);

  // Summary
  console.log('\n✅ Audio processing complete');
  console.log(`   Original: ${originalAudioUrl}`);
  console.log(`   Vocals: ${vocalsUrl}`);
  console.log(`   Instrumental: ${instrumentalUrl}`);
  if (enhancedInstrumentalUrl) {
    console.log(`   Enhanced: ${enhancedInstrumentalUrl}`);
  }

  console.log('\n💡 Next steps:');
  console.log(`   • Align lyrics: bun src/scripts/align-lyrics.ts --iswc=${iswc}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
