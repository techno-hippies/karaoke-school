import { useState } from 'react'
import { ForYouFeed } from './ForYouFeed'
import { FollowingFeed } from './FollowingFeed'
import { VerticalVideoFeed } from './VerticalVideoFeed'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

export type FeedTab = 'for-you' | 'following'

export interface FeedPageProps {
  defaultTab?: FeedTab
}

/**
 * FeedPage - Main feed container with For You and Following tabs
 * - For You: Copyright-free content from all creators (global feed)
 * - Following: All content from followed creators (personalized timeline)
 */
export function FeedPage({ defaultTab = 'for-you' }: FeedPageProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>(defaultTab)
  const { lensSession } = useAuth()
  const isAuthenticated = !!lensSession

  return (
    <div className="relative h-screen w-full bg-background">
      {/* Tab Navigation - positioned at top */}
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
            // Show loading skeleton (desktop only)
            if (isLoading && videos.length === 0) {
              return (
                <div className="h-screen w-full flex items-center justify-center bg-background">
                  {/* Mobile: blank screen */}
                  <div className="md:hidden" />

                  {/* Desktop: skeleton loader matching VideoPost layout */}
                  <div className="max-md:hidden relative flex items-center justify-center">
                    {/* Video container skeleton - matches VideoPost dimensions */}
                    <div className="relative w-[50.625vh] h-[90vh] max-w-[450px] max-h-[800px] bg-neutral-900 rounded-lg overflow-hidden">
                      {/* Video area with gradient */}
                      <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 animate-pulse" />

                      {/* Bottom info skeleton - matches VideoInfo position */}
                      <div className="absolute bottom-4 left-6 right-20 space-y-3">
                        {/* Username skeleton */}
                        <div className="h-4 w-32 bg-neutral-700/80 rounded animate-pulse" />
                        {/* Music info skeleton */}
                        <div className="h-3 w-48 bg-neutral-700/80 rounded animate-pulse" />
                      </div>
                    </div>

                    {/* Desktop actions column skeleton - positioned to the right like VideoPost desktop layout */}
                    <div className="absolute left-[calc(50%+25vh+20px)] top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-6">
                      {/* Mute button */}
                      <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                      {/* Action buttons with counts */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                        <div className="h-3 w-10 bg-neutral-700/50 rounded animate-pulse" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                        <div className="h-3 w-10 bg-neutral-700/50 rounded animate-pulse" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                        <div className="h-3 w-10 bg-neutral-700/50 rounded animate-pulse" />
                      </div>
                      {/* Audio source */}
                      <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <VerticalVideoFeed
                videos={videos}
                isLoading={isLoading}
                onLoadMore={() => {
                  console.log('[FeedPage] Load more requested')
                  // TODO: Implement pagination with usePagination hook
                }}
                hasMore={false} // TODO: Implement pagination
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
                <div className="h-screen w-full flex items-center justify-center bg-background">
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

            // Show loading skeleton (desktop only)
            if (isLoading && videos.length === 0) {
              return (
                <div className="h-screen w-full flex items-center justify-center bg-background">
                  {/* Mobile: blank screen */}
                  <div className="md:hidden" />

                  {/* Desktop: skeleton loader matching VideoPost layout */}
                  <div className="max-md:hidden relative flex items-center justify-center">
                    {/* Video container skeleton - matches VideoPost dimensions */}
                    <div className="relative w-[50.625vh] h-[90vh] max-w-[450px] max-h-[800px] bg-neutral-900 rounded-lg overflow-hidden">
                      {/* Video area with gradient */}
                      <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 animate-pulse" />

                      {/* Bottom info skeleton - matches VideoInfo position */}
                      <div className="absolute bottom-4 left-6 right-20 space-y-3">
                        {/* Username skeleton */}
                        <div className="h-4 w-32 bg-neutral-700/80 rounded animate-pulse" />
                        {/* Music info skeleton */}
                        <div className="h-3 w-48 bg-neutral-700/80 rounded animate-pulse" />
                      </div>
                    </div>

                    {/* Desktop actions column skeleton - positioned to the right like VideoPost desktop layout */}
                    <div className="absolute left-[calc(50%+25vh+20px)] top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-6">
                      {/* Mute button */}
                      <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                      {/* Action buttons with counts */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                        <div className="h-3 w-10 bg-neutral-700/50 rounded animate-pulse" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                        <div className="h-3 w-10 bg-neutral-700/50 rounded animate-pulse" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                        <div className="h-3 w-10 bg-neutral-700/50 rounded animate-pulse" />
                      </div>
                      {/* Audio source */}
                      <div className="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>
              )
            }

            // Show empty state
            if (videos.length === 0 && !isLoading) {
              return (
                <div className="h-screen w-full flex items-center justify-center bg-background">
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
              />
            )
          }}
        </FollowingFeed>
      )}
    </div>
  )
}
