/**
 * Cloudflare Worker - TikTok Scraper & Music Enrichment API
 *
 * A highly organized, modular API for:
 * - TikTok video scraping with copyright detection
 * - Automatic music metadata enrichment (Spotify → Genius → MusicBrainz → Quansic)
 * - Track normalization with Gemini Flash 2.5 Lite
 * - JSONB-first Neon PostgreSQL storage
 *
 * Built with Hono for clean routing and type safety
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import scraper from './routes/scraper';
import enrichment from './routes/enrichment';
import monitoring from './routes/monitoring';
import karaoke from './routes/karaoke';
import genius from './routes/genius';
import mlc from './routes/mlc';
import bmi from './routes/bmi';
import audio from './routes/audio';
import lyrics from './routes/lyrics';
import lyricsReEnrichment from './routes/lyrics-re-enrichment';
import manualTriggers from './routes/manual-triggers';
import webhooks from './routes/webhooks';
import translations from './routes/translations';
import artistImages from './routes/artist-images';
import { TikTokScraper } from './services/tiktok-scraper';
import { NeonDB } from './neon';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Global CORS middleware
app.use('/*', cors());

// Mount route modules
app.route('/', scraper);
app.route('/', enrichment);
app.route('/', monitoring);
app.route('/', karaoke);
app.route('/', genius);
app.route('/', mlc);
app.route('/', bmi);
app.route('/', audio);
app.route('/', lyrics);
app.route('/', lyricsReEnrichment);
app.route('/', manualTriggers);
app.route('/', webhooks);
app.route('/translations', translations);
app.route('/', artistImages);

// Root endpoint - API info
app.get('/', (c) => {
  return c.json({
    name: 'TikTok Scraper & Music Enrichment API',
    version: '2.0.0',
    architecture: 'Hono + Modular Routes',
    endpoints: {
      // Scraper routes
      'GET /scrape/:handle': 'Scrape TikTok user videos (auto-enriches in background)',
      'GET /stats/:handle': 'Get creator statistics',
      'GET /top-tracks': 'Get top Spotify tracks across all creators',

      // Enrichment routes
      'POST /enrich': 'Manually enrich Spotify tracks',
      'POST /enrich-artists': 'Manually enrich Spotify artists',
      'POST /enrich-musicbrainz?type=artists|recordings': 'Manually enrich MusicBrainz data',
      'POST /enrich-genius': 'Manually enrich Genius songs',
      'POST /normalize-and-match': 'Normalize track titles with Gemini and retry MusicBrainz matching',
      'POST /enrich-quansic': 'Enrich artists with Quansic (IPN, Luminate ID, name variants)',
      'POST /enrich-lyrics': 'Multi-source lyrics (LRCLIB + Lyrics.ovh) with automatic AI normalization',

      // Genius routes
      'POST /enrich-genius-artists': 'Enrich Genius artist metadata (social media, followers, images)',
      'POST /enrich-song-referents': 'Fetch lyrics annotations (referents) for Genius songs',
      'GET /genius/artists/:id': 'Get Genius artist by ID',
      'GET /genius/songs/:id/referents': 'Get all referents for a song',
      'GET /genius/referents/top': 'Get top-voted referents across all songs',

      // MLC licensing routes (corroboration)
      'POST /enrich-mlc-by-iswc': 'Corroborate ISWCs from Quansic + add licensing data (writers, publishers)',
      'GET /mlc/works/:songCode': 'Get MLC work by song code',
      'GET /mlc/recordings/isrc/:isrc': 'Get MLC recording by ISRC',

      // BMI Songview routes (ISWC verification & discovery)
      'POST /enrich-bmi-by-iswc': 'Verify ISWCs from Quansic/MusicBrainz + add BMI publisher data',
      'POST /enrich-bmi-by-title': 'Discover ISWCs for tracks without them (title + performer search)',
      'GET /bmi/works/:bmi_work_id': 'Get BMI work by work ID',
      'GET /bmi/works/iswc/:iswc': 'Get BMI work by ISWC',
      'GET /bmi/stats': 'Get BMI enrichment statistics',

      // Lyrics routes
      'GET /lyrics/:spotify_track_id': 'Get lyrics for a specific track',
      'GET /lyrics-stats': 'Get lyrics enrichment statistics',

      // Monitoring routes
      'GET /cascade-status?handle=:handle': 'View enrichment pipeline completion (all creators or specific)',
      'GET /enrichment-queue': 'Show pending enrichment items at each stage',
      'GET /worker-status': 'Show recent enrichment activity and worker health',
      'POST /backfill?stage=all|spotify|genius|musicbrainz': 'Trigger backfill (not yet implemented)',

      // Karaoke production routes
      'POST /karaoke/create': 'Start karaoke production for a Spotify track',
      'POST /karaoke/download': 'Download track audio via freyr service',
      'POST /karaoke/select-segment': 'Select best 190s segment for fal.ai processing',
      'POST /karaoke/extract-segment': 'Extract selected segment from audio',
      'GET /karaoke/lyrics?spotify_track_id=:id': 'Fetch synced lyrics from LRCLib',
      'GET /karaoke/status?spotify_track_id=:id': 'Check karaoke production status',

      // Audio download workflow routes (Grove storage + Neon DB)
      'GET /audio/ready-for-download?limit=:limit': 'Get tracks ready for audio download (ISWC + MLC ≥98%)',
      'POST /audio/download-tracks?limit=:limit': 'Download audio for ready tracks → Grove → Neon',
      'GET /audio/status/:spotify_track_id': 'Get audio file status for a track',
      'GET /audio/stats': 'Get audio download statistics',

      // Artist Image routes (fal.ai derivative generation)
      'POST /generate-artist-images?limit=:limit': 'Generate derivative artist images via fal.ai Seedream',
      'POST /poll-artist-images?limit=:limit': 'Poll pending fal.ai image generation requests',
      'GET /artist-images/stats': 'Get artist image generation statistics',
      'GET /artist-images/:spotify_artist_id': 'Get generated image for a specific artist',

      // Manual trigger routes (for testing and bulk population)
      'POST /trigger/audio-download?limit=:limit': 'Manually trigger audio download cron',
      'POST /trigger/iswc-discovery?limit=:limit': 'Manually trigger ISWC discovery cron',
      'POST /trigger/spotify-enrichment?limit=:limit': 'Manually trigger Spotify enrichment cron',
      'POST /trigger/genius-enrichment': 'Manually trigger Genius enrichment cron',
      'POST /trigger/musicbrainz-enrichment': 'Manually trigger MusicBrainz enrichment cron',
      'POST /trigger/quansic-enrichment': 'Manually trigger Quansic enrichment cron',
      'POST /trigger/licensing-enrichment': 'Manually trigger licensing enrichment cron',
      'POST /trigger/cisac-ipi-discovery': 'Manually trigger CISAC IPI discovery cron',
      'POST /trigger/lyrics-enrichment': 'Manually trigger lyrics enrichment cron',
      'POST /trigger/lyrics-translation': 'Manually trigger lyrics translation cron (zh, vi, id)',
      'POST /trigger/segment-selection?limit=:limit': 'Manually trigger segment selection cron (Gemini)',
      'POST /trigger/elevenlabs-alignment?limit=:limit': 'Manually trigger ElevenLabs word alignment cron',
      'POST /trigger/artist-images?limit=:limit': 'Manually trigger artist image generation cron (fal.ai)',
      'POST /trigger/all': 'Manually trigger ALL enrichment handlers in sequence',
    },
    pipeline: [
      'TikTok Videos',
      '→ Spotify Tracks (ISRC)',
      '→ ISWC Lookup (GATE: only continue if ISWC found)',
      '→ Spotify Artists',
      '→ Genius Songs',
      '→ Genius Artists (social media, followers, verification)',
      '→ Song Referents (lyrics annotations)',
      '→ MusicBrainz Artists (ISNI, social media)',
      '→ MusicBrainz Recordings (ISRC)',
      '→ MusicBrainz Works (ISWC)',
      '→ Multi-Source Lyrics (LRCLIB + Lyrics.ovh → AI normalization if corroborated)',
      '→ Quansic Enrichment (IPN, Luminate ID)',
      '→ MLC Licensing (writers, publishers, Story Protocol compliance)',
      '→ BMI Songview (ISWC verification, publisher details, reconciliation status)',
    ],
    features: [
      'JSONB-first schema with indexed columns',
      'Idempotent upserts (safe to re-run)',
      'Background enrichment (non-blocking)',
      'Batch processing (handles Cloudflare limits)',
      'Track normalization (Gemini Flash 2.5 Lite)',
      'Rate limiting for external APIs',
    ],
  });
});

// Multiple scheduled cron jobs - Each enrichment stage runs independently
export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('🕐 Cron triggered:', event.scheduledTime);

    // Determine which cron(s) to run based on the current minute
    const now = new Date(event.scheduledTime);
    const minute = now.getMinutes();
    const hour = now.getHours();

    // Map minutes to handlers (multiple can run at same time)
    const handlers: Array<{ name: string; handler: () => Promise<void> }> = [];

    // Every 5 minutes: Unified Pipeline (all enabled steps)
    if (minute % 5 === 0) {
      handlers.push({
        name: 'Unified Pipeline',
        handler: async () => {
          const { runUnifiedPipeline } = await import('./processors/unified-pipeline');
          await runUnifiedPipeline(env, { limit: 50 });
        }
      });
    }

    // Every 3 minutes: ISWC Discovery (0, 3, 6, 9, ...)
    if (minute % 3 === 0) {
      handlers.push({
        name: 'ISWC Discovery',
        handler: async () => {
          const { default: runISWCDiscovery } = await import('./crons/iswc-discovery');
          await runISWCDiscovery(env);
        }
      });
    }

    // Every 5 minutes: Spotify Enrichment (0, 5, 10, ...)
    if (minute % 5 === 0) {
      handlers.push({
        name: 'Spotify Enrichment',
        handler: async () => {
          const { default: runSpotifyEnrichment } = await import('./crons/spotify-enrichment');
          await runSpotifyEnrichment(env);
        }
      });
    }

    // Every 10 minutes: Genius Enrichment (0, 10, 20, ...)
    if (minute % 10 === 0) {
      handlers.push({
        name: 'Genius Enrichment',
        handler: async () => {
          const { default: runGeniusEnrichment } = await import('./crons/genius-enrichment');
          await runGeniusEnrichment(env);
        }
      });
    }

    // Every 12 minutes: MusicBrainz Enrichment (0, 12, 24, 36, 48)
    if (minute % 12 === 0) {
      handlers.push({
        name: 'MusicBrainz Enrichment',
        handler: async () => {
          const { default: runMusicBrainzEnrichment } = await import('./crons/musicbrainz-enrichment');
          await runMusicBrainzEnrichment(env);
        }
      });
    }

    // Every 15 minutes: Lyrics Enrichment (0, 15, 30, 45)
    if (minute % 15 === 0) {
      handlers.push({
        name: 'Lyrics Enrichment',
        handler: async () => {
          const { default: runLyricsEnrichment } = await import('./crons/lyrics-enrichment');
          await runLyricsEnrichment(env);
        }
      });
    }

    // Every 15 minutes: Quansic Recordings Enrichment (0, 15, 30, 45)
    if (minute % 15 === 0) {
      handlers.push({
        name: 'Quansic Recordings Enrichment',
        handler: async () => {
          const { default: runQuansicRecordingsEnrichment } = await import('./crons/quansic-recordings-enrichment');
          await runQuansicRecordingsEnrichment(env);
        }
      });
    }

    // Every 20 minutes: Quansic Artists/Works Enrichment (0, 20, 40)
    if (minute % 20 === 0) {
      handlers.push({
        name: 'Quansic Artists/Works Enrichment',
        handler: async () => {
          const { default: runQuansicEnrichment } = await import('./crons/quansic-enrichment');
          await runQuansicEnrichment(env);
        }
      });
    }

    // Every 25 minutes: Audio Download (0, 25, 50)
    if (minute % 25 === 0) {
      handlers.push({
        name: 'Audio Download',
        handler: async () => {
          const { default: runAudioDownload } = await import('./crons/audio-download');
          await runAudioDownload(env);
        }
      });
    }

    // Every 30 minutes: Licensing Enrichment (0, 30)
    if (minute % 30 === 0) {
      handlers.push({
        name: 'Licensing Enrichment',
        handler: async () => {
          const { default: runLicensingEnrichment } = await import('./crons/licensing-enrichment');
          await runLicensingEnrichment(env);
        }
      });
    }

    // Every 35 minutes: Demucs Separation (0, 35)
    if (minute % 35 === 0) {
      handlers.push({
        name: 'Demucs Separation',
        handler: async () => {
          const { default: runDemucsSeparation } = await import('./crons/demucs-separation');
          await runDemucsSeparation(env);
        }
      });
    }

    // Every 40 minutes: ElevenLabs Word Alignment (0, 40)
    if (minute % 40 === 0) {
      handlers.push({
        name: 'ElevenLabs Alignment',
        handler: async () => {
          const { default: runElevenLabsAlignment } = await import('./crons/elevenlabs-alignment');
          await runElevenLabsAlignment(env);
        }
      });
    }

    // Every 45 minutes: Segment Selection (0, 45)
    if (minute % 45 === 0) {
      handlers.push({
        name: 'Segment Selection',
        handler: async () => {
          const { default: runSegmentSelection } = await import('./crons/segment-selection');
          await runSegmentSelection(env);
        }
      });
    }

    // Every 50 minutes: FFmpeg Crop (0, 50)
    if (minute % 50 === 0) {
      handlers.push({
        name: 'FFmpeg Crop',
        handler: async () => {
          const { default: runFFmpegCrop } = await import('./crons/ffmpeg-crop');
          await runFFmpegCrop(env);
        }
      });
    }

    // Every 55 minutes: Lyrics Translation (0, 55)
    if (minute % 55 === 0) {
      handlers.push({
        name: 'Lyrics Translation',
        handler: async () => {
          const { default: runLyricsTranslation } = await import('./crons/lyrics-translation');
          await runLyricsTranslation(env);
        }
      });
    }

    // Every 2 hours: CISAC IPI Discovery (0:00, 2:00, 4:00, ...)
    if (hour % 2 === 0 && minute === 0) {
      handlers.push({
        name: 'CISAC IPI Discovery',
        handler: async () => {
          const { default: runCISACIPIDiscovery } = await import('./crons/cisac-ipi-discovery');
          await runCISACIPIDiscovery(env);
        }
      });
    }

    // Every hour: Artist Image Generation (0, 60, 120, ...)
    if (minute === 0) {
      handlers.push({
        name: 'Artist Image Generation',
        handler: async () => {
          const { default: runArtistImageGeneration } = await import('./crons/artist-images');
          await runArtistImageGeneration(env);
        }
      });
    }

    if (handlers.length === 0) {
      console.log('⏭️ No handlers scheduled for this minute');
      return;
    }

    console.log(`🚀 Running ${handlers.length} enrichment handler(s): ${handlers.map(h => h.name).join(', ')}`);

    // Run all handlers in parallel with error isolation
    const results = await Promise.allSettled(
      handlers.map(async ({ name, handler }) => {
        try {
          console.log(`▶️ Starting: ${name}`);
          await handler();
          console.log(`✅ Completed: ${name}`);
        } catch (error) {
          console.error(`❌ Failed: ${name}`, error);
          throw error; // Re-throw to mark as rejected in Promise.allSettled
        }
      })
    );

    // Summary
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`📊 Summary: ${succeeded} succeeded, ${failed} failed`);
  },
};
