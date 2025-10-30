#!/usr/bin/env bun
/**
 * Test Demucs Health Check
 */

import { createDemucsService } from './src/services/demucs';

async function main() {
  console.log('🧪 Testing Demucs Service Health Check\n');

  const demucs = createDemucsService();

  console.log(`Environment:`)
  console.log(`  DEMUCS_LOCAL_ENDPOINT: ${process.env.DEMUCS_LOCAL_ENDPOINT || 'not set (will use default)'}`);
  console.log(`  DEMUCS_REMOTE_ENDPOINT: ${process.env.DEMUCS_REMOTE_ENDPOINT || 'not set'}`);
  console.log();

  try {
    // Try to submit a test job
    console.log('Testing demucs.separateAsync()...');
    const result = await demucs.separateAsync(
      'test-track-id',
      'https://api.grove.storage/test',
      'http://localhost:36949/webhooks/demucs-complete'
    );

    console.log('\n✅ Health check passed!');
    console.log(`   Mode: ${result.mode}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);
  } catch (error: any) {
    console.error('\n❌ Health check failed:', error.message);
    process.exit(1);
  }
}

main();
