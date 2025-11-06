/**
 * Unified Pipeline Processor
 *
 * Orchestrates the complete karaoke processing pipeline with BLOCK ARCHITECTURE:
 *
 * BLOCK 1: WORKS ENRICHMENT (Steps 2-4.6)
 * ────────────────────────────────────────
 * - Step 2: Spotify Tracks (metadata + ISRC)
 * - Step 3: ISWC Discovery (Quansic → MLC → BMI fallback) [FIXED ORDER]
 * - Step 4: MusicBrainz Works (recordings + works + artists)
 * - Step 4.5: Genius Songs (language, annotations, referents)
 * - Step 4.6: Wikidata Works (ISWC, composers, international IDs)
 *
 * BLOCK 2: ARTISTS ENRICHMENT (Steps 4.7-4.10)
 * ─────────────────────────────────────────────
 * - Step 4.7: Quansic Artists (ISNI, IPI, Wikidata IDs)
 * - Step 4.8: MusicBrainz Artists (handled by Step 4)
 * - Step 4.9: Genius Artists (bios, social links, all roles)
 * - Step 4.10: Wikidata Artists (library IDs, 40+ identifiers) [REFACTORED]
 *
 * BLOCK 3: LYRICS & AUDIO PROCESSING (Steps 5-11)
 * ────────────────────────────────────────────────
 * - Step 5: Discover Lyrics (synced LRC format)
 * - Step 6: Download Audio (fire-and-forget to Grove)
 * - Step 6.5: ElevenLabs Forced Alignment (word-level timing)
 * - Step 7: Genius Enrichment (LEGACY - kept for compatibility)
 * - Step 7.5: Multi-language Translation (zh, vi, id)
 * - Step 8: Audio Separation (Demucs vocal/instrumental)
 * - Step 9: AI Segment Selection (optimal 190s segment)
 * - Step 10: fal.ai Enhancement (full-song chunking + 2s crossfade)
 * - Step 11: AI Viral Clip Selection (30-60s verse+chorus via Claude)
 * - Step 11.5: Upload TikTok Videos to Grove (IPFS)
 *
 * BLOCK 4: BLOCKCHAIN EMISSION & CONSOLIDATION (Steps 12-13)
 * ───────────────────────────────────────────────────────────
 * - Step 12: Emit Segment Events (on-chain karaoke data)
 * - Step 13: Story Protocol Derivatives (TikTok creator videos)
 *
 * Main karaoke pipeline status flow:
 * tiktok_scraped → spotify_resolved → iswc_found → metadata_enriched →
 * lyrics_ready → audio_downloaded → alignment_complete → translations_ready →
 * stems_separated → segments_selected → enhanced → clips_cropped
 *
 * KEY ARCHITECTURAL CHANGES:
 * 1. ISWC fallback order FIXED: Quansic → MLC (direct ISRC→ISWC) → BMI (fuzzy match)
 * 2. Works vs Artists enrichment now happens in PARALLEL (same status: metadata_enriched)
 * 3. Wikidata Artists REFACTORED to query spotify_artists (not grc20_artists)
 * 4. grc20_artists consolidation moved to Step 13 (was causing circular dependency)
 *
 * KEY INSIGHT: Step 12 only uploads the 50s TikTok clip's lyrics/alignment
 * to Grove, not the full 190s segment. The SQL query filters to only lines
 * that fall within the clip window (clip_start_ms → clip_end_ms), and offsets
 * all timings to 0-based (0 = clip start). This ensures users only see the
 * relevant lyrics for the song they're singing.
 */

