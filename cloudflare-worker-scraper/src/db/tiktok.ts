/**
 * TikTok Domain - Database Operations
 * Handles TikTok creators and videos
 */

import { NeonDBBase } from './base';
import type { TikTokUserProfile, TikTokVideo } from '../types';

export class TikTokDB extends NeonDBBase {
  /**
   * Upsert creator profile (idempotent)
   */
  async upsertCreator(profile: TikTokUserProfile): Promise<void> {
    await this.sql`
      INSERT INTO tiktok_creators (
        tiktok_handle,
        sec_uid,
        name,
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
        name = EXCLUDED.name,
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
}
