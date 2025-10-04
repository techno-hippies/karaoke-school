import { DotsThree } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ProfileActionsProps {
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
 * ProfileActions - Action buttons for profile header
 * Shows Edit button for own profile, Follow/Message/More for others
 */
export function ProfileActions({
  isOwnProfile,
  isFollowing = false,
  isFollowLoading = false,
  onEditClick,
  onFollowClick,
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
          className="flex-1 md:flex-initial px-6 py-3"
        >
          Edit profile
        </Button>
      ) : (
        // Other profile - Follow, Message, More buttons
        <>
          <Button
            onClick={onFollowClick}
            disabled={isFollowLoading}
            variant={isFollowing ? 'secondary' : 'default'}
            className="flex-1 md:flex-initial px-6 py-3"
          >
            {isFollowLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
          </Button>
          <Button
            onClick={onMessageClick}
            variant="secondary"
            className="flex-1 md:flex-initial px-6 py-3"
          >
            Message
          </Button>
          <Button
            onClick={onMoreClick}
            variant="secondary"
            size="icon"
          >
            <DotsThree className="w-5 h-5 md:w-6 md:h-6" weight="bold" />
          </Button>
        </>
      )}
    </div>
  )
}