import type { Env } from '../types';
import { reconcileAllStatuses } from '../utils/reconcile-status';
import { close } from '../db/neon';
import { resolveSpotifyMetadata } from './resolve-spotify';
import { processISWCDiscovery } from './discover-iswc';
import { processMusicBrainzEnrichment } from './enrich-musicbrainz';
import { processGeniusSongs } from './enrich-genius-songs';
import { processWikidataWorks } from './enrich-wikidata-works';
import { processQuansicArtistEnrichment } from './enrich-quansic-artists';
import { processGeniusArtists } from './enrich-genius-artists';
import { processWikidataArtists } from './enrich-wikidata-artists';
import { processDiscoverLyrics } from './discover-lyrics';
import { processDownloadAudio } from './download-audio';
import { processGeniusEnrichment } from './enrich-genius-legacy';
import { processForcedAlignment } from './align-lyrics-forced';
import { processLyricsTranslation } from './translate-lyrics';
import { processSeparateAudio } from './separate-audio';
import { processSegmentSelection } from './select-segments';
import { processFalEnhancementChunked } from './enhance-audio';
import { processViralClipSelection } from './select-viral-clip';
import { processUploadGroveVideos } from './upload-videos-grove';
import { processEmitSegmentEvents } from './emit-segment-events';
import { processStoryDerivatives } from './mint-story-derivatives';

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

  // SELF-HEALING: Reconcile statuses before running pipeline
  console.log('');
  const reconcileResult = await reconcileAllStatuses(env.DATABASE_URL);
  if (reconcileResult.tracksFixed > 0) {
    console.log(`   ✅ Fixed ${reconcileResult.tracksFixed} status inconsistencies`);
  }
  console.log('');

  if (targetStep) {
    console.log(`🎯 Running step ${targetStep} only (limit: ${limit})\n`);
  } else {
    console.log(`🚀 Running all enabled steps (limit: ${limit} per step)\n`);
  }

  const steps: PipelineStep[] = [
    // ==================== BLOCK 1: WORKS ENRICHMENT ====================

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

    // Step 3: ISWC Discovery (Quansic → MLC → BMI fallback)
    {
      number: 3,
      name: 'ISWC Discovery',
      description: 'Resolve ISWC codes via Quansic/MLC/BMI (gate: required for GRC-20)',
      status: 'spotify_resolved',
      nextStatus: 'iswc_found',
      processor: processISWCDiscovery,
      enabled: true,
      optional: true  // Don't block pipeline - has retry logic now
    },

    // Step 4: MusicBrainz Works (recordings + works)
    {
      number: 4,
      name: 'MusicBrainz Works',
      description: 'Add MusicBrainz metadata for recordings and works',
      status: 'iswc_found',
      nextStatus: 'metadata_enriched',
      processor: processMusicBrainzEnrichment,
      enabled: true,
      optional: true  // Don't block pipeline - has retry logic now
    },

    // Step 4.9: Genius Artists (MOVED HERE - must run before 4.5)
    {
      number: 4.9,
      name: 'Genius Artists',
      description: 'Fetch full artist profiles from Genius (primary, featured, producers, writers)',
      status: 'metadata_enriched',
      nextStatus: 'metadata_enriched',  // No status change
      processor: processGeniusArtists,
      enabled: true,
      optional: true
    },

    // Step 4.5: Genius Songs
    {
      number: 4.5,
      name: 'Genius Songs',
      description: 'Match songs to Genius for work-level metadata (language, annotations)',
      status: 'metadata_enriched',
      nextStatus: 'metadata_enriched',  // No status change
      processor: processGeniusSongs,
      enabled: true,
      optional: true
    },

    // Step 4.6: Wikidata Works
    {
      number: 4.6,
      name: 'Wikidata Works',
      description: 'Enrich works with Wikidata metadata (ISWC, composers, identifiers)',
      status: 'metadata_enriched',
      nextStatus: 'metadata_enriched',  // No status change
      processor: processWikidataWorks,
      enabled: true,
      optional: true
    },

    // ==================== BLOCK 2: ARTISTS ENRICHMENT ====================

    // Step 4.7: Quansic Artists
    {
      number: 4.7,
      name: 'Quansic Artists',
      description: 'Enrich artists with ISNI/IPI data from Quansic',
      status: 'metadata_enriched',
      nextStatus: 'metadata_enriched',  // No status change
      processor: processQuansicArtistEnrichment,
      enabled: true,
      optional: true
    },

    // Step 4.8: MusicBrainz Artists (part of Step 4)
    // NOTE: Currently handled by Step 4 (processMusicBrainzEnrichment)
    // MusicBrainz enrichment fetches recordings, works, AND artists together

    // Step 4.10: Wikidata Artists
    {
      number: 4.10,
      name: 'Wikidata Artists',
      description: 'Enrich artists with Wikidata metadata (library IDs, international identifiers)',
      status: 'metadata_enriched',
      nextStatus: 'metadata_enriched',  // No status change
      processor: processWikidataArtists,
      enabled: true,
      optional: true
    },

    // ==================== BLOCK 3: LYRICS & AUDIO PROCESSING ====================

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
      status: 'lyrics_ready',  // Also processes: audio_downloaded, alignment_complete, translations_ready, stems_separated
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
      processor: processSeparateAudio,
      enabled: true
    },

    // ==================== SEGMENT PROCESSING STEPS ====================

    // Step 9: AI Segment Selection
    {
      number: 9,
      name: 'AI Segment Selection',
      description: 'Select optimal 190s karaoke segment and best 20-50s clip using AI',
      status: 'stems_separated',
      nextStatus: 'segments_selected',
      processor: processSegmentSelection,
      enabled: true
    },

    // Step 10: fal.ai Audio Enhancement (Full-Song Chunking)
    {
      number: 10,
      name: 'fal.ai Audio Enhancement',
      description: 'Enhance ENTIRE songs using Stable Audio 2.5 with 190s chunking, 2s crossfade merging',
      status: 'segments_selected',
      nextStatus: 'enhanced',
      processor: processFalEnhancementChunked,
      enabled: true
    },

    // Step 11: AI-Powered Viral Clip Selection
    {
      number: 11,
      name: 'AI-Powered Viral Clip Selection',
      description: 'AI analyzes song structure to select optimal 30-60s verse+chorus, crops from enhanced instrumental',
      status: 'enhanced',
      nextStatus: 'clips_cropped',
      processor: processViralClipSelection,
      enabled: true
    },

    // ==================== VIDEO UPLOAD TO GROVE ====================

    // Step 11.5: Upload TikTok Videos to Grove
    {
      number: 11.5,
      name: 'Upload TikTok Videos to Grove',
      description: 'Upload TikTok creator videos to Grove/IPFS (copyrighted after clips_cropped, uncopyrighted anytime)',
      status: 'clips_cropped',
      nextStatus: 'clips_cropped',  // Doesn't change pipeline status
      processor: processUploadGroveVideos,
      enabled: true,
      optional: true  // Don't block pipeline if upload fails
    },

    // ==================== BLOCKCHAIN EMISSION ====================

    // Step 12: Emit Segment Events to Blockchain
    {
      number: 12,
      name: 'Emit Segment Events to Blockchain',
      description: 'Upload pre-filtered translations/alignments to Grove, emit contract events for subgraph indexing',
      status: 'clips_cropped',
      nextStatus: 'clips_cropped',  // Doesn't change pipeline status
      processor: processEmitSegmentEvents,
      enabled: true,
      optional: true  // Don't block pipeline if PRIVATE_KEY missing
    },

    // ==================== CREATOR VIDEO DERIVATIVES ====================

    // Step 13: Mint Story Protocol Derivatives
    {
      number: 13,
      name: 'Mint Story Protocol Derivatives',
      description: 'Mint copyrighted TikTok creator videos as Story IP Assets (18% creator / 82% rights holders)',
      status: 'clips_cropped',  // Technically independent but runs after segment events
      nextStatus: 'clips_cropped',  // Doesn't change pipeline status
      processor: processStoryDerivatives,
      enabled: false,  // Manual step - requires creator PKP/Lens accounts
      optional: true   // Don't block pipeline
    }
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

// Only run if this file is executed directly
if (import.meta.main) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let step: number | undefined;
  let limit = 50;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--step' && args[i + 1]) {
      step = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
      i++;
    }
  }

  const env: Env = {
    DATABASE_URL: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '',
    QUANSIC_SERVICE_URL: process.env.QUANSIC_SERVICE_URL,
  } as Env;

  runUnifiedPipeline(env, { step, limit })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await close();
    });
}
