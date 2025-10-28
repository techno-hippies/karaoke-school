/**
 * Type definitions for Karaoke Pipeline
 */

export interface Env {
  NEON_DATABASE_URL: string;
  QUANSIC_SERVICE_URL?: string;
}

export interface TrackToProcess {
  id: number;
  spotify_track_id: string;
  isrc: string;
  title?: string;
}

export type PipelineStatus =
  | 'scraped'
  | 'spotify_resolved'
  | 'iswc_found'
  | 'metadata_enriched'
  | 'lyrics_ready'
  | 'audio_downloaded'
  | 'alignment_complete'
  | 'stems_separated'
  | 'media_enhanced'
  | 'ready_to_mint'
  | 'minted'
  | 'failed';

// TikTok Types
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
        platform: number;
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
