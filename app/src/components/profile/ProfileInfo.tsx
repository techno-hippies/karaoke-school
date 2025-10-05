import { SealCheck } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface ProfileInfoProps {
  username: string
  displayName?: string
  bio?: string
  isVerified?: boolean
  alignment?: 'left' | 'center'
  className?: string
}

/**
 * ProfileInfo - Username, display name, bio, and verified badge
 * Responsive text sizes and auto-responsive alignment
 */
export function ProfileInfo({
  username,
  displayName,
  bio,
  isVerified = false,
  alignment = 'center',
  className
}: ProfileInfoProps) {
  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center md:text-left'
  }

  // Show display name if it exists and is different from username
  const showDisplayName = displayName && displayName !== username
  const primaryName = displayName || username

  return (
    <div className={cn(alignmentClasses[alignment], className)}>
      {/* Primary Name */}
      <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
        <h1 className="text-xl md:text-3xl font-bold text-foreground">
          {primaryName}
        </h1>
        {isVerified && (
          <SealCheck
            className="w-5 h-5 md:w-7 md:h-7 text-blue-500 flex-shrink-0"
            weight="fill"
          />
        )}
      </div>

      {/* Username (if different from display name) */}
      {showDisplayName && (
        <h2 className="text-base md:text-xl text-neutral-400 mb-2 md:mb-4">
          @{username}
        </h2>
      )}

      {/* Bio */}
      {bio && (
        <p className="text-base md:text-lg text-neutral-300 mt-2 md:mt-0 mb-4">
          {bio}
        </p>
      )}
    </div>
  )
}
