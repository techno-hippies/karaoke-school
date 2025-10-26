/**
 * Cloudflare Worker Environment
 */
export interface Env {
  NEON_DATABASE_URL: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  GENIUS_API_KEY: string;
  OPENROUTER_API_KEY: string;
  QUANSIC_SESSION_COOKIE: string;
  QUANSIC_SERVICE_URL: string;
  BMI_SERVICE_URL?: string;
  CISAC_SERVICE_URL?: string;
  FREYR_SERVICE_URL?: string;
  ACOUSTID_API_KEY?: string;
}

/**
 * TikTok API Response Types
 */

export interface TikTokUserProfile {
  username: string;
  secUid: string;
  userId: string;
  nickname: string;
  bio: string;
  avatar: string;
  stats: {
    followerCount: number;
    followingCount: number;
    videoCount: number;
  };
}

export interface TikTokVideo {
  id: string;
  desc: string;
  createTime: number;
  video: {
    playAddr: string;
    downloadAddr: string;
    cover: string;
    duration: number;
  };
  author: {
    id: string;
    uniqueId: string;
    nickname: string;
  };
  music: {
    title: string;
    authorName?: string;
    playUrl: string;
    coverMedium: string;
    isCopyrighted?: boolean;
    tt2dsp?: {
      tt_to_dsp_song_infos?: Array<{
        platform: number; // 3 = Spotify
        song_id: string;
      }>;
    };
  };
  stats: {
    playCount: number;
    shareCount: number;
    commentCount: number;
    diggCount: number;
  };
}

export interface TikTokAPIResponse {
  statusCode: number;
  itemList?: TikTokVideo[];
  hasMore?: boolean;
  cursor?: number;
}

/**
 * Database Types
 */

export interface CreatorRecord {
  tiktok_handle: string;
  sec_uid: string;
  name: string;
  follower_count: number;
  raw_profile: Record<string, unknown>;
  last_scraped_at: Date;
}

export interface VideoRecord {
  video_id: string;
  tiktok_handle: string;
  spotify_track_id: string | null;
  copyright_status: 'copyrighted' | 'copyright-free' | 'unknown';
  play_count: number;
  like_count: number;
  comment_count: number;
  created_at: Date;
  raw_data: Record<string, unknown>;
  scraped_at: Date;
  updated_at: Date;
}
