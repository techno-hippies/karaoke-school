/**
 * Typed SQL Helper Functions for Audio Pipeline
 *
 * Purpose: Prevent SQL injection, improve type safety, reduce code duplication
 *
 * All queries use parameterized statements with explicit types.
 * Never concatenate user input into SQL strings.
 */

import { query } from './connection';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SongAudioStems {
  vocals_grove_cid: string;
  vocals_grove_url: string;
  instrumental_grove_cid: string;
  instrumental_grove_url: string;
}

export interface KaraokeSegmentData {
  fal_request_id: string;
  fal_enhanced_grove_cid: string;
  fal_enhanced_grove_url: string;
}

export interface TranslationData {
  lines: any; // JSONB data (will be stringified)
  translator: string;
  quality_score: number;
}

// ============================================================================
// Song Audio Queries
// ============================================================================

/**
 * Update song_audio with vocal and instrumental stem URLs from Demucs
 *
 * Used by: separate-audio.ts
 *
 * @param spotifyTrackId - Track identifier
 * @param stems - Vocal and instrumental Grove URLs/CIDs
 */
export async function updateSongAudioStems(
  spotifyTrackId: string,
  stems: SongAudioStems
): Promise<void> {
  await query(
    `UPDATE song_audio
     SET vocals_grove_cid = $1,
         vocals_grove_url = $2,
         instrumental_grove_cid = $3,
         instrumental_grove_url = $4,
         updated_at = NOW()
     WHERE spotify_track_id = $5`,
    [
      stems.vocals_grove_cid,
      stems.vocals_grove_url,
      stems.instrumental_grove_cid,
      stems.instrumental_grove_url,
      spotifyTrackId
    ]
  );
}

// ============================================================================
// Karaoke Segments Queries
// ============================================================================

/**
 * Upsert karaoke_segments with enhanced audio from fal.ai
 *
 * Used by: enhance-audio.ts
 *
 * Uses ON CONFLICT to update existing records or insert new ones.
 *
 * @param spotifyTrackId - Track identifier
 * @param data - fal.ai request ID and Grove URLs for enhanced audio
 */
export async function upsertKaraokeSegment(
  spotifyTrackId: string,
  data: KaraokeSegmentData
): Promise<void> {
  await query(
    `INSERT INTO karaoke_segments (
      spotify_track_id,
      fal_request_id,
      fal_enhanced_grove_cid,
      fal_enhanced_grove_url
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (spotify_track_id)
    DO UPDATE SET
      fal_request_id = EXCLUDED.fal_request_id,
      fal_enhanced_grove_cid = EXCLUDED.fal_enhanced_grove_cid,
      fal_enhanced_grove_url = EXCLUDED.fal_enhanced_grove_url,
      updated_at = NOW()`,
    [
      spotifyTrackId,
      data.fal_request_id,
      data.fal_enhanced_grove_cid,
      data.fal_enhanced_grove_url
    ]
  );
}

// ============================================================================
// Lyrics Translation Queries
// ============================================================================

/**
 * Upsert lyrics translation for a specific language
 *
 * Used by: translate-lyrics.ts
 *
 * Stores line-by-line translations with word timing preserved.
 * Uses ON CONFLICT to update existing translations.
 *
 * @param spotifyTrackId - Track identifier
 * @param languageCode - Target language (e.g., 'zh', 'vi', 'id')
 * @param data - Translation lines, source, and confidence score
 */
export async function upsertTranslation(
  spotifyTrackId: string,
  languageCode: string,
  data: TranslationData
): Promise<void> {
  await query(
    `INSERT INTO lyrics_translations (
      spotify_track_id,
      language_code,
      lines,
      translator,
      quality_score
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (spotify_track_id, language_code)
    DO UPDATE SET
      lines = EXCLUDED.lines,
      translator = EXCLUDED.translator,
      quality_score = EXCLUDED.quality_score,
      updated_at = NOW()`,
    [
      spotifyTrackId,
      languageCode,
      JSON.stringify(data.lines), // JSONB column
      data.translator,
      data.quality_score
    ]
  );
}

// ============================================================================
// Query Helpers (Read Operations)
// ============================================================================

/**
 * Get existing translations for a track
 *
 * @param spotifyTrackId - Track identifier
 * @returns Array of language codes that already have translations
 */
export async function getExistingTranslations(
  spotifyTrackId: string
): Promise<string[]> {
  const results = await query<{ language_code: string }>(
    `SELECT language_code
     FROM lyrics_translations
     WHERE spotify_track_id = $1`,
    [spotifyTrackId]
  );

  return results.map(r => r.language_code);
}

/**
 * Count total translations for a track
 *
 * @param spotifyTrackId - Track identifier
 * @returns Number of translations available
 */
export async function countTranslations(
  spotifyTrackId: string
): Promise<number> {
  const results = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM lyrics_translations
     WHERE spotify_track_id = $1`,
    [spotifyTrackId]
  );

  return parseInt(results[0].count, 10);
}
