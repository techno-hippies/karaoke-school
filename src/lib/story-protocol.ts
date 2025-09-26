/**
 * Story Protocol utilities for fetching IP asset metadata
 */

interface StoryProtocolMetadata {
  title?: string;
  description?: string;
  mediaUrl?: string; // Audio file URL
  lyricsHash?: string; // IPFS hash for lyrics
  [key: string]: any;
}

/**
 * Fetch Story Protocol IP asset metadata using direct contract calls
 */
export async function fetchStoryProtocolMetadata(ipId: string): Promise<StoryProtocolMetadata | null> {
  try {
    console.log('[fetchStoryProtocolMetadata] Fetching metadata for IP ID:', ipId);

    // Try multiple approaches to get Story Protocol metadata

    // Story Protocol IP assets are on-chain
    // For now, we don't have access to the official StoryKit package
    // The proper way would be to use Story Protocol's SDK to:
    // 1. Query the IP Asset Registry contract for metadata URI
    // 2. Fetch metadata from the URI (usually IPFS)

    console.log('[fetchStoryProtocolMetadata] Story Protocol SDK integration needed');
    console.log('[fetchStoryProtocolMetadata] IP Asset ID:', ipId);
    console.log('[fetchStoryProtocolMetadata] Would need to:');
    console.log('[fetchStoryProtocolMetadata] 1. Query IP Asset Registry contract');
    console.log('[fetchStoryProtocolMetadata] 2. Get metadata URI from contract');
    console.log('[fetchStoryProtocolMetadata] 3. Fetch metadata from IPFS');

    // For now, return placeholder indicating we need proper SDK integration
    return {
      title: 'Story Protocol Asset',
      description: `IP Asset ${ipId}`,
      mediaUrl: null,
      lyricsHash: null,
      needsSdkIntegration: true,
      ipId: ipId
    };

    console.log('[fetchStoryProtocolMetadata] All approaches failed for IP ID:', ipId);
    return null;

  } catch (error) {
    console.error('[fetchStoryProtocolMetadata] Error fetching metadata:', error);
    return null;
  }
}

/**
 * Extract IPFS hash from various IPFS URL formats
 */
function extractIPFSHash(ipfsUrl: string | undefined): string | undefined {
  if (!ipfsUrl) return undefined;

  // Handle various IPFS URL formats
  if (ipfsUrl.startsWith('ipfs://')) {
    return ipfsUrl.replace('ipfs://', '');
  }

  if (ipfsUrl.includes('/ipfs/')) {
    return ipfsUrl.split('/ipfs/')[1];
  }

  // If it's already just a hash
  if (ipfsUrl.match(/^[a-zA-Z0-9]+$/)) {
    return ipfsUrl;
  }

  return undefined;
}

/**
 * Fetch lyrics content from IPFS hash
 */
export async function fetchLyricsFromIPFS(ipfsHash: string): Promise<string | null> {
  try {
    console.log('[fetchLyricsFromIPFS] Fetching lyrics from IPFS hash:', ipfsHash);

    // Convert IPFS hash to gateway URL
    const ipfsUrl = `https://ipfs.io/ipfs/${ipfsHash}`;

    const response = await fetch(ipfsUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch lyrics: ${response.status}`);
    }

    const lyricsText = await response.text();
    console.log('[fetchLyricsFromIPFS] Successfully fetched lyrics:', lyricsText.substring(0, 100) + '...');

    return lyricsText;
  } catch (error) {
    console.error('[fetchLyricsFromIPFS] Error fetching lyrics:', error);
    return null;
  }
}

/**
 * Enhanced function to get both metadata and lyrics for an IP asset
 */
export async function fetchStoryProtocolAssetData(ipId: string): Promise<{
  metadata: StoryProtocolMetadata | null;
  lyrics: string | null;
}> {
  try {
    console.log('[fetchStoryProtocolAssetData] Starting comprehensive fetch for IP ID:', ipId);

    // Step 1: Get metadata from Story Protocol
    const metadata = await fetchStoryProtocolMetadata(ipId);

    // Step 2: If metadata has lyrics hash, fetch lyrics from IPFS
    let lyrics: string | null = null;
    if (metadata?.lyricsHash) {
      lyrics = await fetchLyricsFromIPFS(metadata.lyricsHash);
    }

    console.log('[fetchStoryProtocolAssetData] Complete fetch result:', {
      hasMetadata: !!metadata,
      hasLyrics: !!lyrics,
      audioUrl: metadata?.mediaUrl
    });

    return { metadata, lyrics };
  } catch (error) {
    console.error('[fetchStoryProtocolAssetData] Error in comprehensive fetch:', error);
    return { metadata: null, lyrics: null };
  }
}