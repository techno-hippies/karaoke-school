import { Show, type Component } from 'solid-js'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/icons'
import type { VideoActionsProps } from './types'

/**
 * VideoActions - Vertical action buttons column
 * Profile avatar + follow, like, study, share, mute, audio source
 */
export const VideoActions: Component<VideoActionsProps> = (props) => {
  return (
    <div class={cn('flex flex-col items-center gap-2 md:gap-6', props.class)}>
      {/* Mute/Unmute Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          props.onToggleMute()
        }}
        class="flex flex-col items-center cursor-pointer"
      >
        <div class="rounded-full p-3 max-md:bg-transparent md:bg-black/30 md:backdrop-blur-sm md:hover:bg-black/40 transition-colors">
          <Show
            when={!props.isMuted}
            fallback={<Icon name="speaker-slash" class="text-4xl md:text-3xl text-foreground" />}
          >
            <Icon name="speaker-high" class="text-4xl md:text-3xl text-foreground" />
          </Show>
        </div>
      </button>

      {/* Profile Avatar with Follow Button */}
      <div class="relative flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation()
            props.onProfileClick()
          }}
          class="cursor-pointer"
        >
          <Show
            when={props.userAvatar}
            fallback={
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                {props.username.charAt(0).toUpperCase()}
              </div>
            }
          >
            <img
              src={props.userAvatar}
              alt={props.username}
              class="w-12 h-12 rounded-full object-cover bg-white"
            />
          </Show>
        </button>

        {/* Follow/Following Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (props.canFollow && !props.isFollowLoading) props.onFollowClick()
          }}
          disabled={!props.canFollow || props.isFollowLoading}
          class={cn(
            'absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200',
            props.isFollowing && !props.isFollowLoading
              ? 'bg-black/50 hover:bg-black/60'
              : 'bg-primary hover:bg-primary/90',
            (!props.canFollow || props.isFollowLoading) && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Show when={props.isFollowLoading}>
            <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </Show>
          <Show when={!props.isFollowLoading && props.isFollowing}>
            <Icon name="check" class="text-base text-primary" />
          </Show>
          <Show when={!props.isFollowLoading && !props.isFollowing}>
            <Icon name="plus" class="text-base text-foreground" />
          </Show>
        </button>
      </div>

      {/* Like Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          props.onLikeClick()
        }}
        class="flex flex-col items-center cursor-pointer"
      >
        <div
          class={cn(
            'rounded-full p-3 transition-colors',
            'max-md:bg-transparent',
            props.isLiked
              ? 'md:bg-red-500/15 md:hover:bg-red-500/20'
              : 'md:bg-black/30 md:backdrop-blur-sm md:hover:bg-black/40'
          )}
        >
          <Icon
            name="heart"
            class={cn(
              'text-4xl md:text-3xl transition-colors',
              props.isLiked ? 'text-red-500' : 'text-foreground'
            )}
            weight="fill"
          />
        </div>
      </button>

      {/* Share Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          props.onShareClick()
        }}
        class="flex flex-col items-center cursor-pointer"
      >
        <div class="rounded-full p-3 max-md:bg-transparent md:bg-black/30 md:backdrop-blur-sm md:hover:bg-black/40 transition-colors">
          <Icon name="share-network" class="text-4xl md:text-3xl text-foreground" weight="fill" />
        </div>
      </button>

      {/* Study Button */}
      <Show when={props.canStudy}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            props.onStudyClick?.()
          }}
          class="flex flex-col items-center cursor-pointer"
        >
          <div class="rounded-full p-3 max-md:bg-transparent md:bg-black/30 md:backdrop-blur-sm md:hover:bg-black/40 transition-colors">
            <Icon name="exam" class="text-4xl md:text-3xl text-foreground" weight="fill" />
          </div>
        </button>
      </Show>

      {/* Audio Source Button */}
      <Show when={props.musicTitle || props.musicAuthor}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            props.onAudioClick?.()
          }}
          class="cursor-pointer group"
        >
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center overflow-hidden">
            <Show
              when={props.musicImageUrl}
              fallback={<Icon name="music-note" class="text-2xl text-foreground" weight="fill" />}
            >
              <img
                src={props.musicImageUrl}
                alt={props.musicTitle}
                class="w-full h-full object-cover"
              />
            </Show>
          </div>
        </button>
      </Show>
    </div>
  )
}
