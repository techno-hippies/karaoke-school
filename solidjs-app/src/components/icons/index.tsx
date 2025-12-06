/**
 * Icon components using @phosphor-icons/web
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

// All available icon names we use in the app
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
 * <Icon name="crown" class="text-yellow-500 text-3xl" />
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
      class={cn(
        weightClass(),
        `ph-${local.name}`,
        local.class
      )}
      {...others}
    />
  )
}

// ============================================================================
// Named icon components for backwards compatibility and convenience
// These wrap the Icon component with preset names
// ============================================================================

interface SimpleIconProps extends Omit<IconProps, 'name'> {
  class?: string
}

export const House: Component<SimpleIconProps> = (props) => (
  <Icon name="house" {...props} />
)

export const MagnifyingGlass: Component<SimpleIconProps> = (props) => (
  <Icon name="magnifying-glass" {...props} />
)

export const Exam: Component<SimpleIconProps> = (props) => (
  <Icon name="exam" {...props} />
)

export const ChatCircle: Component<SimpleIconProps> = (props) => (
  <Icon name="chat-circle" {...props} />
)

export const Wallet: Component<SimpleIconProps> = (props) => (
  <Icon name="wallet" {...props} />
)

export const Key: Component<SimpleIconProps> = (props) => (
  <Icon name="key" {...props} />
)

export const CheckCircle: Component<SimpleIconProps> = (props) => (
  <Icon name="check-circle" {...props} />
)

export const AlertCircle: Component<SimpleIconProps> = (props) => (
  <Icon name="warning-circle" {...props} />
)

export const ChevronLeft: Component<SimpleIconProps> = (props) => (
  <Icon name="caret-left" {...props} />
)

export const X: Component<SimpleIconProps> = (props) => (
  <Icon name="x" {...props} />
)

export const Play: Component<SimpleIconProps> = (props) => (
  <Icon name="play" {...props} />
)

export const Pause: Component<SimpleIconProps> = (props) => (
  <Icon name="pause" {...props} />
)

export const MusicNote: Component<SimpleIconProps> = (props) => (
  <Icon name="music-note" {...props} />
)

export const User: Component<SimpleIconProps> = (props) => (
  <Icon name="user" {...props} />
)

export const PaperPlaneRight: Component<SimpleIconProps> = (props) => (
  <Icon name="paper-plane-right" {...props} />
)

export const Waveform: Component<SimpleIconProps> = (props) => (
  <Icon name="waveform" {...props} />
)

export const Stop: Component<SimpleIconProps> = (props) => (
  <Icon name="stop" {...props} />
)

export const Translate: Component<SimpleIconProps> = (props) => (
  <Icon name="translate" {...props} />
)

export const SpeakerHigh: Component<SimpleIconProps> = (props) => (
  <Icon name="speaker-high" {...props} />
)

export const SpeakerSlash: Component<SimpleIconProps> = (props) => (
  <Icon name="speaker-slash" {...props} />
)

export const Sparkle: Component<SimpleIconProps> = (props) => (
  <Icon name="sparkle" {...props} />
)

export const Warning: Component<SimpleIconProps> = (props) => (
  <Icon name="warning" {...props} />
)

export const Copy: Component<SimpleIconProps> = (props) => (
  <Icon name="copy" {...props} />
)

export const Check: Component<SimpleIconProps> = (props) => (
  <Icon name="check" {...props} />
)

export const SignOut: Component<SimpleIconProps> = (props) => (
  <Icon name="sign-out" {...props} />
)

export const Heart: Component<SimpleIconProps> = (props) => (
  <Icon name="heart" {...props} />
)

export const ShareNetwork: Component<SimpleIconProps> = (props) => (
  <Icon name="share-network" {...props} />
)

export const Books: Component<SimpleIconProps> = (props) => (
  <Icon name="books" {...props} />
)

export const Plus: Component<SimpleIconProps> = (props) => (
  <Icon name="plus" {...props} />
)

export const LockSimple: Component<SimpleIconProps> = (props) => (
  <Icon name="lock-simple" {...props} />
)

export const Globe: Component<SimpleIconProps> = (props) => (
  <Icon name="globe" {...props} />
)

export const Crown: Component<SimpleIconProps> = (props) => (
  <Icon name="crown" {...props} />
)

export const Microphone: Component<SimpleIconProps> = (props) => (
  <Icon name="microphone" {...props} />
)

export const ArrowLeft: Component<SimpleIconProps> = (props) => (
  <Icon name="arrow-left" {...props} />
)

export const ArrowRight: Component<SimpleIconProps> = (props) => (
  <Icon name="arrow-right" {...props} />
)

export const CaretRight: Component<SimpleIconProps> = (props) => (
  <Icon name="caret-right" {...props} />
)

export const CaretDown: Component<SimpleIconProps> = (props) => (
  <Icon name="caret-down" {...props} />
)

export const CaretUp: Component<SimpleIconProps> = (props) => (
  <Icon name="caret-up" {...props} />
)

export const DotsThree: Component<SimpleIconProps> = (props) => (
  <Icon name="dots-three" {...props} />
)

export const Gear: Component<SimpleIconProps> = (props) => (
  <Icon name="gear" {...props} />
)

export const Info: Component<SimpleIconProps> = (props) => (
  <Icon name="info" {...props} />
)

export const Question: Component<SimpleIconProps> = (props) => (
  <Icon name="question" {...props} />
)

export const Trash: Component<SimpleIconProps> = (props) => (
  <Icon name="trash" {...props} />
)

export const Pencil: Component<SimpleIconProps> = (props) => (
  <Icon name="pencil" {...props} />
)

export const Eye: Component<SimpleIconProps> = (props) => (
  <Icon name="eye" {...props} />
)

export const EyeSlash: Component<SimpleIconProps> = (props) => (
  <Icon name="eye-slash" {...props} />
)

export const Link: Component<SimpleIconProps> = (props) => (
  <Icon name="link" {...props} />
)

export const ChatText: Component<SimpleIconProps> = (props) => (
  <Icon name="chat-text" {...props} />
)

export const Image: Component<SimpleIconProps> = (props) => (
  <Icon name="image" {...props} />
)

export const VideoCamera: Component<SimpleIconProps> = (props) => (
  <Icon name="video-camera" {...props} />
)

export const MusicNotes: Component<SimpleIconProps> = (props) => (
  <Icon name="music-notes" {...props} />
)

export const List: Component<SimpleIconProps> = (props) => (
  <Icon name="list" {...props} />
)

export const SquaresFour: Component<SimpleIconProps> = (props) => (
  <Icon name="squares-four" {...props} />
)

export const Spinner: Component<SimpleIconProps> = (props) => (
  <Icon name="spinner" {...props} />
)

export const CircleNotch: Component<SimpleIconProps> = (props) => (
  <Icon name="circle-notch" {...props} />
)

export const Repeat: Component<SimpleIconProps> = (props) => (
  <Icon name="repeat" {...props} />
)

export const Shuffle: Component<SimpleIconProps> = (props) => (
  <Icon name="shuffle" {...props} />
)

export const SkipBack: Component<SimpleIconProps> = (props) => (
  <Icon name="skip-back" {...props} />
)

export const SkipForward: Component<SimpleIconProps> = (props) => (
  <Icon name="skip-forward" {...props} />
)

export const Rewind: Component<SimpleIconProps> = (props) => (
  <Icon name="rewind" {...props} />
)

export const FastForward: Component<SimpleIconProps> = (props) => (
  <Icon name="fast-forward" {...props} />
)
