/**
 * Fallback Fetch Logic
 *
 * Cost-optimized gateway fallback chain:
 * 1. Cache (free, instant)
 * 2. Grove (free egress, fast CDN)
 * 3. Arweave (free egress forever, multiple gateways)
 * 4. Akash IPFS (free egress, you control)
 * 5. Lighthouse (paid egress, last resort)
 */

import { STORAGE_CONFIG } from './config'
import { getCached, setCache } from './cache'
import type {
  StorageManifest,
  FetchResult,
  FetchOptions,
  GatewayError,
  StorageLayer,
} from './types'

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Try a single gateway, return result or error
 */
async function tryGateway(
  url: string,
  _layer: StorageLayer,
  timeoutMs: number
): Promise<{ ok: true; response: Response; latencyMs: number } | { ok: false; error: string; latencyMs: number }> {
  const start = performance.now()

  try {
    const response = await fetchWithTimeout(url, timeoutMs)
    const latencyMs = performance.now() - start

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}`, latencyMs }
    }

    return { ok: true, response, latencyMs }
  } catch (error) {
    const latencyMs = performance.now() - start

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { ok: false, error: 'timeout', latencyMs }
      }
      return { ok: false, error: error.message, latencyMs }
    }

    return { ok: false, error: 'unknown error', latencyMs }
  }
}

/**
 * Get the cache key from a manifest
 * Prefers Grove CID, then Arweave txId, then Lighthouse CID
 */
export function getCacheKey(manifest: StorageManifest): string | null {
  return manifest.grove?.cid ?? manifest.arweave?.txId ?? manifest.lighthouse?.cid ?? null
}

/**
 * Fetch content with cost-optimized fallback chain
 *
 * Order:
 * 1. Cache (if enabled)
 * 2. Grove (free, fast)
 * 3. Arweave gateways (free egress)
 * 4. Akash IPFS gateways (free egress, you control)
 * 5. Lighthouse gateway (paid egress)
 *
 * @throws Error with all gateway errors if all fail
 */
export async function fetchWithFallback(
  manifest: StorageManifest,
  options?: FetchOptions
): Promise<FetchResult> {
  const timeoutMs = options?.timeout ?? STORAGE_CONFIG.defaultTimeoutMs
  const errors: GatewayError[] = []
  const cacheKey = getCacheKey(manifest)

  // 1. Check cache first
  if (!options?.skipCache && cacheKey) {
    const cached = await getCached(cacheKey)
    if (cached) {
      return {
        response: cached,
        source: 'cache',
        gateway: 'indexeddb',
        latencyMs: 0,
      }
    }
  }

  // 2. Try Grove (free, fast CDN)
  if (manifest.grove?.url) {
    const result = await tryGateway(manifest.grove.url, 'grove', timeoutMs)

    if (STORAGE_CONFIG.debug) {
      console.log(`[storage] Grove ${result.ok ? 'OK' : 'FAIL'}: ${result.ok ? '' : result.error} (${Math.round(result.latencyMs)}ms)`)
    }

    if (result.ok) {
      // Cache successful response
      if (!options?.noStore && cacheKey) {
        await setCache(cacheKey, result.response)
      }
      return {
        response: result.response,
        source: 'grove',
        gateway: STORAGE_CONFIG.gateways.grove[0],
        latencyMs: result.latencyMs,
      }
    }

    errors.push({
      layer: 'grove',
      gateway: STORAGE_CONFIG.gateways.grove[0],
      error: result.error,
      latencyMs: result.latencyMs,
    })
  }

  // 3. Try Arweave gateways (free egress forever)
  if (manifest.arweave?.txId) {
    for (const gateway of STORAGE_CONFIG.gateways.arweave) {
      const url = `${gateway}/${manifest.arweave.txId}`
      const result = await tryGateway(url, 'arweave', timeoutMs)

      if (STORAGE_CONFIG.debug) {
        console.log(`[storage] Arweave (${gateway}) ${result.ok ? 'OK' : 'FAIL'}: ${result.ok ? '' : result.error} (${Math.round(result.latencyMs)}ms)`)
      }

      if (result.ok) {
        if (!options?.noStore && cacheKey) {
          await setCache(cacheKey, result.response)
        }
        return {
          response: result.response,
          source: 'arweave',
          gateway,
          latencyMs: result.latencyMs,
        }
      }

      errors.push({
        layer: 'arweave',
        gateway,
        error: result.error,
        latencyMs: result.latencyMs,
      })
    }
  }

  // 4. Try Akash IPFS gateways (free egress, you control)
  if (manifest.lighthouse?.cid && STORAGE_CONFIG.gateways.akashIpfs.length > 0) {
    for (const gateway of STORAGE_CONFIG.gateways.akashIpfs) {
      const url = `${gateway}/${manifest.lighthouse.cid}`
      const result = await tryGateway(url, 'akash-ipfs', timeoutMs)

      if (STORAGE_CONFIG.debug) {
        console.log(`[storage] Akash IPFS (${gateway}) ${result.ok ? 'OK' : 'FAIL'}: ${result.ok ? '' : result.error} (${Math.round(result.latencyMs)}ms)`)
      }

      if (result.ok) {
        if (!options?.noStore && cacheKey) {
          await setCache(cacheKey, result.response)
        }
        return {
          response: result.response,
          source: 'akash-ipfs',
          gateway,
          latencyMs: result.latencyMs,
        }
      }

      errors.push({
        layer: 'akash-ipfs',
        gateway,
        error: result.error,
        latencyMs: result.latencyMs,
      })
    }
  }

  // 5. Try Lighthouse gateway (paid egress - last resort)
  if (manifest.lighthouse?.cid) {
    for (const gateway of STORAGE_CONFIG.gateways.lighthouse) {
      const url = `${gateway}/${manifest.lighthouse.cid}`
      const result = await tryGateway(url, 'lighthouse', timeoutMs)

      if (STORAGE_CONFIG.debug) {
        console.log(`[storage] Lighthouse (${gateway}) ${result.ok ? 'OK' : 'FAIL'}: ${result.ok ? '' : result.error} (${Math.round(result.latencyMs)}ms)`)
      }

      if (result.ok) {
        if (!options?.noStore && cacheKey) {
          await setCache(cacheKey, result.response)
        }
        return {
          response: result.response,
          source: 'lighthouse',
          gateway,
          latencyMs: result.latencyMs,
        }
      }

      errors.push({
        layer: 'lighthouse',
        gateway,
        error: result.error,
        latencyMs: result.latencyMs,
      })
    }
  }

  // All gateways failed
  const errorSummary = errors
    .map((e) => `${e.layer}/${e.gateway}: ${e.error}`)
    .join(', ')

  throw new Error(`All gateways failed: ${errorSummary}`)
}

/**
 * Get the best available URL for content (for audio elements that need a URL string)
 *
 * Returns first available URL in cost-optimized order:
 * Grove → Arweave (first gateway) → Lighthouse
 *
 * Does NOT check availability - just returns the URL
 */
export function getBestUrl(manifest: StorageManifest): string | null {
  // Grove first (free, fast)
  if (manifest.grove?.url) {
    return manifest.grove.url
  }

  // Arweave second (free egress)
  if (manifest.arweave?.txId) {
    const gateway = STORAGE_CONFIG.gateways.arweave[0]
    return `${gateway}/${manifest.arweave.txId}`
  }

  // Akash IPFS third (free egress, you control)
  if (manifest.lighthouse?.cid && STORAGE_CONFIG.gateways.akashIpfs.length > 0) {
    const gateway = STORAGE_CONFIG.gateways.akashIpfs[0]
    return `${gateway}/${manifest.lighthouse.cid}`
  }

  // Lighthouse last (paid egress)
  if (manifest.lighthouse?.cid) {
    const gateway = STORAGE_CONFIG.gateways.lighthouse[0]
    return `${gateway}/${manifest.lighthouse.cid}`
  }

  return null
}
