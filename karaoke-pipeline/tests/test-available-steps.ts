#!/usr/bin/env bun
/**
 * Test pipeline with available steps (2, 6.5, 7, 7.5)
 * Skip Step 3 which requires Cloudflare Workers client
 */

import { resolveSpotifyMetadata } from './src/processors/02-resolve-spotify';
import { processForcedAlignment } from './src/processors/06-forced-alignment';
import { processGeniusEnrichment } from './src/processors/07-genius-enrichment';
import { processLyricsTranslation } from './src/processors/07-translate-lyrics';

const env = {
  NEON_DATABASE_URL: process.env.DATABASE_URL!,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
  GENIUS_API_KEY: process.env.GENIUS_API_KEY!,
} as any;

async function runPipeline() {
  console.log('🎵 Testing Karaoke Pipeline (Steps 2, 6.5, 7, 7.5)\n');
  const limit = 5;

  try {
    console.log('=' .repeat(70));
    console.log('Step 2: Resolve Spotify Metadata');
    console.log('Status: tiktok_scraped → spotify_resolved');
    console.log('='.repeat(70));
    await resolveSpotifyMetadata(env, limit);
    console.log('');
  } catch (err: any) {
    console.error('❌ Step 2 failed:', err.message);
  }

  try {
    console.log('=' .repeat(70));
    console.log('Step 6.5: ElevenLabs Forced Alignment');
    console.log('Status: audio_downloaded → alignment_complete');
    console.log('='.repeat(70));
    await processForcedAlignment(env, limit);
    console.log('');
  } catch (err: any) {
    console.error('❌ Step 6.5 failed:', err.message);
  }

  try {
    console.log('=' .repeat(70));
    console.log('Step 7: Genius Enrichment');
    console.log('Status: lyrics_ready (parallel - no status change)');
    console.log('='.repeat(70));
    await processGeniusEnrichment(env, limit);
    console.log('');
  } catch (err: any) {
    console.error('❌ Step 7 failed:', err.message);
  }

  try {
    console.log('=' .repeat(70));
    console.log('Step 7.5: Lyrics Translation');
    console.log('Status: alignment_complete → translations_ready');
    console.log('='.repeat(70));
    await processLyricsTranslation(env, limit);
    console.log('');
  } catch (err: any) {
    console.error('❌ Step 7.5 failed:', err.message);
  }

  console.log('🏁 Test complete');
}

runPipeline().catch(console.error);
