#!/usr/bin/env node

import fs from 'fs';
import { resolve } from 'path';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function transcribeWithElevenLabs(audioPath) {
  console.log(`  Transcribing: ${audioPath}`);

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
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

function parseLrcTimestamp(timestamp) {
  const match = timestamp.match(/\[(\d+):(\d+\.\d+)\]/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseFloat(match[2]);
}

function loadLrcAsWordTimestamps(lyricsPath) {
  const content = fs.readFileSync(lyricsPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const words = [];
  for (const line of lines) {
    const timestamp = parseLrcTimestamp(line);
    if (timestamp !== null) {
      const text = line.replace(/\[\d+:\d+\.\d+\]\s*/, '').trim();
      if (text) {
        // Split into words and assign same timestamp to all
        const lineWords = text.split(/\s+/);
        for (const word of lineWords) {
          words.push({
            text: word,
            start: timestamp,
            type: 'word'
          });
        }
      }
    }
  }

  return words;
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
    const windowWords = fullWords.slice(i, i + windowSize).map(w => normalizeWord(w.text));

    // Count how many words match (order-preserving but allowing gaps)
    let matchCount = 0;
    let lastMatchIdx = -1;

    for (let j = 0; j < clipText.length; j++) {
      for (let k = lastMatchIdx + 1; k < windowWords.length; k++) {
        if (clipText[j] === windowWords[k]) {
          matchCount++;
          lastMatchIdx = k;
          break;
        }
      }
    }

    const matchRatio = matchCount / clipText.length;

    if (matchRatio >= minMatchRatio) {
      const startTime = fullWords[i].start;
      const endTime = fullWords[Math.min(i + windowSize - 1, fullWords.length - 1)].start;

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

async function disambiguateWithGemini(clipTranscript, matches, fullLyrics) {
  console.log('\n  Using Gemini Flash 2.5 to disambiguate multiple matches...');

  const matchDescriptions = matches.map((m, i) => {
    const mins = Math.floor(m.startTime / 60);
    const secs = (m.startTime % 60).toFixed(2);
    return `Match ${i + 1}: ${mins}:${secs.padStart(5, '0')} (confidence: ${(m.confidence * 100).toFixed(1)}%)`;
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
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [{
        role: 'user',
        content: `I have a short audio clip with this transcript:
"${clipTranscript}"

I found ${matches.length} possible matches in the full song at these timestamps:
${matchDescriptions}

Which match is most likely correct? Consider the lyrical context and structure.

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

async function matchAudioSTTPipeline(clipPath, fullSongPath, lyricsPath) {
  console.log('🎵 STT-based Audio Matching Pipeline\n');
  console.log(`Clip: ${clipPath}`);
  console.log(`Full Song: ${fullSongPath || 'Using LRC lyrics'}`);
  console.log(`Lyrics: ${lyricsPath}\n`);

  // Step 1: Transcribe clip
  console.log('Step 1: Transcribe TikTok clip with ElevenLabs...');
  const clipResult = await transcribeWithElevenLabs(clipPath);
  const clipWords = clipResult.words;
  const clipText = clipResult.text;
  console.log(`  ✓ Clip transcript: "${clipText}"`);
  console.log(`  ✓ ${clipWords.filter(w => w.type === 'word').length} words\n`);

  // Step 2: Get full song words (from LRC or STT)
  console.log('Step 2: Load full song lyrics...');
  let fullWords;
  if (lyricsPath && fs.existsSync(lyricsPath)) {
    fullWords = loadLrcAsWordTimestamps(lyricsPath);
    console.log(`  ✓ Loaded ${fullWords.length} words from LRC lyrics\n`);
  } else if (fullSongPath) {
    const fullResult = await transcribeWithElevenLabs(fullSongPath);
    fullWords = fullResult.words.filter(w => w.type === 'word');
    console.log(`  ✓ Transcribed ${fullWords.length} words from full song\n`);
  } else {
    throw new Error('Must provide either lyricsPath or fullSongPath');
  }

  // Step 3: Find matches with fuzzy text matching
  console.log('Step 3: Find matches with fuzzy text matching...');
  const matches = findMatches(clipWords, fullWords);
  console.log(`  ✓ Found ${matches.length} potential match(es)\n`);

  if (matches.length === 0) {
    console.log('❌ No matches found\n');
    return null;
  }

  // Step 4: Disambiguate if multiple matches
  let bestMatch;
  if (matches.length === 1) {
    console.log('Step 4: Single match found, using it...');
    bestMatch = matches[0];
  } else {
    console.log(`Step 4: ${matches.length} matches found, disambiguating...`);
    bestMatch = await disambiguateWithGemini(clipText, matches, lyricsPath);
  }

  const mins = Math.floor(bestMatch.startTime / 60);
  const secs = (bestMatch.startTime % 60).toFixed(2);
  const endMins = Math.floor(bestMatch.endTime / 60);
  const endSecs = (bestMatch.endTime % 60).toFixed(2);

  console.log('\n✅ Match found!');
  console.log(`  Start: ${mins}:${secs.padStart(5, '0')} (${bestMatch.startTime.toFixed(2)}s)`);
  console.log(`  End: ${endMins}:${endSecs.padStart(5, '0')} (${bestMatch.endTime.toFixed(2)}s)`);
  console.log(`  Duration: ${(bestMatch.endTime - bestMatch.startTime).toFixed(2)}s`);
  console.log(`  Confidence: ${(bestMatch.confidence * 100).toFixed(1)}%\n`);

  return {
    startTime: bestMatch.startTime,
    endTime: bestMatch.endTime,
    duration: bestMatch.endTime - bestMatch.startTime,
    confidence: bestMatch.confidence,
    matchCount: matches.length,
    clipTranscript: clipText
  };
}

// Main execution
if (process.argv.length < 4) {
  console.error('Usage: node match-audio-stt-pipeline.mjs <clip.mp3> <lyrics.txt> [full_song.mp3]');
  process.exit(1);
}

const clipPath = resolve(process.argv[2]);
const lyricsPath = resolve(process.argv[3]);
const fullSongPath = process.argv[4] ? resolve(process.argv[4]) : null;

matchAudioSTTPipeline(clipPath, fullSongPath, lyricsPath)
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
