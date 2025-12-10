/**
 * Storage Configuration
 *
 * Single source of truth for gateway URLs, timeouts, and cache settings.
 * Ops can modify this file to add/remove gateways without touching logic.
 */

export const STORAGE_CONFIG = {
  /**
   * Default timeout per gateway attempt (ms)
   * If a gateway doesn't respond within this time, try next
   */
  defaultTimeoutMs: 8000,

  /**
   * Gateway lists by layer
   * Order within each layer = priority (first = try first)
   *
   * Cost optimization order (in fallback.ts):
   * 1. Cache (free, instant)
   * 2. Grove (free egress, fast CDN)
   * 3. Arweave (free egress forever)
   * 4. Akash IPFS (free egress, you control)
   * 5. Lighthouse (paid egress - last resort)
   */
  gateways: {
    /**
     * Grove - Primary storage, free egress
     * Lens ecosystem CDN
     */
    grove: ['https://api.grove.storage'],

    /**
     * Arweave - Permanent storage, free egress forever
     * Ordered by speed (from benchmark Dec 2024):
     * arweave.dev: 599ms, ar-io.net: 1486ms, arweave.net: 1847ms
     */
    arweave: [
      'https://arweave.dev',
      'https://ar-io.net',
      'https://arweave.net',
      'https://g8way.io',
    ],

    /**
     * Akash IPFS - Your own gateways, free egress
     * Add URLs when you deploy Akash nodes
     * Format: 'https://your-gateway.com/ipfs' (CID appended)
     */
    akashIpfs: [
      // 'https://ipfs1.kschool.app/ipfs',
      // 'https://ipfs2.kschool.app/ipfs',
    ] as string[],

    /**
     * Lighthouse/IPFS - Paid egress, last resort
     * Public IPFS gateways often fail for fresh content
     * Lighthouse gateway is most reliable for Lighthouse-pinned content
     */
    lighthouse: ['https://gateway.lighthouse.storage/ipfs'],
  },

  /**
   * IndexedDB cache settings
   */
  cache: {
    /** Enable/disable caching */
    enabled: true,

    /** Database name */
    dbName: 'kschool-storage-cache',

    /** Database version (increment to trigger upgrade) */
    dbVersion: 1,

    /** Max total cache size in bytes (100MB) */
    maxSizeBytes: 100 * 1024 * 1024,

    /** Max age for cached entries (7 days) */
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,

    /** Prune when cache exceeds this ratio of max size */
    pruneThreshold: 0.9,
  },

  /**
   * Debug mode - logs gateway attempts and latencies
   * Auto-enabled in dev, can override in production
   */
  debug: import.meta.env.DEV,
} as const

/**
 * Get all Arweave gateway URLs for a transaction ID
 */
export function getArweaveUrls(txId: string): string[] {
  return STORAGE_CONFIG.gateways.arweave.map((gw) => `${gw}/${txId}`)
}

/**
 * Get all IPFS gateway URLs for a CID (Akash + Lighthouse)
 */
export function getIpfsUrls(cid: string): string[] {
  const akash = STORAGE_CONFIG.gateways.akashIpfs.map((gw) => `${gw}/${cid}`)
  const lighthouse = STORAGE_CONFIG.gateways.lighthouse.map((gw) => `${gw}/${cid}`)
  return [...akash, ...lighthouse]
}
