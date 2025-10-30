#!/usr/bin/env bun
/**
 * Test complete pipeline end-to-end
 */

import { runUnifiedPipeline } from './src/processors/orchestrator';

const env = {
  NEON_DATABASE_URL: process.env.DATABASE_URL!,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
  GENIUS_API_KEY: process.env.GENIUS_API_KEY!,
} as any;

console.log('🎵 Testing Complete Karaoke Pipeline\n');

// Run with limit=10 to keep test manageable
runUnifiedPipeline(env, { limit: 10 }).catch(err => {
  console.error('❌ Pipeline failed:', err);
  process.exit(1);
});
