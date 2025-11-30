import { useState, useEffect, useRef } from 'react'
import { Skeleton } from './skeleton'
import { cn } from '@/lib/utils'

interface AvatarWithSkeletonProps {
  src?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
}

/**
 * Avatar that shows skeleton until image fully loads.
 * Prevents flash of placeholder → image transitions.
 */
export function AvatarWithSkeleton({
  src,
  alt = '',
  size = 'sm',
  className,
}: AvatarWithSkeletonProps) {
  const [loaded, setLoaded] = useState(false)
  const prevSrc = useRef(src)

  // Reset loaded state when src changes
  useEffect(() => {
    if (src !== prevSrc.current) {
      setLoaded(false)
      prevSrc.current = src
    }
  }, [src])

  const sizeClass = sizeClasses[size]
  const showSkeleton = !src || !loaded

  return (
    <div className={cn('relative flex-shrink-0', sizeClass, className)}>
      {/* Skeleton shown while no src or loading */}
      {showSkeleton && (
        <Skeleton className={cn('absolute inset-0 rounded-full', sizeClass)} />
      )}

      {/* Image - hidden until loaded */}
      {src && (
        <img
          key={src}
          src={src}
          alt={alt}
          className={cn(
            'absolute inset-0 rounded-full object-cover',
            sizeClass,
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  )
}
