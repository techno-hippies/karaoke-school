import { useQuery } from '@tanstack/react-query';
import { getLensUserPosts } from '../lib/lens-feed';
import { isHLSUrl, extractPlaybackId } from '../lib/livepeer-thumbnails';

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

        // Transform to profile video format with client-side thumbnail generation
        const videosWithThumbnails = [];
        for (const item of userPosts) {
          const videoUrl = item.data.videoUrl;
          let thumbnailSourceUrl = '';

          if (isHLSUrl(videoUrl)) {
            const playbackId = extractPlaybackId(videoUrl);

            if (playbackId) {
              try {
                const response = await fetch(`https://livepeer.studio/api/playback/${playbackId}`);
                if (response.ok) {
                  const data = await response.json();
                  const sources = data?.meta?.source || data?.meta?.meta?.source || [];

                  // Find the lowest res MP4 (static480p or similar)
                  const lowResMp4 = sources.find(s =>
                    s.url && (
                      s.url.includes('static480p.mp4') ||
                      s.url.includes('static360p.mp4') ||
                      s.url.includes('static.mp4')
                    )
                  );

                  if (lowResMp4) {
                    thumbnailSourceUrl = lowResMp4.url;
                  }
                }
              } catch (error) {
                console.error(`[useLensProfileVideos] Error fetching playback info:`, error);
              }
            }
          }

          videosWithThumbnails.push({
            id: item.id,
            thumbnailUrl: '', // No server thumbnail - client will generate
            thumbnailSourceUrl, // MP4 for client generation
            videoUrl,
            playCount: item.data.likes + item.data.comments + item.data.shares,
            likes: item.data.likes,
            comments: item.data.comments,
            shares: item.data.shares,
            description: item.data.description,
            timestamp: item.timestamp,
          });
        }

        return videosWithThumbnails;

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