/**
 * Chat IndexedDB Store
 *
 * Persistent storage for:
 * - User profile (singleton)
 * - Threads (conversations)
 * - Messages (last N per thread)
 * - View history (for psychographic profiling)
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { UserProfile, Thread, Message, ViewHistoryEntry } from './types'

const DB_NAME = 'karaoke-chat'
const DB_VERSION = 2

/** Max messages to keep per thread */
const MAX_MESSAGES_PER_THREAD = 100

/** Generate summary after this many messages */
export const SUMMARY_INTERVAL = 20

/** Max view history entries */
const MAX_VIEW_HISTORY = 100

// ============================================================
// Database Schema
// ============================================================

interface ChatDBSchema extends DBSchema {
  profile: {
    key: 'singleton'
    value: UserProfile
  }
  threads: {
    key: string
    value: Thread
    indexes: {
      'by-updated': number
    }
  }
  messages: {
    key: string
    value: Message
    indexes: {
      'by-thread': string
      'by-thread-idx': [string, number]
    }
  }
  viewHistory: {
    key: string
    value: ViewHistoryEntry
    indexes: {
      'by-viewed-at': number
      'by-content': string
    }
  }
}

let dbPromise: Promise<IDBPDatabase<ChatDBSchema>> | null = null

function getDB(): Promise<IDBPDatabase<ChatDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<ChatDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Profile store (singleton)
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile')
        }

        // Threads store
        if (!db.objectStoreNames.contains('threads')) {
          const threadStore = db.createObjectStore('threads', { keyPath: 'id' })
          threadStore.createIndex('by-updated', 'updatedAt')
        }

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' })
          msgStore.createIndex('by-thread', 'threadId')
          msgStore.createIndex('by-thread-idx', ['threadId', 'idx'])
        }

        // View history store
        if (!db.objectStoreNames.contains('viewHistory')) {
          const viewStore = db.createObjectStore('viewHistory', { keyPath: 'id' })
          viewStore.createIndex('by-viewed-at', 'viewedAt')
          viewStore.createIndex('by-content', 'contentId')
        }
      },
    })
  }
  return dbPromise
}

// ============================================================
// Profile Operations
// ============================================================

export async function getProfile(): Promise<UserProfile | null> {
  const db = await getDB()
  return (await db.get('profile', 'singleton')) ?? null
}

export async function saveProfile(
  profile: Partial<UserProfile>
): Promise<UserProfile> {
  const db = await getDB()
  const existing = await getProfile()
  const now = Date.now()

  const updated: UserProfile = {
    id: 'singleton',
    createdAt: existing?.createdAt ?? now,
    ...existing,
    ...profile,
    updatedAt: now,
  }

  await db.put('profile', updated, 'singleton')
  return updated
}

// ============================================================
// Thread Operations
// ============================================================

export async function getThreads(): Promise<Thread[]> {
  const db = await getDB()
  const threads = await db.getAllFromIndex('threads', 'by-updated')
  // Return newest first
  return threads.reverse()
}

export async function getThread(threadId: string): Promise<Thread | null> {
  const db = await getDB()
  return (await db.get('threads', threadId)) ?? null
}

/**
 * Get or create a conversation for a scenario.
 * Thread ID = scenario ID (e.g., "scarlett-chat")
 */
export async function getOrCreateConversation(
  scenarioId: string,
  tutorName: string,
  tutorAvatarUrl?: string
): Promise<Thread> {
  const db = await getDB()

  const existing = await db.get('threads', scenarioId)
  if (existing) return existing

  const now = Date.now()
  const thread: Thread = {
    id: scenarioId,
    tutorId: scenarioId.split('-')[0], // Extract personality ID
    tutorName,
    tutorAvatarUrl,
    messageCount: 0,
    lastSummarizedIdx: 0,
    unreadCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  await db.put('threads', thread)
  return thread
}

export async function updateThread(
  threadId: string,
  updates: Partial<Omit<Thread, 'id' | 'createdAt'>>
): Promise<Thread | null> {
  const db = await getDB()
  const existing = await getThread(threadId)
  if (!existing) return null

  const updated: Thread = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  }

  await db.put('threads', updated)
  return updated
}

export async function deleteThread(threadId: string): Promise<void> {
  const db = await getDB()

  // Delete all messages in thread
  const messages = await db.getAllFromIndex('messages', 'by-thread', threadId)
  const tx = db.transaction('messages', 'readwrite')
  await Promise.all(messages.map((m) => tx.store.delete(m.id)))
  await tx.done

  // Delete thread
  await db.delete('threads', threadId)
}

export async function markThreadRead(threadId: string): Promise<void> {
  await updateThread(threadId, { unreadCount: 0 })
}

// ============================================================
// Message Operations
// ============================================================

export async function getMessages(
  threadId: string,
  limit = MAX_MESSAGES_PER_THREAD
): Promise<Message[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('messages', 'by-thread', threadId)
  // Sort by idx and return last N
  all.sort((a, b) => a.idx - b.idx)
  return all.slice(-limit)
}

export async function addMessage(
  threadId: string,
  role: Message['role'],
  content: string,
  metadata?: Message['metadata']
): Promise<Message> {
  const db = await getDB()

  const thread = await getThread(threadId)
  if (!thread) throw new Error(`Thread ${threadId} not found`)

  const now = Date.now()
  const idx = thread.messageCount

  const message: Message = {
    id: crypto.randomUUID(),
    threadId,
    idx,
    role,
    content,
    metadata,
    createdAt: now,
  }

  await db.put('messages', message)

  // Update thread
  await updateThread(threadId, {
    messageCount: idx + 1,
    lastMessagePreview:
      role === 'assistant' ? content.slice(0, 100) : thread.lastMessagePreview,
    unreadCount:
      role === 'assistant' ? thread.unreadCount + 1 : thread.unreadCount,
  })

  // Prune old messages if needed
  await pruneMessages(threadId)

  return message
}

