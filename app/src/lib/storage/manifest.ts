/**
 * Manifest Builder
 *
 * Parse URIs and build StorageManifest objects for the fallback layer.
 * Centralizes URI parsing logic so call sites just pass a URI string.
 */

import type { StorageManifest, GroveRef, ArweaveRef, LighthouseRef } from './types'

/**
 * Parse a URI and extract storage layer info
 *
 * Supported formats:
 * - lens://hash or lens://hash:1 (Grove)
 * - glens://hash (Grove)
 * - grove://hash (Grove)
 * - https://api.grove.storage/hash (Grove)
 * - ar://txId (Arweave)
 * - https://arweave.net/txId (Arweave)
 * - https://arweave.dev/txId (Arweave)
 * - ipfs://cid (IPFS/Lighthouse)
 * - https://gateway.lighthouse.storage/ipfs/cid (Lighthouse)
 * - https://ipfs.io/ipfs/cid (IPFS)
 */
export function parseUri(uri: string): {
  grove?: GroveRef
  arweave?: ArweaveRef
  lighthouse?: LighthouseRef
} | null {
  if (!uri) return null

  const lower = uri.toLowerCase()

  // Grove: lens://, glens://, grove://
  if (lower.startsWith('lens://') || lower.startsWith('glens://')) {
    const cid = uri
      .replace(/^(lens|glens?):\/\//i, '')
      .replace(/:\d+$/, '') // Strip trailing :1, :2, etc.
    return {
      grove: {
        cid,
        url: `https://api.grove.storage/${cid}`,
      },
    }
  }

  if (lower.startsWith('grove://')) {
    const cid = uri.replace(/^grove:\/\//i, '')
    return {
      grove: {
        cid,
        url: `https://api.grove.storage/${cid}`,
      },
    }
  }

  // Grove: https://api.grove.storage/hash
  if (lower.startsWith('https://api.grove.storage/')) {
    const cid = uri.replace('https://api.grove.storage/', '')
    return {
      grove: {
        cid,
        url: uri,
      },
    }
  }

  // Arweave: ar://
  if (lower.startsWith('ar://')) {
    const txId = uri.replace(/^ar:\/\//i, '')
    return {
      arweave: {
        txId,
        url: `https://arweave.dev/${txId}`, // Use fastest gateway
      },
    }
  }

  // Arweave: https://arweave.net/, arweave.dev/, ar-io.net/, etc.
  const arweaveMatch = uri.match(/^https:\/\/(arweave\.net|arweave\.dev|ar-io\.net|ar-io\.dev|g8way\.io)\/([a-zA-Z0-9_-]{43})/)
  if (arweaveMatch) {
    const txId = arweaveMatch[2]
    return {
      arweave: {
        txId,
        url: `https://arweave.dev/${txId}`,
      },
    }
  }

  // IPFS: ipfs://
  if (lower.startsWith('ipfs://')) {
    const cid = uri.replace(/^ipfs:\/\//i, '')
    return {
      lighthouse: {
        cid,
        url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
      },
    }
  }

  // IPFS: https://...ipfs/cid
  const ipfsMatch = uri.match(/\/ipfs\/([a-zA-Z0-9]+)/)
  if (ipfsMatch) {
    const cid = ipfsMatch[1]
    return {
      lighthouse: {
        cid,
        url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
      },
    }
  }

  // Unknown - treat as Grove URL if it's HTTPS
  if (lower.startsWith('https://')) {
    // Extract last path segment as potential CID
    const parts = uri.split('/')
    const cid = parts[parts.length - 1]
    if (cid && cid.length > 20) {
      return {
        grove: {
          cid,
          url: uri,
        },
      }
    }
  }

  return null
}

/**
 * Build a StorageManifest from a single URI
 *
 * Use this when you only have one URI (e.g., from Lens metadata)
 */
export function buildManifest(uri: string): StorageManifest {
  const parsed = parseUri(uri)
  return parsed ?? {}
}

/**
 * Build a StorageManifest from multiple known URIs
 *
 * Use this when you have URIs from different layers (e.g., from clip metadata)
 */
export function buildManifestFromUrls(urls: {
  grove?: string
  arweave?: string
  lighthouse?: string
}): StorageManifest {
  const manifest: StorageManifest = {}

  if (urls.grove) {
    const parsed = parseUri(urls.grove)
    if (parsed?.grove) manifest.grove = parsed.grove
  }

  if (urls.arweave) {
    const parsed = parseUri(urls.arweave)
    if (parsed?.arweave) manifest.arweave = parsed.arweave
  }

  if (urls.lighthouse) {
    const parsed = parseUri(urls.lighthouse)
    if (parsed?.lighthouse) manifest.lighthouse = parsed.lighthouse
  }

  return manifest
}

/**
 * Build a StorageManifest from clip metadata structure
 *
 * Clip metadata from Grove contains:
 * - Direct Grove URL (the metadata URI itself)
 * - Optional storage_manifest with arweave/lighthouse refs
 */
export function buildManifestFromClipMeta(
  metadataUri: string,
  storageManifest?: {
    grove?: { cid: string; url: string }
    arweave?: { txId: string; url: string }
    lighthouse?: { cid: string; url: string }
  }
): StorageManifest {
  // Start with the direct URI
  const manifest = buildManifest(metadataUri)

  // Merge in storage manifest if provided
  if (storageManifest) {
    if (storageManifest.grove) {
      manifest.grove = storageManifest.grove
    }
    if (storageManifest.arweave) {
      manifest.arweave = storageManifest.arweave
    }
    if (storageManifest.lighthouse) {
      manifest.lighthouse = storageManifest.lighthouse
    }
  }

  return manifest
}

/**
 * Check if a manifest has at least one valid storage reference
 */
export function isValidManifest(manifest: StorageManifest): boolean {
  return !!(manifest.grove?.url || manifest.arweave?.txId || manifest.lighthouse?.cid)
}

/**
 * Get a simple URL from a manifest (for backwards compatibility)
 * Prefers Grove, then Arweave, then Lighthouse
 *
 * @deprecated Use fetchWithFallback for resilient fetching
 */
export function getSimpleUrl(manifest: StorageManifest): string | null {
  if (manifest.grove?.url) return manifest.grove.url
  if (manifest.arweave?.url) return manifest.arweave.url
  if (manifest.lighthouse?.url) return manifest.lighthouse.url
  return null
}
