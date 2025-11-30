import { ForYouFeed } from './ForYouFeed'
import { VerticalVideoFeed } from './VerticalVideoFeed'
import { FeedLoadingSkeleton } from './FeedLoadingSkeleton'

/**
 * FeedPage - Main feed container
 *
 * Shows global feed of all karaoke videos
 *
 * Mobile: Full screen vertical scrolling
 * Desktop: Centered 9:16 cards with snap scrolling
 */
export function FeedPage() {
  return (
    <div className="relative h-vh-screen md:h-screen w-full bg-background">
      <ForYouFeed>
        {(videos, isLoading) => {
          if (isLoading && videos.length === 0) {
            return <FeedLoadingSkeleton />
          }

          return (
            <VerticalVideoFeed
              videos={videos}
              isLoading={isLoading}
              onLoadMore={() => {
                console.log('[FeedPage] Load more requested')
              }}
              hasMore={false}
              hasMobileFooter={true}
            />
          )
        }}
      </ForYouFeed>
    </div>
  )
}
