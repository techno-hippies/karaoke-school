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

/**
 * Fetch metadata from Grove/IPFS storage
 */
export async function fetchGroveMetadata<T = any>(uri: string): Promise<T | null> {
  try {
    const url = convertGroveUri(uri)
    if (!url) return null

    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Failed to fetch Grove metadata from ${url}: ${response.statusText}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to fetch Grove metadata:', error)
    return null
  }
}
