#!/usr/bin/env bun
/**
 * Test MLC integration with "Another Love" by Tom Odell
 */

import { searchMLC } from './src/services/mlc';

async function main() {
  console.log('🧪 Testing MLC Integration\n');
  console.log('Track: Another Love by Tom Odell');
  console.log('ISRC: GBARL1300107');
  console.log('Expected ISWC: T9112804510\n');

  const result = await searchMLC(
    'GBARL1300107',
    'Another Love',
    'Tom Odell'
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
  }
}

main().catch(console.error);
