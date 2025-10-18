import { useState } from 'react'
import { ForYouFeed } from './ForYouFeed'
import { VerticalVideoFeed } from './VerticalVideoFeed'
import { cn } from '@/lib/utils'

export type FeedTab = 'for-you' | 'following'

export interface FeedPageProps {
  defaultTab?: FeedTab
}

/**
 * FeedPage - Main feed container with For You and Following tabs
 * Currently only For You is implemented (copyright-free content)
 */
export function FeedPage({ defaultTab = 'for-you' }: FeedPageProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>(defaultTab)

  return (
    <div className="relative h-screen w-full bg-background">
      {/* Tab Navigation - positioned at top */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center pt-safe">
        <div className="flex gap-8 pt-4 pb-2">
          <button
            onClick={() => setActiveTab('for-you')}
            className={cn(
              'text-base font-semibold transition-colors',
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
                : 'text-neutral-400'
            )}
            disabled // Disabled until Following feed is implemented
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
          {(videos, isLoading) => (
            <VerticalVideoFeed
              videos={videos}
              isLoading={isLoading}
              onLoadMore={() => {
                console.log('[FeedPage] Load more requested')
                // TODO: Implement pagination with usePagination hook
              }}
              hasMore={false} // TODO: Implement pagination
            />
          )}
        </ForYouFeed>
      )}

      {activeTab === 'following' && (
        <div className="h-screen w-full flex items-center justify-center">
          <div className="text-white text-center px-8">
            <div className="text-xl font-semibold mb-2">Coming Soon</div>
            <div className="text-neutral-400">
              Follow creators to see their content here
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
