#!/usr/bin/env node

import fs from 'fs';
import { resolve } from 'path';

const VOXTRAL_API_KEY = process.env.VOXTRAL_API_KEY;

function loadLyricsText(lyricsPath) {
  return fs.readFileSync(lyricsPath, 'utf-8');
}

async function matchWithPrompt(clipPath, lyricsPath) {
  console.log('🎵 AI-Prompted Audio Matching\n');
  console.log(`Clip: ${clipPath}`);
  console.log(`Lyrics: ${lyricsPath}\n`);

  // Load lyrics
  const lyrics = loadLyricsText(lyricsPath);

  // Read audio file and convert to base64
  const audioBuffer = fs.readFileSync(clipPath);
  const audioBase64 = audioBuffer.toString('base64');

  console.log('Step 1: Sending audio + lyrics to Mistral with prompt...\n');

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOXTRAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'voxtral-mini-latest',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: audioBase64,
              format: 'mp3'
            }
          },
          {
            type: 'text',
            text: `You are listening to a SHORT CLIP extracted from a full song.

Below are the COMPLETE timestamped lyrics from the FULL SONG (not the clip):

${lyrics}

Your task: Listen to the audio clip and identify which part of the full song it comes from.

What timestamp in the FULL SONG does this clip start at? What timestamp does it end at?

Answer ONLY with the timestamps from the full song in this format:
START: [MM:SS.ms]
END: [MM:SS.ms]`
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mistral API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const answer = result.choices[0].message.content;

  console.log('✅ AI Response:\n');
  console.log(answer);
  console.log('');

  // Parse the response
  const startMatch = answer.match(/START:\s*\[?(\d+):(\d+(?:\.\d+)?)\]?/i);
  const endMatch = answer.match(/END:\s*\[?(\d+):(\d+(?:\.\d+)?)\]?/i);

  if (!startMatch || !endMatch) {
    throw new Error('Could not parse timestamps from AI response');
  }

  const startTime = parseInt(startMatch[1]) * 60 + parseFloat(startMatch[2]);
  const endTime = parseInt(endMatch[1]) * 60 + parseFloat(endMatch[2]);

  console.log(`\n📍 Parsed timestamps:`);
  console.log(`  Start: ${startTime.toFixed(2)}s (${startMatch[1]}:${startMatch[2]})`);
  console.log(`  End: ${endTime.toFixed(2)}s (${endMatch[1]}:${endMatch[2]})`);
  console.log(`  Duration: ${(endTime - startTime).toFixed(2)}s\n`);

  return {
    startTime,
    endTime,
    duration: endTime - startTime,
    rawResponse: answer
  };
}

// Main execution
if (process.argv.length < 4) {
  console.error('Usage: node match-audio-prompt.mjs <clip.mp3> <lyrics.txt>');
  process.exit(1);
}

const clipPath = resolve(process.argv[2]);
const lyricsPath = resolve(process.argv[3]);

matchWithPrompt(clipPath, lyricsPath)
  .then(result => {
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
