#!/usr/bin/env bun
/**
 * Test running individual orchestrator steps (local versions)
 */

import { processForcedAlignment } from './src/processors/06-forced-alignment';
import { processLyricsTranslation } from './src/processors/07-translate-lyrics';
import { processGeniusEnrichment } from './src/processors/07-genius-enrichment';

const env = {
  NEON_DATABASE_URL: process.env.DATABASE_URL!,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
  GENIUS_API_KEY: process.env.GENIUS_API_KEY!,
} as any;

async function runSteps() {
  const limit = 5;
  
  console.log('🎵 Testing Karaoke Pipeline Steps (Local)\n');
  
  try {
    console.log('=' .repeat(70));
    console.log('Step 6.5: ElevenLabs Forced Alignment');
    console.log('Status: audio_downloaded → alignment_complete');
    console.log('='.repeat(70));
    await processForcedAlignment(env, limit);
    console.log('✅ Step 6.5 completed\n');
  } catch (err: any) {
    console.error('❌ Step 6.5 failed:', err.message, '\n');
  }
  
  try {
    console.log('=' .repeat(70));
    console.log('Step 7: Genius Enrichment');
    console.log('Status: lyrics_ready (parallel - no status change)');
    console.log('='.repeat(70));
    await processGeniusEnrichment(env, limit);
    console.log('✅ Step 7 completed\n');
  } catch (err: any) {
    console.error('❌ Step 7 failed:', err.message, '\n');
  }
  
  try {
    console.log('=' .repeat(70));
    console.log('Step 7.5: Lyrics Translation');
    console.log('Status: alignment_complete → translations_ready');
    console.log('='.repeat(70));
    await processLyricsTranslation(env, limit);
    console.log('✅ Step 7.5 completed\n');
  } catch (err: any) {
    console.error('❌ Step 7.5 failed:', err.message, '\n');
  }
  
  console.log('🏁 Test complete');
}

runSteps().catch(console.error);
