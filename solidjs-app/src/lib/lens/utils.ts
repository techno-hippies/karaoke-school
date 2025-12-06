/**
 * Converts lens:// URI to Grove storage URL
 * Handles formats like:
 * - lens://hash
 * - lens://hash:1 (Lens protocol version/ID)
 * - glens://hash
 */
export function lensToGroveUrl(lensUri: string | null | undefined): string {
  if (!lensUri) return ''
  const lower = lensUri.toLowerCase()
  if (!lower.startsWith('lens') && !lower.startsWith('glen')) return lensUri

  // Remove lens:// prefix and any trailing :number suffix
  const hash = lensUri
    .replace(/^(lens|glens?):\/\//i, '')
    .replace(/:\d+$/, '') // Strip trailing :1, :2, etc.

  return `https://api.grove.storage/${hash}`
}

/**
 * Convert Grove/IPFS/Lens URI to HTTPS URL
 * Handles: lens://, ipfs://, ar://, and direct URLs
 */
export function convertGroveUri(uri: string | null | undefined): string {
  if (!uri) return ''

  const lower = uri.toLowerCase()

  // Handle lens:// URIs (Grove storage) - reuse existing function
  if (lower.startsWith('lens://') || lower.startsWith('glens://')) {
    return lensToGroveUrl(uri)
  }

  // Handle grove:// URIs (direct Grove storage)
  if (lower.startsWith('grove://')) {
    const hash = uri.replace(/^grove:\/\//i, '')
    return `https://api.grove.storage/${hash}`
  }

  // Handle ipfs:// URIs
  if (lower.startsWith('ipfs://')) {
    const hash = uri.replace(/^ipfs:\/\//i, '')
    return `https://ipfs.io/ipfs/${hash}`
  }

  // Handle Arweave URIs
  if (lower.startsWith('ar://')) {
    const hash = uri.replace(/^ar:\/\//i, '')
    return `https://arweave.net/${hash}`
  }

  // Already HTTP(S) or unknown scheme - return as-is
  return uri
}

/**
 * Extract URI from Lens ImageSet
 * Prefers optimized version, falls back to raw
 */
export function extractImageSetUri(imageSet: any): string | null {
  if (!imageSet) return null

  // Handle direct URI strings (backwards compatibility)
  if (typeof imageSet === 'string') {
    return imageSet
  }

  // Extract from Lens ImageSet structure
  return imageSet.optimized?.uri ?? imageSet.raw?.uri ?? null
}

/**
 * Convert Lens ImageSet to HTTPS URL
 * Combines ImageSet extraction with URI conversion
 */
export function convertLensImage(imageSet: any): string {
  const uri = extractImageSetUri(imageSet)
  return convertGroveUri(uri)
}

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
