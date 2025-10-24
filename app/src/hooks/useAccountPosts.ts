import { useQuery } from '@tanstack/react-query'
import { lensClient } from '@/lib/lens'
import { evmAddress } from '@lens-protocol/client'
import { fetchAccount, fetchPosts } from '@lens-protocol/client/actions'
import { convertGroveUri } from '@/lib/lens/utils'
import type { VideoPost } from '@/components/video/VideoGrid'

/**
 * Lens post metadata from Grove
 */
interface LensPostMetadata {
  $schema?: string
  lens?: {
    content: string
    mainContentFocus: string
    title?: string
    id: string
    locale: string
  }
  storyProtocol?: {
    ipId: string
  }
  video?: {
    uri: string
    type: string
  }
  image?: {
    uri: string
    type: string
  }
  attachments?: Array<{
    uri: string
    type: string
  }>
}

/**
 * Fetch posts by Lens account address
 *
 * @param accountAddress - Lens account contract address
 * @returns Posts with their metadata
 */
export function useAccountPosts(accountAddress?: string) {
  return useQuery({
    queryKey: ['account-posts', accountAddress],
    queryFn: async (): Promise<VideoPost[]> => {
      if (!accountAddress) {
        throw new Error('Account address is required')
      }

      // Fetch account by address
      const accountResult = await fetchAccount(lensClient as any, {
        address: evmAddress(accountAddress),
      })

      if (accountResult.isErr()) {
        throw new Error(`Failed to fetch account: ${accountResult.error?.message}`)
      }

      const accountData = accountResult.value
      if (!accountData) {
        throw new Error('Account not found')
      }

      // Fetch posts by account
      const postsResult = await fetchPosts(lensClient as any, {
        filter: {
          authors: [accountData.address],
        },
      })

      if (postsResult.isErr()) {
        throw new Error(`Failed to fetch posts: ${postsResult.error?.message}`)
      }

      const posts = Array.from(postsResult.value.items)

      // Fetch metadata for each post
      const videoPosts = (await Promise.all(
        posts.map(async (p: any) => {
          try {
            // Fetch metadata from Grove
            const metadataUrl = convertGroveUri(p.metadata)
            const response = await fetch(metadataUrl)

            if (!response.ok) {
              console.warn(`Failed to fetch metadata for post ${p.id}:`, response.status)
              return null
            }

            const metadata: LensPostMetadata = await response.json()

            // Extract video URI
            const videoUri = metadata.video?.uri ||
                           metadata.attachments?.[0]?.uri ||
                           metadata.image?.uri

            if (!videoUri) {
              console.warn(`No video URI found for post ${p.id}`)
              return null
            }

            // Convert to VideoPost format
            return {
              id: p.id,
              videoUrl: convertGroveUri(videoUri),
              thumbnailUrl: convertGroveUri(videoUri), // Use video as thumbnail for now
              username: accountData.username?.localName || 'unknown',
              songTitle: metadata.lens?.title || 'Untitled',
              timestamp: new Date(p.timestamp),
              likes: 0, // TODO: Fetch from Lens reactions
              comments: 0, // TODO: Fetch from Lens comments
              views: 0, // TODO: Fetch from Lens stats
            } as VideoPost
          } catch (error) {
            console.error(`Error processing post ${p.id}:`, error)
            return null
          }
        })
      )).filter((p): p is VideoPost => p !== null)

      // Return filtered posts
      return videoPosts
    },
    enabled: !!accountAddress,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}
