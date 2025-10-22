#!/usr/bin/env node

import fs from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

function getAudioDuration(audioPath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      { encoding: 'utf-8' }
    );
    return parseFloat(output.trim());
  } catch (error) {
    throw new Error(`Failed to get audio duration: ${error.message}`);
  }
}

async function transcribeWithElevenLabs(audioPath) {
  console.log(`  Transcribing with STT: ${audioPath}`);

  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync(audioPath)], { type: 'audio/mpeg' }), 'audio.mp3');
  formData.append('model_id', 'scribe_v1');

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    body: formData
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs STT error: ${response.status} - ${error}`);
  }

  return await response.json();
}

async function forcedAlignmentWithElevenLabs(audioPath, lyricsText) {
  console.log(`  Running forced alignment on: ${audioPath}`);

  const audioBuffer = fs.readFileSync(audioPath);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
  const textEncoder = new TextEncoder();

  let body = [];

  // Add audio file part
  body.push(textEncoder.encode(`--${boundary}\r\n`));
  body.push(textEncoder.encode('Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n'));
  body.push(textEncoder.encode('Content-Type: audio/mpeg\r\n\r\n'));
  body.push(new Uint8Array(audioBuffer));
  body.push(textEncoder.encode('\r\n'));

  // Add text part
  body.push(textEncoder.encode(`--${boundary}\r\n`));
  body.push(textEncoder.encode('Content-Disposition: form-data; name="text"\r\n\r\n'));
  body.push(textEncoder.encode(lyricsText));
  body.push(textEncoder.encode('\r\n'));

  // End boundary
  body.push(textEncoder.encode(`--${boundary}--\r\n`));

  // Combine all parts
  let totalLength = 0;
  for (let part of body) {
    totalLength += part.length;
  }

  const combinedBody = new Uint8Array(totalLength);
  let offset = 0;
  for (let part of body) {
    combinedBody.set(part, offset);
    offset += part.length;
  }

  const response = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: combinedBody
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs forced alignment error: ${response.status} - ${error}`);
  }

  return await response.json();
}

