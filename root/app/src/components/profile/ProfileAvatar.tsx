import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface ProfileAvatarProps {
  src: string
  alt: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * ProfileAvatar - Responsive avatar with gradient fallback
 * Sizes: sm (64/80px), md (80/96px), lg (96/128px) - mobile/desktop
 */
export function ProfileAvatar({
  src,
  alt,
  size = 'md',
  className
}: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false)

  const sizeClasses = {
    sm: 'w-16 h-16 md:w-20 md:h-20',
    md: 'w-20 h-20 md:w-24 md:h-24',
    lg: 'w-24 h-24 md:w-32 md:h-32'
  }

  return (
    <div className={cn(
      'rounded-lg overflow-hidden flex-shrink-0',
      sizeClasses[size],
      className
    )}>
      {imageError ? (
        // Gradient fallback when image fails
        <div className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center">
          <span className="text-white font-bold text-2xl md:text-3xl">
            {alt.charAt(0).toUpperCase()}
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      )}
    </div>
  )
}
