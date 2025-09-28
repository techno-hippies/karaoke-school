import { video, MediaVideoMimeType, MetadataLicenseType } from "@lens-protocol/metadata";
import { post } from "@lens-protocol/client/actions";
import { uri } from "@lens-protocol/client";
import { getLensSession, createLensSessionWithWallet, isLensAuthenticated } from "./session";
import { /* uploadKaraokePost, */ uploadVideoToGrove, uploadMetadataToGrove, waitForPropagation } from "./storage";
import type { WalletClient } from "viem";

// Your Custom Feed address
export const KARAOKE_FEED_ADDRESS = '0x01426d97B8d2e021cd5CF57cbbB2851bb355942D';

export interface KaraokePostData {
  videoBlob: Blob;
  caption: string;
  songId: string;
  songTitle?: string;
  segment: {
    start: number;
    end: number;
    lyrics: Array<{ text: string; timestamp: number }>;
  };
}

export interface PostProgress {
  stage: 'authenticating' | 'uploading_video' | 'uploading_metadata' | 'creating_post' | 'completed';
  progress: number; // 0-1
  message: string;
}

/**
 * Create a karaoke video post on Lens Protocol
 * Handles authentication, video upload, metadata creation, and post creation
 */
export async function createKaraokePost(
  postData: KaraokePostData,
  walletClient?: WalletClient,
  walletAddress?: string,
  onProgress?: (progress: PostProgress) => void,
  sessionClientFromReact?: any // Accept session client from React context
): Promise<{ postId: string; metadataUri: string; videoUri: string }> {
  try {
    // Step 1: Authentication
    onProgress?.({
      stage: 'authenticating',
      progress: 0.1,
      message: 'Checking Lens authentication...'
    });

    let sessionClient = getLensSession();

    if (!sessionClient && walletClient && walletAddress) {
      onProgress?.({
        stage: 'authenticating',
        progress: 0.5,
        message: 'Creating Lens session...'
      });

      sessionClient = await createLensSessionWithWallet(walletClient, walletAddress);
      if (!sessionClient) {
        throw new Error('Failed to create Lens session. Please ensure you have a Lens account.');
      }
    }

    if (!sessionClient) {
      throw new Error('No Lens authentication available. Please connect your wallet and create a Lens account.');
    }

    onProgress?.({
      stage: 'authenticating',
      progress: 1.0,
      message: 'Authentication successful'
    });

    // Step 2: Upload video to Grove first
    onProgress?.({
      stage: 'uploading_video',
      progress: 0.1,
      message: 'Uploading video to storage...'
    });

    const videoResult = await uploadVideoToGrove(postData.videoBlob);
    onProgress?.({
      stage: 'uploading_video',
      progress: 1.0,
      message: 'Video uploaded successfully'
    });

    // Step 3: Create video metadata with real video URI
    onProgress?.({
      stage: 'uploading_metadata',
      progress: 0.1,
      message: 'Creating video metadata...'
    });

    const segmentDuration = Math.round((postData.segment.end - postData.segment.start) * 1000);
    const mimeType = postData.videoBlob.type || 'video/webm';
    const videoMimeType = mimeType.includes('mp4') ? MediaVideoMimeType.MP4 : MediaVideoMimeType.WEBM;

    const videoMetadata = video({
      title: `Karaoke: ${postData.songTitle || 'Song Performance'}`,
      video: {
        item: videoResult.uri, // Use the real video URI from Grove
        type: videoMimeType,
        duration: segmentDuration,
        altTag: `Karaoke performance of ${postData.songTitle || 'a song'}`,
        license: MetadataLicenseType.CCO,
      },
      content: postData.caption || `🎤 Karaoke performance! ${postData.songTitle ? `Singing "${postData.songTitle}"` : ''}`,
      attributes: [
        {
          key: 'app_type',
          value: 'karaoke',
          type: 'String'
        },
        {
          key: 'karaoke_song_id',
          value: postData.songId,
          type: 'String'
        },
        {
          key: 'video_gateway_url',
          value: videoResult.gatewayUrl,
          type: 'String'
        },
        {
          key: 'karaoke_segment_start',
          value: postData.segment.start.toString(),
          type: 'String'
        },
        {
          key: 'karaoke_segment_end',
          value: postData.segment.end.toString(),
          type: 'String'
        },
        {
          key: 'karaoke_duration',
          value: segmentDuration.toString(),
          type: 'String'
        },
        ...(postData.songTitle ? [{
          key: 'karaoke_song_title',
          value: postData.songTitle,
          type: 'String'
        }] : [])
      ]
    });

    console.log('[KaraokePost] Created video metadata with video URI:', videoMetadata);

    // Step 4: Upload metadata to Grove
    const metadataResult = await uploadMetadataToGrove(videoMetadata);
    onProgress?.({
      stage: 'uploading_metadata',
      progress: 1.0,
      message: 'Metadata uploaded successfully'
    });

    const uploadResult = {
      metadataUri: metadataResult.uri,
      videoUri: videoResult.uri,
      metadataGatewayUrl: metadataResult.gatewayUrl,
      videoGatewayUrl: videoResult.gatewayUrl
    };

    // Step 5: Wait for content propagation (optional but recommended)
    onProgress?.({
      stage: 'uploading_metadata',
      progress: 0.9,
      message: 'Waiting for content propagation...'
    });

    // Extract storage key from URI for propagation check
    const metadataStorageKey = uploadResult.metadataUri.replace('lens://', '');
    await waitForPropagation(metadataStorageKey);

    // Step 6: Create Lens post
    onProgress?.({
      stage: 'creating_post',
      progress: 0.1,
      message: 'Creating Lens post...'
    });

    const postResult = await post(sessionClient, {
      contentUri: uri(uploadResult.metadataUri)
    });

    if (postResult.isErr()) {
      console.error('[KaraokePost] Post creation failed:', postResult.error);
      throw new Error(`Failed to create Lens post: ${postResult.error?.message || 'Unknown error'}`);
    }

    const postResultData = postResult.value;
    console.log('[KaraokePost] 🎉 Post creation successful!');
    console.log('[KaraokePost] 📝 Post details:', {
      author: sessionClient.account?.address,
      hasAccount: !!sessionClient.account,
      appId: sessionClient.account?.app || 'NOT_TAGGED',
      metadataUri: uploadResult.metadataUri,
      expectedInFeedQuery: `apps: ["${sessionClient.account?.app || 'MISSING_APP_ID'}"]`
    });
    console.log('[KaraokePost] 📱 To verify post appears in feed, check if it matches app filter');

    if (!sessionClient.account) {
      console.error('[KaraokePost] ⚠️ WARNING: sessionClient.account is undefined! Post may not appear in feed.');
      console.error('[KaraokePost] 💡 Solution: Fix account switching in resumeLensSession()');
      console.error('[KaraokePost] 🔍 Debug: Run console.log(getLensSession().account) to verify');
      console.error('[KaraokePost] 🛠️ Fix: Clear localStorage and reconnect wallet');
    }
    console.log('[KaraokePost] Raw post result:', postResultData);

    onProgress?.({
      stage: 'creating_post',
      progress: 0.9,
      message: 'Post created, finalizing...'
    });

    // Extract transaction hash and post ID from result
    const txHash = postResultData.hash || postResultData.txHash || 'unknown';
    const postId = postResultData.id || txHash;

    onProgress?.({
      stage: 'completed',
      progress: 1.0,
      message: 'Karaoke post created successfully!'
    });

    console.log('[KaraokePost] Post creation successful:', {
      postId,
      metadataUri: uploadResult.metadataUri,
      videoUri: uploadResult.videoUri
    });

    return {
      postId,
      metadataUri: uploadResult.metadataUri,
      videoUri: uploadResult.videoUri
    };

  } catch (error) {
    console.error('[KaraokePost] Post creation failed:', error);
    throw error;
  }
}

/**
 * Check if the user can create posts (has authentication and account)
 */
export function canCreatePosts(): boolean {
  const sessionClient = getLensSession();
  const hasAuth = isLensAuthenticated();
  const hasSession = !!sessionClient;

  // Posts can be created as long as we have a session client
  // Account attachment is optional - posts will still be created
  return hasAuth && hasSession;
}

/**
 * Get user's Lens account info if authenticated
 */
export function getLensAccountInfo(): { address: string; username?: string } | null {
  const sessionClient = getLensSession();

  if (!sessionClient?.account) {
    return null;
  }

  return {
    address: sessionClient.account.address,
    username: sessionClient.account.username?.value
  };
}