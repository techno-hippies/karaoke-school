/**
 * Lens Protocol Hooks for SolidJS
 */

import { createSignal, createEffect } from 'solid-js'
import { fetchPosts } from '@lens-protocol/client/actions'
import { evmAddress } from '@lens-protocol/client'
import { lensClient } from './client'
import { LENS_APP_ADDRESS } from './config'
import { transformLensPostsToVideoData } from './transformers'
import type { VideoPostData } from '../../components/feed/types'

export interface UseFeedPostsOptions {
  /** Whether the user is authenticated */
  isAuthenticated?: boolean
  /** Map of post IDs to liked status */
  likedPostsMap?: Map<string, boolean>
}

export interface UseFeedPostsResult {
  posts: () => VideoPostData[]
  isLoading: () => boolean
  error: () => Error | null
  hasMore: () => boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

/**
 * Hook to fetch karaoke posts from the global Lens feed
 *
 * @example
 * ```tsx
 * const { posts, isLoading, error, loadMore, hasMore } = useFeedPosts()
 *
 * <Show when={!isLoading()} fallback={<Loading />}>
 *   <For each={posts()}>{post => <VideoPost {...post} />}</For>
 * </Show>
 * ```
 */
export function useFeedPosts(options: UseFeedPostsOptions = {}): UseFeedPostsResult {
  const [rawPosts, setRawPosts] = createSignal<any[]>([])
  const [isLoading, setIsLoading] = createSignal(true)
  const [error, setError] = createSignal<Error | null>(null)
  const [hasMore, setHasMore] = createSignal(false)
  const [cursor, setCursor] = createSignal<string | undefined>(undefined)

  // Transform raw Lens posts to VideoPostData
  const posts = () => {
    const likedMap = options.likedPostsMap ?? new Map()
    return transformLensPostsToVideoData(rawPosts(), likedMap, options.isAuthenticated ?? false)
  }

  const fetchFeed = async (pageCursor?: string) => {
    console.log('[useFeedPosts] Fetching feed...', { pageCursor, appAddress: LENS_APP_ADDRESS })
    try {
      if (!pageCursor) {
        setIsLoading(true)
      }
      setError(null)

      const result = await fetchPosts(lensClient as any, {
        filter: {
          apps: [evmAddress(LENS_APP_ADDRESS)],
          metadata: {
            tags: { all: ['karaoke'] }
          }
        },
        ...(pageCursor && { cursor: pageCursor }),
      })

      console.log('[useFeedPosts] Result:', result)

      if (result.isErr()) {
        console.error('[useFeedPosts] API Error:', result.error)
        throw new Error(`Failed to fetch posts: ${result.error.message}`)
      }

      const data = result.value
      console.log('[useFeedPosts] Data:', data)

      const items = Array.from(data.items || []).filter(
        (post: any) => post.__typename === 'Post'
      )
      console.log('[useFeedPosts] Filtered items:', items.length)

      if (pageCursor) {
        // Append for pagination
        setRawPosts(prev => [...prev, ...items])
      } else {
        // Replace for initial load
        setRawPosts(items)
      }

      setHasMore(!!data.pageInfo?.next)
      setCursor(data.pageInfo?.next ?? undefined)
    } catch (err) {
      console.error('[useFeedPosts] Error:', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }

  // Initial fetch on mount
  createEffect(() => {
    fetchFeed()
  })

  const loadMore = async () => {
    const c = cursor()
    if (!c || isLoading()) return
    await fetchFeed(c)
  }

  const refetch = async () => {
    setCursor(undefined)
    await fetchFeed()
  }

  return {
    posts,
    isLoading,
    error,
    hasMore,
    loadMore,
    refetch,
  }
}
