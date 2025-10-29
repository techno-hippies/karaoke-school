/**
 * Step 6: ElevenLabs Forced Alignment
 * Status: audio_downloaded → alignment_complete
 *
 * Processes tracks that have:
 * - Audio file on Grove (song_audio.grove_url)
 * - Normalized lyrics (song_lyrics.plain_text)
 *
 * Calls ElevenLabs forced alignment API to get word-level + character-level timing.
 * Stores results in elevenlabs_word_alignments table.
 */

import { getNeonClient } from '../db/neon';
import { ElevenLabsService } from '../services/elevenlabs';
import type { Env } from '../types';

interface TrackForAlignment {
  spotifyTrackId: string;
  title: string;
  artists: string[];
  groveUrl: string;
  plainLyrics: string;
}

export async function processForcedAlignment(env: Env, limit: number = 50): Promise<void> {
  console.log(`\n[Step 6] ElevenLabs Forced Alignment (limit: ${limit})`);

  if (!env.ELEVENLABS_API_KEY) {
    console.log('⚠️ ELEVENLABS_API_KEY not configured, skipping');
    return;
  }

  const db = getNeonClient(env.NEON_DATABASE_URL);
  const elevenlabs = new ElevenLabsService(env.ELEVENLABS_API_KEY);

  try {
    // Find tracks needing alignment: audio_downloaded status + no alignment yet
    const tracksQuery = `
      SELECT
        sp.spotify_track_id,
        st.title,
        st.artists,
        sa.grove_url,
        sl.plain_text as plain_lyrics
      FROM song_pipeline sp
      JOIN spotify_tracks st ON sp.spotify_track_id = st.spotify_track_id
      JOIN song_audio sa ON sp.spotify_track_id = sa.spotify_track_id
      JOIN song_lyrics sl ON sp.spotify_track_id = sl.spotify_track_id
      LEFT JOIN elevenlabs_word_alignments ewa ON sp.spotify_track_id = ewa.spotify_track_id
      WHERE sp.status = 'audio_downloaded'
        AND sp.has_audio = TRUE
        AND sp.has_lyrics = TRUE
        AND ewa.spotify_track_id IS NULL  -- No alignment yet
      ORDER BY sp.updated_at ASC
      LIMIT $1
    `;

    const result = await db.query(tracksQuery, [limit]);
    const tracks = result.rows as TrackForAlignment[];

    if (tracks.length === 0) {
      console.log('✓ No tracks need alignment (all caught up!)');
      return;
    }

    console.log(`Found ${tracks.length} tracks needing alignment`);

    let alignedCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      try {
        const artistsStr = Array.isArray(track.artists)
          ? track.artists.join(', ')
          : track.artists;

        console.log(`\n📍 Aligning: ${track.title} - ${artistsStr}`);
        console.log(`   Audio: ${track.groveUrl}`);
        console.log(`   Lyrics: ${track.plainLyrics.length} chars`);

        // Update pipeline: mark as attempting
        await db.query(
          `UPDATE song_pipeline
           SET last_attempted_at = NOW(),
               retry_count = retry_count + 1,
               error_message = NULL,
               error_stage = NULL
           WHERE spotify_track_id = $1`,
          [track.spotifyTrackId]
        );

        // Call ElevenLabs forced alignment API
        const alignment = await elevenlabs.forcedAlignment(
          track.groveUrl,
          track.plainLyrics
        );

        // Store alignment in database
        await db.query(
          `INSERT INTO elevenlabs_word_alignments (
             spotify_track_id,
             words,
             total_words,
             characters,
             total_characters,
             alignment_duration_ms,
             overall_loss,
             raw_alignment_data
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (spotify_track_id)
           DO UPDATE SET
             words = EXCLUDED.words,
             total_words = EXCLUDED.total_words,
             characters = EXCLUDED.characters,
             total_characters = EXCLUDED.total_characters,
             alignment_duration_ms = EXCLUDED.alignment_duration_ms,
             overall_loss = EXCLUDED.overall_loss,
             raw_alignment_data = EXCLUDED.raw_alignment_data,
             updated_at = NOW()`,
          [
            track.spotifyTrackId,
            JSON.stringify(alignment.words),
            alignment.totalWords,
            JSON.stringify(alignment.characters),
            alignment.totalCharacters,
            alignment.alignmentDurationMs,
            alignment.overallLoss,
            JSON.stringify(alignment.rawResponse),
          ]
        );

        // Update pipeline status: audio_downloaded → alignment_complete
        await db.query(
          `UPDATE song_pipeline
           SET status = 'alignment_complete',
               updated_at = NOW()
           WHERE spotify_track_id = $1`,
          [track.spotifyTrackId]
        );

        alignedCount++;

        console.log(
          `   ✓ Aligned ${alignment.totalWords} words, ` +
          `${alignment.totalCharacters} characters, ` +
          `loss: ${alignment.overallLoss.toFixed(3)}`
        );

        // Rate limiting: 2 seconds between API calls (ElevenLabs processing time)
        if (alignedCount < tracks.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        failedCount++;

        console.error(`   ✗ Failed to align ${track.spotifyTrackId}:`, error.message);

        // Update pipeline with error
        await db.query(
          `UPDATE song_pipeline
           SET error_message = $1,
               error_stage = 'forced_alignment',
               updated_at = NOW()
           WHERE spotify_track_id = $2`,
          [error.message, track.spotifyTrackId]
        );

        // If retry count >= 3, mark as failed
        const retryResult = await db.query(
          `SELECT retry_count FROM song_pipeline WHERE spotify_track_id = $1`,
          [track.spotifyTrackId]
        );

        if (retryResult.rows[0]?.retry_count >= 3) {
          console.log(`   ⚠️ Max retries reached, marking as failed`);
          await db.query(
            `UPDATE song_pipeline
             SET status = 'failed'
             WHERE spotify_track_id = $1`,
            [track.spotifyTrackId]
          );
        }
      }
    }

    console.log(
      `\n✅ Step 6 Complete: ${alignedCount} aligned, ${failedCount} failed`
    );
  } catch (error) {
    console.error('❌ Step 6 (Forced Alignment) failed:', error);
    throw error;
  }
}
