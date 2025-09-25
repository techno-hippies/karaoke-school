import { lensClient } from "./lens/client";
import { fetchPosts } from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/client";
import type { LensFeedItem } from "../types/feed";
import { getLensSession } from "./lens/sessionClient";

// Get PKP registry contract address from environment or config
const PKP_REGISTRY_ADDRESS = import.meta.env.VITE_PKP_REGISTRY_ADDRESS || "0x..."; // Replace with your actual contract address

/**
 * Fetch feed items from Lens Protocol
 * This replaces the old subgraph-based approach
 */
export async function getFeedItems(limit: number = 50): Promise<LensFeedItem[]> {
  try {
    console.log('[getFeedItems] GENERAL FEED - Fetching posts with limit:', limit);
    
    // For now, get latest posts from all accounts
    // In production, you'd filter by your PKP accounts
    const result = await fetchPosts(lensClient, {
      pageSize: "FIFTY",
    });

    if (result.isErr()) {
      console.error('[getFeedItems] Error fetching posts from Lens:', result.error);
      return [];
    }

    const posts = result.value.items;
    // console.log('[getFeedItems] Fetched posts:', posts.length);

    // if (posts.length > 0) {
    //   console.log('[getFeedItems] First 3 posts summaries:');
    //   posts.slice(0, 3).forEach((post, i) => {
    //     console.log(`[getFeedItems] Post ${i}:`, {
    //       id: post.id,
    //       by: post.by,
    //       author: post.author,
    //       createdAt: post.createdAt,
    //       timestamp: post.timestamp,
    //       metadata: post.metadata,
    //       typename: post.__typename
    //     });
    //   });
    // }
    
    // Transform Lens posts to legacy subgraph format
    return posts
      .filter(post => post && post.id) // More lenient filter - just need an ID
      .map((post, index) => {
        // Handle different possible post structures - Lens uses 'author' not 'by'
        const author = post.author || post.by || {};
        const username = author.username?.value || author.handle?.value || author.address || `user_${index}`;
        const address = author.address || 'unknown';

        // Lens uses 'timestamp' not 'createdAt'
        const postTimestamp = post.timestamp || post.createdAt;
        const timestampMs = postTimestamp ? new Date(postTimestamp).getTime().toString() : Date.now().toString();

        // console.log(`[getFeedItems] Transforming post ${index}:`, {
        //   id: post.id,
        //   username,
        //   address,
        //   timestamp: timestampMs,
        //   content: post.metadata?.content
        // });

        return {
          id: post.id,
          creatorHandle: username,
          timestamp: timestampMs,
          data: {
            videoUrl: extractVideoUrl(post.metadata) || '/test_video/sample.mp4', // Fallback video
            username: username,
            description: extractContent(post.metadata) || 'Sample post content',
            likes: post.stats?.likes || Math.floor(Math.random() * 10000),
            comments: post.stats?.comments || Math.floor(Math.random() * 1000),
            shares: (post.stats?.reposts || 0) + (post.stats?.quotes || 0) || Math.floor(Math.random() * 500),
          },
          video: {
            id: post.id,
            uploadTxId: post.id,
            creator: {
              id: address,
            },
          },
        };
      });
  } catch (error) {
    console.error('Error in getFeedItems:', error);
    return [];
  }
}

/**
 * Extract video URL from Lens post metadata
 */
function extractVideoUrl(metadata: any): string {
  // Check for VideoMetadata with video.item (new structure)
  if (metadata?.__typename === 'VideoMetadata' && metadata.video?.item) {
    return metadata.video.item;
  }

  // Check for video metadata with video.uri (old structure)
  if (metadata?.__typename === 'VideoMetadata' && metadata.video?.uri) {
    return metadata.video.uri;
  }

  // Check attachments for MediaVideo
  if (metadata?.attachments && Array.isArray(metadata.attachments)) {
    for (const attachment of metadata.attachments) {
      if (attachment.__typename === 'MediaVideo' && attachment.item) {
        return attachment.item;
      }
    }
  }

  // Check for Livepeer URLs in content or attributes
  if (metadata?.content) {
    const livepeerMatch = metadata.content.match(/https:\/\/vod-cdn\.lp-playback\.studio\/[^\s]+/);
    if (livepeerMatch) {
      return livepeerMatch[0];
    }
  }

  // Check attributes for video URLs
  if (metadata?.attributes) {
    for (const attr of metadata.attributes) {
      if (attr.key === 'videoUrl' || attr.key === 'livepeerUrl') {
        return attr.value;
      }
    }
  }

  return '';
}

