/**
 * LRU Audio Cache
 *
 * Caches decrypted audio blobs in IndexedDB to avoid repeated Lit decryption.
 * Uses versioned cache keys to auto-invalidate on re-encryption.
 *
 * Max 15 entries, LRU eviction.
 */

const DB_NAME = 'karaoke-audio-cache'
const DB_VERSION = 1
const STORE_NAME = 'decrypted-audio'
const MAX_ENTRIES = 15

interface CacheEntry {
  cacheKey: string // spotifyTrackId_dataToEncryptHash
  audioBlob: Blob
  lastAccessedAt: number
  sizeBytes: number
}

// In-flight decryption promises to prevent duplicate work
const inFlightDecrypts = new Map<string, Promise<Blob>>()

let dbPromise: Promise<IDBDatabase> | null = null
let dbUnavailable = false

/**
 * Open IndexedDB (singleton)
 */
function openDb(): Promise<IDBDatabase> {
  if (dbUnavailable) {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => {
          console.warn('[audioCache] IndexedDB unavailable (private browsing?)')
          dbUnavailable = true
          dbPromise = null
          reject(new Error('IndexedDB unavailable'))
        }

        request.onsuccess = () => {
          resolve(request.result)
        }

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' })
            store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false })
          }
        }
      } catch {
        console.warn('[audioCache] IndexedDB not supported')
        dbUnavailable = true
        reject(new Error('IndexedDB not supported'))
      }
    })
  }

  return dbPromise
}

/**
 * Build cache key from track ID and encryption hash
 */
export function buildCacheKey(spotifyTrackId: string, dataToEncryptHash: string): string {
  return `${spotifyTrackId}_${dataToEncryptHash}`
}

/**
 * Get cached audio blob, returns null if not found
 * Updates lastAccessedAt on hit
 */
export async function getFromCache(cacheKey: string): Promise<Blob | null> {
  try {
    const db = await openDb()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(cacheKey)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined
        if (!entry) {
          resolve(null)
          return
        }

        // Update lastAccessedAt
        entry.lastAccessedAt = Date.now()
        store.put(entry)

        // Verify blob is valid
        if (!(entry.audioBlob instanceof Blob)) {
          console.warn('[audioCache] Corrupt cache entry, deleting')
          store.delete(cacheKey)
          resolve(null)
          return
        }

        console.log(`[audioCache] Cache HIT: ${cacheKey.slice(0, 30)}...`)
        resolve(entry.audioBlob)
      }
    })
  } catch {
    // IndexedDB unavailable, return null
    return null
  }
}

/**
 * Save audio blob to cache with LRU eviction
 */
export async function saveToCache(
  cacheKey: string,
  audioBlob: Blob,
  retryCount = 0
): Promise<void> {
  try {
    const db = await openDb()

    // First, check count and evict if needed
    const count = await getEntryCount(db)
    if (count >= MAX_ENTRIES) {
      await evictOldest(db, count - MAX_ENTRIES + 1)
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      const entry: CacheEntry = {
        cacheKey,
        audioBlob,
        lastAccessedAt: Date.now(),
        sizeBytes: audioBlob.size,
      }

      const request = store.put(entry)

      request.onerror = () => {
        const error = request.error
        // Handle quota exceeded
        if (error?.name === 'QuotaExceededError' && retryCount < 1) {
          console.warn('[audioCache] Quota exceeded, evicting 5 oldest entries')
          evictOldest(db, 5)
            .then(() => saveToCache(cacheKey, audioBlob, retryCount + 1))
            .then(resolve)
            .catch(reject)
        } else {
          reject(error)
        }
      }

      request.onsuccess = () => {
        console.log(`[audioCache] Cached: ${cacheKey.slice(0, 30)}... (${(audioBlob.size / 1024 / 1024).toFixed(1)}MB)`)
        resolve()
      }
    })
  } catch {
    // IndexedDB unavailable, silently fail
    console.warn('[audioCache] Failed to cache (IndexedDB unavailable)')
  }
}

/**
 * Get number of entries in cache
 */
async function getEntryCount(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.count()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Evict N oldest entries (by lastAccessedAt)
 */
async function evictOldest(db: IDBDatabase, count: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('lastAccessedAt')

    const keysToDelete: string[] = []
    const request = index.openCursor()

    request.onerror = () => reject(request.error)
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor && keysToDelete.length < count) {
        keysToDelete.push(cursor.value.cacheKey)
        cursor.continue()
      } else {
        // Delete collected keys
        keysToDelete.forEach((key) => store.delete(key))
        console.log(`[audioCache] Evicted ${keysToDelete.length} oldest entries`)
        resolve()
      }
    }
  })
}

/**
 * Clear entire cache (for debugging/settings)
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        console.log('[audioCache] Cache cleared')
        resolve()
      }
    })
  } catch {
    // IndexedDB unavailable
  }
}

/**
 * Check if a decryption is already in flight for this cache key
 */
export function getInFlightDecrypt(cacheKey: string): Promise<Blob> | undefined {
  return inFlightDecrypts.get(cacheKey)
}

/**
 * Register an in-flight decryption promise
 */
export function setInFlightDecrypt(cacheKey: string, promise: Promise<Blob>): void {
  inFlightDecrypts.set(cacheKey, promise)
  // Clean up when done
  promise.finally(() => {
    inFlightDecrypts.delete(cacheKey)
  })
}
