/**
 * useAccountPosts Hook
 * Fetch posts created by a Lens account
 *
 * Uses Lens SDK's built-in post queries
 */

import { useState, useEffect } from 'react'
import type { EvmAddress } from '@lens-protocol/client'
import { fetchPosts } from '@lens-protocol/client/actions'
import { evmAddress } from '@lens-protocol/client'
import { lensClient } from '../client'

export interface LensPost {
  id: string
  metadata?: {
    asset?: {
      video?: {
        cover?: string
        duration?: number
      }
    }
  }
  stats?: {
    reactions: number
    comments: number
    reposts: number
  }
}

export interface UseAccountPostsResult {
  posts: LensPost[]
  isLoading: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => Promise<void>
}

/**
 * Fetch posts created by an account
 *
 * @param accountAddress - Lens account address (not PKP address)
 * @returns Posts with loading/error state and pagination
 *
 * @example
 * ```tsx
 * const { posts, isLoading, loadMore, hasMore } = useAccountPosts(lensAccount?.address)
 * ```
 */
export function useAccountPosts(accountAddress: string | undefined): UseAccountPostsResult {
  const [posts, setPosts] = useState<LensPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!accountAddress) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadPosts() {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch posts by author
        const result = await fetchPosts(lensClient as any, {
          filter: {
            authors: [evmAddress(accountAddress as EvmAddress)],
          },
        })

        if (result.isErr()) {
          throw new Error(`Failed to fetch posts: ${result.error.message}`)
        }

        if (cancelled) return

        const postsData = result.value

        // TODO: Map posts to our format and extract pagination
        // Lens SDK should return { items: Post[], pageInfo: { next: string } }
        setPosts(postsData.items || [])
        setHasMore(!!postsData.pageInfo?.next)
        setCursor(postsData.pageInfo?.next)

      } catch (err) {
        if (cancelled) return
        console.error('[useAccountPosts] Error:', err)
        setError(err as Error)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPosts()

    return () => {
      cancelled = true
    }
  }, [accountAddress])

  const loadMore = async () => {
    if (!cursor || isLoading || !accountAddress) return

    try {
      setIsLoading(true)

      const result = await fetchPosts(lensClient as any, {
        filter: {
          authors: [evmAddress(accountAddress as EvmAddress)],
        },
        cursor,
      })

      if (result.isErr()) {
        throw new Error(`Failed to fetch more posts: ${result.error.message}`)
      }

      const postsData = result.value

      setPosts(prev => [...prev, ...(postsData.items || [])])
      setHasMore(!!postsData.pageInfo?.next)
      setCursor(postsData.pageInfo?.next)

    } catch (err) {
      console.error('[useAccountPosts] Load more error:', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    posts,
    isLoading,
    error,
    hasMore,
    loadMore,
  }
}
