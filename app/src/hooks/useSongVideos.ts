import { useQuery } from '@tanstack/react-query'
import { fetchPosts } from '@lens-protocol/client/actions'
import { lensClient } from '@/lib/lens'

export interface VideoPost {
  id: string
  thumbnailUrl: string
  username: string
  author: {
    address: string
    username?: string
    name?: string
    picture?: string
  }
  metadata: {
    content?: string
    attributes?: Array<{ key: string; value: string }>
  }
}

/**
 * Fetch all creator videos for a given song (by genius_id)
 *
 * Uses Lens GraphQL to query posts filtered by the genius_id attribute.
 * This returns videos from ALL creators who performed this song.
 */
export function useSongVideos(geniusId?: number) {
  return useQuery({
    queryKey: ['song-videos', geniusId],
    queryFn: async () => {
      if (!geniusId) return []

      const result = await fetchPosts(lensClient, {
        filter: {
          metadata: {
            tags: {
              oneOf: [`genius_id:${geniusId}`],
            },
          },
        },
      })

      if (result.isErr()) {
        throw result.error
      }

      // Transform to VideoPost format
      const videos: VideoPost[] = result.value.items.map((post: any) => ({
        id: post.id,
        thumbnailUrl: post.metadata?.cover?.optimized?.uri || post.metadata?.image?.optimized?.uri || 'https://placehold.co/400x711/8b5cf6/ffffff?text=Video',
        username: post.author?.username?.value || post.author?.address.slice(0, 8),
        author: {
          address: post.author.address,
          username: post.author?.username?.value,
          name: post.author?.metadata?.name,
          picture: post.author?.metadata?.picture,
        },
        metadata: {
          content: post.metadata?.content,
          attributes: post.metadata?.attributes || [],
        },
      }))

      return videos
    },
    enabled: !!geniusId && geniusId > 0,
  })
}

/**
 * Fetch videos for a specific creator performing songs by a specific artist
 *
 * Filters by both:
 * - Lens account (creator)
 * - genius_artist_id attribute (original artist)
 */
export function useCreatorArtistVideos(creatorLensAccount?: string, geniusArtistId?: number) {
  return useQuery({
    queryKey: ['creator-artist-videos', creatorLensAccount, geniusArtistId],
    queryFn: async () => {
      if (!creatorLensAccount || !geniusArtistId) return []

      const result = await fetchPosts(lensClient, {
        filter: {
          authors: [creatorLensAccount],
          metadata: {
            tags: {
              oneOf: [`genius_artist_id:${geniusArtistId}`],
            },
          },
        },
      })

      if (result.isErr()) {
        throw result.error
      }

      const videos: VideoPost[] = result.value.items.map((post: any) => ({
        id: post.id,
        thumbnailUrl: post.metadata?.cover?.optimized?.uri || post.metadata?.image?.optimized?.uri || 'https://placehold.co/400x711/8b5cf6/ffffff?text=Video',
        username: post.author?.username?.value || post.author?.address.slice(0, 8),
        author: {
          address: post.author.address,
          username: post.author?.username?.value,
          name: post.author?.metadata?.name,
          picture: post.author?.metadata?.picture,
        },
        metadata: {
          content: post.metadata?.content,
          attributes: post.metadata?.attributes || [],
        },
      }))

      return videos
    },
    enabled: !!creatorLensAccount && !!geniusArtistId && geniusArtistId > 0,
  })
}
