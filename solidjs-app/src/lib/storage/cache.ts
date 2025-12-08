/**
 * Storage Cache Layer
 *
 * IndexedDB-based cache for fetched content.
 * Uses content hash as key so same content from different gateways shares cache.
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import { STORAGE_CONFIG } from './config'
import type { CacheEntry } from './types'

interface CacheDBSchema extends DBSchema {
  responses: {
    key: string
    value: CacheEntry
    indexes: {
      'by-cached-at': number
      'by-size': number
    }
  }
}

let dbPromise: Promise<IDBPDatabase<CacheDBSchema>> | null = null

/**
 * Get or create the cache database
 */
function getDB(): Promise<IDBPDatabase<CacheDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<CacheDBSchema>(
      STORAGE_CONFIG.cache.dbName,
      STORAGE_CONFIG.cache.dbVersion,
      {
        upgrade(db) {
          if (!db.objectStoreNames.contains('responses')) {
            const store = db.createObjectStore('responses', { keyPath: 'key' })
            store.createIndex('by-cached-at', 'cachedAt')
            store.createIndex('by-size', 'sizeBytes')
          }
        },
      }
    )
  }
  return dbPromise
}

/**
 * Get cached response by content key
 * Returns null if not found or expired
 */
export async function getCached(key: string): Promise<Response | null> {
  if (!STORAGE_CONFIG.cache.enabled) return null

  try {
    const db = await getDB()
    const entry = await db.get('responses', key)

    if (!entry) return null

    // Check expiry
    const age = Date.now() - entry.cachedAt
    if (age > STORAGE_CONFIG.cache.maxAgeMs) {
      // Expired - delete and return null
      await db.delete('responses', key)
      if (STORAGE_CONFIG.debug) {
        console.log(`[storage:cache] EXPIRED: ${key.slice(0, 16)}... (${Math.round(age / 1000 / 60 / 60)}h old)`)
      }
      return null
    }

    if (STORAGE_CONFIG.debug) {
      console.log(`[storage:cache] HIT: ${key.slice(0, 16)}... (${Math.round(age / 1000 / 60)}m old)`)
    }

    // Reconstruct Response from cached data
    return new Response(entry.data, {
      headers: {
        'Content-Type': entry.contentType,
        'X-Cache': 'HIT',
        'X-Cache-Age': String(age),
      },
    })
  } catch (error) {
    console.warn('[storage:cache] Read error:', error)
    return null
  }
}

/**
 * Cache a response by content key
 * Clones the response so original can still be consumed
 */
export async function setCache(key: string, response: Response): Promise<void> {
  if (!STORAGE_CONFIG.cache.enabled) return

  try {
    const db = await getDB()

    // Clone and read body
    const clone = response.clone()
    const data = await clone.arrayBuffer()
    const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream'

    const entry: CacheEntry = {
      key,
      data,
      contentType,
      cachedAt: Date.now(),
      sizeBytes: data.byteLength,
    }

    await db.put('responses', entry)

    if (STORAGE_CONFIG.debug) {
      console.log(`[storage:cache] STORE: ${key.slice(0, 16)}... (${(data.byteLength / 1024).toFixed(1)}KB)`)
    }

    // Check if we need to prune
    await maybePrune()
  } catch (error) {
    console.warn('[storage:cache] Write error:', error)
  }
}

/**
 * Delete a specific cache entry
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const db = await getDB()
    await db.delete('responses', key)
  } catch (error) {
    console.warn('[storage:cache] Delete error:', error)
  }
}

/**
 * Clear all cached entries
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await getDB()
    await db.clear('responses')
    if (STORAGE_CONFIG.debug) {
      console.log('[storage:cache] CLEARED')
    }
  } catch (error) {
    console.warn('[storage:cache] Clear error:', error)
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  entryCount: number
  totalSizeBytes: number
  oldestEntry: number | null
}> {
  try {
    const db = await getDB()
    const all = await db.getAll('responses')

    let totalSize = 0
    let oldest: number | null = null

    for (const entry of all) {
      totalSize += entry.sizeBytes
      if (oldest === null || entry.cachedAt < oldest) {
        oldest = entry.cachedAt
      }
    }

    return {
      entryCount: all.length,
      totalSizeBytes: totalSize,
      oldestEntry: oldest,
    }
  } catch (error) {
    console.warn('[storage:cache] Stats error:', error)
    return { entryCount: 0, totalSizeBytes: 0, oldestEntry: null }
  }
}

/**
 * Prune cache if over threshold
 * Uses LRU-ish strategy: delete oldest entries first
 */
async function maybePrune(): Promise<void> {
  try {
    const db = await getDB()
    const stats = await getCacheStats()

    const threshold = STORAGE_CONFIG.cache.maxSizeBytes * STORAGE_CONFIG.cache.pruneThreshold

    if (stats.totalSizeBytes < threshold) return

    if (STORAGE_CONFIG.debug) {
      console.log(`[storage:cache] PRUNE: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(1)}MB > ${(threshold / 1024 / 1024).toFixed(1)}MB threshold`)
    }

    // Get all entries sorted by cachedAt (oldest first)
    const all = await db.getAllFromIndex('responses', 'by-cached-at')

    let currentSize = stats.totalSizeBytes
    const targetSize = STORAGE_CONFIG.cache.maxSizeBytes * 0.7 // Prune to 70%

    const tx = db.transaction('responses', 'readwrite')
    let deleted = 0

    for (const entry of all) {
      if (currentSize <= targetSize) break

      await tx.store.delete(entry.key)
      currentSize -= entry.sizeBytes
      deleted++
    }

    await tx.done

    if (STORAGE_CONFIG.debug) {
      console.log(`[storage:cache] PRUNED: ${deleted} entries, now ${(currentSize / 1024 / 1024).toFixed(1)}MB`)
    }
  } catch (error) {
    console.warn('[storage:cache] Prune error:', error)
  }
}
