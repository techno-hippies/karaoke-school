/**
 * Convert HLS video URL to thumbnail URL using Livepeer's thumbnail API
 * Based on: https://docs.livepeer.org/developers/guides/get-asset-thumbnail
 */

/**
 * Extract thumbnail URL from HLS video URL
 * @param hlsUrl - The HLS video URL (ends with index.m3u8)
 * @param frameIndex - Which frame to use (0 = first frame, 1 = ~3s, 2 = ~6s, etc.)
 * @returns Thumbnail image URL
 */
export function getHLSThumbnailUrl(hlsUrl: string, frameIndex: number = 0): string {
  try {
    // Example HLS URL: https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/feb4gpqlmf5e4aha/index.m3u8
    // Thumbnail URL: https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/feb4gpqlmf5e4aha/thumbnails/keyframes_0.jpg

    if (!hlsUrl || !hlsUrl.includes('.m3u8')) {
      return hlsUrl; // Return original if not HLS
    }

    // Remove the index.m3u8 and add thumbnails/keyframes_X.jpg
    const baseUrl = hlsUrl.replace('/index.m3u8', '');
    const thumbnailUrl = `${baseUrl}/thumbnails/keyframes_${frameIndex}.jpg`;

    return thumbnailUrl;
  } catch (error) {
    console.error('[getHLSThumbnailUrl] Error converting URL:', error);
    return hlsUrl; // Return original on error
  }
}

/**
 * Get multiple thumbnail URLs for scrubbing/preview
 * @param hlsUrl - The HLS video URL
 * @param count - Number of thumbnails to generate (default 3)
 * @returns Array of thumbnail URLs
 */
export function getHLSThumbnailUrls(hlsUrl: string, count: number = 3): string[] {
  const thumbnails = [];
  for (let i = 0; i < count; i++) {
    thumbnails.push(getHLSThumbnailUrl(hlsUrl, i));
  }
  return thumbnails;
}

/**
 * Check if a URL is an HLS video URL
 */
export function isHLSUrl(url: string): boolean {
  return url && url.includes('.m3u8');
}

/**
 * Extract playback ID from Livepeer HLS URL
 * @param hlsUrl - The HLS video URL
 * @returns Playback ID or null if not found
 */
export function extractPlaybackId(hlsUrl: string): string | null {
  // URL pattern: https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/feb4gpqlmf5e4aha/index.m3u8
  // Extract: feb4gpqlmf5e4aha
  const match = hlsUrl.match(/\/hls\/([^/]+)/);
  return match ? match[1] : null;
}