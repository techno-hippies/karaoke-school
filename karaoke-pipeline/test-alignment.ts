#!/usr/bin/env bun

import { processForcedAlignment } from './src/processors/06-forced-alignment';
import type { Env } from './src/types';

const env: Env = {
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY!,
  DATABASE_URL: process.env.DATABASE_URL!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
  GENIUS_API_KEY: process.env.GENIUS_API_KEY!,
} as any;

if (!env.ELEVENLABS_API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY not set');
  process.exit(1);
}

console.log('🧪 Testing Forced Alignment Processor...\n');

try {
  await processForcedAlignment(env, 3);
  console.log('\n✅ Test completed successfully!');
} catch (error: any) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
