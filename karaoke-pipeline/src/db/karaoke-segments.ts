/**
 * Karaoke Segments Database Operations
 *
 * Manages AI-selected segments and fal.ai enhanced instrumentals
 * (Clean schema - no Demucs duplication)
 */

import { neon } from '@neondatabase/serverless';

export interface KaraokeSegment {
  spotify_track_id: string;
  optimal_segment_start_ms: number | null;
  optimal_segment_end_ms: number | null;
  clip_start_ms: number | null;
  clip_end_ms: number | null;
  clip_relative_start_ms: number | null;
  clip_relative_end_ms: number | null;
  cropped_instrumental_grove_cid: string | null;
  cropped_instrumental_grove_url: string | null;
  fal_enhanced_grove_cid: string | null;
  fal_enhanced_grove_url: string | null;
  fal_processing_duration_seconds: number | null;
  clip_cropped_grove_cid: string | null;
  clip_cropped_grove_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Insert or get existing karaoke segment record
 */
export async function ensureKaraokeSegment(
  databaseUrl: string,
  spotifyTrackId: string
): Promise<KaraokeSegment> {
  const sql = neon(databaseUrl);

  const result = await sql`
    INSERT INTO karaoke_segments (spotify_track_id)
    VALUES (${spotifyTrackId})
    ON CONFLICT (spotify_track_id) DO UPDATE
      SET updated_at = NOW()
    RETURNING *
  `;

  return result[0] as KaraokeSegment;
}

/**
 * Update AI-selected segments (optimal + clip)
 */
export async function updateSelectedSegments(
  databaseUrl: string,
  spotifyTrackId: string,
  segments: {
    optimalSegmentStartMs?: number;
    optimalSegmentEndMs?: number;
    clipStartMs: number;
    clipEndMs: number;
  }
): Promise<void> {
  const sql = neon(databaseUrl);

  await sql`
    UPDATE karaoke_segments
    SET
      optimal_segment_start_ms = ${segments.optimalSegmentStartMs || null},
      optimal_segment_end_ms = ${segments.optimalSegmentEndMs || null},
      clip_start_ms = ${segments.clipStartMs},
      clip_end_ms = ${segments.clipEndMs},
      updated_at = NOW()
    WHERE spotify_track_id = ${spotifyTrackId}
  `;
}

/**
 * Update cropped instrumental (from FFmpeg cropping)
 */
export async function updateCroppedInstrumental(
  databaseUrl: string,
  spotifyTrackId: string,
  cropped: {
    groveCid: string;
    groveUrl: string;
  }
): Promise<void> {
  const sql = neon(databaseUrl);

  await sql`
    UPDATE karaoke_segments
    SET
      cropped_instrumental_grove_cid = ${cropped.groveCid},
      cropped_instrumental_grove_url = ${cropped.groveUrl},
      updated_at = NOW()
    WHERE spotify_track_id = ${spotifyTrackId}
  `;
}

/**
 * Update cropped viral clip (from Step 11)
 */
export async function updateClipCropped(
  databaseUrl: string,
  spotifyTrackId: string,
  clip: {
    relativeStartMs: number;
    relativeEndMs: number;
    groveCid: string;
    groveUrl: string;
  }
): Promise<void> {
  const sql = neon(databaseUrl);

  await sql`
    UPDATE karaoke_segments
    SET
      clip_relative_start_ms = ${clip.relativeStartMs},
      clip_relative_end_ms = ${clip.relativeEndMs},
      clip_cropped_grove_cid = ${clip.groveCid},
      clip_cropped_grove_url = ${clip.groveUrl},
      updated_at = NOW()
    WHERE spotify_track_id = ${spotifyTrackId}
  `;
}

/**
 * Update fal.ai enhancement results
 */
export async function updateFalEnhancement(
  databaseUrl: string,
  spotifyTrackId: string,
  enhancement: {
    groveCid: string;
    groveUrl: string;
    processingDurationSeconds: number;
  }
): Promise<void> {
  const sql = neon(databaseUrl);

  await sql`
    UPDATE karaoke_segments
    SET
      fal_enhanced_grove_cid = ${enhancement.groveCid},
      fal_enhanced_grove_url = ${enhancement.groveUrl},
      fal_processing_duration_seconds = ${enhancement.processingDurationSeconds},
      updated_at = NOW()
    WHERE spotify_track_id = ${spotifyTrackId}
  `;
}

/**
 * Get tracks needing segment selection
 */
export async function getTracksNeedingSegmentSelection(
  databaseUrl: string,
  limit: number = 50
): Promise<Array<{
  spotify_track_id: string;
  duration_ms: number;
  word_alignments: any;
}>> {
  const sql = neon(databaseUrl);

  // Tracks that have:
  // - Separated instrumentals in song_audio
  // - Word alignments from ElevenLabs
  // - NO segment selection yet
  const result = await sql`
    SELECT
      sa.spotify_track_id,
      sa.duration_ms,
      ewa.words as word_alignments
    FROM song_audio sa
    JOIN elevenlabs_word_alignments ewa
      ON sa.spotify_track_id = ewa.spotify_track_id
    LEFT JOIN karaoke_segments ks
      ON sa.spotify_track_id = ks.spotify_track_id
    WHERE sa.instrumental_grove_url IS NOT NULL
      AND (ks.clip_start_ms IS NULL OR ks.spotify_track_id IS NULL)
    ORDER BY sa.created_at DESC
    LIMIT ${limit}
  `;

  return result as any[];
}

/**
 * Get tracks needing fal.ai enhancement
 */
export async function getTracksNeedingFalEnhancement(
  databaseUrl: string,
  limit: number = 50
): Promise<Array<{
  spotify_track_id: string;
  duration_ms: number;
  instrumental_grove_url: string;
  optimal_segment_start_ms: number | null;
  optimal_segment_end_ms: number | null;
}>> {
  const sql = neon(databaseUrl);

  // Tracks that have:
  // - Segment selection complete
  // - NO fal.ai enhancement yet
  const result = await sql`
    SELECT
      ks.spotify_track_id,
      sa.duration_ms,
      sa.instrumental_grove_url,
      ks.optimal_segment_start_ms,
      ks.optimal_segment_end_ms
    FROM karaoke_segments ks
    JOIN song_audio sa
      ON ks.spotify_track_id = sa.spotify_track_id
    WHERE ks.clip_start_ms IS NOT NULL
      AND ks.fal_enhanced_grove_cid IS NULL
      AND sa.instrumental_grove_url IS NOT NULL
    ORDER BY ks.updated_at DESC
    LIMIT ${limit}
  `;

  return result as any[];
}

/**
 * Get tracks needing clip cropping (Step 11)
 */
export async function getTracksNeedingClipCropping(
  databaseUrl: string,
  limit: number = 50
): Promise<Array<{
  spotify_track_id: string;
  optimal_segment_start_ms: number;
  optimal_segment_end_ms: number;
  clip_start_ms: number;
  clip_end_ms: number;
  fal_enhanced_grove_url: string;
}>> {
  const sql = neon(databaseUrl);

  // Tracks that have:
  // - Segment selection complete
  // - fal.ai enhancement complete
  // - NO clip cropping yet
  const result = await sql`
    SELECT
      ks.spotify_track_id,
      ks.optimal_segment_start_ms,
      ks.optimal_segment_end_ms,
      ks.clip_start_ms,
      ks.clip_end_ms,
      ks.fal_enhanced_grove_url
    FROM karaoke_segments ks
    WHERE ks.clip_start_ms IS NOT NULL
      AND ks.fal_enhanced_grove_cid IS NOT NULL
      AND ks.clip_cropped_grove_cid IS NULL
    ORDER BY ks.updated_at DESC
    LIMIT ${limit}
  `;

  return result as any[];
}
