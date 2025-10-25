/**
 * Neon Database Service
 * Handles database connections and upsert operations
 */

import { neon } from '@neondatabase/serverless';
import type { TikTokUserProfile, TikTokVideo } from './types';
import type { SpotifyTrackData, SpotifyArtistData } from './spotify';
import type { GeniusSongData } from './genius';
import type { MusicBrainzArtistData, MusicBrainzRecordingData, MusicBrainzWorkData } from './musicbrainz';
import type { QuansicArtistData } from './quansic';

export class NeonDB {
  private sql: ReturnType<typeof neon>;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  /**
   * Upsert creator profile (idempotent)
   */
  async upsertCreator(profile: TikTokUserProfile): Promise<void> {
    await this.sql`
      INSERT INTO tiktok_creators (
        tiktok_handle,
        sec_uid,
        nickname,
        follower_count,
        raw_profile,
        last_scraped_at
      )
      VALUES (
        ${profile.username},
        ${profile.secUid},
        ${profile.nickname},
        ${profile.stats.followerCount},
        ${JSON.stringify(profile)}::jsonb,
        NOW()
      )
      ON CONFLICT (tiktok_handle)
      DO UPDATE SET
        sec_uid = EXCLUDED.sec_uid,
        nickname = EXCLUDED.nickname,
        follower_count = EXCLUDED.follower_count,
        raw_profile = EXCLUDED.raw_profile,
        last_scraped_at = NOW()
    `;
  }

