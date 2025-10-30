#!/usr/bin/env bun
/**
 * Test running individual orchestrator steps
 */

import { processForcedAlignment } from './src/processors/06-forced-alignment';
import { processLyricsTranslation } from './src/processors/07-translate-lyrics';
import { processGeniusEnrichment } from './src/processors/07-genius-enrichment';
import { processISWCDiscovery } from './src/processors/step-08-iswc-discovery';

const env = {
  NEON_DATABASE_URL: process.env.DATABASE_URL!,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
  GENIUS_API_KEY: process.env.GENIUS_API_KEY!,
} as any;

async function runSteps() {
  const limit = 10;
  
  console.log('🎵 Testing Pipeline Steps\n');
  
  try {
    console.log('=' .repeat(70));
    console.log('Step 3: ISWC Discovery');
    console.log('='.repeat(70));
    await processISWCDiscovery(env, limit);
  } catch (err: any) {
    console.error('❌ Step 3 failed:', err.message);
  }
  
  try {
    console.log('\n' + '='.repeat(70));
    console.log('Step 6.5: ElevenLabs Forced Alignment');
    console.log('='.repeat(70));
    await processForcedAlignment(env, limit);
  } catch (err: any) {
    console.error('❌ Step 6.5 failed:', err.message);
  }
  
  try {
    console.log('\n' + '='.repeat(70));
    console.log('Step 7: Genius Enrichment');
    console.log('='.repeat(70));
    await processGeniusEnrichment(env, limit);
  } catch (err: any) {
    console.error('❌ Step 7 failed:', err.message);
  }
  
  try {
    console.log('\n' + '='.repeat(70));
    console.log('Step 7.5: Lyrics Translation');
    console.log('='.repeat(70));
    await processLyricsTranslation(env, limit);
  } catch (err: any) {
    console.error('❌ Step 7.5 failed:', err.message);
  }
  
  console.log('\n✅ Test complete');
}

runSteps().catch(console.error);
