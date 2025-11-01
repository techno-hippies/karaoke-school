/**
 * Unified Pipeline Processor
 *
 * Orchestrates the complete karaoke processing pipeline (steps 2-12):
 *
 * Main karaoke pipeline status flow:
 * tiktok_scraped → spotify_resolved → iswc_found → metadata_enriched →
 * lyrics_ready → audio_downloaded → alignment_complete → translations_ready → stems_separated
 *
 * GRC-20 asset preparation (independent):
 * - Step 12: Generate derivative images for artists/works ready for minting
 *
 * Can be triggered manually or via cron. Steps run sequentially based on status dependencies.
 * Each step processes tracks and advances them to the next status.
 *
 * STEPS:
 * - Step 2: Resolve Spotify Metadata (enabled)
 * - Step 3: ISWC Discovery (enabled optional - gate for GRC-20)
 * - Step 4: MusicBrainz Enrichment (enabled optional - metadata)
 * - Step 5: Discover Lyrics (enabled optional - synced lyrics)
 * - Step 6: Download Audio (enabled - fire-and-forget via audio-download-service)
 * - Step 6.5: ElevenLabs Forced Alignment (enabled - word timing)
 * - Step 7: Genius Enrichment (enabled optional - metadata)
 * - Step 7.5: Multi-language Translation (enabled - zh, vi, id)
 * - Step 8: Audio Separation (enabled - Demucs vocal/instrumental separation)
 * - Step 12: Generate Derivative Images (optional - watercolor-style images for GRC-20)
 */

import type { Env } from '../types';
import { resolveSpotifyMetadata } from './02-resolve-spotify';
import { processISWCDiscovery } from './step-08-iswc-discovery';
import { processMusicBrainzEnrichment } from './04-enrich-musicbrainz';
import { processDiscoverLyrics } from './05-discover-lyrics';
import { processDownloadAudio } from './06-download-audio';
import { processGeniusEnrichment } from './07-genius-enrichment';
import { processForcedAlignment } from './06-forced-alignment';
import { processLyricsTranslation } from './07-translate-lyrics';
import { processSeparateAudioRunPod } from './08-separate-audio-runpod';
import { processGenerateImages } from './12-generate-images';

interface PipelineStep {
  number: number;
  name: string;
  description: string;
  status: string;          // Required input status
  nextStatus: string;      // Output status after step
  processor: (env: Env, limit: number) => Promise<void>;
  enabled: boolean;
  optional?: boolean;      // Won't block pipeline if disabled
}

