#!/usr/bin/env bun
/**
 * Test: Verify Quansic /enrich endpoint works for artist enrichment
 */

const QUANSIC_URL = process.env.QUANSIC_URL || 'http://d1crjmbvpla6lc3afdemo0mhgo.ingress.dhcloud.xyz';

async function testArtistEnrich() {
  // Test with Wolfgang Gartner (featured artist with no ISNI in grc20_artists)
  const testArtist = {
    name: 'Wolfgang Gartner',
    spotify_artist_id: '3534yWWzmxx8NbKVoNolsK',
    musicbrainz_mbid: 'fc3f7bc9-8ced-48e3-8d6d-66384e9e01dc'
  };

  console.log(`🧪 Testing Quansic /enrich endpoint`);
  console.log(`📊 Artist: ${testArtist.name}`);
  console.log(`🎵 Spotify ID: ${testArtist.spotify_artist_id}`);
  console.log(`🎼 MusicBrainz MBID: ${testArtist.musicbrainz_mbid}\n`);

  try {
    const response = await fetch(`${QUANSIC_URL}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spotify_artist_id: testArtist.spotify_artist_id,
        musicbrainz_mbid: testArtist.musicbrainz_mbid
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.log(`❌ Request failed: ${response.status}`);
      console.log(`   Error: ${result.error || result.message}`);
      console.log(`   Full response:`, JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log(`✅ Success: ${result.success}`);

    if (result.data) {
      console.log(`\n📋 Artist Data:`);
      console.log(`   Name: ${result.data.name}`);
      console.log(`   ISNI: ${result.data.ids?.isnis?.[0] || 'Not found'}`);
      console.log(`   All ISNIs: ${result.data.ids?.isnis?.join(', ') || 'None'}`);
      console.log(`   IPIs: ${result.data.ids?.ipis?.join(', ') || 'None'}`);
      console.log(`   MusicBrainz MBID: ${result.data.ids?.musicbrainz_mbid || 'Not found'}`);

      if (result.data.ids?.isnis?.length > 0) {
        console.log(`\n✅ ISNI FOUND! The /enrich endpoint works!`);
        console.log(`   Wolfgang Gartner ISNI: ${result.data.ids.isnis[0]}`);
      } else {
        console.log(`\n⚠️  No ISNI returned (artist might not have one in Quansic)`);
      }

      console.log(`\n📦 Full response:`);
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.log(`❌ No data in response`);
    }

  } catch (error) {
    console.error(`❌ Test failed:`, error);
    process.exit(1);
  }
}

testArtistEnrich();