/**
 * Extract content text from Lens post metadata
 */
function extractContent(metadata: any): string {
  if (metadata?.content) {
    return metadata.content;
  }
  return '';
}

/**
 * Get posts from a specific Lens username
 * Used for profile pages to show videos from a specific creator
 */
export async function getLensUserPosts(lensUsername: string, limit: number = 50): Promise<LensFeedItem[]> {
  try {
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get general posts from Lens with retry logic
    let result;
    let retries = 3;

    while (retries > 0) {
      try {
        result = await fetchPosts(lensClient, {
          pageSize: "FIFTY"
        });
        break; // Success, exit retry loop
      } catch (error) {
        retries--;
        if (retries === 0) throw error;

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
      }
    }

    if (!result || result.isErr()) {
      console.error('Error fetching Lens posts:', result?.error || 'Unknown error');
      return [];
    }

    const posts = result.value.items;

    // Filter posts for this specific username
    const userPosts = posts.filter(post => {
      if (!post || !post.author) return false;

      // Check if the username matches (with or without lens/ prefix)
      const postUsername = post.author.username?.value;
      if (!postUsername) return false;

      // Handle various formats: lens/username, username, @username
      const cleanPostUsername = postUsername.replace('lens/', '').replace('@', '');
      const cleanSearchUsername = lensUsername.replace('lens/', '').replace('@', '');

      return cleanPostUsername.toLowerCase() === cleanSearchUsername.toLowerCase();
    });

    console.log(`[getLensUserPosts] Found ${userPosts.length} posts for ${lensUsername}`);

    return userPosts
      .filter(post => post && post.id) // Only valid posts
      .map((post, index) => {
        // Handle different possible post structures - Lens uses 'author' not 'by'
        const author = post.author || post.by || {};
        const username = author.username?.value || author.handle?.value || author.address || `user_${index}`;
        const address = author.address || 'unknown';

        // Lens uses 'timestamp' not 'createdAt'
        const postTimestamp = post.timestamp || post.createdAt;
        const timestampMs = postTimestamp ? new Date(postTimestamp).getTime().toString() : Date.now().toString();

        const extractedVideoUrl = extractVideoUrl(post.metadata);

        return {
          id: post.id,
          creatorHandle: username,
          timestamp: timestampMs,
          data: {
            videoUrl: extractedVideoUrl || '', // No fallback for profile videos
            username: username,
            description: extractContent(post.metadata) || '',
            likes: post.stats?.likes || 0,
            comments: post.stats?.comments || 0,
            shares: (post.stats?.reposts || 0) + (post.stats?.quotes || 0) || 0,
          },
          video: {
            id: post.id,
            uploadTxId: post.id,
            creator: {
              id: address,
            },
          },
        };
      })
      .filter(item => item.data.videoUrl); // Only return items with actual videos
  } catch (error) {
    console.error('Error in getLensUserPosts:', error);
    return [];
  }
}

/**
 * Get posts from specific PKP accounts
 * This is the main function you'll use to get posts from your TikTok creators
 */
