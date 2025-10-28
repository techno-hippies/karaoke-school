/**
 * TikTok Database Operations
 * Handles creator and video insertions/updates
 */

import { buildUpsert, sqlValue } from './neon';
import type { TikTokUserProfile, TikTokVideo } from '../types';

export interface Creator {
  username: string;
  sec_uid: string;
  user_id?: string;
  nickname?: string;
  bio?: string;
  avatar_url?: string;
  follower_count?: number;
  video_count?: number;
  last_scraped_at?: Date;
}

export interface Video {
  video_id: string;
  creator_username: string;
  description?: string;
  video_created_at: Date;
  music_title?: string;
  music_author?: string;
  is_copyrighted?: boolean;
  spotify_track_id?: string;
  play_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  video_url?: string;
  cover_url?: string;
  duration_seconds?: number;
}

/**
 * Generate SQL to upsert a creator
 */
export function upsertCreatorSQL(profile: TikTokUserProfile): string {
  const data = {
    username: profile.username,
    sec_uid: profile.secUid,
    user_id: profile.userId || null,
    nickname: profile.nickname || null,
    bio: profile.bio || null,
    avatar_url: profile.avatar || null,
    follower_count: profile.stats.followerCount || null,
    video_count: profile.stats.videoCount || null,
    last_scraped_at: new Date(),
  };

  return buildUpsert('tiktok_creators', data, 'username', [
    'sec_uid',
    'user_id',
    'nickname',
    'bio',
    'avatar_url',
    'follower_count',
    'video_count',
    'last_scraped_at',
    'updated_at'
  ]) + ' RETURNING username';
}

/**
 * Generate SQL to upsert a video
 */
export function upsertVideoSQL(video: Video): string {
  return buildUpsert('tiktok_videos', video, 'video_id', [
    'description',
    'music_title',
    'music_author',
    'is_copyrighted',
    'spotify_track_id',
    'play_count',
    'like_count',
    'comment_count',
    'share_count',
    'video_url',
    'cover_url',
    'duration_seconds',
    'updated_at'
  ]) + ' RETURNING video_id, spotify_track_id, is_copyrighted';
}

/**
 * Generate SQL to store raw TikTok response (optional, for debugging)
 */
export function upsertRawDataSQL(videoId: string, rawResponse: any): string {
  return buildUpsert(
    'tiktok_raw_data',
    {
      video_id: videoId,
      raw_response: rawResponse,
    },
    'video_id',
    ['raw_response']
  );
}

/**
 * Convert TikTok API video to our Video type
 */
export function convertTikTokVideo(video: TikTokVideo, creatorUsername: string): Video {
  // Extract Spotify track ID
  const spotifyInfo = video.music?.tt2dsp?.tt_to_dsp_song_infos?.find(
    (info) => info.platform === 3
  );
  const spotifyTrackId = spotifyInfo?.song_id || null;

  // Determine copyright status
  let isCopyrighted: boolean | null = null;
  if (video.music?.isCopyrighted === true) {
    isCopyrighted = true;
  } else if (video.music?.isCopyrighted === false) {
    isCopyrighted = false;
  } else if (spotifyTrackId) {
    // Fallback: if has Spotify link, likely copyrighted
    isCopyrighted = true;
  }

  return {
    video_id: video.id,
    creator_username: creatorUsername,
    description: video.desc || null,
    video_created_at: new Date(video.createTime * 1000),
    music_title: video.music?.title || null,
    music_author: video.music?.authorName || null,
    is_copyrighted: isCopyrighted,
    spotify_track_id: spotifyTrackId,
    play_count: video.stats?.playCount || null,
    like_count: video.stats?.diggCount || null,
    comment_count: video.stats?.commentCount || null,
    share_count: video.stats?.shareCount || null,
    video_url: video.video?.playAddr || null,
    cover_url: video.video?.cover || null,
    duration_seconds: video.video?.duration || null,
  };
}
