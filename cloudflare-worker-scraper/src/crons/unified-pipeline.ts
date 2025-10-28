/**
 * Unified Pipeline Processor
 *
 * Replaces 9 separate cron jobs with single linear flow.
 * Processes tracks stage-by-stage with clear gating logic.
 *
 * Steps:
 * 1-3: TikTok scraping (existing code)
 * 4-7: Spotify resolution (dump-first)
 * 8: ISWC discovery (GATE!)
 * 9-11: MusicBrainz enrichment
 * 12-14: Lyrics fetching + normalization
 * 15: Audio download (freyr + AcoustID + Grove)
 * 16: ElevenLabs word alignment
 * 17: Demucs separation
 * 18: Fal.ai enhancement (audio + images)
 * 19: GRC20 mint preparation
 */

import { NeonDB } from '../neon';
import { SpotifyAdapter } from '../services/spotify-adapter';
import { SpotifyAPI } from '../services/spotify';
import { QuansicService } from '../services/quansic';
import { MusicBrainzService } from '../services/musicbrainz';
import type { Env } from '../types';

interface PipelineTrack {
  id: number;
  spotify_track_id: string;
  status: string;
  isrc: string | null;
  iswc: string | null;
  retry_count: number;
}

export default async function processUnifiedPipeline(env: Env) {
  const db = new NeonDB(env.NEON_DATABASE_URL);
  const spotifyAPI = new SpotifyAPI(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET);
  const spotifyAdapter = new SpotifyAdapter(db, spotifyAPI);

  console.log('🚀 Starting unified pipeline processor');

  // Process each stage in order
  await processStage(db, spotifyAdapter, 'scraped', resolveSpotify, 10);
  await processStage(db, null, 'spotify_resolved', findISWC, 20, env);
  await processStage(db, null, 'iswc_found', enrichMetadata, 10, env);
  await processStage(db, null, 'metadata_enriched', fetchLyrics, 15, env);
  await processStage(db, null, 'lyrics_ready', downloadAudio, 5, env);
  await processStage(db, null, 'audio_downloaded', alignWords, 5, env);
  await processStage(db, null, 'alignment_complete', separateStems, 3, env);
  await processStage(db, null, 'stems_separated', enhanceMedia, 3, env);
  await processStage(db, null, 'media_enhanced', prepareForMint, 10);

  // Print stats
  const stats = await getPipelineStats(db);
  console.log('📊 Pipeline stats:', stats);

  // Print API usage
  const usage = await spotifyAdapter.getUsageStats();
  console.log('📈 Spotify cache rate:', `${(usage.cache_rate * 100).toFixed(1)}%`);
  console.log(`   Dump hits: ${usage.dump_hits}, API calls: ${usage.api_calls}`);
}

/**
 * Generic stage processor
 */
async function processStage(
  db: NeonDB,
  adapter: SpotifyAdapter | null,
  currentStatus: string,
  processor: (items: PipelineTrack[], db: NeonDB, adapter?: any, env?: Env) => Promise<void>,
  limit: number,
  env?: Env
) {
  // Get tracks ready for processing
  const items = await db.query<PipelineTrack>(`
    SELECT *
    FROM track_pipeline
    WHERE status = $1
      AND (last_attempted_at IS NULL OR last_attempted_at < NOW() - INTERVAL '1 hour')
      AND retry_count < 3
    ORDER BY created_at ASC
    LIMIT $2
  `, [currentStatus, limit]);

  if (items.length === 0) {
    console.log(`⏭️  No tracks to process in stage: ${currentStatus}`);
    return;
  }

  console.log(`▶️  Processing ${items.length} tracks in stage: ${currentStatus}`);

  try {
    await processor(items, db, adapter, env);
  } catch (error) {
    console.error(`❌ Stage ${currentStatus} failed:`, error);
  }
}

/**
 * STEP 4-7: Resolve Spotify track + artists
 */
async function resolveSpotify(
  tracks: PipelineTrack[],
  db: NeonDB,
  adapter: SpotifyAdapter
) {
  for (const track of tracks) {
    try {
      // Get track from dump or API
      const spotifyTrack = await adapter.getTrack(track.spotify_track_id);

      if (!spotifyTrack) {
        await markFailed(db, track.id, 'Spotify track not found');
        continue;
      }

      // Get ISRC
      const isrc = await adapter.getISRC(track.spotify_track_id);

      if (!isrc) {
        await markFailed(db, track.id, 'No ISRC found for track');
        continue;
      }

      // Log source
      await db.query(`
        INSERT INTO processing_log (spotify_track_id, stage, action, source, message)
        VALUES ($1, 'spotify_resolve', 'success', $2, $3)
      `, [
        track.spotify_track_id,
        spotifyTrack.source,
        `Found in ${spotifyTrack.source}`
      ]);

      // Update pipeline
      await db.query(`
        UPDATE track_pipeline
        SET
          status = 'spotify_resolved',
          isrc = $1,
          spotify_artist_id = $2,
          last_attempted_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
      `, [isrc, spotifyTrack.artists[0], track.id]);

      console.log(`✅ Resolved ${track.spotify_track_id} (source: ${spotifyTrack.source})`);
    } catch (error) {
      console.error(`Failed to resolve ${track.spotify_track_id}:`, error);
      await incrementRetry(db, track.id, 'spotify_resolve', String(error));
    }
  }
}

