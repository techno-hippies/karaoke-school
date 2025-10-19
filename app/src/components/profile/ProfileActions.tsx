import { DotsThree } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ProfileActionsProps {
  isOwnProfile: boolean
  isFollowing?: boolean
  isEnrolled?: boolean
  isFollowLoading?: boolean
  onEditClick?: () => void
  onFollowClick?: () => void
  onEnrollClick?: () => void
  onMessageClick?: () => void
  onMoreClick?: () => void
  className?: string
}

/**
 * ProfileActions - Action buttons for profile header
 *
 * States:
 * - Own profile: [Edit profile]
 * - Not following: [Follow] [Enroll]
 * - Following, not enrolled: [Following] [Enroll]
 * - Enrolled: [Message] [Enrolled ✓]
 */
export function ProfileActions({
  isOwnProfile,
  isFollowing = false,
  isEnrolled = false,
  isFollowLoading = false,
  onEditClick,
  onFollowClick,
  onEnrollClick,
  onMessageClick,
  onMoreClick,
  className
}: ProfileActionsProps) {
  return (
    <div className={cn('flex gap-2 md:gap-3 mt-4', className)}>
      {isOwnProfile ? (
        // Own profile - Edit button
        <Button
          onClick={onEditClick}
          variant="default"
          size="lg"
          className="flex-1 md:flex-initial"
        >
          Edit profile
        </Button>
      ) : isEnrolled ? (
        // Enrolled - Message and Enrolled indicator
        <>
          <Button
            onClick={onMessageClick}
            variant="default"
            size="lg"
            className="flex-1 md:flex-initial"
          >
            Message
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="flex-1 md:flex-initial"
            disabled
          >
            Enrolled ✓
          </Button>
          <Button
            onClick={onMoreClick}
            variant="secondary"
            size="icon"
            className="h-12 w-12"
          >
            <DotsThree className="w-6 h-6" weight="bold" />
          </Button>
        </>
      ) : (
        // Not enrolled - Follow/Following toggle and Study
        // UX: Follow is primary initially, then Study becomes primary after following
        <>
          <Button
            onClick={onFollowClick}
            disabled={isFollowLoading}
            variant={isFollowing ? 'secondary' : 'default'}
            size="lg"
            className="flex-1 md:flex-initial"
          >
            {isFollowLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
          </Button>
          <Button
            onClick={onEnrollClick}
            variant={isFollowing ? 'default' : 'secondary'}
            size="lg"
            className="flex-1 md:flex-initial"
          >
            {isEnrolled ? 'Enrolled' : 'Study'}
          </Button>
          <Button
            onClick={onMoreClick}
            variant="secondary"
            size="icon"
            className="h-12 w-12"
          >
            <DotsThree className="w-6 h-6" weight="bold" />
          </Button>
        </>
      )}
    </div>
  )
}
