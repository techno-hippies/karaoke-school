#!/usr/bin/env bun
/**
 * Test Audio Matching Pipeline
 *
 * Tests the full pipeline:
 * 1. Scrape TikTok segment (Python)
 * 2. Fetch lyrics from LRCLib
 * 3. Run forced alignment + Gemini matching
 *
 * Usage:
 *   bun run test-audio-matching.ts --tiktok <url> --song <path> --track <name> --artist <name> [--album <name>]
 *
 * Example:
 *   bun run test-audio-matching.ts \
 *     --tiktok "https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891" \
 *     --song "/media/t42/me/Music/Beyoncé - COWBOY CARTER/07 TEXAS HOLD 'EM.flac" \
 *     --track "TEXAS HOLD 'EM" \
 *     --artist "Beyoncé" \
 *     --album "COWBOY CARTER"
 */

import { parseArgs } from 'util';
import { execSync } from 'child_process';
import { AudioMatchingService } from './services/index.js';

async function main() {
  // Debug: check if API keys are set
  console.log('DEBUG: Environment variables at runtime:');
  console.log(`  VOXTRAL_API_KEY: ${process.env.VOXTRAL_API_KEY ? 'SET (length: ' + process.env.VOXTRAL_API_KEY.length + ')' : 'NOT SET'}`);
  console.log(`  ELEVENLABS_API_KEY: ${process.env.ELEVENLABS_API_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`  OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET'}`);
  console.log();

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      tiktok: { type: 'string' },
      song: { type: 'string' },
      track: { type: 'string' },
      artist: { type: 'string' },
      album: { type: 'string' },
    },
  });

  if (!values.tiktok || !values.song || !values.track || !values.artist) {
    console.error('❌ Missing required arguments\n');
    console.log('Usage:');
    console.log('  bun run test-audio-matching.ts \\');
    console.log('    --tiktok <url> \\');
    console.log('    --song <path> \\');
    console.log('    --track <name> \\');
    console.log('    --artist <name> \\');
    console.log('    [--album <name>]\n');
    console.log('Example:');
    console.log('  bun run test-audio-matching.ts \\');
    console.log('    --tiktok "https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891" \\');
    console.log('    --song "/media/t42/me/Music/Beyoncé - COWBOY CARTER/07 TEXAS HOLD \'EM.flac" \\');
    console.log('    --track "TEXAS HOLD \'EM" \\');
    console.log('    --artist "Beyoncé" \\');
    console.log('    --album "COWBOY CARTER"');
    process.exit(1);
  }

  const tiktokUrl = values.tiktok;
  const fullSongPath = values.song;
  const trackName = values.track;
  const artistName = values.artist;
  const albumName = values.album;

  console.log('🧪 Audio Matching Pipeline Test\n');
  console.log('═'.repeat(60));
  console.log();

  // Step 1: Scrape TikTok segment
  console.log('Step 1: Scraping TikTok segment...');
  console.log(`URL: ${tiktokUrl}\n`);

  try {
    const output = execSync(
      `.venv/bin/python3 lib/tiktok_music_scraper.py "${tiktokUrl}" /tmp/texas_holdem_segment.mp4`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );

    // Parse JSON output from scraper (multiline JSON at the end)
    const lines = output.split('\n');

    // Find where JSON starts (last line with just '{')
    let jsonStartIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '{') {
        jsonStartIdx = i;
        break;
      }
    }

    if (jsonStartIdx === -1) {
      console.error('Python script output:');
      console.error(output);
      throw new Error('No JSON output from TikTok scraper');
    }

    // Collect all lines from { to }
    const jsonLines = [];
    for (let i = jsonStartIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      jsonLines.push(line);
      if (line === '}') {
        break;
      }
    }

    const jsonText = jsonLines.join('\n');
    const scraperResult = JSON.parse(jsonText);
    console.log(`✓ Downloaded segment: ${scraperResult.local_path}`);
    console.log(`  Duration: ${scraperResult.duration}s\n`);

    // Step 2: Run audio matching
    console.log('Step 2: Running audio matching pipeline...\n');

    const matcher = new AudioMatchingService();
    const result = await matcher.matchClipToSong(
      scraperResult.local_path,
      fullSongPath,
      trackName,
      artistName,
      albumName
    );

    // Display results
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('📊 RESULTS');
    console.log('═'.repeat(60));
    console.log();

    console.log('Match Details:');
    console.log(`  Start Time: ${result.startTime.toFixed(2)}s`);
    console.log(`  End Time: ${result.endTime.toFixed(2)}s`);
    console.log(`  Duration: ${result.duration.toFixed(2)}s`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log();

    console.log('LRCLib Match:');
    console.log(`  Track: ${result.lrcMatch?.trackName || 'N/A'}`);
    console.log(`  Artist: ${result.lrcMatch?.artistName || 'N/A'}`);
    console.log(`  Album: ${result.lrcMatch?.albumName || 'N/A'}`);
    console.log(`  ID: ${result.lrcMatch?.id || 'N/A'}`);
    console.log();

    console.log('Clip Analysis:');
    console.log(`  Transcript: "${result.clipTranscript}"`);
    console.log(`  Vocal Start: ${result.clipVocalStart.toFixed(2)}s`);
    console.log(`  Vocal End: ${result.clipVocalEnd.toFixed(2)}s`);
    console.log(`  Vocal Duration: ${result.clipVocalDuration.toFixed(2)}s`);
    console.log();

    console.log('✅ Test completed successfully!');
    console.log();

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
