import type { Component } from 'solid-js'

/**
 * FeedLoadingSkeleton - Loading state for video feeds
 *
 * Mobile: Blank screen (instant feel)
 * Desktop: Skeleton matching VideoPost layout
 */
export const FeedLoadingSkeleton: Component = () => {
  return (
    <div class="h-screen w-full flex items-center justify-center bg-background">
      {/* Mobile: blank screen for instant feel */}
      <div class="md:hidden" />

      {/* Desktop: skeleton loader matching VideoPost dimensions */}
      <div class="max-md:hidden relative flex items-center justify-center">
        {/* Video container skeleton - matches VideoPost 9:16 dimensions */}
        <div class="relative w-[50.625vh] h-[90vh] max-w-[450px] max-h-[800px] bg-neutral-900 rounded-lg overflow-hidden">
          {/* Video area with gradient animation */}
          <div class="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 animate-pulse" />

          {/* Bottom info skeleton - matches VideoInfo position */}
          <div class="absolute bottom-4 left-6 right-20 space-y-3">
            {/* Username skeleton */}
            <div class="h-4 w-32 bg-neutral-700/80 rounded animate-pulse" />
            {/* Music info skeleton */}
            <div class="h-3 w-48 bg-neutral-700/80 rounded animate-pulse" />
          </div>
        </div>

        {/* Desktop actions column skeleton */}
        <div class="absolute right-[calc(50%-25vh-60px)] top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-6">
          {/* Mute button */}
          <div class="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
          {/* Avatar */}
          <div class="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
          {/* Like button */}
          <div class="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
          {/* Share button */}
          <div class="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
          {/* Study button */}
          <div class="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
          {/* Audio source */}
          <div class="w-12 h-12 bg-neutral-800/50 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}
