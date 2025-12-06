/**
 * Icon component using @phosphor-icons/web
 * https://phosphoricons.com
 *
 * Usage:
 *   <Icon name="house" />
 *   <Icon name="house" weight="fill" />
 *   <Icon name="crown" class="text-yellow-500 text-2xl" />
 *
 * IMPORTANT: Use text-* classes for sizing (text-xl, text-2xl, text-3xl, etc.)
 * The w-* h-* classes don't work for font-based icons!
 */

// Import only the weights we need
import '@phosphor-icons/web/regular'
import '@phosphor-icons/web/fill'
import '@phosphor-icons/web/bold'

import type { Component, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '@/lib/utils'

export type IconWeight = 'regular' | 'fill' | 'bold'

export type IconName =
  | 'house'
  | 'magnifying-glass'
  | 'exam'
  | 'chat-circle'
  | 'wallet'
  | 'key'
  | 'check-circle'
  | 'warning-circle'
  | 'caret-left'
  | 'x'
  | 'play'
  | 'pause'
  | 'music-note'
  | 'music-notes-simple'
  | 'user'
  | 'paper-plane-right'
  | 'waveform'
  | 'stop'
  | 'translate'
  | 'speaker-high'
  | 'speaker-slash'
  | 'sparkle'
  | 'warning'
  | 'copy'
  | 'check'
  | 'sign-out'
  | 'heart'
  | 'share-network'
  | 'books'
  | 'plus'
  | 'lock-simple'
  | 'globe'
  | 'crown'
  | 'crown-cross'
  | 'microphone'
  | 'arrow-left'
  | 'arrow-right'
  | 'caret-right'
  | 'caret-down'
  | 'caret-up'
  | 'dots-three'
  | 'gear'
  | 'info'
  | 'question'
  | 'trash'
  | 'pencil'
  | 'eye'
  | 'eye-slash'
  | 'link'
  | 'chat-text'
  | 'image'
  | 'video-camera'
  | 'music-notes'
  | 'list'
  | 'squares-four'
  | 'spinner'
  | 'circle-notch'
  | 'repeat'
  | 'shuffle'
  | 'skip-back'
  | 'skip-forward'
  | 'rewind'
  | 'fast-forward'
  | 'seal-check'
  | 'google-logo'
  | 'discord-logo'

export interface IconProps extends JSX.HTMLAttributes<HTMLElement> {
  name: IconName
  weight?: IconWeight
}

/**
 * Icon component using Phosphor Icons web font
 *
 * @example
 * <Icon name="house" />
 * <Icon name="heart" weight="fill" class="text-red-500 text-2xl" />
 */
export const Icon: Component<IconProps> = (props) => {
  const [local, others] = splitProps(props, ['name', 'weight', 'class'])

  const weightClass = () => {
    switch (local.weight) {
      case 'fill':
        return 'ph-fill'
      case 'bold':
        return 'ph-bold'
      default:
        return 'ph'
    }
  }

  return (
    <i
      class={cn(weightClass(), `ph-${local.name}`, local.class)}
      {...others}
    />
  )
}
