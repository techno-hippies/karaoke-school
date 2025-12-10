/**
 * Storage Layer Types
 *
 * Interfaces for multi-gateway censorship-resistant storage.
 */

/** Storage layer identifiers */
export type StorageLayer = 'grove' | 'arweave' | 'akash-ipfs' | 'lighthouse' | 'cache'

/** Grove storage reference */
export interface GroveRef {
  cid: string
  url: string
}

/** Arweave storage reference */
export interface ArweaveRef {
  txId: string
  url: string
}

/** IPFS/Lighthouse storage reference */
export interface LighthouseRef {
  cid: string
  url: string
}

/**
 * Storage manifest - contains all known locations for content
 * At least one reference is required
 */
export interface StorageManifest {
  grove?: GroveRef
  arweave?: ArweaveRef
  lighthouse?: LighthouseRef
}

/**
 * Successful fetch result with source attribution
 */
export interface FetchResult {
  response: Response
  source: StorageLayer
  gateway: string
  latencyMs: number
}

/**
 * Per-gateway error for debugging
 */
export interface GatewayError {
  layer: StorageLayer
  gateway: string
  error: string
  latencyMs: number
}

/**
 * Full fetch attempt result (success or all errors)
 */
export type FetchAttempt =
  | { ok: true; result: FetchResult }
  | { ok: false; errors: GatewayError[] }

/**
 * Cache entry stored in IndexedDB
 */
export interface CacheEntry {
  /** Content hash (Grove CID, Arweave txId, or IPFS CID) */
  key: string
  /** Raw response data */
  data: ArrayBuffer
  /** MIME type */
  contentType: string
  /** Timestamp when cached */
  cachedAt: number
  /** Size in bytes */
  sizeBytes: number
}

/**
 * Options for fetchContent
 */
export interface FetchOptions {
  /** Timeout per gateway in ms (default: from config) */
  timeout?: number
  /** Skip cache lookup (force fresh fetch) */
  skipCache?: boolean
  /** Skip caching the response */
  noStore?: boolean
}
