import { lensClient } from "./lens/client";
import { fetchPosts, fetchAccountsAvailable } from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/client";
import type { LensFeedItem } from "../types/feed";
import { getLensSession } from "./lens/session";
import { getStorageClient } from "./lens/storage";

// Lens app configuration
const LENS_TESTNET_APP = '0x9484206D9beA9830F27361a2F5868522a8B8Ad22';

/**
 * Fetch feed items from Lens Protocol using appId filter
 * This gets all posts for the app, removing PKP dependencies
 */
export async function getFeedItems(): Promise<LensFeedItem[]> {
  try {
    const sessionClient = getLensSession();
    const clientToUse = sessionClient || lensClient;

    // Try to get wallet address for debugging
    const walletAddress = sessionClient?.account?.address;
    console.log('[getFeedItems] 🔍 Debugging wallet vs app posts:', {
      hasSessionClient: !!sessionClient,
      walletAddress,
      appFilter: LENS_TESTNET_APP
    });

    const result = await fetchPosts(clientToUse, {
      filter: {
        apps: [evmAddress(LENS_TESTNET_APP)]
      },
      pageSize: "FIFTY",
    });

    if (result.isErr()) {
      console.error('[getFeedItems] Error fetching posts from Lens:', result.error);
      return [];
    }

    const posts = result.value.items;

    console.log(`[getFeedItems] 📊 Retrieved ${posts.length} posts from app ${LENS_TESTNET_APP}`);
    if (posts.length > 0) {
      console.log('[getFeedItems] 📝 Recent posts by author:', posts.slice(0, 3).map(p => ({
        id: p.id,
        author: p.author?.address,
        username: p.author?.username?.value,
        timestamp: p.timestamp
      })));

      // Check if the latest post from this session appears
      const currentWallet = '0xfe8374d7b392151dec051a9424bfa447700d6bb0';
      const postsFromCurrentWallet = posts.filter(p =>
        p.author?.address?.toLowerCase() === currentWallet.toLowerCase()
      );
      console.log('[getFeedItems] 🎯 Posts from current wallet:', postsFromCurrentWallet.length,
        postsFromCurrentWallet.map(p => ({ id: p.id, timestamp: p.timestamp })));
    }

    // Transform Lens posts to legacy subgraph format
    return posts
      .filter(post => post && post.id) // More lenient filter - just need an ID
      .map((post, index) => {

        // Handle different possible post structures - Lens uses 'author' not 'by'
        const author = post.author || post.by || {};
        const address = author.address || 'unknown';
        // Use wallet address as display name (no usernames needed)
        const username = author.username?.value || author.handle?.value || address || `user_${index}`;

        // Lens uses 'timestamp' not 'createdAt'
        const postTimestamp = post.timestamp || post.createdAt;
        const timestampMs = postTimestamp ? new Date(postTimestamp).getTime().toString() : Date.now().toString();



        const extractedVideoUrl = extractVideoUrl(post.metadata);
        console.log('[getFeedItems] 🎬 Video URL extraction:', {
          postId: post.id,
          extractedUrl: extractedVideoUrl,
          metadata: post.metadata
        });

        return {
          id: post.id,
          creatorHandle: username,
          timestamp: timestampMs,
          data: {
            videoUrl: extractedVideoUrl || '/test_video/sample.mp4', // Fallback video
            username: username,
            description: extractContent(post.metadata) || 'Sample post content',
            likes: post.stats?.upvotes || 0,
            comments: post.stats?.comments || 0,
            shares: (post.stats?.reposts || 0) + (post.stats?.quotes || 0),
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
 * Convert lens:// URI to Grove gateway URL for video playback
 * Uses Grove storage client's resolve method for proper URL resolution
 */
function resolveLensUri(uri: string): string {
  if (uri.startsWith('lens://')) {
    try {
      // Use Grove storage client's resolve method
      const storageClient = getStorageClient();
      const resolvedUrl = storageClient.resolve(uri);
      console.log('[resolveLensUri] 🌳 Grove storage client resolved:', { original: uri, resolved: resolvedUrl });
      return resolvedUrl;
    } catch (error) {
      console.warn('[resolveLensUri] Storage client resolve failed, using manual conversion:', error);
      // Fallback to manual conversion
      const hash = uri.replace('lens://', '');
      const groveUrl = `https://api.grove.storage/${hash}`;
      console.log('[resolveLensUri] 🌳 Manual Grove gateway conversion:', { original: uri, resolved: groveUrl });
      return groveUrl;
    }
  }
  return uri;
}

/**
 * Extract video URL from Lens post metadata
 */
function extractVideoUrl(metadata: unknown): string {
  console.log('[extractVideoUrl] 🔍 Full metadata structure:', metadata);

  // Check for VideoMetadata with video.item (new structure)
  if (metadata && typeof metadata === 'object' && '__typename' in metadata && metadata.__typename === 'VideoMetadata' && 'video' in metadata) {
    const video = (metadata as { video?: { item?: string; uri?: string } }).video;
    console.log('[extractVideoUrl] 📹 Found VideoMetadata.video:', video);
    if (video?.item) {
      const resolvedUrl = resolveLensUri(video.item);
      console.log('[extractVideoUrl] ✅ Using video.item:', { original: video.item, resolved: resolvedUrl });
      return resolvedUrl;
    }
    if (video?.uri) {
      const resolvedUrl = resolveLensUri(video.uri);
      console.log('[extractVideoUrl] ✅ Using video.uri:', { original: video.uri, resolved: resolvedUrl });
      return resolvedUrl;
    }
  }

  // Check attachments for MediaVideo
  if (metadata && typeof metadata === 'object' && 'attachments' in metadata && Array.isArray(metadata.attachments)) {
    for (const attachment of metadata.attachments) {
      if (attachment && typeof attachment === 'object' && '__typename' in attachment && attachment.__typename === 'MediaVideo' && 'item' in attachment) {
        return resolveLensUri((attachment as { item: string }).item);
      }
    }
  }

  // Check for video URLs in content
  if (metadata?.content) {
    const videoUrlMatch = metadata.content.match(/https:\/\/[^\s]+\.(mp4|webm|m3u8)/);
    if (videoUrlMatch) {
      return videoUrlMatch[0];
    }
  }

  // Check attributes for video URLs (prioritize gateway URL from storage)
  if (metadata?.attributes) {
    for (const attr of metadata.attributes) {
      if (attr.key === 'video_gateway_url') {
        console.log('[extractVideoUrl] ✅ Found gateway URL in attributes:', attr.value);
        return attr.value;
      }
      if (attr.key === 'videoUrl' || attr.key === 'video_url') {
        console.log('[extractVideoUrl] ✅ Found video URL in attributes:', attr.value);
        return attr.value;
      }
    }
  }

  return '';
}

/**
 * Extract content text from Lens post metadata
 */
function extractContent(metadata: unknown): string {
  if (metadata && typeof metadata === 'object' && 'content' in metadata) {
    return (metadata as { content: string }).content;
  }
  return '';
}

/**
 * Get posts from a specific user (by wallet address or Lens account)
 * Used for profile pages to show videos from a specific creator
 */
export async function getLensUserPosts(addressOrUsername: string): Promise<LensFeedItem[]> {
  try {
    const sessionClient = getLensSession();
    const clientToUse = sessionClient || lensClient;

    let authorAddresses: string[] = [];

    // If input looks like a wallet address, fetch associated Lens accounts
    if (addressOrUsername.startsWith('0x') && addressOrUsername.length === 42) {
      const accountsResult = await fetchAccountsAvailable(clientToUse, {
        managedBy: evmAddress(addressOrUsername),
        includeOwned: true
      });

      if (accountsResult.isOk()) {
        authorAddresses = accountsResult.value.items.map(item => item.account.address);
        if (authorAddresses.length === 0) {
          // No Lens accounts found for this wallet
          return [];
        }
      } else {
        // Fallback: use the wallet address directly
        authorAddresses = [addressOrUsername];
      }
    } else {
      // Assume it's a Lens account address
      authorAddresses = [addressOrUsername];
    }

    const result = await fetchPosts(clientToUse, {
      filter: {
        authors: authorAddresses.map(addr => evmAddress(addr)),
        apps: [evmAddress(LENS_TESTNET_APP)]
      },
      pageSize: "FIFTY"
    });

    if (result.isErr()) {
      console.error('Error fetching user posts:', result.error);
      return [];
    }

    const userPosts = result.value.items;


    return userPosts
      .filter(post => post && post.id)
      .map((post, index) => {
        const author = post.author || {};
        const address = author.address || 'unknown';
        const username = author.username?.value || address || `user_${index}`;
        const postTimestamp = post.timestamp || post.createdAt;
        const timestampMs = postTimestamp ? new Date(postTimestamp).getTime().toString() : Date.now().toString();
        const extractedVideoUrl = extractVideoUrl(post.metadata);
        const hasUpvoted = post.operations?.hasUpvoted || false;

        return {
          id: post.id,
          creatorHandle: username,
          timestamp: timestampMs,
          data: {
            videoUrl: extractedVideoUrl || '',
            username: username,
            description: extractContent(post.metadata) || '',
            likes: post.stats?.upvotes || 0,
            comments: post.stats?.comments || 0,
            shares: (post.stats?.reposts || 0) + (post.stats?.quotes || 0) || 0,
            userHasLiked: hasUpvoted,
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
    console.error('Error in getLensUserPosts:', error);
    return [];
  }
}

/**
 * Get app feed items (replaces PKP-based approach)
 * This is now the main function for getting all app posts
 */
export async function getAppFeedItems(): Promise<LensFeedItem[]> {
  return getFeedItems();
}

