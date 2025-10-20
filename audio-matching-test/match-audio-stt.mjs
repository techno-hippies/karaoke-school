#!/usr/bin/env node
/**
 * TikTok Segment Matching via STT + Text Comparison
 *
 * Flow:
 * 1. Extract audio from TikTok video
 * 2. Transcribe using Mistral Voxstral API
 * 3. Compare transcript to segment lyrics (from full song metadata)
 * 4. Return best matching segment with confidence
 *
 * Usage:
 *   VOXSTRAL_API_KEY=xxx node match-audio-stt.mjs <tiktok.mp4> <segments.json>
 *
 * segments.json format:
 * [
 *   {
 *     "id": "verse-1",
 *     "sectionType": "Verse 1",
 *     "startTime": 15.0,
 *     "endTime": 45.0,
 *     "lyrics": "These lyrics for verse 1..."
 *   },
 *   ...
 * ]
 */

import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { resolve } from 'path';

const VOXSTRAL_API_KEY = process.env.VOXTRAL_API_KEY || process.env.VOXSTRAL_API_KEY;

/**
 * Extract audio from video file using ffmpeg
 */
async function extractAudio(videoFile) {
  const audioFile = videoFile.replace(/\.(mp4|mov|avi)$/i, '_extracted.mp3');

  console.log('📹 Extracting audio from video...');

  return new Promise((resolvePromise, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoFile,
      '-vn',
      '-acodec', 'libmp3lame',
      '-y',
      audioFile
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Extracted to: ${audioFile}\n`);
        resolvePromise(audioFile);
      } else {
        reject(new Error(`ffmpeg failed with code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

/**
 * Transcribe audio using Mistral Voxstral API
 */
async function transcribeAudio(audioFile, language = 'en') {
  console.log('🎤 Transcribing audio with Voxstral...');

  if (!VOXSTRAL_API_KEY) {
    throw new Error('VOXSTRAL_API_KEY environment variable not set');
  }

  // Read audio file
  const audioData = readFileSync(audioFile);

  // Create multipart form data
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
  const parts = [];

  // File field
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n`));
  parts.push(Buffer.from(`Content-Type: audio/mpeg\r\n\r\n`));
  parts.push(audioData);
  parts.push(Buffer.from('\r\n'));

  // Model field
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="model"\r\n\r\n`));
  parts.push(Buffer.from(`voxtral-mini-latest\r\n`));

  // Language field
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="language"\r\n\r\n`));
  parts.push(Buffer.from(`${language}\r\n`));

  // End boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  // Call Voxstral API
  const response = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOXSTRAL_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voxstral API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const transcript = result.text || '';
  const detectedLang = result.language || language;

  console.log(`✓ Transcription complete (${detectedLang}):`);
  console.log(`  "${transcript}"\n`);

  return { transcript, detectedLang };
}

/**
 * Normalize text for comparison (lowercase, remove punctuation)
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate word-level similarity between transcript and lyrics
 */
function calculateSimilarity(transcript, lyrics) {
  const transcriptWords = normalizeText(transcript).split(' ');
  const lyricsWords = normalizeText(lyrics).split(' ');

  if (lyricsWords.length === 0) return 0;

  // Count matching words (order-independent)
  const transcriptSet = new Set(transcriptWords);
  const lyricsSet = new Set(lyricsWords);

  let matches = 0;
  for (const word of lyricsSet) {
    if (transcriptSet.has(word)) {
      matches++;
    }
  }

  // Similarity = (matched words) / (total unique lyrics words)
  const similarity = matches / lyricsSet.size;

  return similarity;
}

/**
 * Find best matching segment for transcript
 */
function findBestMatch(transcript, segments) {
  console.log('🔍 Matching transcript to segments...\n');

  const matches = segments.map(segment => {
    const similarity = calculateSimilarity(transcript, segment.lyrics);
    return {
      segment,
      similarity,
      confidence: similarity
    };
  });

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity);

  // Display results
  console.log('📊 Match Results:\n');
  matches.forEach((match, idx) => {
    const { segment, confidence } = match;
    const percentage = (confidence * 100).toFixed(1);
    const icon = idx === 0 ? '🎯' : '  ';

    console.log(`${icon} ${segment.id} (${segment.sectionType})`);
    console.log(`   Confidence: ${percentage}%`);
    console.log(`   Time: ${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}`);
    console.log();
  });

  return matches[0];
}

/**
 * Format seconds as MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Main function
 */
async function main() {
  const [videoFile, segmentsFile] = process.argv.slice(2);

  if (!videoFile || !segmentsFile) {
    console.error('Usage: VOXSTRAL_API_KEY=xxx node match-audio-stt.mjs <tiktok.mp4> <segments.json>');
    console.error('\nsegments.json format:');
    console.error('[{"id": "verse-1", "sectionType": "Verse 1", "startTime": 15, "endTime": 45, "lyrics": "..."}]');
    process.exit(1);
  }

  console.log('============================================================');
  console.log('🎯 STT-BASED SEGMENT MATCHING');
  console.log('============================================================\n');

  try {
    // Load segments
    const segments = JSON.parse(readFileSync(segmentsFile, 'utf-8'));
    console.log(`✓ Loaded ${segments.length} segments\n`);

    // Extract audio from video
    const audioFile = await extractAudio(videoFile);

    // Transcribe audio
    const { transcript, detectedLang } = await transcribeAudio(audioFile);

    // Find best match
    const bestMatch = findBestMatch(transcript, segments);

    // Display final result
    console.log('============================================================');
    console.log('✅ BEST MATCH');
    console.log('============================================================\n');

    const { segment, confidence } = bestMatch;
    const percentage = (confidence * 100).toFixed(1);

    console.log(`Segment: ${segment.id} (${segment.sectionType})`);
    console.log(`Time: ${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}`);
    console.log(`Confidence: ${percentage}%`);
    console.log();

    if (confidence > 0.6) {
      console.log('✅ HIGH CONFIDENCE - Very likely accurate');
    } else if (confidence > 0.3) {
      console.log('⚠️  MEDIUM CONFIDENCE - Probably correct');
    } else {
      console.log('❌ LOW CONFIDENCE - Match uncertain');
    }

    console.log();
    console.log('============================================================\n');

    // Output JSON for programmatic use
    console.log('JSON OUTPUT:');
    console.log(JSON.stringify({
      segmentId: segment.id,
      sectionType: segment.sectionType,
      startTime: segment.startTime,
      endTime: segment.endTime,
      confidence: confidence,
      transcript: transcript,
      detectedLanguage: detectedLang
    }, null, 2));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
