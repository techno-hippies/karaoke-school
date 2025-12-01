/**
 * Lens Protocol Service
 *
 * Post content to Lens Protocol via SDK with proper auth.
 */

import { createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { LENS_APP_ADDRESS, PRIVATE_KEY } from '../config';
import type { LensPostResult } from '../types';

/**
 * Create Lens post metadata using v3 schema
 * Note: Lens v3 uses "raw" for text content, not "content"
 */
export async function createPostMetadata(params: {
  content: string;
  title?: string;
  tags?: string[];
  videoUrl?: string;
  audioUrl?: string;
  imageUrl?: string;
  coverImageUrl?: string;
  // Song linking - slugs are primary (for clean URLs)
  artistSlug?: string;
  songSlug?: string;
  songName?: string;
  artistName?: string;
  albumArt?: string;
  // Legacy identifiers (for backwards compatibility)
  spotifyTrackId?: string;
  // Content tags for AI chat context (psychographics)
  visualTags?: string[]; // Video visuals: death-note, cosplay, anime
  lyricTags?: string[];  // Lyric themes: empowerment, heartbreak
}): Promise<Record<string, unknown>> {
  // Build attributes array for song linking
  const attributes: Array<{ key: string; type: string; value: string }> = [];

  // Primary: slugs for clean URL routing (e.g., /eminem/lose-yourself)
  if (params.artistSlug) {
    attributes.push({ key: 'artist_slug', type: 'String', value: params.artistSlug });
  }
  if (params.songSlug) {
    attributes.push({ key: 'song_slug', type: 'String', value: params.songSlug });
  }
  // Display info
  if (params.songName) {
    attributes.push({ key: 'song_name', type: 'String', value: params.songName });
  }
  if (params.artistName) {
    attributes.push({ key: 'artist_name', type: 'String', value: params.artistName });
  }
  if (params.albumArt) {
    attributes.push({ key: 'album_art', type: 'String', value: params.albumArt });
  }
  // Legacy: keep spotify_track_id for backwards compatibility
  if (params.spotifyTrackId) {
    attributes.push({ key: 'spotify_track_id', type: 'String', value: params.spotifyTrackId });
  }

  // Content tags for AI chat context (psychographics)
  if (params.visualTags && params.visualTags.length > 0) {
    attributes.push({ key: 'visual_tags', type: 'String', value: params.visualTags.join(',') });
  }
  if (params.lyricTags && params.lyricTags.length > 0) {
    attributes.push({ key: 'lyric_tags', type: 'String', value: params.lyricTags.join(',') });
  }

  // Use posts/ schema (not publications/) for Lens v3
  if (params.videoUrl) {
    return {
      $schema: 'https://json-schemas.lens.dev/posts/video/3.0.0.json',
      lens: {
        id: crypto.randomUUID(),
        locale: 'en',
        mainContentFocus: 'VIDEO',
        title: params.title,
        tags: params.tags || [],
        video: {
          item: params.videoUrl,
          type: 'video/mp4',
          cover: params.coverImageUrl,
        },
        content: params.content,
        attributes: attributes.length > 0 ? attributes : undefined,
      },
    };
  }

  return {
    $schema: 'https://json-schemas.lens.dev/posts/text-only/3.0.0.json',
    lens: {
      id: crypto.randomUUID(),
      locale: 'en',
      mainContentFocus: 'TEXT_ONLY',
      tags: params.tags || [],
      content: params.content,
      attributes: attributes.length > 0 ? attributes : undefined,
    },
  };
}

/**
 * Post to Lens Protocol using SDK with proper auth
 *
 * @param accountAddress - The Lens account address (posting as)
 * @param metadataUri - URI to the post metadata (grove://)
 * @param signerPrivateKey - Private key to sign the transaction
 * @returns Post result with transaction hash
 */
export async function postToLens(
  accountAddress: Address,
  metadataUri: string,
  signerPrivateKey?: Hex
): Promise<LensPostResult> {
  const privateKey = signerPrivateKey || (PRIVATE_KEY as Hex);
  if (!privateKey) {
    throw new Error('No private key configured');
  }

  // Dynamic imports for Lens SDK
  const { PublicClient } = await import('@lens-protocol/client');
  const { staging } = await import('@lens-protocol/env');
  const { evmAddress } = await import('@lens-protocol/client');
  const { signMessageWith, handleOperationWith } = await import('@lens-protocol/client/viem');
  const { post: createPostAction } = await import('@lens-protocol/client/actions');
  const { chains } = await import('@lens-chain/sdk/viem');

  // Create wallet client
  let formattedKey = privateKey;
  if (!formattedKey.startsWith('0x')) {
    formattedKey = `0x${formattedKey}` as Hex;
  }

  const walletAccount = privateKeyToAccount(formattedKey as `0x${string}`);
  const walletClient = createWalletClient({
    account: walletAccount,
    chain: chains.testnet,
    transport: http(),
  });

  // Create Lens client
  const lensClient = PublicClient.create({
    environment: staging,
    origin: 'http://localhost:3000',
  });

  // Login as account owner
  console.log('   🔐 Authenticating as account owner...');
  const authenticated = await lensClient.login({
    accountOwner: {
      account: evmAddress(accountAddress),
      owner: evmAddress(walletAccount.address),
      app: evmAddress(LENS_APP_ADDRESS),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (authenticated.isErr()) {
    throw new Error(`Lens login failed: ${authenticated.error.message}`);
  }

  const sessionClient = authenticated.value;
  console.log('   ✓ Authenticated');

  // Create post
  console.log('   📝 Creating post...');
  const operationResult = await createPostAction(sessionClient, {
    contentUri: metadataUri,
  }).andThen(handleOperationWith(walletClient));

  if (operationResult.isErr()) {
    throw new Error(`Post creation failed: ${operationResult.error.message}`);
  }

  const txHash = operationResult.value as Hex;
  console.log(`   📡 Transaction: ${txHash}`);

  // Wait for transaction
  const waitResult = await sessionClient.waitForTransaction(txHash as any);

  if (waitResult.isErr()) {
    const message = waitResult.error.message || 'Unknown error';
    if (!message.includes('Timeout')) {
      throw new Error(`Transaction failed: ${message}`);
    }
    console.log('   ⚠️  Timeout waiting, but transaction may have succeeded');
  }

  // Fetch the actual post ID from Lens API (different from tx hash)
  let actualPostId = txHash;
  try {
    const response = await fetch('https://api.staging.lens.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query { post(request: { txHash: "${txHash}" }) { ... on Post { id } } }`,
      }),
    });
    const data = await response.json() as { data?: { post?: { id?: string } } };
    if (data.data?.post?.id) {
      actualPostId = data.data.post.id as Hex;
      console.log(`   📋 Post ID: ${actualPostId}`);
    }
  } catch (e) {
    console.log('   ⚠️  Could not fetch post ID, using tx hash');
  }

  return {
    postId: actualPostId,
    metadataUri,
    transactionHash: txHash,
  };
}

/**
 * Get Lens account info
 */
export async function getLensAccountInfo(accountAddress: Address): Promise<{
  handle: string;
  id: string;
} | null> {
  // This would query the Lens API for account details
  // For now, return null (implement when needed)
  return null;
}
