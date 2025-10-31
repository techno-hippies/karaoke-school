#!/usr/bin/env bun
/**
 * Test Step 12: Generate Derivative Images
 */

import { processGenerateImages } from '../src/processors/12-generate-images';

async function main() {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
    FAL_API_KEY: process.env.FAL_API_KEY,
  } as any;

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL or NEON_DATABASE_URL required');
  }

  if (!env.FAL_API_KEY) {
    throw new Error('FAL_API_KEY required in .env');
  }

  console.log('🎨 Step 12: Generate Derivative Images');
  console.log(`📊 Limit: 3 items`);
  console.log('');

  try {
    await processGenerateImages(env, 50);
    console.log('\n✅ Test complete!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
