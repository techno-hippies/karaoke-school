import { chains } from "@lens-chain/sdk/viem";
import { immutable, lensAccountOnly, StorageClient } from "@lens-chain/storage-client";
import { getLensSession } from "./sessionClient";

// Storage client singleton
let storageClient: StorageClient | null = null;

/**
 * Get or create the Grove storage client
 */
export function getStorageClient(): StorageClient {
  if (!storageClient) {
    // Create storage client as shown in documentation
    storageClient = StorageClient.create();
  }
  return storageClient;
}

/**
 * Get the appropriate ACL configuration based on authentication state
 * Uses Lens Account ACL if authenticated, otherwise immutable
 */
export function getACLConfig() {
  const sessionClient = getLensSession();

  if (sessionClient && sessionClient.account) {
    console.log('[Storage] Using Lens Account ACL for authenticated user:', sessionClient.account.address);

    // Use Lens Account ACL - allows the authenticated account to edit/delete
    return lensAccountOnly(
      sessionClient.account.address, // Lens Account Address
      chains.testnet.id, // Use testnet for now
    );
  } else {
    console.log('[Storage] Using immutable ACL for unauthenticated user');

    // Use immutable ACL - content cannot be edited or deleted
    return immutable(chains.testnet.id);
  }
}

/**
 * Upload a video file to Grove storage
 * Returns the storage URI that can be used in Lens posts
 */
export async function uploadVideoToGrove(videoBlob: Blob): Promise<{
  uri: string;
  gatewayUrl: string;
  storageKey: string;
}> {
  try {
    console.log('[Storage] Uploading video blob to Grove:', {
      size: videoBlob.size,
      type: videoBlob.type
    });

    const storage = getStorageClient();
    const acl = getACLConfig();

    // Convert blob to File for upload
    const videoFile = new File([videoBlob], 'karaoke-video.webm', {
      type: videoBlob.type || 'video/webm'
    });

    const response = await storage.uploadFile(videoFile, { acl });

    console.log('[Storage] Video upload successful:', {
      uri: response.uri,
      gatewayUrl: response.gatewayUrl,
      storageKey: response.storageKey
    });

    return {
      uri: response.uri,
      gatewayUrl: response.gatewayUrl,
      storageKey: response.storageKey
    };
  } catch (error) {
    console.error('[Storage] Video upload failed:', error);
    throw new Error(`Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload JSON metadata to Grove storage
 * Used for Lens post metadata
 */
export async function uploadMetadataToGrove(metadata: Record<string, unknown>): Promise<{
  uri: string;
  gatewayUrl: string;
  storageKey: string;
}> {
  try {
    console.log('[Storage] Uploading metadata to Grove:', metadata);

    const storage = getStorageClient();
    const acl = getACLConfig();

    const response = await storage.uploadAsJson(metadata, { acl });

    console.log('[Storage] Metadata upload successful:', {
      uri: response.uri,
      gatewayUrl: response.gatewayUrl,
      storageKey: response.storageKey
    });

    return {
      uri: response.uri,
      gatewayUrl: response.gatewayUrl,
      storageKey: response.storageKey
    };
  } catch (error) {
    console.error('[Storage] Metadata upload failed:', error);
    throw new Error(`Failed to upload metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload both video and metadata for a karaoke post
 * Returns the metadata URI that should be used for the Lens post
 */
export async function uploadKaraokePost(
  videoBlob: Blob,
  metadata: Record<string, unknown>,
  onProgress?: (stage: 'video' | 'metadata', progress: number) => void
): Promise<{
  metadataUri: string;
  videoUri: string;
  metadataGatewayUrl: string;
  videoGatewayUrl: string;
}> {
  try {
    // Step 1: Upload video file
    onProgress?.('video', 0.1);
    console.log('[Storage] Starting karaoke post upload - uploading video...');

    const videoResult = await uploadVideoToGrove(videoBlob);
    onProgress?.('video', 1.0);

    // Step 2: Update metadata with video URI and upload
    onProgress?.('metadata', 0.1);
    console.log('[Storage] Video uploaded, now uploading metadata...');

    const metadataWithVideo = {
      ...metadata,
      video: {
        ...metadata.video,
        item: videoResult.uri // Use Grove URI for video
      }
    };

    const metadataResult = await uploadMetadataToGrove(metadataWithVideo);
    onProgress?.('metadata', 1.0);

    console.log('[Storage] Karaoke post upload complete:', {
      metadataUri: metadataResult.uri,
      videoUri: videoResult.uri
    });

    return {
      metadataUri: metadataResult.uri,
      videoUri: videoResult.uri,
      metadataGatewayUrl: metadataResult.gatewayUrl,
      videoGatewayUrl: videoResult.gatewayUrl
    };
  } catch (error) {
    console.error('[Storage] Karaoke post upload failed:', error);
    throw error;
  }
}

/**
 * Check the propagation status of uploaded content
 * Useful for ensuring content is fully persisted before creating Lens posts
 */
export async function waitForPropagation(storageKey: string): Promise<void> {
  try {
    console.log('[Storage] Waiting for content propagation:', storageKey);

    // const storage = getStorageClient();

    // Poll the status endpoint until content is propagated
    let attempts = 0;
    const maxAttempts = 10;
    const delayMs = 1000;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`https://api.grove.storage/status/${storageKey}`);
        const status = await response.json();

        if (status.propagated || status.status === 'persisted') {
          console.log('[Storage] Content propagation complete');
          return;
        }

        console.log('[Storage] Content still propagating, waiting...', status);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        attempts++;
      } catch (error) {
        console.warn('[Storage] Error checking propagation status:', error);
        attempts++;
      }
    }

    console.warn('[Storage] Propagation check timed out, proceeding anyway');
  } catch (error) {
    console.error('[Storage] Propagation check failed:', error);
    // Don't throw - proceed with post creation even if we can't verify propagation
  }
}