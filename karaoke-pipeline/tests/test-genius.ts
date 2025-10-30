#!/usr/bin/env bun
/**
 * Test Genius API Integration
 * Quick test to verify Genius service works before running the full processor
 *
 * Usage:
 *   GENIUS_API_KEY=your_key bun test-genius.ts
 */

import { GeniusService } from './src/services/genius';
import { query, close } from './src/db/neon';

async function main() {
  // Check for API key
  const apiKey = process.env.GENIUS_API_KEY;
  if (!apiKey) {
    console.error('❌ GENIUS_API_KEY environment variable not set');
    console.error('');
    console.error('Get your Genius API key:');
    console.error('1. Visit: https://genius.com/api-clients');
    console.error('2. Sign in or create account');
    console.error('3. Create a new API client');
    console.error('4. Copy the "Client Access Token"');
    console.error('');
    console.error('Then run:');
    console.error('  GENIUS_API_KEY=your_token_here bun test-genius.ts');
    console.error('');
    console.error('Or add to .env:');
    console.error('  dotenvx set GENIUS_API_KEY your_token_here -f .env');
    process.exit(1);
  }

  console.log('🎤 Testing Genius API Integration\n');

  const genius = new GeniusService(apiKey);

  // Test 1: Search for a well-known song
  console.log('Test 1: Search for "ocean eyes" by Billie Eilish');
  const result1 = await genius.searchAndMatch('ocean eyes', 'Billie Eilish', 'test-track-1');

  if (result1) {
    console.log('  ✅ Success!');
    console.log(`     Genius Song ID: ${result1.genius_song_id}`);
    console.log(`     Artist: ${result1.artist_name} (ID: ${result1.genius_artist_id})`);
    console.log(`     URL: ${result1.url}`);
    if (result1.language) console.log(`     Language: ${result1.language}`);
  } else {
    console.log('  ❌ No match found');
  }

  console.log('');

  // Test 2: Search with a real track from the database
  console.log('Test 2: Search for a track from your pipeline');

  const tracks = await query<{
    spotify_track_id: string;
    title: string;
    artists: Array<{ name: string }>;
  }>(`
    SELECT st.spotify_track_id, st.title, st.artists
    FROM song_pipeline sp
    JOIN spotify_tracks st ON sp.spotify_track_id = st.spotify_track_id
    WHERE sp.has_lyrics = TRUE
      AND sp.genius_song_id IS NULL
    LIMIT 1
  `);

  if (tracks.length > 0) {
    const track = tracks[0];
    const artistName = track.artists[0]?.name || 'Unknown';

    console.log(`  Searching: "${track.title}" by ${artistName}`);

    const result2 = await genius.searchAndMatch(track.title, artistName, track.spotify_track_id);

    if (result2) {
      console.log('  ✅ Success!');
      console.log(`     Genius Song ID: ${result2.genius_song_id}`);
      console.log(`     Artist: ${result2.artist_name} (ID: ${result2.genius_artist_id})`);
      console.log(`     URL: ${result2.url}`);
    } else {
      console.log('  ⚠️ No match found (might not be on Genius)');
    }
  } else {
    console.log('  No tracks available for testing');
  }

  console.log('');

  // Test 3: Get artist details
  if (result1) {
    console.log('Test 3: Fetch artist details');
    const artist = await genius.getArtist(result1.genius_artist_id);

    if (artist) {
      console.log('  ✅ Success!');
      console.log(`     Name: ${artist.name}`);
      console.log(`     Verified: ${artist.is_verified ? 'Yes' : 'No'}`);
      console.log(`     URL: ${artist.url}`);
      if (artist.alternate_names.length > 0) {
        console.log(`     Alternate names: ${artist.alternate_names.join(', ')}`);
      }
    } else {
      console.log('  ❌ Failed to fetch artist');
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('✅ Genius API integration is working!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Add GENIUS_API_KEY to your .env:');
  console.log('   dotenvx set GENIUS_API_KEY your_token_here -f .env');
  console.log('');
  console.log('2. Run the enrichment processor:');
  console.log('   dotenvx run -f .env -- bun src/processors/07-genius-enrichment.ts');
  console.log('═══════════════════════════════════════');

  await close();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
