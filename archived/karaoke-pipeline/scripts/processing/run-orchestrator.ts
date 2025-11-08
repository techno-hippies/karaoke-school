#!/usr/bin/env bun
/**
 * Local orchestrator runner for testing
 * Uses the unified pipeline orchestrator with standard .env loading
 */

import { runUnifiedPipeline } from '../../src/processors/orchestrator';

const env = {
  NEON_DATABASE_URL: process.env.DATABASE_URL!,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
  GENIUS_API_KEY: process.env.GENIUS_API_KEY!,
} as any;

// Parse CLI args
const args = process.argv.slice(2);
const step = args[0] ? parseInt(args[0]) : undefined;
const limit = args[1] ? parseInt(args[1]) : 50;

console.log('🎵 Running Karaoke Pipeline Orchestrator');
console.log(`   Step: ${step ? step : 'all'}`);
console.log(`   Limit: ${limit}\n`);

runUnifiedPipeline(env, { step, limit }).catch(err => {
  console.error('❌ Pipeline failed:', err);
  process.exit(1);
});
