#!/usr/bin/env bun
/**
 * Test: Verify that Genius enrichment extracts ALL artists
 * (primary, featured, producer, writer)
 */

import { GeniusService } from '../src/services/genius';

async function test() {
  const genius = new GeniusService(process.env.GENIUS_API_KEY!);

  // Test with Thrift Shop (has Wanz as featured artist)
  const track = {
    spotify_track_id: '5Sbpp73UYq3GUqsiENXS0O',
    title: 'Thrift Shop',
    artist: 'Macklemore'
  };

  console.log(`🧪 Testing: "${track.title}" by ${track.artist}\n`);

  const geniusData = await genius.searchAndMatch(track.title, track.artist, track.spotify_track_id);

  if (!geniusData) {
    console.log('❌ Not found on Genius');
    process.exit(1);
  }

  console.log(`✅ Found: ${geniusData.title} by ${geniusData.artist_name}`);
  console.log(`   Genius Song ID: ${geniusData.genius_song_id}\n`);

  const fullSong = await genius.getFullSong(geniusData.genius_song_id, track.spotify_track_id);

  if (!fullSong) {
    console.log('❌ Could not fetch full song');
    process.exit(1);
  }

  // Extract ALL artists (same logic as processor)
  const allArtistIds = new Set<number>();
  const rawSong = fullSong.raw_data as any;

  [rawSong.primary_artist]
    .concat(rawSong.featured_artists || [])
    .concat(rawSong.producer_artists || [])
    .concat(rawSong.writer_artists || [])
    .filter(Boolean)
    .forEach((artist: any) => {
      if (artist?.id) allArtistIds.add(artist.id);
    });

  console.log(`👥 Found ${allArtistIds.size} unique artists:\n`);

  // Fetch details for all
  const allArtists = [];
  for (const artistId of allArtistIds) {
    const fullArtist = await genius.getFullArtist(artistId);
    if (fullArtist) {
      allArtists.push(fullArtist);
      console.log(`   ✅ ${fullArtist.name} (ID: ${fullArtist.genius_artist_id})`);
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`\n✅ Successfully extracted ${allArtists.length} artists!`);
  console.log('\n📊 Breakdown:');
  console.log(`   Primary: ${rawSong.primary_artist?.name} (ID: ${rawSong.primary_artist?.id})`);
  console.log(`   Featured: ${(rawSong.featured_artists || []).map((a: any) => `${a.name} (${a.id})`).join(', ') || 'none'}`);
  console.log(`   Producers: ${(rawSong.producer_artists || []).map((a: any) => `${a.name} (${a.id})`).join(', ') || 'none'}`);
  console.log(`   Writers: ${(rawSong.writer_artists || []).map((a: any) => `${a.name} (${a.id})`).join(', ') || 'none'}`);
}

test().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
