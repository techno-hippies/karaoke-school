/**
 * Unified Pipeline Processor
 *
 * Orchestrates all 19 steps of the GRC20 minting pipeline.
 * Can be triggered manually (POST /trigger/pipeline) or via cron (every 5 min).
 *
 * Each step processes tracks in its current status and advances them to the next.
 * Steps run sequentially to maintain data dependencies and rate limits.
 */

import type { Env } from '../types';
import { processISWCDiscovery } from './step-08-iswc-discovery';

interface PipelineStep {
  number: number;
  name: string;
  status: string;
  nextStatus: string;
  processor: (env: Env, limit: number) => Promise<void>;
  enabled: boolean;
}

export async function runUnifiedPipeline(env: Env, options?: {
  step?: number;  // Run specific step only
  limit?: number; // Tracks per step (default: 50)
}): Promise<void> {
  const limit = options?.limit || 50;
  const targetStep = options?.step;

  console.log('🚀 Unified Pipeline Starting...');
  if (targetStep) {
    console.log(`   Running step ${targetStep} only (limit: ${limit})`);
  } else {
    console.log(`   Running all steps (limit: ${limit} per step)\n`);
  }

  const steps: PipelineStep[] = [
    // Step 8: ISWC Discovery (THE GATE)
    {
      number: 8,
      name: 'ISWC Discovery',
      status: 'spotify_resolved',
      nextStatus: 'iswc_found',
      processor: processISWCDiscovery,
      enabled: true
    },

    // Step 9: MusicBrainz Metadata Enrichment
    // {
    //   number: 9,
    //   name: 'MusicBrainz Enrichment',
    //   status: 'iswc_found',
    //   nextStatus: 'metadata_enriched',
    //   processor: processMusicBrainzEnrichment,
    //   enabled: false // TODO: implement
    // },

    // Step 10: Genius Lyrics + Annotations
    // {
    //   number: 10,
    //   name: 'Genius Enrichment',
    //   status: 'metadata_enriched',
    //   nextStatus: 'genius_enriched',
    //   processor: processGeniusEnrichment,
    //   enabled: false // TODO: implement
    // },

    // Step 11: Multi-Source Lyrics (LRCLIB + Lyrics.ovh)
    // {
    //   number: 11,
    //   name: 'Lyrics Enrichment',
    //   status: 'genius_enriched',
    //   nextStatus: 'lyrics_ready',
    //   processor: processLyricsEnrichment,
    //   enabled: false // TODO: implement
    // },

    // Step 12: MLC Licensing Data
    // {
    //   number: 12,
    //   name: 'MLC Licensing',
    //   status: 'lyrics_ready',
    //   nextStatus: 'licensing_enriched',
    //   processor: processMLCEnrichment,
    //   enabled: false // TODO: implement
    // },

    // Step 13: Audio Download (Freyr + Grove + AcoustID)
    // {
    //   number: 13,
    //   name: 'Audio Download',
    //   status: 'licensing_enriched',
    //   nextStatus: 'audio_downloaded',
    //   processor: processAudioDownload,
    //   enabled: false // TODO: implement
    // },

    // Step 14: Segment Selection (Gemini)
    // {
    //   number: 14,
    //   name: 'Segment Selection',
    //   status: 'audio_downloaded',
    //   nextStatus: 'segment_selected',
    //   processor: processSegmentSelection,
    //   enabled: false // TODO: implement
    // },

    // Step 15: FFmpeg Segment Extraction
    // {
    //   number: 15,
    //   name: 'Segment Extraction',
    //   status: 'segment_selected',
    //   nextStatus: 'segment_extracted',
    //   processor: processSegmentExtraction,
    //   enabled: false // TODO: implement
    // },

    // Step 16: ElevenLabs Word Alignment
    // {
    //   number: 16,
    //   name: 'Word Alignment',
    //   status: 'segment_extracted',
    //   nextStatus: 'alignment_complete',
    //   processor: processWordAlignment,
    //   enabled: false // TODO: implement
    // },

    // Step 17: Demucs Stem Separation
    // {
    //   number: 17,
    //   name: 'Demucs Separation',
    //   status: 'alignment_complete',
    //   nextStatus: 'stems_separated',
    //   processor: processDemucsSeparation,
    //   enabled: false // TODO: implement
    // },

    // Step 18: Fal.ai Media Enhancement
    // {
    //   number: 18,
    //   name: 'Media Enhancement',
    //   status: 'stems_separated',
    //   nextStatus: 'media_enhanced',
    //   processor: processMediaEnhancement,
    //   enabled: false // TODO: implement
    // },

    // Step 19: GRC20 Mint Preparation
    // {
    //   number: 19,
    //   name: 'Mint Preparation',
    //   status: 'media_enhanced',
    //   nextStatus: 'ready_to_mint',
    //   processor: processMintPreparation,
    //   enabled: false // TODO: implement
    // }
  ];

  // Filter to enabled steps (and specific step if requested)
  const stepsToRun = steps.filter(s => {
    if (!s.enabled) return false;
    if (targetStep && s.number !== targetStep) return false;
    return true;
  });

  if (stepsToRun.length === 0) {
    console.log('⚠️ No steps to run (all disabled or step not found)');
    return;
  }

  const startTime = Date.now();
  const results: { step: number; name: string; success: boolean; error?: string }[] = [];

  // Run each step sequentially
  for (const step of stepsToRun) {
    const stepStart = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Step ${step.number}: ${step.name}`);
    console.log(`Status: ${step.status} → ${step.nextStatus}`);
    console.log(`${'='.repeat(60)}`);

    try {
      await step.processor(env, limit);

      const duration = ((Date.now() - stepStart) / 1000).toFixed(1);
      console.log(`✅ Step ${step.number} completed in ${duration}s`);

      results.push({
        step: step.number,
        name: step.name,
        success: true
      });
    } catch (error: any) {
      console.error(`❌ Step ${step.number} failed:`, error.message);

      results.push({
        step: step.number,
        name: step.name,
        success: false,
        error: error.message
      });

      // Continue to next step even if one fails
    }
  }

  // Summary
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🏁 Pipeline Complete (${totalDuration}s)`);
  console.log(`   ✅ Succeeded: ${succeeded} / ${results.length}`);
  console.log(`   ❌ Failed: ${failed} / ${results.length}`);

  if (failed > 0) {
    console.log('\n   Failed steps:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - Step ${r.step}: ${r.name} - ${r.error}`);
    });
  }

  console.log(`${'='.repeat(60)}\n`);
}