  /**
   * Upsert video (idempotent)
   * Updates stats if video already exists
   */
  async upsertVideo(
    video: TikTokVideo,
    tiktokHandle: string,
    spotifyTrackId: string | null,
    copyrightStatus: 'copyrighted' | 'copyright-free' | 'unknown'
  ): Promise<void> {
    await this.sql`
      INSERT INTO tiktok_scraped_videos (
        video_id,
        tiktok_handle,
        spotify_track_id,
        copyright_status,
        play_count,
        like_count,
        comment_count,
        created_at,
        raw_data,
        scraped_at,
        updated_at
      )
      VALUES (
        ${video.id},
        ${tiktokHandle},
        ${spotifyTrackId},
        ${copyrightStatus},
        ${video.stats.playCount},
        ${video.stats.diggCount},
        ${video.stats.commentCount},
        ${new Date(video.createTime * 1000).toISOString()},
        ${JSON.stringify(video)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (video_id)
      DO UPDATE SET
        play_count = EXCLUDED.play_count,
        like_count = EXCLUDED.like_count,
        comment_count = EXCLUDED.comment_count,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Batch upsert videos (more efficient - uses single query)
   */
  async batchUpsertVideos(
    videos: Array<{
      video: TikTokVideo;
      tiktokHandle: string;
      spotifyTrackId: string | null;
      copyrightStatus: 'copyrighted' | 'copyright-free' | 'unknown';
    }>
  ): Promise<number> {
    if (videos.length === 0) return 0;

    // Process in chunks of 50 to avoid query size limits
    const chunkSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < videos.length; i += chunkSize) {
      const chunk = videos.slice(i, i + chunkSize);

      try {
        // Build VALUES clause for batch insert
        const values = chunk.map((item) => ({
          video_id: item.video.id,
          tiktok_handle: item.tiktokHandle,
          spotify_track_id: item.spotifyTrackId,
          copyright_status: item.copyrightStatus,
          play_count: item.video.stats.playCount,
          like_count: item.video.stats.diggCount,
          comment_count: item.video.stats.commentCount,
          created_at: new Date(item.video.createTime * 1000).toISOString(),
          raw_data: JSON.stringify(item.video),
        }));

        // Single batch upsert query
        const placeholders = values.map((_, idx) => {
          const base = idx * 9;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}::jsonb)`;
        }).join(', ');

        const params = values.flatMap(v => [
          v.video_id,
          v.tiktok_handle,
          v.spotify_track_id,
          v.copyright_status,
          v.play_count,
          v.like_count,
          v.comment_count,
          v.created_at,
          v.raw_data,
        ]);

        await this.sql.unsafe(`
          INSERT INTO tiktok_scraped_videos (
            video_id, tiktok_handle, spotify_track_id, copyright_status,
            play_count, like_count, comment_count, created_at, raw_data
          )
          VALUES ${placeholders}
          ON CONFLICT (video_id)
          DO UPDATE SET
            play_count = EXCLUDED.play_count,
            like_count = EXCLUDED.like_count,
            comment_count = EXCLUDED.comment_count,
            raw_data = EXCLUDED.raw_data,
            updated_at = NOW()
        `, params);

        totalInserted += chunk.length;
        console.log(`Inserted chunk ${Math.floor(i / chunkSize) + 1}: ${chunk.length} videos`);
      } catch (error) {
        console.error(`Failed to upsert chunk at index ${i}:`, error);

        // Fallback: try individual inserts for this chunk
        for (const item of chunk) {
          try {
            await this.upsertVideo(
              item.video,
              item.tiktokHandle,
              item.spotifyTrackId,
              item.copyrightStatus
            );
            totalInserted++;
          } catch (err) {
            console.error(`Failed individual upsert for video ${item.video.id}:`, err);
          }
        }
      }
    }

    return totalInserted;
  }

  /**
   * Get stats for a creator
   */
  async getCreatorStats(tiktokHandle: string): Promise<{
    totalVideos: number;
    totalViews: number;
    copyrightedCount: number;
    copyrightFreeCount: number;
  } | null> {
    const result = await this.sql`
      SELECT
        COUNT(*)::int as total_videos,
        COALESCE(SUM(play_count), 0)::bigint as total_views,
        COUNT(*) FILTER (WHERE copyright_status = 'copyrighted')::int as copyrighted_count,
        COUNT(*) FILTER (WHERE copyright_status = 'copyright-free')::int as copyright_free_count
      FROM tiktok_scraped_videos
      WHERE tiktok_handle = ${tiktokHandle}
    `;

    if (result.length === 0) {
      return null;
    }

    return {
      totalVideos: result[0].total_videos,
      totalViews: Number(result[0].total_views),
      copyrightedCount: result[0].copyrighted_count,
      copyrightFreeCount: result[0].copyright_free_count,
    };
  }

  /**
   * Get top videos by Spotify track
   */
  async getTopTrackVideos(limit: number = 20): Promise<Array<{
    spotifyTrackId: string;
    videoCount: number;
    totalViews: number;
  }>> {
    const result = await this.sql`
      SELECT
        spotify_track_id,
        COUNT(*)::int as video_count,
        SUM(play_count)::bigint as total_views
      FROM tiktok_scraped_videos
      WHERE spotify_track_id IS NOT NULL
      GROUP BY spotify_track_id
      ORDER BY total_views DESC
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      spotifyTrackId: row.spotify_track_id,
      videoCount: row.video_count,
      totalViews: Number(row.total_views),
    }));
  }

  /**
   * Upsert Spotify track data (idempotent)
   */
  async upsertSpotifyTrack(track: SpotifyTrackData): Promise<void> {
    await this.sql`
      INSERT INTO spotify_tracks (
        spotify_track_id,
        title,
        artists,
        album,
        isrc,
        release_date,
        duration_ms,
        popularity,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${track.spotify_track_id},
        ${track.title},
        ${track.artists}::text[],
        ${track.album},
        ${track.isrc},
        ${track.release_date},
        ${track.duration_ms},
        ${track.popularity},
        ${JSON.stringify(track.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (spotify_track_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        artists = EXCLUDED.artists,
        album = EXCLUDED.album,
        isrc = EXCLUDED.isrc,
        release_date = EXCLUDED.release_date,
        duration_ms = EXCLUDED.duration_ms,
        popularity = EXCLUDED.popularity,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Batch upsert Spotify tracks
   */
  async batchUpsertSpotifyTracks(tracks: SpotifyTrackData[]): Promise<number> {
    if (tracks.length === 0) return 0;

    let inserted = 0;
    for (const track of tracks) {
      try {
        await this.upsertSpotifyTrack(track);
        inserted++;
      } catch (error) {
        console.error(`Failed to upsert Spotify track ${track.spotify_track_id}:`, error);
      }
    }

    return inserted;
  }

  /**
   * Get unique Spotify track IDs that need enrichment
   */
  async getUnenrichedSpotifyTracks(limit: number = 100): Promise<string[]> {
    const result = await this.sql`
      SELECT DISTINCT v.spotify_track_id
      FROM tiktok_scraped_videos v
      LEFT JOIN spotify_tracks s ON v.spotify_track_id = s.spotify_track_id
      WHERE v.spotify_track_id IS NOT NULL
        AND s.spotify_track_id IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => row.spotify_track_id);
  }

  /**
   * Upsert Genius song data (idempotent)
   */
  async upsertGeniusSong(song: GeniusSongData): Promise<void> {
    await this.sql`
      INSERT INTO genius_songs (
        genius_song_id,
        spotify_track_id,
        title,
        artist_name,
        genius_artist_id,
        url,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${song.genius_song_id},
        ${song.spotify_track_id},
        ${song.title},
        ${song.artist_name},
        ${song.genius_artist_id},
        ${song.url},
        ${JSON.stringify(song.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (genius_song_id)
      DO UPDATE SET
        spotify_track_id = EXCLUDED.spotify_track_id,
        title = EXCLUDED.title,
        artist_name = EXCLUDED.artist_name,
        genius_artist_id = EXCLUDED.genius_artist_id,
        url = EXCLUDED.url,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Batch upsert Genius songs
   */
  async batchUpsertGeniusSongs(songs: GeniusSongData[]): Promise<number> {
    if (songs.length === 0) return 0;

    let inserted = 0;
    for (const song of songs) {
      try {
        await this.upsertGeniusSong(song);
        inserted++;
      } catch (error) {
        console.error(`Failed to upsert Genius song ${song.genius_song_id}:`, error);
      }
    }

    return inserted;
  }

  /**
   * Get Spotify tracks that need Genius enrichment
   * Returns tracks that have Spotify data but no Genius match yet
   */
  async getUnenrichedGeniusTracks(limit: number = 50): Promise<Array<{
    spotify_track_id: string;
    title: string;
    artist: string;
  }>> {
    const result = await this.sql`
      SELECT
        s.spotify_track_id,
        s.title,
        s.artists[1] as artist
      FROM spotify_tracks s
      LEFT JOIN genius_songs g ON s.spotify_track_id = g.spotify_track_id
      WHERE g.genius_song_id IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      spotify_track_id: row.spotify_track_id,
      title: row.title,
      artist: row.artist,
    }));
  }

  /**
   * Extract unique Spotify artist IDs from spotify_tracks that need enrichment
   * Uses raw_data.artists[].id from Spotify API response
   */
  async getUnenrichedSpotifyArtists(limit: number = 50): Promise<string[]> {
    const result = await this.sql`
      WITH artist_ids AS (
        SELECT DISTINCT jsonb_array_elements(raw_data->'artists')->>'id' as artist_id
        FROM spotify_tracks
      )
      SELECT a.artist_id
      FROM artist_ids a
      LEFT JOIN spotify_artists s ON a.artist_id = s.spotify_artist_id
      WHERE a.artist_id IS NOT NULL
        AND s.spotify_artist_id IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => row.artist_id);
  }

  /**
   * Upsert Spotify artist data (idempotent)
   */
  async upsertSpotifyArtist(artist: SpotifyArtistData): Promise<void> {
    await this.sql`
      INSERT INTO spotify_artists (
        spotify_artist_id,
        name,
        genres,
        popularity,
        followers,
        images,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${artist.spotify_artist_id},
        ${artist.name},
        ${artist.genres}::text[],
        ${artist.popularity},
        ${artist.followers},
        ${JSON.stringify(artist.images)}::jsonb,
        ${JSON.stringify(artist.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (spotify_artist_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        genres = EXCLUDED.genres,
        popularity = EXCLUDED.popularity,
        followers = EXCLUDED.followers,
        images = EXCLUDED.images,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Batch upsert Spotify artists
   */
  async batchUpsertSpotifyArtists(artists: SpotifyArtistData[]): Promise<number> {
    if (artists.length === 0) return 0;

    let inserted = 0;
    for (const artist of artists) {
      try {
        await this.upsertSpotifyArtist(artist);
        inserted++;
      } catch (error) {
        console.error(`Failed to upsert Spotify artist ${artist.spotify_artist_id}:`, error);
      }
    }

    return inserted;
  }

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
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${work.work_mbid},
        ${work.iswc},
        ${work.title},
        ${work.type},
        ${JSON.stringify(work.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (work_mbid)
      DO UPDATE SET
        iswc = EXCLUDED.iswc,
        title = EXCLUDED.title,
        type = EXCLUDED.type,
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

  /**
   * Get MusicBrainz artists with ISNIs that need Quansic enrichment
   */
  async getUnenrichedQuansicArtists(limit: number = 10): Promise<Array<{
    mbid: string;
    name: string;
    isnis: string[];
  }>> {
    const result = await this.sql`
      SELECT ma.mbid, ma.name, ma.isnis
      FROM musicbrainz_artists ma
      LEFT JOIN quansic_artists qa ON ma.isnis[1] = qa.isni
      WHERE ma.isnis IS NOT NULL
        AND array_length(ma.isnis, 1) > 0
        AND qa.isni IS NULL
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      mbid: row.mbid,
      name: row.name,
      isnis: row.isnis,
    }));
  }

  /**
   * Upsert Quansic artist data (idempotent)
   */
  async upsertQuansicArtist(artist: QuansicArtistData): Promise<void> {
    await this.sql`
      INSERT INTO quansic_artists (
        isni,
        musicbrainz_mbid,
        ipn,
        luminate_id,
        gracenote_id,
        amazon_id,
        apple_music_id,
        name_variants,
        raw_data,
        fetched_at,
        updated_at
      )
      VALUES (
        ${artist.isni},
        ${artist.musicbrainz_mbid || null},
        ${artist.ipn},
        ${artist.luminate_id},
        ${artist.gracenote_id},
        ${artist.amazon_id},
        ${artist.apple_music_id},
        ${JSON.stringify(artist.name_variants)}::jsonb,
        ${JSON.stringify(artist.raw_data)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (isni)
      DO UPDATE SET
        musicbrainz_mbid = COALESCE(EXCLUDED.musicbrainz_mbid, quansic_artists.musicbrainz_mbid),
        ipn = EXCLUDED.ipn,
        luminate_id = EXCLUDED.luminate_id,
        gracenote_id = EXCLUDED.gracenote_id,
        amazon_id = EXCLUDED.amazon_id,
        apple_music_id = EXCLUDED.apple_music_id,
        name_variants = EXCLUDED.name_variants,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Batch upsert Quansic artists
   */
  async batchUpsertQuansicArtists(artists: QuansicArtistData[]): Promise<number> {
    if (artists.length === 0) return 0;

    let inserted = 0;
    for (const artist of artists) {
      try {
        await this.upsertQuansicArtist(artist);
        inserted++;
      } catch (error) {
        console.error(`Failed to upsert Quansic artist ${artist.isni}:`, error);
      }
    }

    return inserted;
  }
}
