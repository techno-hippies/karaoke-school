import { lensClient } from "./lens/client";
import { fetchPosts, fetchAccountsAvailable } from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/client";
import type { LensFeedItem } from "../types/feed";
import { getStorageClient } from "./lens/storage";

// Lens app configuration
const LENS_TESTNET_APP = '0x9484206D9beA9830F27361a2F5868522a8B8Ad22';

/**
 * Fetch feed items from Lens Protocol using appId filter
 * This gets all posts for the app, removing PKP dependencies
 */
export async function getFeedItems(limit: number = 50): Promise<LensFeedItem[]> {
  console.log('🎵 [getFeedItems] Starting feed fetch with limit:', limit);
  try {
    const clientToUse = lensClient;

    // Try to get wallet address for debugging - now handled by React SDK
    const walletAddress = null; // Not needed for public feed queries
    // console.log('[getFeedItems] Debugging wallet vs app posts');

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

//     console.log(`[getFeedItems] 📊 Retrieved ${posts.length} posts from app ${LENS_TESTNET_APP}`);
    if (posts.length > 0) {
      // console.log('[getFeedItems] Recent posts by author:', posts.slice(0, 3).map(p => ({
      //   id: p.id,
      //   author: p.author?.address,
      //   username: p.author?.username?.value,
      //   timestamp: p.timestamp
      // })));

      // Check if the latest post from this session appears
      const currentWallet = '0xfe8374d7b392151dec051a9424bfa447700d6bb0';
      const postsFromCurrentWallet = posts.filter(p =>
        p.author?.address?.toLowerCase() === currentWallet.toLowerCase()
      );
      // console.log('[getFeedItems] Posts from current wallet:', postsFromCurrentWallet.length,
      //   postsFromCurrentWallet.map(p => ({ id: p.id, timestamp: p.timestamp })));
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
        const karaokeData = extractKaraokeData(post.metadata);
        console.log('[getFeedItems] Processing post:', {
          postId: post.id,
          extractedUrl: extractedVideoUrl,
          karaokeData,
          hasKaraokeData: Object.keys(karaokeData).length > 0,
          metadataAttributes: post.metadata?.attributes || 'no attributes'
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
            // Include karaoke lyrics data
            ...karaokeData,
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
//       console.log('[resolveLensUri] 🌳 Grove storage client resolved:', { original: uri, resolved: resolvedUrl });
      return resolvedUrl;
    } catch (error) {
      console.warn('[resolveLensUri] Storage client resolve failed, using manual conversion:', error);
      // Fallback to manual conversion
      const hash = uri.replace('lens://', '');
      const groveUrl = `https://api.grove.storage/${hash}`;
//       console.log('[resolveLensUri] 🌳 Manual Grove gateway conversion:', { original: uri, resolved: groveUrl });
      return groveUrl;
    }
  }
  return uri;
}

/**
 * Extract video URL from Lens post metadata
 */
function extractVideoUrl(metadata: unknown): string {
//   console.log('[extractVideoUrl] 🔍 Full metadata structure:', metadata);

  // Check for VideoMetadata with video.item (new structure)
  if (metadata && typeof metadata === 'object' && '__typename' in metadata && metadata.__typename === 'VideoMetadata' && 'video' in metadata) {
    const video = (metadata as { video?: { item?: string; uri?: string } }).video;
//     console.log('[extractVideoUrl] 📹 Found VideoMetadata.video:', video);
    if (video?.item) {
      const resolvedUrl = resolveLensUri(video.item);
//       console.log('[extractVideoUrl] ✅ Using video.item:', { original: video.item, resolved: resolvedUrl });
      return resolvedUrl;
    }
    if (video?.uri) {
      const resolvedUrl = resolveLensUri(video.uri);
//       console.log('[extractVideoUrl] ✅ Using video.uri:', { original: video.uri, resolved: resolvedUrl });
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
//         console.log('[extractVideoUrl] ✅ Found gateway URL in attributes:', attr.value);
        return attr.value;
      }
      if (attr.key === 'videoUrl' || attr.key === 'video_url') {
//         console.log('[extractVideoUrl] ✅ Found video URL in attributes:', attr.value);
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
 * Extract karaoke lyrics metadata from Lens post
 */
function extractKaraokeData(metadata: unknown): {
  lyricsUrl?: string;
  lyricsFormat?: string;
  segmentStart?: number;
  segmentEnd?: number;
  songTitle?: string;
} {
  const result: {
    lyricsUrl?: string;
    lyricsFormat?: string;
    segmentStart?: number;
    segmentEnd?: number;
    songTitle?: string;
  } = {};

  if (metadata && typeof metadata === 'object' && 'attributes' in metadata && Array.isArray(metadata.attributes)) {
    for (const attr of metadata.attributes) {
      if (attr && typeof attr === 'object' && 'key' in attr && 'value' in attr) {
        switch (attr.key) {
          case 'karaoke_lyrics_url':
            result.lyricsUrl = attr.value as string;
            break;
          case 'karaoke_lyrics_format':
            result.lyricsFormat = attr.value as string;
            break;
          case 'karaoke_segment_start':
            result.segmentStart = parseFloat(attr.value as string);
            break;
          case 'karaoke_segment_end':
            result.segmentEnd = parseFloat(attr.value as string);
            break;
          case 'karaoke_song_title':
            result.songTitle = attr.value as string;
            break;
        }
      }
    }
  }

  return result;
}

/**
 * Get posts from a specific user (by wallet address or Lens account)
 * Used for profile pages to show videos from a specific creator
 */
export async function getLensUserPosts(addressOrUsername: string): Promise<LensFeedItem[]> {
  try {
    console.log('[getLensUserPosts] Fetching posts for:', addressOrUsername);
    // Use lensClient directly since getLensSession is disabled
    const clientToUse = lensClient;

    let authorAddresses: string[] = [];

    // If input looks like a hex address, it could be either a wallet address or Lens account address
    if (addressOrUsername.startsWith('0x') && addressOrUsername.length === 42) {
      // First try to use it directly as a Lens account address
      authorAddresses = [addressOrUsername];

      // Also try to fetch Lens accounts managed by this address (in case it's a wallet address)
      try {
        const accountsResult = await fetchAccountsAvailable(clientToUse, {
          managedBy: evmAddress(addressOrUsername),
          includeOwned: true
        });

        if (accountsResult.isOk() && accountsResult.value.items.length > 0) {
          const managedAddresses = accountsResult.value.items.map(item => item.account.address);
          // Add managed addresses to the list (avoiding duplicates)
          managedAddresses.forEach(addr => {
            if (!authorAddresses.includes(addr)) {
              authorAddresses.push(addr);
            }
          });
        }
      } catch (error) {
        console.warn('[getLensUserPosts] Failed to fetch managed accounts:', error);
      }
    } else {
      // Assume it's a Lens account address or username
      authorAddresses = [addressOrUsername];
    }

    console.log('[getLensUserPosts] Using author addresses:', authorAddresses);

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
    console.log('[getLensUserPosts] Found posts:', userPosts.length);


    return userPosts
      .filter(post => post && post.id)
      .map((post, index) => {
        const author = post.author || {};
        const address = author.address || 'unknown';
        const username = author.username?.value || address || `user_${index}`;
        const postTimestamp = post.timestamp || post.createdAt;
        const timestampMs = postTimestamp ? new Date(postTimestamp).getTime().toString() : Date.now().toString();
        const extractedVideoUrl = extractVideoUrl(post.metadata);
        const karaokeData = extractKaraokeData(post.metadata);
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
            // Include karaoke lyrics data
            ...karaokeData,
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

