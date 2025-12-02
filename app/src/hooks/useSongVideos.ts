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
 * Fetch all creator videos for a song by Spotify track ID
 */
export function useSongVideos(spotifyTrackId?: string) {
  return useQuery({
    queryKey: ['song-videos', spotifyTrackId],
    queryFn: async () => {
      if (!spotifyTrackId) return []

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

      // Filter by spotify_track_id attribute
      const filteredItems = allResult.value.items.filter((post: any) => {
        const attrs = post.metadata?.attributes || []
        return attrs.some((a: any) => a.key === 'spotify_track_id' && a.value === spotifyTrackId)
      })

      // Transform to VideoPost format
      const videos: VideoPost[] = filteredItems.map((post: any) => {
        let thumbnailUrl = 'https://placehold.co/400x711/8b5cf6/ffffff?text=Video'

        if (post.metadata?.__typename === 'VideoMetadata' && post.metadata.video?.cover) {
          thumbnailUrl = post.metadata.video.cover
        } else if (post.metadata?.cover?.optimized?.uri) {
          thumbnailUrl = post.metadata.cover.optimized.uri
        } else if (post.metadata?.image?.optimized?.uri) {
          thumbnailUrl = post.metadata.image.optimized.uri
        }

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

      return videos
    },
    enabled: !!spotifyTrackId,
  })
}
