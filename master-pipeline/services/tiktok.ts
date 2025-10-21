/**
 * TikTok Utility Functions
 *
 * Extract metadata from TikTok URLs
 */

/**
 * Extract TikTok music ID from music page URL
 *
 * Examples:
 * - https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891
 * - https://www.tiktok.com/music/original-sound-1234567890
 *
 * @param url TikTok music page URL
 * @returns TikTok music ID (numeric string)
 */
export function extractTikTokMusicId(url: string): string {
  // Match pattern: /music/{slug}-{numeric-id}
  // The slug can contain hyphens, so we match the LAST sequence of digits
  const match = url.match(/\/music\/.+-(\d+)$/);

  if (!match || !match[1]) {
    throw new Error(`Invalid TikTok music URL: ${url}\nExpected format: https://www.tiktok.com/music/{name}-{id}`);
  }

  return match[1];
}

/**
 * Extract TikTok music slug from URL
 *
 * @param url TikTok music page URL
 * @returns Music slug (e.g., "TEXAS-HOLDEM")
 */
export function extractTikTokMusicSlug(url: string): string {
  // Match everything between /music/ and the last -{digits}
  const match = url.match(/\/music\/(.+)-\d+$/);

  if (!match || !match[1]) {
    throw new Error(`Invalid TikTok music URL: ${url}`);
  }

  return match[1];
}

/**
 * Validate TikTok music URL format
 *
 * @param url TikTok music page URL
 * @returns true if valid
 */
export function isValidTikTokMusicUrl(url: string): boolean {
  return /^https:\/\/www\.tiktok\.com\/music\/[^-]+-\d+/.test(url);
}