/**
 * STEP 8: ISWC Discovery (GATE!)
 */
async function findISWC(tracks: PipelineTrack[], db: NeonDB, _adapter: any, env: Env) {
  const quansic = new QuansicService(env.QUANSIC_SERVICE_URL, env.QUANSIC_SESSION_COOKIE);

  for (const track of tracks) {
    try {
      if (!track.isrc) {
        await markFailed(db, track.id, 'No ISRC to lookup ISWC');
        continue;
      }

      // 1. Check cache first
      const cached = await db.query<{ iswc: string }>(`
        SELECT iswc FROM quansic_cache WHERE isrc = $1
      `, [track.isrc]);

      let iswc = cached[0]?.iswc;

      if (!iswc) {
        // 2. Try Quansic API
        const quansicData = await quansic.getRecordingByISRC(track.isrc);
        iswc = quansicData?.iswc;

        if (iswc) {
          // Cache result
          await db.query(`
            INSERT INTO quansic_cache (isrc, iswc, raw_data)
            VALUES ($1, $2, $3)
            ON CONFLICT (isrc) DO UPDATE SET
              iswc = EXCLUDED.iswc,
              raw_data = EXCLUDED.raw_data,
              fetched_at = NOW()
          `, [track.isrc, iswc, JSON.stringify(quansicData)]);
        }
      }

      if (!iswc) {
        // 3. Fallback to MusicBrainz
        const mbService = new MusicBrainzService();
        const mbData = await mbService.getRecordingByISRC(track.isrc);
        iswc = mbData?.works?.[0]?.iswc;

        if (iswc) {
          // Cache in musicbrainz_cache
          await db.query(`
            INSERT INTO musicbrainz_cache (isrc, iswc, raw_data)
            VALUES ($1, $2, $3)
            ON CONFLICT (isrc) DO UPDATE SET
              iswc = EXCLUDED.iswc,
              raw_data = EXCLUDED.raw_data,
              fetched_at = NOW()
          `, [track.isrc, iswc, JSON.stringify(mbData)]);
        }
      }

      if (iswc) {
        // SUCCESS! Passed the gate
        await db.query(`
          UPDATE track_pipeline
          SET
            status = 'iswc_found',
            has_iswc = TRUE,
            iswc = $1,
            last_attempted_at = NOW(),
            updated_at = NOW()
          WHERE id = $2
        `, [iswc, track.id]);

        await db.query(`
          INSERT INTO processing_log (spotify_track_id, stage, action, message)
          VALUES ($1, 'iswc_lookup', 'success', $2)
        `, [track.spotify_track_id, `Found ISWC: ${iswc}`]);

        console.log(`✅ Found ISWC for ${track.spotify_track_id}: ${iswc}`);
      } else {
        // FAILED! Dead end (no ISWC = can't mint GRC20)
        await markFailed(db, track.id, 'No ISWC found in Quansic or MusicBrainz');
        console.log(`❌ No ISWC found for ${track.spotify_track_id} - marked as failed`);
      }
    } catch (error) {
      console.error(`Failed ISWC lookup for ${track.spotify_track_id}:`, error);
      await incrementRetry(db, track.id, 'iswc_lookup', String(error));
    }
  }
}

/**
 * STEP 9-11: MusicBrainz metadata enrichment (ISNI, etc.)
 */