function parseLrcToPlainText(lyricsPath) {
  const content = fs.readFileSync(lyricsPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const plainLines = [];
  for (const line of lines) {
    const match = line.match(/\[[\d:.]+\]\s*(.+)/);
    if (match && match[1].trim()) {
      plainLines.push(match[1].trim());
    }
  }

  return plainLines.join('\n');
}

function normalizeWord(word) {
  return word.toLowerCase()
    .replace(/[.,!?;:'"""()[\]{}]/g, '')
    .trim();
}

function findMatches(clipWords, fullWords, minMatchRatio = 0.6) {
  const matches = [];
  const clipText = clipWords
    .filter(w => w.type === 'word')
    .map(w => normalizeWord(w.text))
    .filter(w => w);

  console.log(`  Clip words (${clipText.length}):`, clipText.slice(0, 10).join(', '), '...');

  // Sliding window with fuzzy matching
  const windowSize = clipText.length;
  for (let i = 0; i <= fullWords.length - windowSize; i++) {
    const windowWords = fullWords.slice(i, i + windowSize);

    // Count how many words match (order-preserving but allowing gaps)
    let matchCount = 0;
    let lastMatchIdx = -1;

    for (let j = 0; j < clipText.length; j++) {
      for (let k = lastMatchIdx + 1; k < windowWords.length; k++) {
        if (clipText[j] === normalizeWord(windowWords[k].text)) {
          matchCount++;
          lastMatchIdx = k;
          break;
        }
      }
    }

    const matchRatio = matchCount / clipText.length;

    if (matchRatio >= minMatchRatio) {
      const startTime = windowWords[0].start;
      const endTime = windowWords[windowWords.length - 1].end;

      matches.push({
        startTime,
        endTime,
        startIdx: i,
        endIdx: i + windowSize - 1,
        matchCount,
        confidence: matchRatio
      });
    }
  }

  return matches;
}

async function disambiguateWithGemini(clipTranscript, matches) {
  console.log('\n  Using Gemini Flash 2.5 to disambiguate multiple matches...');

  const matchDescriptions = matches.map((m, i) => {
    const mins = Math.floor(m.startTime / 60);
    const secs = (m.startTime % 60).toFixed(2);
    const duration = (m.endTime - m.startTime).toFixed(2);
    return `Match ${i + 1}: ${mins}:${secs.padStart(5, '0')} (duration: ${duration}s, confidence: ${(m.confidence * 100).toFixed(1)}%)`;
  }).join('\n');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://karaoke-school.ai',
      'X-Title': 'Karaoke School Audio Matcher'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      messages: [{
        role: 'user',
        content: `I have a short audio clip with this transcript:
"${clipTranscript}"

I found ${matches.length} possible matches in the full song at these timestamps:
${matchDescriptions}

Which match is most likely correct? This could be a repeated chorus or verse.

Answer with ONLY the match number (1, 2, 3, etc.).`
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const answer = result.choices[0].message.content.trim();
  const matchNum = parseInt(answer.match(/\d+/)?.[0] || '1');

  return matches[matchNum - 1] || matches[0];
}

async function matchAudioAlignment(clipPath, fullSongPath, lyricsPath) {
  console.log('🎵 Forced Alignment Audio Matching Pipeline\n');
  console.log(`Clip: ${clipPath}`);
  console.log(`Full Song: ${fullSongPath}`);
  console.log(`Lyrics: ${lyricsPath}\n`);

  // Step 1: Get plain text lyrics from LRC
  console.log('Step 1: Extract plain text from LRC lyrics...');
  const plainLyrics = parseLrcToPlainText(lyricsPath);
  const lineCount = plainLyrics.split('\n').length;
  console.log(`  ✓ Extracted ${lineCount} lines of plain text\n`);

  // Step 2: Transcribe TikTok clip with STT
  console.log('Step 2: Transcribe TikTok clip with ElevenLabs STT...');
  const clipResult = await transcribeWithElevenLabs(clipPath);
  const clipWords = clipResult.words || [];
  console.log(`  ✓ Transcribed ${clipWords.length} words from clip\n`);

  // Find vocal start/end times in clip
  const clipVocalStart = clipWords.length > 0 ? clipWords[0].start : 0;
  const clipVocalEnd = clipWords.length > 0 ? clipWords[clipWords.length - 1].end : 0;
  const clipVocalDuration = clipVocalEnd - clipVocalStart;

  console.log(`  Vocal timing in clip: ${clipVocalStart.toFixed(2)}s - ${clipVocalEnd.toFixed(2)}s (${clipVocalDuration.toFixed(2)}s)\n`);

  // Get clip text for Gemini matching
  const clipText = clipWords.map(w => w.text).join(' ');

  // Step 3: Run forced alignment on full song
  console.log('Step 3: Run ElevenLabs forced alignment on full song...');
  const alignment = await forcedAlignmentWithElevenLabs(fullSongPath, plainLyrics);
  const fullWords = alignment.words || [];
  console.log(`  ✓ Aligned ${fullWords.length} words with perfect timestamps\n`);

  // Step 4: Use Gemini Flash 2.5 to find the match
  console.log('Step 4: Using Gemini Flash 2.5 to find match...');

  // Format ALL full song words for Gemini (with timestamps and indices)
  const allWords = fullWords.map((w, i) =>
    `${i}: "${w.text}" (${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s)`
  ).join('\n');

  const prompt = `I have a TikTok clip transcript generated by STT (speech-to-text). This transcript may contain PHONETIC INACCURACIES - words that sound similar but are spelled wrong (e.g., "Tryna" instead of "Chyna", "bussy" instead of "pussy").

STT Transcript from clip:
"${clipText}"

Below are ALL ${fullWords.length} words from the full song with their ACTUAL LYRICS and timestamps:

${allWords}

Your task: Find a SINGLE CONTIGUOUS SECTION of the song where the lyrics best match this STT transcript, accounting for:
- Phonetic errors (similar sounding words)
- Slang pronunciation
- Minor word variations (e.g., "gettin'" vs "get")
- Background vocals or ad-libs in parentheses

IMPORTANT: The match must be a CONTINUOUS sequence in the song, not scattered words from different parts. Look for where most of the STT words appear together in order, even if some words are phonetically misspelled.

Respond ONLY with:
START_INDEX: <number>
END_INDEX: <number>`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://karaoke-school.ai',
      'X-Title': 'Karaoke School Audio Matcher'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const answer = result.choices[0].message.content;

  console.log(`  Gemini response:\n${answer}\n`);

  // Parse indices
  const startMatch = answer.match(/START_INDEX:\s*(\d+)/i);
  const endMatch = answer.match(/END_INDEX:\s*(\d+)/i);

  if (!startMatch || !endMatch) {
    throw new Error(`Could not parse indices from Gemini response: ${answer}`);
  }

  const startIdx = parseInt(startMatch[1]);
  const endIdx = parseInt(endMatch[1]);

  // Use vocal-only duration (excludes intro/outro effects)
  console.log(`  Using vocal duration: ${clipVocalDuration.toFixed(2)}s (excludes intro/outro)\n`);

  const bestMatch = {
    startTime: fullWords[startIdx].start,
    endTime: fullWords[startIdx].start + clipVocalDuration, // Use vocal-only duration
    confidence: 1.0, // Gemini's confidence
    geminiEndIdx: endIdx, // Keep Gemini's suggestion for reference
    clipVocalDuration: clipVocalDuration,
    clipVocalStart: clipVocalStart,
    clipVocalEnd: clipVocalEnd
  };

  const mins = Math.floor(bestMatch.startTime / 60);
  const secs = (bestMatch.startTime % 60).toFixed(2);
  const endMins = Math.floor(bestMatch.endTime / 60);
  const endSecs = (bestMatch.endTime % 60).toFixed(2);
  const duration = (bestMatch.endTime - bestMatch.startTime).toFixed(2);

  console.log('\n✅ Match found!');
  console.log(`  Start: ${mins}:${secs.padStart(5, '0')} (${bestMatch.startTime.toFixed(2)}s)`);
  console.log(`  End: ${endMins}:${endSecs.padStart(5, '0')} (${bestMatch.endTime.toFixed(2)}s)`);
  console.log(`  Duration: ${duration}s`);
  console.log(`  Confidence: ${(bestMatch.confidence * 100).toFixed(1)}%\n`);

  return {
    startTime: bestMatch.startTime,
    endTime: bestMatch.endTime,
    duration: bestMatch.endTime - bestMatch.startTime,
    confidence: bestMatch.confidence,
    startIdx,
    geminiEndIdx: endIdx,
    clipVocalDuration: clipVocalDuration,
    clipVocalStart: clipVocalStart,
    clipVocalEnd: clipVocalEnd,
    clipTranscript: clipText,
    method: 'forced_alignment_with_gemini'
  };
}

// Main execution
if (process.argv.length < 5) {
  console.error('Usage: node match-audio-alignment.mjs <clip.mp3> <full_song.mp3> <lyrics.txt>');
  process.exit(1);
}

const clipPath = resolve(process.argv[2]);
const fullSongPath = resolve(process.argv[3]);
const lyricsPath = resolve(process.argv[4]);

matchAudioAlignment(clipPath, fullSongPath, lyricsPath)
  .then(result => {
    if (result) {
      // Save result
      const outputPath = resolve(process.cwd(), 'match_result.json');
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`Result saved to: ${outputPath}\n`);
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
