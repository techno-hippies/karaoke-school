/**
 * VideoThumbnail - thumbnail with play indicator overlay
 */

import { Show, type Component } from 'solid-js'
import { cn } from '@/lib/utils'
import { Icon } from '../icons'

interface VideoThumbnailProps {
  src?: string
  alt?: string
  aspectRatio?: '16/9' | '9/16' | '1/1' | '4/3'
  showPlayButton?: boolean
  duration?: string
  class?: string
  onClick?: () => void
}

const VideoThumbnail: Component<VideoThumbnailProps> = (props) => {
  const aspectClass = () => {
    switch (props.aspectRatio) {
      case '16/9': return 'aspect-video'
      case '9/16': return 'aspect-[9/16]'
      case '4/3': return 'aspect-[4/3]'
      default: return 'aspect-square'
    }
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      class={cn(
        'relative w-full overflow-hidden rounded-xl bg-muted cursor-pointer group',
        aspectClass(),
        props.class
      )}
    >
      <Show
        when={props.src}
        fallback={
          <div class="w-full h-full bg-gradient-to-br from-pink-400 to-purple-600" />
        }
      >
        <img
          src={props.src}
          alt={props.alt ?? 'Video thumbnail'}
          class="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      </Show>

      {/* Play button overlay */}
      <Show when={props.showPlayButton !== false}>
        <div class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Icon name="play" class="text-xl text-black ml-0.5" />
          </div>
        </div>
      </Show>

      {/* Duration badge */}
      <Show when={props.duration}>
        <div class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium">
          {props.duration}
        </div>
      </Show>
    </button>
  )
}

export { VideoThumbnail }
