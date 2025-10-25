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
import { TikTokScraper } from './tiktok-scraper';
import { NeonDB } from './neon';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Global CORS middleware
app.use('/*', cors());

// Mount route modules
app.route('/', scraper);
app.route('/', enrichment);

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
    },
    pipeline: [
      'TikTok Videos',
      '→ Spotify Tracks',
      '→ Spotify Artists',
      '→ Genius Songs',
      '→ MusicBrainz Artists (ISNI)',
      '→ MusicBrainz Recordings (ISRC)',
      '→ MusicBrainz Works (ISWC)',
      '→ Quansic Enrichment (IPN, Luminate ID)',
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

// Scheduled cron job (optional)
export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    console.log('Cron triggered:', event.scheduledTime);

    // Example: Scrape predefined creators (fetches ALL videos)
    const creators = ['idazeile', 'brookemonk_']; // Add your target creators

    const scraper = new TikTokScraper();
    const db = new NeonDB(env.NEON_DATABASE_URL);

    for (const handle of creators) {
      try {
        console.log(`Scraping @${handle}...`);

        const profile = await scraper.getUserProfile(handle);
        if (!profile) continue;

        await db.upsertCreator(profile);

        // Fetch ALL videos (no limit)
        const videos = await scraper.getUserVideos(profile.secUid);
        const videoRecords = videos.map((video) => ({
          video,
          tiktokHandle: handle,
          spotifyTrackId: scraper.extractSpotifyId(video),
          copyrightStatus: scraper.getCopyrightStatus(video),
        }));

        const inserted = await db.batchUpsertVideos(videoRecords);
        console.log(`@${handle}: ${inserted}/${videos.length} videos upserted`);
      } catch (error) {
        console.error(`Failed to scrape @${handle}:`, error);
      }
    }
  },
};