export async function runUnifiedPipeline(env: Env, options?: {
  step?: number;           // Run specific step only
  limit?: number;          // Tracks per step (default: 50)
}): Promise<void> {
  const limit = options?.limit || 50;
  const targetStep = options?.step;

  console.log('🎵 Karaoke Pipeline - Unified Orchestrator');
  console.log(`📊 Complete status flow:`);
  console.log(`   tiktok_scraped → spotify_resolved → iswc_found`);
  console.log(`   → metadata_enriched → lyrics_ready → audio_downloaded`);
  console.log(`   → alignment_complete → translations_ready → stems_separated\n`);

  if (targetStep) {
    console.log(`🎯 Running step ${targetStep} only (limit: ${limit})\n`);
  } else {
    console.log(`🚀 Running all enabled steps (limit: ${limit} per step)\n`);
  }

  const steps: PipelineStep[] = [
    // ==================== EARLY PIPELINE STEPS ====================

    // Step 2: Resolve Spotify Metadata
    {
      number: 2,
      name: 'Resolve Spotify Metadata',
      description: 'Get track metadata and ISRC codes from Spotify API',
      status: 'tiktok_scraped',
      nextStatus: 'spotify_resolved',
      processor: resolveSpotifyMetadata,
      enabled: true
    },

    // Step 3: ISWC Discovery (THE GATE)
    {
      number: 3,
      name: 'ISWC Discovery',
      description: 'Resolve ISWC codes via Quansic (gate: required for GRC-20)',
      status: 'spotify_resolved',
      nextStatus: 'iswc_found',
      processor: processISWCDiscovery,
      enabled: true,
      optional: true  // Don't block pipeline - has retry logic now
    },

    // ==================== MIDDLE PIPELINE STEPS ====================

    // Step 4: MusicBrainz Enrichment
    {
      number: 4,
      name: 'MusicBrainz Enrichment',
      description: 'Add MusicBrainz metadata (recordings, works, artists)',
      status: 'iswc_found',
      nextStatus: 'metadata_enriched',
      processor: processMusicBrainzEnrichment,
      enabled: true,
      optional: true  // Don't block pipeline - has retry logic now
    },

    // Step 5: Discover Lyrics
    {
      number: 5,
      name: 'Discover Lyrics',
      description: 'Fetch synced lyrics from LRCLIB/Lyrics.ovh with AI normalization',
      status: 'metadata_enriched',
      nextStatus: 'lyrics_ready',
      processor: processDiscoverLyrics,
      enabled: true,
      optional: true  // Don't block pipeline - has retry logic now
    },

    // Step 6: Download Audio
    {
      number: 6,
      name: 'Download Audio',
      description: 'Submit audio downloads to audio-download-service',
      status: 'lyrics_ready',
      nextStatus: 'audio_downloaded',
      processor: processDownloadAudio,
      enabled: true
    },

    // ==================== NEW AUDIO PROCESSING STEPS ====================

    // Step 6.5: ElevenLabs Forced Alignment
    {
      number: 6.5,
      name: 'ElevenLabs Forced Alignment',
      description: 'Get word-level timing from lyrics (critical for karaoke)',
      status: 'audio_downloaded',
      nextStatus: 'alignment_complete',
      processor: processForcedAlignment,
      enabled: true
    },

    // Step 7: Genius Enrichment (PARALLEL - no status change)
    {
      number: 7,
      name: 'Genius Enrichment',
      description: 'Enrich with Genius metadata & annotations (for future trivia/images)',
      status: 'lyrics_ready',  // Also processes: audio_downloaded, alignment_complete
      nextStatus: 'lyrics_ready',  // Doesn't change status
      processor: processGeniusEnrichment,
      enabled: true,
      optional: true
    },

    // Step 7.5: Multi-Language Lyrics Translation
    {
      number: 7.5,
      name: 'Lyrics Translation',
      description: 'Translate lyrics to zh, vi, id with word timing',
      status: 'alignment_complete',
      nextStatus: 'translations_ready',
      processor: processLyricsTranslation,
      enabled: true
    },

    // ==================== AUDIO SEPARATION STEP ====================

    // Step 8: Audio Separation (Demucs)
    {
      number: 8,
      name: 'Audio Separation',
      description: 'Submit audio to Demucs for vocal/instrumental separation',
      status: 'translations_ready',
      nextStatus: 'stems_separated',
      processor: processSeparateAudioRunPod,
      enabled: true
    },

    // ==================== GRC-20 ASSET PREPARATION ====================

    // Step 12: Generate Derivative Images (Independent - no status dependency)
    {
      number: 12,
      name: 'Generate Derivative Images',
      description: 'Generate watercolor-style derivative images for GRC-20 artists/works (Seedream)',
      status: 'grc20_ready',  // Dummy status - not used for filtering
      nextStatus: 'grc20_ready',  // Doesn't change status
      processor: processGenerateImages,
      enabled: false,  // Optional - run manually with --step=12
      optional: true  // Won't block pipeline if disabled/fails
    },
  ];

  // Filter to enabled steps (and specific step if requested)
  const stepsToRun = steps.filter(s => {
    if (!s.enabled) return false;
    if (targetStep && s.number !== targetStep) return false;
    return true;
  });

  if (stepsToRun.length === 0) {
    console.log('⚠️  No steps to run (all disabled or step not found)');
    return;
  }

  const startTime = Date.now();
  const results: Array<{ step: number; name: string; success: boolean; error?: string }> = [];

  console.log(`📋 Running ${stepsToRun.length} steps:\n`);

  // Run each step sequentially
  for (const step of stepsToRun) {
    const stepStart = Date.now();
    console.log(`${'='.repeat(70)}`);
    console.log(`Step ${step.number}: ${step.name}${step.optional ? ' [OPTIONAL]' : ''}`);
    console.log(`${step.description}`);
    console.log(`Status: ${step.status} → ${step.nextStatus}`);
    console.log(`${'='.repeat(70)}`);

    try {
      await step.processor(env, limit);

      const duration = ((Date.now() - stepStart) / 1000).toFixed(1);
      console.log(`\n✅ Step ${step.number} completed in ${duration}s`);

      results.push({
        step: step.number,
        name: step.name,
        success: true
      });
    } catch (error: any) {
      console.error(`\n❌ Step ${step.number} failed: ${error.message}`);

      results.push({
        step: step.number,
        name: step.name,
        success: false,
        error: error.message
      });

      // If required step fails, stop pipeline
      // If optional step fails, continue
      if (!step.optional) {
        console.error(`\n⚠️  Required step failed. Stopping pipeline.`);
        break;
      }
    }
  }

  // Summary
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🏁 Pipeline Complete (${totalDuration}s)`);
  console.log(`   ✅ Succeeded: ${succeeded}/${results.length}`);
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed}/${results.length}`);
  }
  console.log(`${'='.repeat(70)}\n`);

  if (failed > 0) {
    console.log('Failed steps:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - Step ${r.step}: ${r.name}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
    console.log('');
  }
}
