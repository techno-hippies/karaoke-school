#!/usr/bin/env bun
/**
 * Test Song Identification Service
 *
 * Tests both copyrighted and copyright-free content
 */

import { SongIdentificationService } from './services/song-identification.js';
import { requireEnv } from './lib/config.js';

async function main() {
  console.log('🧪 Testing Song Identification Service\n');
  console.log('═'.repeat(60) + '\n');

  // Setup service
  const spotifyConfig = {
    clientId: requireEnv('SPOTIFY_CLIENT_ID'),
    clientSecret: requireEnv('SPOTIFY_CLIENT_SECRET'),
  };

  const geniusConfig = {
    apiKey: process.env.GENIUS_API_KEY || '',
  };

  const service = new SongIdentificationService(spotifyConfig, geniusConfig);

  // Test 1: Copyrighted content (from beyonce manifest)
  console.log('Test 1: Copyrighted Content (LEVII\'S JEANS)\n');
  console.log('-'.repeat(60));

  const copyrightedResult = await service.identifyFromTikTok({
    title: "LEVII'S JEANS",
    artist: 'Beyoncé & Post Malone',
    spotifyUrl: 'https://open.spotify.com/track/2UDARQiksl207HcSduDpov',
    spotifyTrackId: '2UDARQiksl207HcSduDpov',
  });

  console.log('\nResult:');
  console.log(JSON.stringify(copyrightedResult, null, 2));
  console.log('\nAssertion checks:');
  console.log(`✓ Copyright type: ${copyrightedResult.copyrightType === 'copyrighted' ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Has Spotify ID: ${copyrightedResult.spotifyId ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Has ISRC: ${copyrightedResult.isrc ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Title: ${copyrightedResult.title === "LEVII'S JEANS" ? 'PASS' : 'FAIL'}`);

  // Test 2: Copyright-free content (original sound)
  console.log('\n\nTest 2: Copyright-Free Content (Original Sound)\n');
  console.log('-'.repeat(60));

  const copyrightFreeResult = await service.identifyFromTikTok({
    title: 'original sound - karaokeking99',
    artist: undefined,
    spotifyUrl: null,
    spotifyTrackId: null,
  });

  console.log('\nResult:');
  console.log(JSON.stringify(copyrightFreeResult, null, 2));
  console.log('\nAssertion checks:');
  console.log(`✓ Copyright type: ${copyrightFreeResult.copyrightType === 'copyright-free' ? 'PASS' : 'FAIL'}`);
  console.log(`✓ No Spotify ID: ${!copyrightFreeResult.spotifyId ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Story mintable: ${copyrightFreeResult.storyMintable ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Artist: ${copyrightFreeResult.artist === 'Original Sound' ? 'PASS' : 'FAIL'}`);

  console.log('\n' + '═'.repeat(60));
  console.log('✅ All tests complete!\n');
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error.message);
  console.error(error);
  process.exit(1);
});
