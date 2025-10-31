/**
 * Local Quansic Service
 * Direct embedding of music enrichment logic from quansic-service
 */

import { neon } from "@neondatabase/serverless";

export interface MusicEnrichmentResult {
  success: boolean;
  data?: {
    isrc?: string;
    title: string;
    iswc?: string | null;
    work_title?: string | null;
    artists: Array<{
      name: string;
      isni?: string;
      spotify_id?: string;
      musicbrainz_mbid?: string;
    }>;
    duration_ms?: number;
    platform_ids?: {
      spotify?: string;
      musicbrainz?: string;
      genius?: string;
    };
  };
  error?: string;
}

export interface QuansicConfig {
  neonUrl: string;
  maxConcurrency: number;
  retryAttempts: number;
  cacheResults: boolean;
}

export class QuansicLocalService {
  private config: QuansicConfig;
  private cache: Map<string, MusicEnrichmentResult>;
  private activeRequests: Map<string, Promise<MusicEnrichmentResult>>;

  constructor(config: QuansicConfig) {
    this.config = config;
    this.cache = new Map();
    this.activeRequests = new Map();
  }

  /**
   * Enrich track with MusicBrainz data
   */
  async enrichFromSpotify(
    spotifyTrackId: string,
    title?: string,
    artist?: string
  ): Promise<MusicEnrichmentResult> {
    // Check cache first
    if (this.config.cacheResults && this.cache.has(spotifyTrackId)) {
      return this.cache.get(spotifyTrackId)!;
    }

    // Prevent duplicate requests
    if (this.activeRequests.has(spotifyTrackId)) {
      return await this.activeRequests.get(spotifyTrackId)!;
    }

    const enrichmentPromise = this.performEnrichment(spotifyTrackId, title, artist);
    this.activeRequests.set(spotifyTrackId, enrichmentPromise);

    try {
      const result = await enrichmentPromise;
      
      // Cache successful results
      if (this.config.cacheResults && result.success) {
        this.cache.set(spotifyTrackId, result);
      }
      
      return result;
    } finally {
      this.activeRequests.delete(spotifyTrackId);
    }
  }

  private async performEnrichment(
    spotifyTrackId: string,
    title?: string,
    artist?: string
  ): Promise<MusicEnrichmentResult> {
    const sql = neon(this.config.neonUrl);

    try {
      // First, try to get existing MusicBrainz data from spotify_tracks
      const existingData = await sql`
        SELECT 
          title,
          artist,
          musicbrainz_mbid,
          musicbrainz_recording_mbid,
          genius_id
        FROM spotify_tracks 
        WHERE spotify_track_id = ${spotifyTrackId}
      `;

      if (existingData.length === 0) {
        return {
          success: false,
          error: 'Track not found in database'
        };
      }

      const track = existingData[0];
      const trackTitle = title || track.title;
      const trackArtist = artist || track.artist;

      // Get ISWC data from grc20_works if available
      const iswcData = await sql`
        SELECT 
          gw.iswc,
          gw.title as work_title,
          ga.name as artist_name,
          ga.isni,
          ga.mbid as artist_mbid
        FROM grc20_works gw
        LEFT JOIN grc20_artists ga ON gw.primary_artist_id = ga.id
        WHERE gw.spotify_track_id = ${spotifyTrackId}
        LIMIT 1
      `;

      const result: MusicEnrichmentResult = {
        success: true,
        data: {
          title: trackTitle,
          iswc: iswcData[0]?.iswc || null,
          work_title: iswcData[0]?.work_title || null,
          artists: [{
            name: trackArtist,
            isni: iswcData[0]?.isni || null,
            musicbrainz_mbid: track.musicbrainz_recording_mbid || null,
          }],
          platform_ids: {
            spotify: spotifyTrackId,
            musicbrainz: track.musicbrainz_recording_mbid || null,
            genius: track.genius_id || null,
          }
        }
      };

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Database query failed'
      };
    }
  }

  /**
   * Batch enrichment for multiple tracks
   */
  async enrichBatch(
    tracks: Array<{ spotifyTrackId: string; title?: string; artist?: string }>
  ): Promise<Array<MusicEnrichmentResult>> {
    const results = await Promise.allSettled(
      tracks.map(track => this.enrichFromSpotify(track.spotifyTrackId, track.title, track.artist))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: result.reason?.message || 'Batch enrichment failed'
        };
      }
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      activeRequests: this.activeRequests.size,
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * Create default Quansic service from environment
 */
export function createQuansicLocalService(): QuansicLocalService {
  const config: QuansicConfig = {
    neonUrl: process.env.NEON_DATABASE_URL!,
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '5'),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    cacheResults: true,
  };

  if (!config.neonUrl) {
    throw new Error('NEON_DATABASE_URL environment variable required');
  }

  return new QuansicLocalService(config);
}
