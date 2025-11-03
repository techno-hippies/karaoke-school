#!/usr/bin/env bun
/**
 * Test: Verify Quansic /lookup-artist endpoint works for Spotify artist ID lookup
 */

const QUANSIC_URL = process.env.QUANSIC_URL || 'http://d1crjmbvpla6lc3afdemo0mhgo.ingress.dhcloud.xyz';

async function testArtistLookup() {
  // Test with Wanz (featured artist from Thrift Shop)
  // User confirmed this returns ISNI: 000000050339548X
  const testArtist = {
    name: 'Wanz',
    spotify_artist_id: '56xTxG4nQMAs1GW9kvn0uA'  // Wanz's Spotify ID from grc20_artists
  };

  console.log(`🧪 Testing Quansic /lookup-artist endpoint`);
  console.log(`📊 Artist: ${testArtist.name}`);
  console.log(`🎵 Spotify ID: ${testArtist.spotify_artist_id}\n`);

  try {
    const response = await fetch(`${QUANSIC_URL}/lookup-artist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spotify_artist_id: testArtist.spotify_artist_id
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
      console.log(`   Spotify ID: ${result.data.spotify_artist_id}`);
      console.log(`   ISNI: ${result.data.ids?.isnis?.[0] || 'Not found'}`);
      console.log(`   All ISNIs: ${result.data.ids?.isnis?.join(', ') || 'None'}`);
      console.log(`   IPIs: ${result.data.ids?.ipis?.join(', ') || 'None'}`);
      console.log(`   Quansic ID: ${result.data.ids?.quansic_id || 'Not found'}`);
      console.log(`   MusicBrainz MBID: ${result.data.ids?.musicbrainz_mbid || 'Not found'}`);

      if (result.data.ids?.isnis?.length > 0) {
        console.log(`\n✅ ISNI FOUND! The /lookup-artist endpoint works!`);
        console.log(`   Wanz ISNI: ${result.data.ids.isnis[0]}`);

        // Verify it matches user's expected value
        if (result.data.ids.isnis[0] === '000000050339548X') {
          console.log(`   ✅ Matches expected ISNI from user!`);
        } else {
          console.log(`   ⚠️  ISNI doesn't match expected: 000000050339548X`);
        }
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

testArtistLookup();
