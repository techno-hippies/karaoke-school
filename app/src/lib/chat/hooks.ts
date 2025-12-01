/**
 * React hooks for chat storage
 */

import { useState, useEffect, useCallback } from 'react'
import type { UserProfile, Thread, Message } from './types'
import * as store from './store'

// ============================================================
// Profile Hook
// ============================================================

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    store.getProfile().then((p) => {
      setProfile(p)
      setLoading(false)
    })
  }, [])

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const updated = await store.saveProfile(updates)
    setProfile(updated)
    return updated
  }, [])

  return { profile, loading, updateProfile }
}

// ============================================================
// Threads Hook
// ============================================================

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const t = await store.getThreads()
    setThreads(t)
    return t
  }, [])

  useEffect(() => {
    refresh().then(() => setLoading(false))
  }, [refresh])

  const createThread = useCallback(
    async (tutorId: string, tutorName: string, tutorAvatarUrl?: string) => {
      const thread = await store.createThread(tutorId, tutorName, tutorAvatarUrl)
      await refresh()
      return thread
    },
    [refresh]
  )

  const deleteThread = useCallback(
    async (threadId: string) => {
      await store.deleteThread(threadId)
      await refresh()
    },
    [refresh]
  )

  return { threads, loading, refresh, createThread, deleteThread }
}

// ============================================================
// Single Thread + Messages Hook
// ============================================================

export function useThread(threadId: string | null) {
  const [thread, setThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!threadId) {
      setThread(null)
      setMessages([])
      setLoading(false)
      return
    }

    const [t, msgs] = await Promise.all([
      store.getThread(threadId),
      store.getMessages(threadId),
    ])
    setThread(t)
    setMessages(msgs)
    setLoading(false)
  }, [threadId])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  const addMessage = useCallback(
    async (role: Message['role'], content: string, metadata?: Record<string, unknown>) => {
      if (!threadId) throw new Error('No thread selected')
      const msg = await store.addMessage(threadId, role, content, metadata)
      await refresh()
      return msg
    },
    [threadId, refresh]
  )

  const updateSummary = useCallback(
    async (summary: string) => {
      if (!threadId || !thread) return
      await store.updateThread(threadId, {
        summary,
        lastSummarizedIdx: thread.messageCount,
      })
      await refresh()
    },
    [threadId, thread, refresh]
  )

  const markRead = useCallback(async () => {
    if (!threadId) return
    await store.markThreadRead(threadId)
    await refresh()
  }, [threadId, refresh])

  const needsSummary = useCallback(async () => {
    if (!threadId) return false
    return store.needsSummary(threadId)
  }, [threadId])

  return {
    thread,
    messages,
    loading,
    refresh,
    addMessage,
    updateSummary,
    markRead,
    needsSummary,
  }
}

