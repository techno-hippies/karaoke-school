import { video, MediaVideoMimeType, MetadataLicenseType } from "@lens-protocol/metadata";
import { post } from "@lens-protocol/client/actions";
import { uri } from "@lens-protocol/client";
import { getLensSession, createLensSessionWithWallet, isLensAuthenticated } from "./sessionClient";
import { uploadKaraokePost, waitForPropagation } from "./storage";
import type { WalletClient } from "viem";

export interface KaraokePostData {
  videoBlob: Blob;
  caption: string;
  songId: string;
  songTitle?: string;
  segment: {
    start: number;
    end: number;
    lyrics: any[];
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
  onProgress?: (progress: PostProgress) => void
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

    // Step 2: Determine video duration and MIME type
    const segmentDuration = Math.round((postData.segment.end - postData.segment.start) * 1000); // Convert to milliseconds
    const mimeType = postData.videoBlob.type || 'video/webm';
    const videoMimeType = mimeType.includes('mp4') ? MediaVideoMimeType.MP4 : MediaVideoMimeType.WEBM;

    // Step 3: Create video metadata
    onProgress?.({
      stage: 'uploading_video',
      progress: 0.1,
      message: 'Preparing video metadata...'
    });

    const videoMetadata = video({
      title: `Karaoke: ${postData.songTitle || 'Song Performance'}`,
      video: {
        item: '', // Will be filled by uploadKaraokePost
        type: videoMimeType,
        duration: segmentDuration,
        altTag: `Karaoke performance of ${postData.songTitle || 'a song'}`,
        license: MetadataLicenseType.CCO,
      },
      content: postData.caption || `🎤 Karaoke performance! ${postData.songTitle ? `Singing "${postData.songTitle}"` : ''}`,
      attributes: [
        {
          key: 'app_type',
          value: 'karaoke'
        },
        {
          key: 'karaoke_song_id',
          value: postData.songId
        },
        {
          key: 'karaoke_segment_start',
          value: postData.segment.start.toString()
        },
        {
          key: 'karaoke_segment_end',
          value: postData.segment.end.toString()
        },
        {
          key: 'karaoke_duration',
          value: segmentDuration.toString()
        },
        ...(postData.songTitle ? [{
          key: 'karaoke_song_title',
          value: postData.songTitle
        }] : [])
      ]
    });

    console.log('[KaraokePost] Created video metadata:', videoMetadata);

    // Step 4: Upload video and metadata to Grove
    const uploadResult = await uploadKaraokePost(
      postData.videoBlob,
      videoMetadata,
      (stage, progress) => {
        const stageMessages = {
          video: 'Uploading video to storage...',
          metadata: 'Uploading metadata to storage...'
        };

        onProgress?.({
          stage: stage === 'video' ? 'uploading_video' : 'uploading_metadata',
          progress: progress,
          message: stageMessages[stage]
        });
      }
    );

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

    onProgress?.({
      stage: 'creating_post',
      progress: 0.9,
      message: 'Post created, finalizing...'
    });

    // Note: We can't easily get the post ID from the result in this SDK version
    // The post creation is async and the ID is generated on-chain
    const postId = 'pending'; // Placeholder - in production you'd track the transaction

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
  return isLensAuthenticated() && !!sessionClient?.account;
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