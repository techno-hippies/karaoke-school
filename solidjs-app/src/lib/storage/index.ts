/**
 * Storage Layer - Public API
 *
 * Censorship-resistant multi-gateway storage with caching.
 *
 * Usage:
 *   import { fetchContent, buildManifest } from '@/lib/storage'
 *
 *   // Simple: fetch from a URI with automatic fallback
 *   const manifest = buildManifest(metadataUri)
 *   const response = await fetchContent(manifest)
 *   const data = await response.json()
 *
 *   // With options
 *   const response = await fetchContent(manifest, {
 *     timeout: 5000,
 *     skipCache: true,
 *   })
 *
 *   // Get URL for audio elements (no fetch, just URL string)
 *   const audioUrl = getBestUrl(manifest)
 */

import { fetchWithFallback, getBestUrl, getCacheKey } from './fallback'
import type { StorageManifest, FetchOptions, FetchResult } from './types'

// Re-export types
export type {
  StorageManifest,
  StorageLayer,
  FetchResult,
  FetchOptions,
  GatewayError,
  GroveRef,
  ArweaveRef,
  LighthouseRef,
} from './types'

// Re-export manifest builders
export {
  buildManifest,
  buildManifestFromUrls,
  buildManifestFromClipMeta,
  parseUri,
  isValidManifest,
  getSimpleUrl,
} from './manifest'

// Re-export config for debugging/ops
export { STORAGE_CONFIG, getArweaveUrls, getIpfsUrls } from './config'

// Re-export cache utilities
export {
  getCached,
  setCache,
  deleteCache,
  clearCache,
  getCacheStats,
} from './cache'

// Re-export fallback utilities
export { getBestUrl, getCacheKey }

/**
 * Fetch content with multi-gateway fallback and caching
 *
 * Fallback order (cost-optimized):
 * 1. Cache (free, instant)
 * 2. Grove (free egress, fast CDN)
 * 3. Arweave (free egress forever, multiple gateways)
 * 4. Akash IPFS (free egress, you control)
 * 5. Lighthouse (paid egress, last resort)
 *
 * @param manifest - Storage manifest with layer references
 * @param options - Fetch options (timeout, skipCache, noStore)
 * @returns Response object
 * @throws Error if all gateways fail
 */
export async function fetchContent(
  manifest: StorageManifest,
  options?: FetchOptions
): Promise<Response> {
  const result = await fetchWithFallback(manifest, options)
  return result.response
}

/**
 * Fetch content with metadata about which gateway succeeded
 *
 * Same as fetchContent but returns FetchResult with source info.
 * Useful for debugging and monitoring.
 */
export async function fetchContentWithMeta(
  manifest: StorageManifest,
  options?: FetchOptions
): Promise<FetchResult> {
  return fetchWithFallback(manifest, options)
}

/**
 * Fetch JSON content with fallback
 *
 * Convenience wrapper that parses JSON response.
 */
export async function fetchJson<T = unknown>(
  manifest: StorageManifest,
  options?: FetchOptions
): Promise<T> {
  const response = await fetchContent(manifest, options)
  return response.json() as Promise<T>
}

/**
 * Prefetch content into cache without blocking
 *
 * Use this to warm the cache for content the user will likely need.
 */
export function prefetchContent(manifest: StorageManifest): void {
  // Fire and forget - don't await
  fetchWithFallback(manifest, { noStore: false }).catch(() => {
    // Silently ignore prefetch failures
  })
}