async function enrichMetadata(tracks: PipelineTrack[], db: NeonDB, _adapter: any, env: Env) {
  const mbService = new MusicBrainzService();

  for (const track of tracks) {
    try {
      // Query by ISWC to get full work data
      const workData = await mbService.getWorkByISWC(track.iswc!);

      let isni: string | null = null;
      if (workData?.artists?.[0]?.isni) {
        isni = workData.artists[0].isni;
      }

      // Update pipeline with enriched data
      await db.query(`
        UPDATE track_pipeline
        SET
          status = 'metadata_enriched',
          isni = $1,
          last_attempted_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [isni, track.id]);

      console.log(`✅ Enriched metadata for ${track.spotify_track_id}`);
    } catch (error) {
      console.error(`Failed metadata enrichment for ${track.spotify_track_id}:`, error);
      await incrementRetry(db, track.id, 'metadata_enrich', String(error));
    }
  }
}

/**
 * STEP 12-14: Fetch lyrics from multiple sources + normalize
 */
async function fetchLyrics(tracks: PipelineTrack[], db: NeonDB, _adapter: any, env: Env) {
  // TODO: Implement lyrics fetching
  // - Try lrclib
  // - Try lyrics.ovh
  // - Normalize with Gemini
  // - Store in track_lyrics
  console.log('⏭️  Lyrics fetching not yet implemented');
}

/**
 * STEP 15: Download audio via freyr + verify with AcoustID + upload to Grove
 */
async function downloadAudio(tracks: PipelineTrack[], db: NeonDB, _adapter: any, env: Env) {
  // TODO: Implement audio download
  console.log('⏭️  Audio download not yet implemented');
}

/**
 * STEP 16: ElevenLabs word-level alignment
 */
async function alignWords(tracks: PipelineTrack[], db: NeonDB, _adapter: any, env: Env) {
  // TODO: Implement ElevenLabs alignment
  console.log('⏭️  Word alignment not yet implemented');
}

/**
 * STEP 17: Demucs stem separation
 */
async function separateStems(tracks: PipelineTrack[], db: NeonDB, _adapter: any, env: Env) {
  // TODO: Implement Demucs separation
  console.log('⏭️  Stem separation not yet implemented');
}

/**
 * STEP 18: Fal.ai audio2audio + image generation
 */
async function enhanceMedia(tracks: PipelineTrack[], db: NeonDB, _adapter: any, env: Env) {
  // TODO: Implement Fal.ai enhancement
  console.log('⏭️  Media enhancement not yet implemented');
}

/**
 * STEP 19: Prepare for GRC20 minting
 */
async function prepareForMint(tracks: PipelineTrack[], db: NeonDB) {
  for (const track of tracks) {
    try {
      // Verify all required fields are present
      const ready = await db.query<{
        has_iswc: boolean;
        has_lyrics: boolean;
        has_audio: boolean;
      }>(`
        SELECT has_iswc, has_lyrics, has_audio
        FROM track_pipeline
        WHERE id = $1
      `, [track.id]);

      const { has_iswc, has_lyrics, has_audio } = ready[0];

      if (has_iswc && has_lyrics && has_audio) {
        await db.query(`
          UPDATE track_pipeline
          SET status = 'ready_to_mint', updated_at = NOW()
          WHERE id = $1
        `, [track.id]);

        console.log(`✅ Track ${track.spotify_track_id} ready to mint!`);
      } else {
        const missing = [];
        if (!has_iswc) missing.push('ISWC');
        if (!has_lyrics) missing.push('lyrics');
        if (!has_audio) missing.push('audio');

        await markFailed(
          db,
          track.id,
          `Missing required fields: ${missing.join(', ')}`
        );
      }
    } catch (error) {
      console.error(`Failed mint preparation for ${track.spotify_track_id}:`, error);
      await incrementRetry(db, track.id, 'mint_prep', String(error));
    }
  }
}

// ==================== HELPER FUNCTIONS ====================

async function markFailed(db: NeonDB, trackId: number, reason: string) {
  await db.query(`
    UPDATE track_pipeline
    SET
      status = 'failed',
      error_message = $1,
      last_attempted_at = NOW(),
      updated_at = NOW()
    WHERE id = $2
  `, [reason, trackId]);
}

async function incrementRetry(db: NeonDB, trackId: number, stage: string, error: string) {
  await db.query(`
    UPDATE track_pipeline
    SET
      retry_count = retry_count + 1,
      error_stage = $1,
      error_message = $2,
      last_attempted_at = NOW(),
      updated_at = NOW()
    WHERE id = $3
  `, [stage, error, trackId]);
}

async function getPipelineStats(db: NeonDB) {
  const result = await db.query<{
    status: string;
    count: number;
  }>(`
    SELECT status, COUNT(*) as count
    FROM track_pipeline
    GROUP BY status
    ORDER BY
      CASE status
        WHEN 'scraped' THEN 1
        WHEN 'spotify_resolved' THEN 2
        WHEN 'iswc_found' THEN 3
        WHEN 'metadata_enriched' THEN 4
        WHEN 'lyrics_ready' THEN 5
        WHEN 'audio_downloaded' THEN 6
        WHEN 'alignment_complete' THEN 7
        WHEN 'stems_separated' THEN 8
        WHEN 'media_enhanced' THEN 9
        WHEN 'ready_to_mint' THEN 10
        WHEN 'minted' THEN 11
        WHEN 'failed' THEN 12
      END
  `);

  return result;
}
