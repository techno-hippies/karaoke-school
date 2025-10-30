#!/usr/bin/env bun

import { processLyricsTranslation } from './src/processors/07-translate-lyrics';
import type { Env } from './src/types';

const env: Env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  NEON_DATABASE_URL: process.env.DATABASE_URL!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
} as any;

if (!env.OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not set');
  process.exit(1);
}

console.log('🧪 Testing Lyrics Translation Processor...\n');

try {
  await processLyricsTranslation(env, 1);
  console.log('\n✅ Test completed successfully!');
} catch (error: any) {
  console.error('❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
