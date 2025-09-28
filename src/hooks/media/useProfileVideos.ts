import { useQuery } from '@tanstack/react-query';
import { getFeedItems } from '../../lib/feed';
import { getCreatorInfo } from '../../lib/creators';

interface ProfileVideo {
  id: string;
  thumbnailUrl: string;
  videoUrl: string;
  playCount: number;
  uploadTxId: string;
  timestamp: string;
}

/**
 * Hook to fetch videos for a specific profile
 * Works with ENS names, ETH addresses, or TikTok handles
 */
export function useProfileVideos(addressOrEns: string | undefined) {
  return useQuery({
    queryKey: ['profile-videos', addressOrEns],
    queryFn: async (): Promise<ProfileVideo[]> => {
      if (!addressOrEns) return [];
      
      try {
        // 1. Determine the TikTok handle for this profile
        let creatorHandle: string | undefined;
        
        // Check if it's a direct handle (starts with @)
        if (addressOrEns.startsWith('@')) {
          creatorHandle = addressOrEns;
        } 
        // Check our mappings
        else {
          const creatorInfo = getCreatorInfo(addressOrEns);
          creatorHandle = creatorInfo?.handle;
          
          // If still not found, assume it's a handle without @
          if (!creatorHandle && !addressOrEns.startsWith('0x')) {
            creatorHandle = `@${addressOrEns}`;
          }
        }
        
        if (!creatorHandle) {
          console.log(`[useProfileVideos] No creator mapping for: ${addressOrEns}`);
          return [];
        }
        
        console.log(`[useProfileVideos] Looking for videos from: ${creatorHandle}`);
        
        // 2. Fetch all feed items (this is inefficient but works for V1)
        const allFeedItems = await getFeedItems(100); // Get more to ensure we find them

        // If this is a wallet address, also check PKP posts which might include user's own posts
        let pkpItems = [];
        if (addressOrEns.startsWith('0x')) {
          console.log(`[useProfileVideos] Checking PKP posts for wallet: ${addressOrEns}`);
          const { getPKPAccountsPosts } = await import('../../lib/feed');
          pkpItems = await getPKPAccountsPosts([addressOrEns], 50);
          console.log(`[useProfileVideos] Found ${pkpItems.length} PKP posts for wallet ${addressOrEns}`);
        }
        
        // Combine regular feed items with PKP items
        const combinedItems = [...allFeedItems, ...pkpItems];

        if (!combinedItems || combinedItems.length === 0) {
          console.log('[useProfileVideos] No feed items found');
          return [];
        }

        // Debug: Log unique creators in the feed
        const uniqueCreators = [...new Set(combinedItems.map(item => item.creatorHandle))];
        console.log('[useProfileVideos] Creators in feed:', uniqueCreators);

        // 3. Filter for this creator's videos
        const creatorVideos = combinedItems.filter(item => {
          // If searching by wallet address, match directly by wallet address
          if (addressOrEns.startsWith('0x')) {
            const creatorAddress = item.video?.creator?.id;
            return creatorAddress?.toLowerCase() === addressOrEns.toLowerCase();
          }

          // Otherwise, match by handle
          const itemHandle = item.creatorHandle?.replace('@', '').toLowerCase();
          const searchHandle = creatorHandle?.replace('@', '').toLowerCase();
          const itemId = item.video?.creator?.id?.replace('@', '').toLowerCase();

          // Match by handle or creator ID
          return itemHandle === searchHandle || itemId === searchHandle;
        });
        
        console.log(`[useProfileVideos] Found ${creatorVideos.length} videos for ${creatorHandle}`);
        
        // 4. Transform to profile video format
        return creatorVideos.map((item, index) => {
          const videoUrl = item.data.videoUrl || '/test_video/sample.mp4';

          return {
            id: item.video.id || `video-${index}`,
            thumbnailUrl: videoUrl, // Use video URL as thumbnail (poster frame)
            videoUrl: videoUrl,
            playCount: Math.floor(Math.random() * 5000000), // Mock for now
            uploadTxId: item.video.uploadTxId,
            timestamp: new Date(parseInt(item.timestamp || '0') * 1000).toISOString(),
          };
        });
        
      } catch (error) {
        console.error('[useProfileVideos] Error fetching videos:', error);
        return [];
      }
    },
    
    // Cache for 5 minutes
    staleTime: 5 * 60 * 1000,
    
    // Enable only if we have an address/handle
    enabled: !!addressOrEns,
  });
}

/**
 * Get creator handle from address/ENS
 * Re-export from creator-mappings to avoid import errors
 */
export { getCreatorHandle } from '../../lib/creators';