/**
 * Add multiple messages in a batch (single refresh).
 * More efficient than calling addMessage multiple times.
 */
export async function addMessagesBatch(
  threadId: string,
  messages: Array<{
    role: Message['role']
    content: string
    metadata?: Message['metadata']
  }>
): Promise<Message[]> {
  if (messages.length === 0) return []

  const db = await getDB()

  const thread = await getThread(threadId)
  if (!thread) throw new Error(`Thread ${threadId} not found`)

  const now = Date.now()
  let currentIdx = thread.messageCount
  const savedMessages: Message[] = []

  // Save all messages in transaction
  const tx = db.transaction('messages', 'readwrite')
  for (const msg of messages) {
    const message: Message = {
      id: crypto.randomUUID(),
      threadId,
      idx: currentIdx,
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata,
      createdAt: now,
    }
    tx.store.put(message)
    savedMessages.push(message)
    currentIdx++
  }
  await tx.done

  // Update thread with final count
  const lastAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant')
  await updateThread(threadId, {
    messageCount: currentIdx,
    lastMessagePreview:
      lastAssistantMsg?.content.slice(0, 100) ?? thread.lastMessagePreview,
    unreadCount:
      thread.unreadCount + messages.filter((m) => m.role === 'assistant').length,
  })

  // Prune old messages
  await pruneMessages(threadId)

  return savedMessages
}

async function pruneMessages(threadId: string): Promise<void> {
  const db = await getDB()
  const allMessages = await db.getAllFromIndex('messages', 'by-thread', threadId)

  if (allMessages.length > MAX_MESSAGES_PER_THREAD * 1.5) {
    allMessages.sort((a, b) => a.idx - b.idx)
    const toDelete = allMessages.slice(
      0,
      allMessages.length - MAX_MESSAGES_PER_THREAD
    )
    const tx = db.transaction('messages', 'readwrite')
    await Promise.all(toDelete.map((m) => tx.store.delete(m.id)))
    await tx.done
  }
}

/** Check if a thread needs a new summary */
export async function needsSummary(threadId: string): Promise<boolean> {
  const thread = await getThread(threadId)
  if (!thread) return false
  return thread.messageCount - thread.lastSummarizedIdx >= SUMMARY_INTERVAL
}

// ============================================================
// View History Operations
// ============================================================

export async function getViewHistory(limit = 50): Promise<ViewHistoryEntry[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('viewHistory', 'by-viewed-at')
  return all.reverse().slice(0, limit)
}

export async function addViewHistoryEntry(
  entry: Omit<ViewHistoryEntry, 'id' | 'viewedAt'>
): Promise<ViewHistoryEntry> {
  const db = await getDB()

  const fullEntry: ViewHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    viewedAt: Date.now(),
  }

  await db.put('viewHistory', fullEntry)

  // Prune old entries
  const all = await db.getAllFromIndex('viewHistory', 'by-viewed-at')
  if (all.length > MAX_VIEW_HISTORY * 1.5) {
    const toDelete = all.slice(0, all.length - MAX_VIEW_HISTORY)
    const tx = db.transaction('viewHistory', 'readwrite')
    await Promise.all(toDelete.map((e) => tx.store.delete(e.id)))
    await tx.done
  }

  return fullEntry
}

/**
 * Build a psychographic profile from view history.
 * Returns aggregated tag counts and favorite content.
 */
export async function getEngagementProfile(): Promise<{
  visualTagCounts: Record<string, number>
  lyricTagCounts: Record<string, number>
  topArtists: Array<{ name: string; viewCount: number }>
  topSongs: Array<{ title: string; artist: string; viewCount: number }>
  completedCount: number
  totalViews: number
}> {
  const history = await getViewHistory(100)

  const visualTagCounts: Record<string, number> = {}
  const lyricTagCounts: Record<string, number> = {}
  const artistCounts: Record<string, number> = {}
  const songCounts: Record<
    string,
    { title: string; artist: string; count: number }
  > = {}
  let completedCount = 0

  for (const entry of history) {
    // Count visual tags
    for (const tag of entry.visualTags || []) {
      visualTagCounts[tag] = (visualTagCounts[tag] || 0) + 1
    }

    // Count lyric tags
    for (const tag of entry.lyricTags || []) {
      lyricTagCounts[tag] = (lyricTagCounts[tag] || 0) + 1
    }

    // Count artists
    if (entry.artistName) {
      artistCounts[entry.artistName] = (artistCounts[entry.artistName] || 0) + 1
    }

    // Count songs
    if (entry.songTitle && entry.artistName) {
      const key = `${entry.songTitle}:${entry.artistName}`
      if (!songCounts[key]) {
        songCounts[key] = {
          title: entry.songTitle,
          artist: entry.artistName,
          count: 0,
        }
      }
      songCounts[key].count++
    }

    if (entry.completed) completedCount++
  }

  // Sort and get top items
  const topArtists = Object.entries(artistCounts)
    .map(([name, viewCount]) => ({ name, viewCount }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 5)

  const topSongs = Object.values(songCounts)
    .map((s) => ({ title: s.title, artist: s.artist, viewCount: s.count }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 5)

  return {
    visualTagCounts,
    lyricTagCounts,
    topArtists,
    topSongs,
    completedCount,
    totalViews: history.length,
  }
}
