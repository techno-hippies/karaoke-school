/**
 * VideoGrid - Responsive grid for video posts
 * SolidJS implementation
 */

import { type Component, Show, For } from 'solid-js'
import { cn } from '@/lib/utils'
import { VideoThumbnail } from '@/components/ui/video-thumbnail'
import { Play } from '@/components/icons'

export interface VideoPost {
  id: string
  thumbnailUrl: string
  username: string
}

export interface VideoGridProps {
  videos: VideoPost[]
  onVideoClick?: (video: VideoPost) => void
  isLoading?: boolean
  showUsernames?: boolean
  class?: string
}

/**
 * VideoGrid - Responsive grid for video posts
 * - Mobile: 3 columns
 * - Desktop: 4-6 columns based on viewport width (like TikTok)
 * - No lock state, just clean video thumbnails
 */
export const VideoGrid: Component<VideoGridProps> = (props) => {
  return (
    <>
      {/* Loading skeleton */}
      <Show when={props.isLoading}>
        <div class={cn(props.class)}>
          <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-2">
            <For each={[1, 2, 3]}>
              {() => (
                <div class="aspect-[9/16] bg-neutral-800 rounded-md animate-pulse" />
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!props.isLoading && props.videos.length === 0}>
        <div class={cn(props.class)}>
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
              <Play class="w-12 h-12 text-neutral-600" />
            </div>
            <p class="text-neutral-400 text-base">No videos yet</p>
          </div>
        </div>
      </Show>

      {/* Video grid */}
      <Show when={!props.isLoading && props.videos.length > 0}>
        <div class={cn(props.class)}>
          <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-2">
            <For each={props.videos}>
              {(video) => (
                <div class="relative">
                  <VideoThumbnail
                    src={video.thumbnailUrl}
                    alt={`Video by ${video.username}`}
                    aspectRatio="9/16"
                    onClick={() => props.onVideoClick?.(video)}
                  />
                  <Show when={props.showUsernames !== false}>
                    <div class="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/70 to-transparent">
                      <p class="text-white text-xs truncate">@{video.username}</p>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </>
  )
}
