#!/usr/bin/env node

import fs from 'fs';
import { resolve } from 'path';

const VOXTRAL_API_KEY = process.env.VOXTRAL_API_KEY;

async function transcribeAudio(clipPath) {
  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync(clipPath)], { type: 'audio/mpeg' }), 'clip.mp3');
  formData.append('model', 'voxtral-mini-latest');
  formData.append('language', 'en');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const response = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOXTRAL_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mistral API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

function parseLrcTimestamp(timestamp) {
  // Parse [MM:SS.ms] format to seconds
  const match = timestamp.match(/\[(\d+):(\d+\.\d+)\]/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseFloat(match[2]);
}

function loadLyrics(lyricsPath) {
  const content = fs.readFileSync(lyricsPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const lyrics = [];
  for (const line of lines) {
    const timestamp = parseLrcTimestamp(line);
    if (timestamp !== null) {
      const text = line.replace(/\[\d+:\d+\.\d+\]\s*/, '').trim();
      if (text) {
        lyrics.push({ timestamp, text });
      }
    }
  }

  return lyrics;
}

function normalizeText(text) {
  return text.toLowerCase()
    .replace(/[.,!?;:]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
}

function calculateSimilarity(str1, str2) {
  const words1 = normalizeText(str1).split(' ');
  const words2 = normalizeText(str2).split(' ');

  let matches = 0;
  for (const word of words1) {
    if (words2.includes(word)) {
      matches++;
    }
  }

  return matches / Math.max(words1.length, words2.length);
}

function findBestMatch(transcription, lyrics) {
  const transcriptText = transcription.text.toLowerCase().trim();

  console.log(`\n📝 Transcript: "${transcriptText}"\n`);

  let bestMatch = null;
  let bestScore = 0;

  // Try windows of consecutive lyrics (1-5 lines)
  for (let windowSize = 1; windowSize <= 5; windowSize++) {
    for (let i = 0; i <= lyrics.length - windowSize; i++) {
      // Combine lyrics in this window
      const windowLyrics = lyrics.slice(i, i + windowSize);
      const combinedText = windowLyrics.map(l => l.text).join(' ');

      // Calculate similarity
      const score = calculateSimilarity(transcriptText, combinedText);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          timestamp: lyrics[i].timestamp,
          lyric: windowLyrics.map(l => l.text).join(' / '),
          score: score,
          windowSize: windowSize
        };
      }
    }
  }

  // Only return if confidence is reasonable
  if (bestMatch && bestScore > 0.5) {
    return bestMatch;
  }

  return null;
}

async function matchAudioAI(clipPath, lyricsPath) {
  console.log('🎵 AI-based Audio Matching\n');
  console.log(`Clip: ${clipPath}`);
  console.log(`Lyrics: ${lyricsPath}\n`);

  // Step 1: Transcribe the clip
  console.log('Step 1: Transcribing audio clip...');
  const transcription = await transcribeAudio(clipPath);

  // Step 2: Load lyrics with timestamps
  console.log('Step 2: Loading lyrics...');
  const lyrics = loadLyrics(lyricsPath);
  console.log(`Loaded ${lyrics.length} lyric lines\n`);

  // Step 3: Find best match
  console.log('Step 3: Finding best match...');
  const match = findBestMatch(transcription, lyrics);

  if (!match) {
    console.log('❌ No match found\n');
    return null;
  }

  // Convert timestamp to MM:SS format
  const minutes = Math.floor(match.timestamp / 60);
  const seconds = (match.timestamp % 60).toFixed(2);
  const timestampStr = `${minutes}:${seconds.padStart(5, '0')}`;

  console.log('\n✅ Match found!');
  console.log(`Timestamp: ${timestampStr} (${match.timestamp.toFixed(2)}s)`);
  console.log(`Lyric: "${match.lyric}"`);
  console.log(`Confidence: ${(match.score * 100).toFixed(1)}%\n`);

  return {
    timestamp: match.timestamp,
    timestampStr: timestampStr,
    lyric: match.lyric,
    confidence: match.score,
    transcription: transcription.text
  };
}

// Main execution
if (process.argv.length < 4) {
  console.error('Usage: node match-audio-ai.mjs <clip.mp3> <lyrics.txt>');
  process.exit(1);
}

const clipPath = resolve(process.argv[2]);
const lyricsPath = resolve(process.argv[3]);

matchAudioAI(clipPath, lyricsPath)
  .then(result => {
    if (result) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
