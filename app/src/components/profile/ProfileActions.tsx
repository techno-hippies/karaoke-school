import { DotsThree } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ProfileActionsProps {
  isOwnProfile: boolean
  isFollowing?: boolean
  isSubscribed?: boolean
  isFollowLoading?: boolean
  onEditClick?: () => void
  onFollowClick?: () => void
  onSubscribeClick?: () => void
  onMessageClick?: () => void
  onMoreClick?: () => void
  className?: string
}

/**
 * ProfileActions - Action buttons for profile header
 *
 * States:
 * - Own profile: [Edit profile]
 * - Not following: [Follow] [Subscribe - $6.99/month]
 * - Following, not subscribed: [Following ✓] [Subscribe - $6.99/month]
 * - Subscribed: [Message] [Subscribed ✓]
 */
export function ProfileActions({
  isOwnProfile,
  isFollowing = false,
  isSubscribed = false,
  isFollowLoading = false,
  onEditClick,
  onFollowClick,
  onSubscribeClick,
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
      ) : isSubscribed ? (
        // Subscribed - Message and Subscribed indicator
        <>
          <Button
            onClick={onMessageClick}
            variant="default"
            className="flex-1 md:flex-initial px-6 py-3"
          >
            Message
          </Button>
          <Button
            variant="secondary"
            className="flex-1 md:flex-initial px-6 py-3"
            disabled
          >
            Subscribed ✓
          </Button>
          <Button
            onClick={onMoreClick}
            variant="secondary"
            size="icon"
          >
            <DotsThree className="w-5 h-5 md:w-6 md:h-6" weight="bold" />
          </Button>
        </>
      ) : (
        // Not subscribed - Follow/Following and Subscribe
        <>
          <Button
            onClick={onFollowClick}
            disabled={isFollowLoading}
            variant="secondary"
            className="flex-1 md:flex-initial px-6 py-3"
          >
            {isFollowLoading ? 'Loading...' : isFollowing ? 'Following ✓' : 'Follow'}
          </Button>
          <Button
            onClick={onSubscribeClick}
            variant="default"
            className="flex-1 md:flex-initial px-6 py-3"
          >
            Subscribe
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
