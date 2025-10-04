import { useState, useRef, useEffect } from 'react'
import { formatTime } from '@/utils/karaoke'

export interface AudioScrobbleBarProps {
  currentTime: number
  duration: number
  onSeek?: (time: number) => void
  showTimeLabels?: boolean
  className?: string
}

// Seekable audio progress bar with draggable thumb
export function AudioScrobbleBar({
  currentTime,
  duration,
  onSeek,
  showTimeLabels = true,
  className = '',
}: AudioScrobbleBarProps) {
  const [isDragging, setIsDragging] = useState(false)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const calculateSeekTime = (clientX: number): number => {
    if (!progressBarRef.current || duration === 0) return 0
    const rect = progressBarRef.current.getBoundingClientRect()
    const clickX = clientX - rect.left
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width))
    return clickRatio * duration
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return
    setIsDragging(true)
    const seekTime = calculateSeekTime(e.clientX)
    onSeek(seekTime)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !onSeek) return
    const seekTime = calculateSeekTime(e.clientX)
    onSeek(seekTime)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Attach global mouse move/up listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  return (
    <div className={className}>
      {/* Progress Bar */}
      <div
        ref={progressBarRef}
        className="relative w-full h-1 bg-neutral-700 rounded-full cursor-pointer group"
        onMouseDown={handleMouseDown}
      >
        {/* Filled portion */}
        <div
          className="absolute inset-y-0 left-0 bg-white rounded-full pointer-events-none"
          style={{ width: `${progress}%` }}
        />

        {/* Draggable thumb */}
        <div
          className="absolute w-3 h-3 bg-white rounded-full pointer-events-none transition-transform group-hover:scale-125"
          style={{
            left: `${progress}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>

      {/* Time Display */}
      {showTimeLabels && (
        <div className="flex justify-between text-xs text-neutral-400 mt-3">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}
    </div>
  )
}
