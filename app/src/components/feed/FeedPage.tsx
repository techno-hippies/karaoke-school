import { useState } from 'react'
import { ForYouFeed } from './ForYouFeed'
import { FollowingFeed } from './FollowingFeed'
import { VerticalVideoFeed } from './VerticalVideoFeed'
import { FeedLoadingSkeleton } from './FeedLoadingSkeleton'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

export type FeedTab = 'for-you' | 'following'

export interface FeedPageProps {
  defaultTab?: FeedTab
}

/**
 * FeedPage - Main feed container with For You and Following tabs
 *
 * Tabs:
 * - For You: Global feed of all karaoke videos (copyright-free)
 * - Following: Personalized feed from creators you follow (requires auth)
 *
 * Mobile: Full screen vertical scrolling
 * Desktop: Centered 9:16 cards with snap scrolling
 */
export function FeedPage({ defaultTab = 'for-you' }: FeedPageProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>(defaultTab)
  const { lensSession } = useAuth()
  const isAuthenticated = !!lensSession

  return (
    <div className="relative h-vh-screen md:h-screen w-full bg-background">
      {/* Tab Navigation - fixed at top */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center pt-safe pointer-events-none">
        <div className="flex gap-8 pt-4 pb-2 pointer-events-auto">
          <button
            onClick={() => setActiveTab('for-you')}
            className={cn(
              'text-base font-semibold transition-colors cursor-pointer',
              activeTab === 'for-you'
                ? 'text-white'
                : 'text-neutral-400'
            )}
          >
            For You
            {activeTab === 'for-you' && (
              <div className="h-0.5 bg-white mt-1 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={cn(
              'text-base font-semibold transition-colors',
              activeTab === 'following'
                ? 'text-white'
                : 'text-neutral-400',
              !isAuthenticated ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            )}
            disabled={!isAuthenticated}
            title={!isAuthenticated ? 'Sign in to see your Following feed' : ''}
          >
            Following
            {activeTab === 'following' && (
              <div className="h-0.5 bg-white mt-1 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Feed Content */}
      {activeTab === 'for-you' && (
        <ForYouFeed>
          {(videos, isLoading) => {
            // Show loading skeleton (desktop only, mobile shows blank)
            if (isLoading && videos.length === 0) {
              return <FeedLoadingSkeleton />
            }

            return (
              <VerticalVideoFeed
                videos={videos}
                isLoading={isLoading}
                onLoadMore={() => {
                  console.log('[FeedPage] Load more requested')
                  // TODO: Implement pagination
                }}
                hasMore={false} // TODO: Implement pagination
                hasMobileFooter={true}
              />
            )
          }}
        </ForYouFeed>
      )}

      {activeTab === 'following' && (
        <FollowingFeed>
          {(videos, isLoading, error) => {
            // Show error state
            if (error) {
              return (
                <div className="h-vh-screen md:h-screen w-full flex items-center justify-center bg-background">
                  <div className="text-white text-center px-8">
                    <div className="text-xl font-semibold mb-2">⚠️ {error}</div>
                    <div className="text-neutral-400 mt-2">
                      {!isAuthenticated
                        ? 'Sign in to see posts from creators you follow'
                        : 'Try following some creators first'}
                    </div>
                  </div>
                </div>
              )
            }

            // Show loading skeleton (desktop only, mobile shows blank)
            if (isLoading && videos.length === 0) {
              return <FeedLoadingSkeleton />
            }

            // Show empty state
            if (videos.length === 0 && !isLoading) {
              return (
                <div className="h-vh-screen md:h-screen w-full flex items-center justify-center bg-background">
                  <div className="text-white text-center px-8">
                    <div className="text-xl font-semibold mb-2">No posts yet</div>
                    <div className="text-neutral-400">
                      Follow creators to see their karaoke videos here
                    </div>
                  </div>
                </div>
              )
            }

            // Show video feed
            return (
              <VerticalVideoFeed
                videos={videos}
                isLoading={isLoading}
                onLoadMore={() => {
                  console.log('[FeedPage] Following: Load more requested')
                  // TODO: Implement pagination with timeline.next()
                }}
                hasMore={false} // TODO: Implement pagination
                hasMobileFooter={true}
              />
            )
          }}
        </FollowingFeed>
      )}
    </div>
  )
}
