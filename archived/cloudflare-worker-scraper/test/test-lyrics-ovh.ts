/**
 * Test script for Lyrics.ovh service
 * Run with: bun run src/test-lyrics-ovh.ts
 */

import { LyricsOvhService } from './lyrics-ovh';

async function test() {
  const service = new LyricsOvhService();

  console.log('Testing Lyrics.ovh API...\n');

  const tests = [
    { artist: 'Adele', title: 'Skyfall' },
    { artist: 'Ozzy Osbourne', title: 'No More Tears' },
    { artist: 'NLE Choppa', title: 'Gang Baby' },
  ];

  for (const test of tests) {
    console.log(`Testing: ${test.title} - ${test.artist}`);

    const lyrics = await service.getLyrics(test);

    if (lyrics) {
      console.log(`✅ Found lyrics: ${lyrics.length} chars, ${lyrics.split('\n').length} lines`);
    } else {
      console.log('❌ No lyrics found');
    }

    console.log('---');

    // Be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

test();
