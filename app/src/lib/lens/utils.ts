/**
 * Parse video metadata attributes into typed object
 */
export interface VideoMetadata {
  videoHash?: string
  tiktokVideoId?: string
  tiktokUrl?: string
  songTitle?: string
  songArtist?: string
  geniusId?: string
  spotifyId?: string
  vocalsUri?: string
  instrumentalUri?: string
  thumbnailUri?: string
  storyIpId?: string
  storyLicenseTerms?: string
  [key: string]: string | undefined
}

export function parseVideoMetadata(
  attributes: Array<{ key: string; value: string }> | null | undefined
): VideoMetadata {
  if (!attributes) return {}

  return attributes.reduce((acc, attr) => {
    acc[attr.key] = attr.value
    return acc
  }, {} as VideoMetadata)
}

/**
 * Format large numbers into human-readable format
 * 1000 → "1K", 1000000 → "1M", etc.
 */
export function formatNumber(num: number | string | null | undefined): string {
  if (num == null) return '0'

  const value = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(value)) return '0'

  const absValue = Math.abs(value)

  if (absValue >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
  }
  if (absValue >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (absValue >= 1_000) {
    return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  }

  return value.toString()
}
