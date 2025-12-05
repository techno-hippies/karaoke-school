import { X, DownloadSimple, ArrowsClockwise } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useEffect, useCallback } from 'react'

export interface ImageLightboxProps {
  /** Image URL to display */
  imageUrl: string
  /** Alt text for accessibility */
  alt?: string
  /** Called when lightbox should close */
  onClose: () => void
  /** Called when regenerate is clicked */
  onRegenerate?: () => void
  /** Whether regeneration is in progress */
  isRegenerating?: boolean
  className?: string
}

/**
 * ImageLightbox - Full screen overlay for viewing images
 *
 * Closes on backdrop click, escape key, or X button
 */
export function ImageLightbox({
  imageUrl,
  alt = 'Generated image',
  onClose,
  onRegenerate,
  isRegenerating = false,
  className,
}: ImageLightboxProps) {
  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generated-image-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-black/80 backdrop-blur-sm',
        className
      )}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className={cn(
          'absolute top-4 right-4 p-2 rounded-full',
          'bg-white/10 hover:bg-white/20 transition-colors',
          'text-white cursor-pointer'
        )}
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image container */}
      <div
        className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <img
          src={imageUrl}
          alt={alt}
          className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
        />

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full',
              'bg-white/10 hover:bg-white/20 transition-colors',
              'text-white text-sm cursor-pointer'
            )}
          >
            <DownloadSimple className="w-5 h-5" />
            <span>Download</span>
          </button>

          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full',
                'bg-white/10 hover:bg-white/20 transition-colors',
                'text-white text-sm cursor-pointer',
                isRegenerating && 'opacity-50 cursor-wait'
              )}
            >
              <ArrowsClockwise className={cn('w-5 h-5', isRegenerating && 'animate-spin')} />
              <span>{isRegenerating ? 'Generating...' : 'Regenerate'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
