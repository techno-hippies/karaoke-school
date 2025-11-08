/**
 * TikTok Database Operations
 * Simplified for new pipeline architecture
 */

import { buildUpsert, sqlValue } from './connection';
import type { TikTokUserProfile, TikTokVideo } from '../types';

/**
 * Convert TikTokUserProfile to database creator record
 */
export function upsertCreatorSQL(profile: TikTokUserProfile): string {
  const data = {
    username: profile.username,
    display_name: profile.nickname || profile.username,
    follower_count: profile.stats?.followerCount || 0,
    total_videos: profile.stats?.videoCount || 0,
  };

  return buildUpsert('tiktok_creators', data, 'username', [
    'display_name',
    'follower_count',
    'total_videos',
    'updated_at'
  ]) + ' RETURNING username';
}

/**
 * Convert TikTokVideo to database video record
 */
export interface ConvertedVideo {
  video_id: string;
  creator_username: string;
  video_url: string;
  description: string | null;
  music_title: string | null;
  music_author: string | null;
  play_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  share_count: number | null;
  duration_ms: number | null;
  spotify_track_id: string | null;
}

export function convertTikTokVideo(
  video: TikTokVideo,
  creatorUsername: string
): ConvertedVideo {
  // Extract Spotify track ID from tt2dsp field
  const spotifyInfo = video.music?.tt2dsp?.tt_to_dsp_song_infos?.find(
    (info) => info.platform === 3 // Platform 3 = Spotify
  );
  const spotifyTrackId = spotifyInfo?.song_id || null;

  return {
    video_id: video.id,
    creator_username: creatorUsername,
    video_url: `https://www.tiktok.com/@${creatorUsername}/video/${video.id}`,
    description: video.desc || null,
    music_title: video.music?.title || null,
    music_author: video.music?.authorName || null,
    play_count: video.stats?.playCount || null,
    like_count: video.stats?.diggCount || null,
    comment_count: video.stats?.commentCount || null,
    share_count: video.stats?.shareCount || null,
    duration_ms: video.video?.duration ? video.video.duration * 1000 : null,
    spotify_track_id: spotifyTrackId,
  };
}

export function upsertVideoSQL(video: ConvertedVideo): string {
  const data = {
    video_id: video.video_id,
    creator_username: video.creator_username,
    video_url: video.video_url,
    description: video.description,
    music_title: video.music_title,
    music_author: video.music_author,
    play_count: video.play_count,
    like_count: video.like_count,
    comment_count: video.comment_count,
    share_count: video.share_count,
    duration_ms: video.duration_ms,
    spotify_track_id: video.spotify_track_id,
  };

  return buildUpsert('tiktok_videos', data, 'video_id', [
    'description',
    'music_title',
    'music_author',
    'play_count',
    'like_count',
    'comment_count',
    'share_count',
    'duration_ms',
    'spotify_track_id',
    'updated_at'
  ]) + ' RETURNING video_id, spotify_track_id';
}
