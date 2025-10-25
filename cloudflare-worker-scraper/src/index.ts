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
import audio from './routes/audio';
import lyrics from './routes/lyrics';
import { TikTokScraper } from './tiktok-scraper';
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
app.route('/', audio);
app.route('/', lyrics);

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
      'POST /enrich-lyrics': 'Fetch lyrics from LRCLIB (synced + plain text)',

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
      '→ LRCLIB Lyrics (synced + plain text)',
      '→ Quansic Enrichment (IPN, Luminate ID)',
      '→ MLC Licensing (writers, publishers, Story Protocol compliance)',
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

// Scheduled cron job - Runs enrichment pipeline every 5 minutes
export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('🕐 Cron triggered:', event.scheduledTime);
    console.log('🚀 Running continuous enrichment pipeline...');

    const db = new NeonDB(env.NEON_DATABASE_URL);

    // Import and run enrichment directly
    const { runEnrichmentPipeline } = await import('./routes/scraper');

    try {
      await runEnrichmentPipeline(env, db);
      console.log('✅ Enrichment cycle complete');
    } catch (error) {
      console.error('❌ Enrichment failed:', error);
    }
  },
};
