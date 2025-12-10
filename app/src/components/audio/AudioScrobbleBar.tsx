import { createSignal, createEffect, onCleanup, type Component, type Accessor } from 'solid-js'
import { Show } from 'solid-js'
import { formatTime } from '@/utils/time'

export interface AudioScrobbleBarProps {
  currentTime: Accessor<number>
  duration: Accessor<number>
  onSeek?: (time: number) => void
  showTimeLabels?: boolean
  isAudioLoading?: boolean
  class?: string
}

/**
 * Seekable audio progress bar with draggable thumb (SolidJS)
 */
export const AudioScrobbleBar: Component<AudioScrobbleBarProps> = (props) => {
  const [isDragging, setIsDragging] = createSignal(false)
  let progressBarRef: HTMLDivElement | undefined

  const progress = () => {
    const dur = props.duration()
    return dur > 0 ? (props.currentTime() / dur) * 100 : 0
  }

  const calculateSeekTime = (clientX: number): number => {
    if (!progressBarRef || props.duration() === 0) return 0
    const rect = progressBarRef.getBoundingClientRect()
    const clickX = clientX - rect.left
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width))
    return clickRatio * props.duration()
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (!props.onSeek) return
    setIsDragging(true)
    const seekTime = calculateSeekTime(e.clientX)
    props.onSeek(seekTime)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging() || !props.onSeek) return
    const seekTime = calculateSeekTime(e.clientX)
    props.onSeek(seekTime)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Attach global mouse listeners when dragging
  createEffect(() => {
    if (isDragging()) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      onCleanup(() => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      })
    }
  })

  return (
    <div class={props.class}>
      {/* Progress Bar */}
      <div
        ref={progressBarRef}
        class="relative w-full h-1 bg-neutral-700 rounded-full cursor-pointer group"
        onMouseDown={handleMouseDown}
      >
        {/* Filled portion */}
        <div
          class="absolute inset-y-0 left-0 bg-white rounded-full pointer-events-none"
          style={{ width: `${progress()}%` }}
        />

        {/* Draggable thumb */}
        <div
          class="absolute w-3 h-3 bg-white rounded-full pointer-events-none transition-transform group-hover:scale-125"
          style={{
            left: `${progress()}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>

      {/* Time Display */}
      <Show when={props.showTimeLabels !== false}>
        <div class="flex justify-between text-xs text-neutral-400 mt-3">
          <span>{props.isAudioLoading ? '--:--' : formatTime(props.currentTime())}</span>
          <span>{props.isAudioLoading ? '--:--' : formatTime(props.duration())}</span>
        </div>
      </Show>
    </div>
  )
}
