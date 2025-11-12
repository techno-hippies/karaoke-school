/**
 * Shared type definitions for TikTok scraping helpers
 */

export interface TikTokUserProfile {
  username: string;
  secUid: string;
  userId: string;
  nickname: string;
  bio: string;
  avatar: string | null;
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
    downloadAddr?: string;
    cover?: string;
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
    playUrl?: string;
    coverMedium?: string;
    isCopyrighted?: boolean;
    original?: boolean;
    tt2dsp?: {
      tt_to_dsp_song_infos?: Array<{
        platform: number;
        song_id: string;
        song_name?: string;
        author?: string;
        album?: string;
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
