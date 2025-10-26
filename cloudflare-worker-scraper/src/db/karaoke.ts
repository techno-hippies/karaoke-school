/**
 * Karaoke Domain - Database Operations
 * Handles lyrics, word alignment, and karaoke segment selection
 */

import { NeonDBBase } from './base';
import type { LRCLIBLyricsData } from '../services/lrclib';

export class KaraokeDB extends NeonDBBase {
  /**
   * Upsert lyrics from LRCLIB
   */
  async upsertLyrics(
    spotifyTrackId: string,
    lyrics: LRCLIBLyricsData,
    confidenceScore: number = 1.0
  ): Promise<void> {
    await this.sql`
      INSERT INTO spotify_track_lyrics (
        spotify_track_id,
        lrclib_id,
        plain_lyrics,
        synced_lyrics,
        instrumental,
        source,
        confidence_score,
        fetched_at,
        updated_at
      )
      VALUES (
        ${spotifyTrackId},
        ${lyrics.id},
        ${lyrics.plainLyrics || null},
        ${lyrics.syncedLyrics || null},
        ${lyrics.instrumental},
        ${'lrclib'},
        ${confidenceScore},
        NOW(),
        NOW()
      )
      ON CONFLICT (spotify_track_id)
      DO UPDATE SET
        lrclib_id = EXCLUDED.lrclib_id,
        plain_lyrics = EXCLUDED.plain_lyrics,
        synced_lyrics = EXCLUDED.synced_lyrics,
        instrumental = EXCLUDED.instrumental,
        confidence_score = EXCLUDED.confidence_score,
        updated_at = NOW()
    `;
  }

  /**
   * Upsert ElevenLabs word-level alignment
   */
  async upsertElevenLabsAlignment(
    spotifyTrackId: string,
    words: Array<{ text: string; start: number; end: number }>,
    rawAlignmentData: any
  ): Promise<void> {
    const totalWords = words.length;
    const durationMs = words.length > 0 ? Math.round(words[words.length - 1].end * 1000) : 0;

    await this.sql`
      INSERT INTO elevenlabs_word_alignments (
        spotify_track_id,
        words,
        total_words,
        alignment_duration_ms,
        raw_alignment_data,
        fetched_at
      )
      VALUES (
        ${spotifyTrackId},
        ${JSON.stringify(words)}::jsonb,
        ${totalWords},
        ${durationMs},
        ${JSON.stringify(rawAlignmentData)}::jsonb,
        NOW()
      )
      ON CONFLICT (spotify_track_id)
      DO UPDATE SET
        words = EXCLUDED.words,
        total_words = EXCLUDED.total_words,
        alignment_duration_ms = EXCLUDED.alignment_duration_ms,
        raw_alignment_data = EXCLUDED.raw_alignment_data,
        fetched_at = NOW()
    `;
  }

  /**
   * Upsert karaoke segment (for songs > 190s)
   */
  async upsertKaraokeSegment(
    spotifyTrackId: string,
    startMs: number,
    endMs: number,
    selectedBy: string | null,
    selectionReason: string | null,
    selectedLyricsText: string | null
  ): Promise<void> {
    const durationMs = endMs - startMs;
    const isFullSong = selectedBy === null;

    await this.sql`
      INSERT INTO karaoke_segments (
        spotify_track_id,
        segment_start_ms,
        segment_end_ms,
        segment_duration_ms,
        is_full_song,
        selected_by,
        selection_reason,
        selected_lyrics_text,
        created_at,
        updated_at
      )
      VALUES (
        ${spotifyTrackId},
        ${startMs},
        ${endMs},
        ${durationMs},
        ${isFullSong},
        ${selectedBy},
        ${selectionReason},
        ${selectedLyricsText},
        NOW(),
        NOW()
      )
      ON CONFLICT (spotify_track_id)
      DO UPDATE SET
        segment_start_ms = EXCLUDED.segment_start_ms,
        segment_end_ms = EXCLUDED.segment_end_ms,
        segment_duration_ms = EXCLUDED.segment_duration_ms,
        is_full_song = EXCLUDED.is_full_song,
        selected_by = EXCLUDED.selected_by,
        selection_reason = EXCLUDED.selection_reason,
        selected_lyrics_text = EXCLUDED.selected_lyrics_text,
        updated_at = NOW()
    `;
  }

  /**
   * Update karaoke segment with Grove CID/URL
   */
  async updateKaraokeSegmentGrove(
    spotifyTrackId: string,
    groveCid: string,
    groveUrl: string
  ): Promise<void> {
    await this.sql`
      UPDATE karaoke_segments
      SET
        segment_grove_cid = ${groveCid},
        segment_grove_url = ${groveUrl},
        updated_at = NOW()
      WHERE spotify_track_id = ${spotifyTrackId}
    `;
  }

  /**
   * Get tracks that need karaoke segment selection (> 190s and no segment yet)
   */
  async getTracksNeedingSegmentSelection(limit: number = 10): Promise<Array<{
    spotify_track_id: string;
    title: string;
    artists: string;
    duration_ms: number;
    synced_lyrics: string;
  }>> {
    const result = await this.sql`
      SELECT
        st.spotify_track_id,
        st.title,
        st.artists,
        st.duration_ms,
        stl.synced_lyrics
      FROM spotify_tracks st
      INNER JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
      LEFT JOIN karaoke_segments ks ON st.spotify_track_id = ks.spotify_track_id
      WHERE st.duration_ms > 190000
        AND stl.synced_lyrics IS NOT NULL
        AND ks.spotify_track_id IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      spotify_track_id: row.spotify_track_id,
      title: row.title,
      artists: row.artists,
      duration_ms: row.duration_ms,
      synced_lyrics: row.synced_lyrics,
    }));
  }

  /**
   * Get tracks that need ElevenLabs word alignment
   */
  async getTracksNeedingWordAlignment(limit: number = 10): Promise<Array<{
    spotify_track_id: string;
    title: string;
    artists: string;
    grove_url: string;
    plain_lyrics: string;
  }>> {
    const result = await this.sql`
      SELECT
        st.spotify_track_id,
        st.title,
        st.artists,
        taf.grove_url,
        stl.plain_lyrics
      FROM spotify_tracks st
      INNER JOIN track_audio_files taf ON st.spotify_track_id = taf.spotify_track_id
      INNER JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
      LEFT JOIN elevenlabs_word_alignments ewa ON st.spotify_track_id = ewa.spotify_track_id
      WHERE taf.grove_url IS NOT NULL
        AND stl.plain_lyrics IS NOT NULL
        AND stl.instrumental = false
        AND ewa.spotify_track_id IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      spotify_track_id: row.spotify_track_id,
      title: row.title,
      artists: row.artists,
      grove_url: row.grove_url,
      plain_lyrics: row.plain_lyrics,
    }));
  }
}
