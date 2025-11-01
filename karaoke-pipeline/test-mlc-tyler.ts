#!/usr/bin/env bun
/**
 * Test MLC integration with "Sugar On My Tongue" by Tyler, The Creator
 */

import { searchMLC } from './src/services/mlc';

async function main() {
  console.log('🧪 Testing MLC Integration\n');
  console.log('Track: Sugar On My Tongue by Tyler, The Creator');
  console.log('ISRC: USQX92503270');
  console.log('Quansic: No ISWC');
  console.log('MusicBrainz: No ISWC\n');

  const result = await searchMLC(
    'USQX92503270',
    'Sugar On My Tongue',
    'Tyler, The Creator'
  );

  if (result) {
    console.log('\n✅ MLC found the track!');
    console.log(`   ISWC: ${result.iswc}`);
    console.log(`   Title: ${result.title}`);
    console.log(`   MLC Song Code: ${result.mlc_song_code}`);
    console.log(`   Writers: ${result.writers.length}`);
    console.log(`   Publishers: ${result.publishers.length}`);
    console.log(`   Total Publisher Share: ${result.total_publisher_share}%`);
  } else {
    console.log('\n❌ MLC did not find the track');
    console.log('   This is expected - newer tracks may not be in MLC yet');
  }
}

main().catch(console.error);
