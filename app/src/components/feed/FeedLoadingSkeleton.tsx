/**
 * FeedLoadingSkeleton - Loading state for video feeds
 *
 * Mobile: Blank screen (instant feel)
 * Desktop: Skeleton matching VideoPost layout
 */
export function FeedLoadingSkeleton() {
  return (
    <div className="h-vh-screen md:h-screen w-full flex items-center justify-center bg-background">
      {/* Mobile: blank screen for instant feel */}
      <div className="md:hidden" />

      {/* Desktop: skeleton loader matching VideoPost dimensions */}
      <div className="max-md:hidden relative flex items-center justify-center">
        {/* Video container skeleton - matches VideoPost 9:16 dimensions */}
        <div className="relative w-[50.625vh] h-[90vh] max-w-[450px] max-h-[800px] bg-neutral-900 rounded-lg overflow-hidden">
          {/* Video area with gradient animation */}
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
