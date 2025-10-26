/**
 * MusicBrainz Domain - Database Operations
 * Handles MusicBrainz artists, recordings, and works
 */

import { NeonDBBase } from './base';
import type { MusicBrainzArtistData, MusicBrainzRecordingData, MusicBrainzWorkData } from '../services/musicbrainz';

export class MusicBrainzDB extends NeonDBBase {
  /**
   * Get Spotify artists that need MusicBrainz enrichment
   */
  async getUnenrichedMusicBrainzArtists(limit: number = 20): Promise<Array<{
    spotify_artist_id: string;
    name: string;
  }>> {
    const result = await this.sql`
      SELECT s.spotify_artist_id, s.name
      FROM spotify_artists s
      LEFT JOIN musicbrainz_artists m ON s.spotify_artist_id = m.spotify_artist_id
      WHERE m.mbid IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      spotify_artist_id: row.spotify_artist_id,
      name: row.name,
    }));
  }

  /**
   * Upsert MusicBrainz artist data (idempotent)
   */
  async upsertMusicBrainzArtist(artist: MusicBrainzArtistData): Promise<void> {
    await this.sql`
      INSERT INTO musicbrainz_artists (
        mbid,
        spotify_artist_id,
        name,
        sort_name,
        type,
        isnis,
        ipi,
        country,
        gender,
        birth_date,
        death_date,
        disambiguation,
        tiktok_handle,
        instagram_handle,
        twitter_handle,
        facebook_handle,
        youtube_channel,
        soundcloud_handle,
        wikidata_id,
        genius_slug,
        discogs_id,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${artist.mbid},
        ${artist.spotify_artist_id || null},
        ${artist.name},
        ${artist.sort_name},
        ${artist.type},
        ${artist.isnis}::text[],
        ${artist.ipi},
        ${artist.country},
        ${artist.gender},
        ${artist.birth_date},
        ${artist.death_date},
        ${artist.disambiguation},
        ${artist.tiktok_handle || null},
        ${artist.instagram_handle || null},
        ${artist.twitter_handle || null},
        ${artist.facebook_handle || null},
        ${artist.youtube_channel || null},
        ${artist.soundcloud_handle || null},
        ${artist.wikidata_id || null},
        ${artist.genius_slug || null},
        ${artist.discogs_id || null},
        ${JSON.stringify(artist.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (mbid)
      DO UPDATE SET
        spotify_artist_id = COALESCE(EXCLUDED.spotify_artist_id, musicbrainz_artists.spotify_artist_id),
        name = EXCLUDED.name,
        sort_name = EXCLUDED.sort_name,
        type = EXCLUDED.type,
        isnis = EXCLUDED.isnis,
        ipi = EXCLUDED.ipi,
        country = EXCLUDED.country,
        gender = EXCLUDED.gender,
        birth_date = EXCLUDED.birth_date,
        death_date = EXCLUDED.death_date,
        disambiguation = EXCLUDED.disambiguation,
        tiktok_handle = COALESCE(EXCLUDED.tiktok_handle, musicbrainz_artists.tiktok_handle),
        instagram_handle = COALESCE(EXCLUDED.instagram_handle, musicbrainz_artists.instagram_handle),
        twitter_handle = COALESCE(EXCLUDED.twitter_handle, musicbrainz_artists.twitter_handle),
        facebook_handle = COALESCE(EXCLUDED.facebook_handle, musicbrainz_artists.facebook_handle),
        youtube_channel = COALESCE(EXCLUDED.youtube_channel, musicbrainz_artists.youtube_channel),
        soundcloud_handle = COALESCE(EXCLUDED.soundcloud_handle, musicbrainz_artists.soundcloud_handle),
        wikidata_id = COALESCE(EXCLUDED.wikidata_id, musicbrainz_artists.wikidata_id),
        genius_slug = COALESCE(EXCLUDED.genius_slug, musicbrainz_artists.genius_slug),
        discogs_id = COALESCE(EXCLUDED.discogs_id, musicbrainz_artists.discogs_id),
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Batch upsert MusicBrainz artists
   */
  async batchUpsertMusicBrainzArtists(artists: MusicBrainzArtistData[]): Promise<number> {
    if (artists.length === 0) return 0;

    let inserted = 0;
    for (const artist of artists) {
      try {
        await this.upsertMusicBrainzArtist(artist);
        inserted++;
      } catch (error) {
        console.error(`Failed to upsert MusicBrainz artist ${artist.mbid}:`, error);
      }
    }

    return inserted;
  }

  /**
   * Get Spotify tracks with ISRC that need MusicBrainz recording enrichment
   */
  async getUnenrichedMusicBrainzRecordings(limit: number = 20): Promise<Array<{
    spotify_track_id: string;
    isrc: string;
    title: string;
  }>> {
    const result = await this.sql`
      SELECT s.spotify_track_id, s.isrc, s.title
      FROM spotify_tracks s
      LEFT JOIN musicbrainz_recordings m ON s.spotify_track_id = m.spotify_track_id
      WHERE s.isrc IS NOT NULL
        AND s.isrc != ''
        AND m.recording_mbid IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      spotify_track_id: row.spotify_track_id,
      isrc: row.isrc,
      title: row.title,
    }));
  }

  /**
   * Upsert MusicBrainz recording data (idempotent)
   */
  async upsertMusicBrainzRecording(recording: MusicBrainzRecordingData): Promise<void> {
    await this.sql`
      INSERT INTO musicbrainz_recordings (
        recording_mbid,
        spotify_track_id,
        isrc,
        title,
        length_ms,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${recording.recording_mbid},
        ${recording.spotify_track_id || null},
        ${recording.isrc},
        ${recording.title},
        ${recording.length_ms},
        ${JSON.stringify(recording.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (recording_mbid)
      DO UPDATE SET
        spotify_track_id = COALESCE(EXCLUDED.spotify_track_id, musicbrainz_recordings.spotify_track_id),
        isrc = EXCLUDED.isrc,
        title = EXCLUDED.title,
        length_ms = EXCLUDED.length_ms,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Batch upsert MusicBrainz recordings
   */
  async batchUpsertMusicBrainzRecordings(recordings: MusicBrainzRecordingData[]): Promise<number> {
    if (recordings.length === 0) return 0;

    let inserted = 0;
    for (const recording of recordings) {
      try {
        await this.upsertMusicBrainzRecording(recording);
        inserted++;
      } catch (error) {
        console.error(`Failed to upsert MusicBrainz recording ${recording.recording_mbid}:`, error);
      }
    }

    return inserted;
  }

  /**
   * Upsert MusicBrainz work data (idempotent)
   */
  async upsertMusicBrainzWork(work: MusicBrainzWorkData): Promise<void> {
    await this.sql`
      INSERT INTO musicbrainz_works (
        work_mbid,
        iswc,
        title,
        type,
        language,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${work.work_mbid},
        ${work.iswc},
        ${work.title},
        ${work.type},
        ${work.language},
        ${JSON.stringify(work.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (work_mbid)
      DO UPDATE SET
        iswc = EXCLUDED.iswc,
        title = EXCLUDED.title,
        type = EXCLUDED.type,
        language = EXCLUDED.language,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Link work to recording
   */
  async linkWorkToRecording(workMbid: string, recordingMbid: string): Promise<void> {
    await this.sql`
      INSERT INTO work_recording_links (work_mbid, recording_mbid)
      VALUES (${workMbid}, ${recordingMbid})
      ON CONFLICT (work_mbid, recording_mbid) DO NOTHING
    `;
  }
}
