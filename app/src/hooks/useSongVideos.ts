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
 * Fetch all creator videos for a given song (by grc20WorkId or genius_id)
 *
 * Uses Lens GraphQL to query posts filtered by tags or attributes.
 * This returns videos from ALL creators who performed this song.
 */
export function useSongVideos(identifier?: number | string) {
  // Determine if identifier is GRC-20 work ID (UUID string) or genius ID (number)
  const isGrc20 = typeof identifier === 'string'
  const grc20WorkId = isGrc20 ? identifier : undefined
  const geniusId = typeof identifier === 'number' ? identifier : undefined

  return useQuery({
    queryKey: ['song-videos', identifier],
    queryFn: async () => {
      if (!identifier) return []

      // Try tag-based query first (fastest)
      let result
      if (grc20WorkId) {
        // Query by GRC-20 work ID tag
        result = await fetchPosts(lensClient, {
          filter: {
            metadata: {
              tags: {
                oneOf: [`grc20-${grc20WorkId}`],
              },
            },
          },
        })
      } else if (geniusId) {
        // Query by genius ID tag (legacy)
        result = await fetchPosts(lensClient, {
          filter: {
            metadata: {
              tags: {
                oneOf: [`genius-${geniusId}`],
              },
            },
          },
        })
      }

      if (!result || result.isErr() || result.value.items.length === 0) {
        // Fallback: fetch all karaoke posts and filter client-side by attribute
        console.log('[useSongVideos] Tag query failed, errored, or returned 0 results - falling back to client-side filter')
        const allResult = await fetchPosts(lensClient, {
          filter: {
            metadata: {
              tags: {
                all: ['karaoke'],
              },
            },
          },
        })

        if (allResult.isErr()) {
          throw allResult.error
        }

        // Filter by grc20_work_id attribute
        const filteredItems = allResult.value.items.filter((post: any) => {
          const attrs = post.metadata?.attributes || []
          if (grc20WorkId) {
            return attrs.some((a: any) => a.key === 'grc20_work_id' && a.value === grc20WorkId)
          } else if (geniusId) {
            return attrs.some((a: any) => a.key === 'genius_id' && Number(a.value) === geniusId)
          }
          return false
        })

        result = { ...allResult, value: { ...allResult.value, items: filteredItems } }
      }

      // Transform to VideoPost format
      const videos: VideoPost[] = result.value.items.map((post: any) => {
        // Extract thumbnail from video.cover field
        let thumbnailUrl = 'https://placehold.co/400x711/8b5cf6/ffffff?text=Video'

        if (post.metadata?.__typename === 'VideoMetadata' && post.metadata.video?.cover) {
          thumbnailUrl = post.metadata.video.cover
        } else if (post.metadata?.cover?.optimized?.uri) {
          thumbnailUrl = post.metadata.cover.optimized.uri
        } else if (post.metadata?.image?.optimized?.uri) {
          thumbnailUrl = post.metadata.image.optimized.uri
        }

        // Extract username without namespace prefix (lens/username -> username)
        const fullUsername = post.author?.username?.value || ''
        const username = fullUsername.includes('/')
          ? fullUsername.split('/')[1]
          : fullUsername || post.author?.address.slice(0, 8)

        return {
          id: post.id,
          thumbnailUrl,
          username,
          author: {
            address: post.author.address,
            username: fullUsername,
            name: post.author?.metadata?.name,
            picture: post.author?.metadata?.picture,
          },
          metadata: {
            content: post.metadata?.content,
            attributes: post.metadata?.attributes || [],
          },
        }
      })

      console.log(`[useSongVideos] Found ${videos.length} videos for ${isGrc20 ? 'GRC-20' : 'Genius'} ID: ${identifier}`)
      return videos
    },
    enabled: !!identifier && (typeof identifier === 'string' || identifier > 0),
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
