/**
 * Common utilities for transforming various data sources into FeedItem format
 */

import type { FeedItem, LensFeedItem } from '../types/feed';

/**
 * Transform LensFeedItem (from Lens Protocol v3) to FeedItem format
 */
export function transformLensToFeedItem(item: LensFeedItem): FeedItem {
  const userHasLiked = item.data.userHasLiked || false;

  console.log(`[transformLensToFeedItem] 🔄 Converting ${item.creatorHandle} post ${item.id.slice(-8)} - userHasLiked: ${userHasLiked}`);

  return {
    id: item.id,
    type: 'video' as const,
    data: {
      ...item.data,
      // Ensure we have the correct data structure for VideoPost
      creatorHandle: item.creatorHandle,
      creatorId: item.creatorHandle,
      pkpPublicKey: item.video?.creator?.id,
      lensPostId: item.id,
      userHasLiked: userHasLiked, // Use actual reaction status from Lens
    }
  };
}

/**
 * Transform profile video data to FeedItem format
 */
export function transformProfileVideoToFeedItem(
  video: {
    id: string;
    videoUrl?: string;
    thumbnailUrl: string;
    thumbnailSourceUrl?: string;
    playCount: number;
    description?: string;
  },
  profileData: {
    username: string;
    creatorHandle?: string;
  }
): FeedItem {
  return {
    id: video.id,
    type: 'video' as const,
    data: {
      videoUrl: video.videoUrl || '',
      username: profileData.username,
      description: video.description || '',
      likes: 0, // Profile videos don't have like counts yet
      comments: 0,
      shares: 0,
      creatorHandle: profileData.creatorHandle || profileData.username,
      creatorId: profileData.username,
      thumbnailUrl: video.thumbnailUrl,
      thumbnailSourceUrl: video.thumbnailSourceUrl,
      playCount: video.playCount
    }
  };
}

/**
 * Check if data source is a Lens profile vs blockchain profile
 * This checks for the presence of username parameter which indicates Lens route
 */
export function isLensProfile(params: { username?: string }): boolean {
  return !!params.username;
}

/**
 * Handle conditional data fetching based on profile type
 */
export function selectProfileDataSource<T>(
  isLens: boolean,
  lensData: T | undefined,
  blockchainData: T | undefined
): T | undefined {
  return isLens ? lensData : blockchainData;
}

/**
 * Standardized data source hook pattern
 * Combines video loading states and data selection
 */
export interface DataSourceResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: any;
}

export function combineDataSources<T>(
  isLens: boolean,
  lensResult: DataSourceResult<T>,
  blockchainResult: DataSourceResult<T>
): DataSourceResult<T> {
  if (isLens) {
    return lensResult;
  }
  return blockchainResult;
}

/**
 * Transform array of LensFeedItems to FeedItems with limit
 */
export function transformLensFeed(
  items: LensFeedItem[] | undefined,
  limit?: number
): FeedItem[] {
  if (!items || items.length === 0) {
    return [];
  }

  const feedItems = items
    .filter(item => item && item.id) // Only valid items
    .map((item) => transformLensToFeedItem(item));

  return limit ? feedItems.slice(0, limit) : feedItems;
}

/**
 * Create sample quiz FeedItem (for demo purposes)
 */
export function createSampleQuiz(): FeedItem {
  return {
    id: 'quiz-1',
    type: 'quiz',
    data: {
      videoUrl: '/test_video/sample.mp4',
      username: 'karaoke_school',
      description: 'Test your knowledge and win big! 🎤 #quiz #learning',
      likes: 234567,
      comments: 1823,
      shares: 5670,
      musicTitle: 'Original Sound - Karaoke School',
      showQuizAfter: 3,
      question: 'What year was "All Eyez on Me" released?',
      options: [
        { id: '1', text: '1994', isCorrect: false },
        { id: '2', text: '1995', isCorrect: false },
        { id: '3', text: '1996', isCorrect: true },
        { id: '4', text: '1997', isCorrect: false },
      ],
      exerciseType: 'trivia',
      megapotAmount: 2500000,
    }
  };
}