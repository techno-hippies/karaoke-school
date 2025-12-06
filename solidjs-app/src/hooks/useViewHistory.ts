import { openDB, type IDBPDatabase } from 'idb'
import { createSignal, onMount, createEffect, type Accessor } from 'solid-js'

const DB_NAME = 'karaoke-school'
const STORE_NAME = 'view-history'
const DB_VERSION = 1

// Keep last 500 views to prevent unbounded growth
const MAX_HISTORY_SIZE = 500

interface ViewRecord {
  postId: string
  viewedAt: number
}

interface ViewHistoryDB {
  [STORE_NAME]: {
    key: string
    value: ViewRecord
  }
}

let dbPromise: Promise<IDBPDatabase<ViewHistoryDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ViewHistoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'postId' })
        }
      },
    })
  }
  return dbPromise
}

/**
 * useViewHistory - Track which posts user has viewed (SolidJS)
 *
 * Uses IndexedDB for persistence across sessions.
 * A post is marked as "viewed" after 3 seconds of watch time.
 */
export function useViewHistory() {
  const [viewedPostIds, setViewedPostIds] = createSignal<Set<string>>(new Set())
  const [isLoaded, setIsLoaded] = createSignal(false)

  // Load history from IDB on mount
  onMount(async () => {
    try {
      const db = await getDB()
      const records = await db.getAll(STORE_NAME)
      setViewedPostIds(new Set(records.map(r => r.postId)))
    } catch (err) {
      console.error('[useViewHistory] Failed to load:', err)
    } finally {
      setIsLoaded(true)
    }
  })

  const markViewed = async (postId: string) => {
    // Update local state immediately
    setViewedPostIds(prev => {
      if (prev.has(postId)) return prev
      const next = new Set(prev)
      next.add(postId)
      return next
    })

    // Persist to IDB
    try {
      const db = await getDB()
      await db.put(STORE_NAME, {
        postId,
        viewedAt: Date.now(),
      })

      // Prune old entries if over limit
      const allRecords = await db.getAll(STORE_NAME)
      if (allRecords.length > MAX_HISTORY_SIZE) {
        allRecords.sort((a, b) => a.viewedAt - b.viewedAt)
        const toDelete = allRecords.slice(0, allRecords.length - MAX_HISTORY_SIZE)
        const tx = db.transaction(STORE_NAME, 'readwrite')
        await Promise.all([
          ...toDelete.map(r => tx.store.delete(r.postId)),
          tx.done,
        ])
      }
    } catch (err) {
      console.error('[useViewHistory] Failed to save:', err)
    }
  }

  const isViewed = (postId: string) => viewedPostIds().has(postId)

  return {
    viewedPostIds,
    markViewed,
    isViewed,
    isLoaded,
  }
}

/**
 * useViewTracker - Track view time and auto-mark as viewed (SolidJS)
 *
 * Call this with reactive accessors to automatically mark a post
 * as viewed after the threshold is reached.
 *
 * @param postId - Accessor for the post ID to track
 * @param currentTime - Accessor for current playback time in seconds
 * @param isPlaying - Accessor for whether video is currently playing
 * @param markViewed - Function to mark post as viewed
 * @param threshold - Seconds of watch time before marking viewed (default: 3)
 */
export function useViewTracker(
  postId: Accessor<string>,
  currentTime: Accessor<number>,
  isPlaying: Accessor<boolean>,
  markViewed: (postId: string) => void,
  threshold: number = 3
) {
  let hasMarked = false
  let watchTime = 0
  let lastTime = 0
  let currentPostId = ''

  createEffect(() => {
    const pid = postId()
    // Reset when post changes
    if (pid !== currentPostId) {
      hasMarked = false
      watchTime = 0
      lastTime = 0
      currentPostId = pid
    }
  })

  createEffect(() => {
    if (hasMarked || !isPlaying()) return

    const time = currentTime()
    const delta = time - lastTime

    // Only count small forward progress (normal playback, not seeks)
    if (delta > 0 && delta < 1) {
      watchTime += delta
    }
    lastTime = time

    if (watchTime >= threshold) {
      hasMarked = true
      markViewed(postId())
    }
  })
}

/**
 * Sort videos to show unseen first, preserving original order within groups
 */
export function sortByViewStatus<T extends { id: string }>(
  videos: T[],
  isViewed: (id: string) => boolean
): T[] {
  const unseen: T[] = []
  const seen: T[] = []

  for (const video of videos) {
    if (isViewed(video.id)) {
      seen.push(video)
    } else {
      unseen.push(video)
    }
  }

  return [...unseen, ...seen]
}
