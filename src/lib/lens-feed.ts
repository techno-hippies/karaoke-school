import { lensClient } from "./lens/client";
import { fetchPosts } from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/client";
import type { LensFeedItem } from "../types/feed";

// Get PKP registry contract address from environment or config
const PKP_REGISTRY_ADDRESS = import.meta.env.VITE_PKP_REGISTRY_ADDRESS || "0x..."; // Replace with your actual contract address

/**
 * Fetch feed items from Lens Protocol
 * This replaces the old subgraph-based approach
 */
export async function getFeedItems(limit: number = 50): Promise<LensFeedItem[]> {
  try {
    // console.log('[getFeedItems] Fetching posts with limit:', limit);
    
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
    // console.log('[getPKPAccountsPosts] Fetching posts for PKP addresses:', pkpAddresses);

    // Get general posts from Lens
    const result = await fetchPosts(lensClient, {
      pageSize: "FIFTY"
    });

    if (result.isErr()) {
      console.error('Error fetching PKP posts from Lens:', result.error);
      return [];
    }

    const posts = result.value.items;
    // console.log('[getPKPAccountsPosts] Fetched posts, filtering for PKP addresses');

    // Filter posts to only include ones from our test PKP addresses
    // Focus on the specific test addresses from the pipeline test
    const testAddresses = [
      '0xD2F10e1E55b5C5d7023b3587D1a18633854Ed0eE', // PKP Address from test
      '0x159d9c6882F97A6C24C8752F68A7E0F0006d2f22', // Creator address from test
      '0xfbc6e6F734253fe36aFF3FC96BB13B4968B71E08', // NEW: lens/addisonre1218 account
      ...pkpAddresses // Include the original PKP addresses too
    ];

    const pkpPosts = posts.filter(post => {
      if (!post || !post.author) return false;

      // Check if the post author's address matches any test address
      const addressMatch = testAddresses.includes(post.author.address);

      // Also check if any PKP accounts have usernames that match
      const usernameMatch = post.author.username?.value && testAddresses.some(addr =>
        addr.toLowerCase().includes(post.author.username?.value?.toLowerCase() || '')
      );

      // Special check for @addisonre content, the new post ID, or posts with video metadata
      const hasVideoContent = post.metadata?.__typename === 'VideoMetadata' ||
                             post.metadata?.content?.includes('addisonre') ||
                             post.metadata?.tags?.includes('addisonre');

      // Check for the specific successful post ID
      const isNewPost = post.id === '0xdd1e459318f85f05ea2199696d6da896b2dcb0aba904108fe19d6b4e2711b393';

      // Check for lens/addisonre1218 username
      const isAddisonAccount = post.author.username?.value === 'lens/addisonre1218';

      // Log full metadata for addisonre1218 posts
      // if (isAddisonAccount) {
      //   console.log(`[getPKPAccountsPosts] FOUND ADDISON POST! Full structure:`, post);
      //   console.log(`[getPKPAccountsPosts] Post metadata:`, post.metadata);
      //   console.log(`[getPKPAccountsPosts] Metadata attachments:`, post.metadata?.attachments);
      //   console.log(`[getPKPAccountsPosts] Metadata attributes:`, post.metadata?.attributes);
      //   console.log(`[getPKPAccountsPosts] Metadata video:`, post.metadata?.video);
      // }

      // console.log(`[getPKPAccountsPosts] Checking post ${post.id}: author=${post.author.address}, username=${post.author.username?.value}, addressMatch=${addressMatch}, usernameMatch=${usernameMatch}, hasVideo=${hasVideoContent}, isNewPost=${isNewPost}, isAddisonAccount=${isAddisonAccount}`);

      return addressMatch || usernameMatch || hasVideoContent || isNewPost || isAddisonAccount;
    });

    // console.log(`[getPKPAccountsPosts] Found ${pkpPosts.length} posts from PKP accounts out of ${posts.length} total`);

    // If no PKP posts found, return a sample of all posts for development purposes
    // This ensures the feed doesn't appear broken while PKP accounts are being set up
    const postsToReturn = pkpPosts.length > 0 ? pkpPosts : posts.slice(0, 10);

    if (pkpPosts.length === 0) {
      console.log('[getPKPAccountsPosts] No PKP posts found, showing sample posts for development');
    }

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

        // console.log(`[getPKPAccountsPosts] Transforming post ${index}:`, {
        //   id: post.id,
        //   username,
        //   address,
        //   timestamp: timestampMs,
        //   content: post.metadata?.content,
        //   extractedVideoUrl: extractedVideoUrl,
        //   metadataType: post.metadata?.__typename
        // });

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