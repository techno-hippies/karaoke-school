#!/usr/bin/env bun
/**
 * Test Segment Selector Service
 *
 * Usage:
 *   bun services/test-segment-selector.ts
 */

import { SegmentSelectorService } from './segment-selector.js';
import { LRCLibService } from './lrclib.js';

async function main() {
  console.log('🧪 Testing Segment Selector Service\n');

  const lrclib = new LRCLibService();
  const selector = new SegmentSelectorService();

  // Test with Anti-Hero by Taylor Swift
  const trackName = 'Anti-Hero';
  const artistName = 'Taylor Swift';

  console.log(`1. Fetching lyrics for: ${trackName} by ${artistName}...`);

  const match = await lrclib.getBestMatch(trackName, artistName);

  if (!match) {
    console.error('❌ No lyrics found');
    process.exit(1);
  }

  console.log(`   ✓ Found: ${match.trackName} by ${match.artistName}`);
  console.log(`   Duration: ${match.duration}s`);
  console.log(`   Has synced lyrics: ${!!match.syncedLyrics}`);
  console.log(`   Lyric lines: ${match.syncedLyrics.split('\n').filter(l => l.trim()).length}\n`);

  console.log('2. Asking Gemini to select iconic segment...\n');

  try {
    const selection = await selector.selectIconicSegment(
      match.syncedLyrics,
      match.trackName,
      match.artistName,
      match.duration,
      30 // Target 30 seconds
    );

    console.log('\n✅ Segment selected successfully!\n');
    console.log('Selected Segment:');
    console.log(`  Start: ${selection.startTime.toFixed(2)}s`);
    console.log(`  End: ${selection.endTime.toFixed(2)}s`);
    console.log(`  Duration: ${selection.duration.toFixed(2)}s`);
    console.log(`  Reason: ${selection.reason}\n`);

    // Show first line of selected text only (to avoid reproducing lyrics)
    const firstLine = selection.selectedText?.split('\n')[0] || '';
    console.log(`  First line: "${firstLine}..."`);
    console.log(`  (${selection.selectedText?.split('\n').length || 0} lines total)\n`);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
