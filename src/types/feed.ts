/**
 * Common types for feed items
 */

export interface FeedItem {
  id: string;
  type: 'video' | 'quiz';
  data: {
    videoUrl: string;
    username: string;
    description: string;
    likes: number;
    comments: number;
    shares: number;
    creatorHandle?: string;
    creatorId?: string;
    pkpPublicKey?: string;
    thumbnailUrl?: string;
    thumbnailSourceUrl?: string;
    playCount?: number;
    musicTitle?: string;
    // Quiz-specific fields
    showQuizAfter?: number;
    question?: string;
    options?: Array<{ id: string; text: string; isCorrect: boolean }>;
    exerciseType?: string;
    megapotAmount?: number;
  };
}

// Lens Protocol v3 feed item interface
export interface LensFeedItem {
  id: string;
  creatorHandle: string;
  timestamp: string;
  data: {
    videoUrl: string;
    username: string;
    description: string;
    likes: number;
    comments: number;
    shares: number;
  };
  video: {
    id: string;
    uploadTxId: string;
    creator?: {
      id: string;
    };
  };
}