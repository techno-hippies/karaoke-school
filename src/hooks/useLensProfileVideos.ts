import { useQuery } from '@tanstack/react-query';
import { getLensUserPosts } from '../lib/lens-feed';

interface LensProfileVideo {
  id: string;
  thumbnailUrl: string;
  thumbnailSourceUrl: string; // Low-res MP4 for client-side thumbnail generation
  videoUrl: string;
  playCount: number;
  likes: number;
  comments: number;
  shares: number;
  description: string;
  timestamp: string;
}

/**
 * Hook to fetch videos for a specific Lens profile
 */
export function useLensProfileVideos(lensUsername: string | undefined) {
  return useQuery({
    queryKey: ['lens-profile-videos', lensUsername],
    queryFn: async (): Promise<LensProfileVideo[]> => {
      if (!lensUsername) return [];

      try {
        // console.log(`[useLensProfileVideos] Fetching videos for: ${lensUsername}`);

        // Get posts from this specific Lens user
        const userPosts = await getLensUserPosts(lensUsername);

        if (!userPosts || userPosts.length === 0) {
          // console.log(`[useLensProfileVideos] No posts found for ${lensUsername}`);
          return [];
        }

        // console.log(`[useLensProfileVideos] Found ${userPosts.length} posts for ${lensUsername}`);

        // Transform to profile video format
        return userPosts.map(item => ({
          id: item.id,
          thumbnailUrl: item.data.videoUrl, // Use video URL as thumbnail (poster frame)
          thumbnailSourceUrl: item.data.videoUrl, // Same as video URL
          videoUrl: item.data.videoUrl,
          playCount: item.data.likes + item.data.comments + item.data.shares,
          likes: item.data.likes,
          comments: item.data.comments,
          shares: item.data.shares,
          description: item.data.description,
          timestamp: item.timestamp,
        }));

      } catch (error) {
        console.error('[useLensProfileVideos] Error fetching videos:', error);
        return [];
      }
    },

    // Cache for 10 minutes to reduce API calls
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,

    // Retry on failure
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Enable only if we have a username
    enabled: !!lensUsername,

    // Refetch settings to reduce unnecessary calls
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}