export async function getPKPAccountsPosts(pkpAddresses: string[], limit: number = 50): Promise<LensFeedItem[]> {
  try {
    console.log('[getPKPAccountsPosts] Fetching posts for PKP addresses:', pkpAddresses);

    // Use authenticated session client if available to get user reaction states
    const sessionClient = getLensSession();
    const clientToUse = sessionClient || lensClient;

    console.log(`[getPKPAccountsPosts] Using ${sessionClient ? 'authenticated SessionClient' : 'basic lensClient'} for post fetching`);

    // Get posts from our specific app
    const result = await fetchPosts(clientToUse, {
      filter: {
        apps: [evmAddress('0x9484206D9beA9830F27361a2F5868522a8B8Ad22')]
      },
      pageSize: "FIFTY"
    });

    if (result.isErr()) {
      console.error('Error fetching PKP posts from Lens:', result.error);
      return [];
    }

    const posts = result.value.items;
    console.log('[getPKPAccountsPosts] Fetched posts from app filter:', posts.length, 'posts');
    console.log('[getPKPAccountsPosts] First few posts:', posts.slice(0, 3).map(p => ({
      id: p.id,
      author: p.author?.username?.value || p.author?.address,
      app: p.app?.address,
      operations: p.operations // Add operations to debug output
    })));

    // Debug: Log operations for authenticated user if available
    if (sessionClient && posts.length > 0) {
      console.log('[getPKPAccountsPosts] 🔍 Operations available for authenticated user:');
      posts.slice(0, 3).forEach((post, i) => {
        console.log(`[getPKPAccountsPosts] Post ${i} operations:`, post.operations);
      });
    }

    // Filter posts to only include ones from our test PKP addresses
    // Focus on the specific test addresses from the pipeline test
    const testAddresses = [
      '0xD2F10e1E55b5C5d7023b3587D1a18633854Ed0eE', // PKP Address from test
      '0x159d9c6882F97A6C24C8752F68A7E0F0006d2f22', // Creator address from test
      '0xfbc6e6F734253fe36aFF3FC96BB13B4968B71E08', // NEW: lens/addisonre1218 account
      ...pkpAddresses // Include the original PKP addresses too
    ];

    console.log(`[getPKPAccountsPosts] Test addresses we're filtering for:`, testAddresses);

    // Since we already filtered by app in the fetchPosts call, we should only get posts from our app
    // Let's be more strict and only show posts from the actual PKP addresses we care about
    const pkpPosts = posts.filter(post => {
      if (!post || !post.author) return false;

      console.log(`[getPKPAccountsPosts] Checking post ${post.id}: author=${post.author.address}, username=${post.author.username?.value}, app=${post.app?.address}`);

      // Only include posts from the exact test addresses (be strict)
      const addressMatch = testAddresses.includes(post.author.address);

      if (addressMatch) {
        console.log(`[getPKPAccountsPosts] ✅ KEEPING post ${post.id} from ${post.author.username?.value || post.author.address}`);
      } else {
        console.log(`[getPKPAccountsPosts] ❌ REJECTING post ${post.id} from ${post.author.username?.value || post.author.address} - not in test addresses`);
      }

      return addressMatch;
    });

    // console.log(`[getPKPAccountsPosts] Found ${pkpPosts.length} posts from PKP accounts out of ${posts.length} total`);

    // Only return PKP posts - no fallback to random posts
    if (pkpPosts.length === 0) {
      console.log('[getPKPAccountsPosts] No PKP posts found, returning empty array');
      return [];
    }

    console.log(`[getPKPAccountsPosts] Found ${pkpPosts.length} posts from PKP accounts out of ${posts.length} total`);
    const postsToReturn = pkpPosts;

    return postsToReturn
      .filter(post => post && post.id) // More lenient filter
      .map((post, index) => {
        // Handle different possible post structures - Lens uses 'author' not 'by'
        const author = post.author || post.by || {};
        const username = author.username?.value || author.handle?.value || author.address || `user_${index}`;
        const address = author.address || 'unknown';

        // Lens uses 'timestamp' not 'createdAt'
        const postTimestamp = post.timestamp || post.createdAt;
        const timestampMs = postTimestamp ? new Date(postTimestamp).getTime().toString() : Date.now().toString();

        const extractedVideoUrl = extractVideoUrl(post.metadata);

        // Extract user reaction state from operations if available (SessionClient only)
        const hasUpvoted = post.operations?.hasUpvoted || false;

        console.log(`[getPKPAccountsPosts] ✨ Transforming post ${index} for ${username}:`, {
          id: post.id,
          hasUpvoted: hasUpvoted,
          operations: post.operations ? 'present' : 'missing',
          operationsDetail: post.operations,
          likes: post.stats?.likes,
          reactions: post.stats?.reactions
        });

        const transformedData = {
          id: post.id,
          creatorHandle: username,
          timestamp: timestampMs,
          data: {
            videoUrl: extractedVideoUrl || '/test_video/sample.mp4', // Fallback video
            username: username,
            description: extractContent(post.metadata) || 'Sample post content',
            likes: post.stats?.likes || Math.floor(Math.random() * 10000),
            comments: post.stats?.comments || Math.floor(Math.random() * 1000),
            shares: (post.stats?.reposts || 0) + (post.stats?.quotes || 0) || Math.floor(Math.random() * 500),
            userHasLiked: hasUpvoted, // Add user reaction state
          },
          video: {
            id: post.id,
            uploadTxId: post.id,
            creator: {
              id: address,
            },
          },
        };

        // console.log(`[getPKPAccountsPosts] Transformed data for ${username}:`, transformedData);

        return transformedData;
      });
  } catch (error) {
    console.error('Error in getPKPAccountsPosts:', error);
    return [];
  }
}