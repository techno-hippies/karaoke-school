#!/usr/bin/env bun
/**
 * Test SpotDL Service
 *
 * Usage:
 *   bun services/test-spotdl.ts
 */

import { SpotDLService } from './spotdl.js';

async function main() {
  console.log('🧪 Testing SpotDL Service\n');

  // Check if spotdl is installed
  console.log('1. Checking if spotdl is installed...');
  const isInstalled = await SpotDLService.isInstalled();

  if (!isInstalled) {
    console.error('❌ spotdl is not installed');
    console.error('Install with: pip3 install spotdl');
    process.exit(1);
  }

  const version = await SpotDLService.getVersion();
  console.log(`   ✓ spotdl ${version}\n`);

  // Test download
  console.log('2. Testing download...');
  const service = new SpotDLService('/tmp/test-spotdl');

  try {
    // Anti-Hero by Taylor Swift
    const result = await service.download('0V3wPSX9ygBnCm8psDIegu', 'flac');

    console.log('\n✅ Download successful!');
    console.log(`   Path: ${result.path}`);
    console.log(`   Artist: ${result.artist}`);
    console.log(`   Title: ${result.title}\n`);

    // Check file size
    const { $ } = await import('bun');
    const size = await $`du -h ${result.path}`.text();
    console.log(`   Size: ${size.split('\t')[0]}`);

    // Check audio info
    const info = await $`ffprobe -v error -show_entries format=duration,bit_rate -of default=noprint_wrappers=1 ${result.path}`.text();
    console.log(`   Format info:\n${info}`);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
