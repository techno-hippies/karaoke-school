import { ProfileAvatar } from './ProfileAvatar'
import { ProfileInfo } from './ProfileInfo'
import { ProfileStats } from './ProfileStats'
import { ProfileActions } from './ProfileActions'
import { cn } from '@/lib/utils'

export interface ProfileHeaderProps {
  username: string
  displayName?: string
  avatarUrl: string
  bio?: string
  following: number
  followers: number
  isVerified?: boolean
  isOwnProfile: boolean
  isFollowing?: boolean
  isFollowLoading?: boolean
  onEditClick?: () => void
  onFollowClick?: () => void
  onMessageClick?: () => void
  onMoreClick?: () => void
  className?: string
}

/**
 * ProfileHeader - Composed profile header with avatar, info, stats, and actions
 * Single responsive implementation - no desktop/mobile duplication
 */
export function ProfileHeader({
  username,
  displayName,
  avatarUrl,
  bio,
  following,
  followers,
  isVerified = false,
  isOwnProfile,
  isFollowing = false,
  isFollowLoading = false,
  onEditClick,
  onFollowClick,
  onMessageClick,
  onMoreClick,
  className
}: ProfileHeaderProps) {
  return (
    <div className={cn(
      'w-full bg-neutral-900 text-foreground px-4 md:px-6 py-4 md:py-6',
      className
    )}>
      {/* Single responsive layout - flex-col on mobile, flex-row on desktop */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-start">

        {/* Avatar */}
        <ProfileAvatar
          src={avatarUrl}
          alt={displayName || username}
          size="lg"
        />

        {/* Info, Stats, Actions - centered on mobile, left-aligned on desktop */}
        <div className="flex-1 w-full">
          <ProfileInfo
            username={username}
            displayName={displayName}
            bio={bio}
            isVerified={isVerified}
            alignment="center"
          />

          <ProfileStats
            following={following}
            followers={followers}
          />

          <ProfileActions
            isOwnProfile={isOwnProfile}
            isFollowing={isFollowing}
            isFollowLoading={isFollowLoading}
            onEditClick={onEditClick}
            onFollowClick={onFollowClick}
            onMessageClick={onMessageClick}
            onMoreClick={onMoreClick}
          />
        </div>
      </div>
    </div>
  )
}
