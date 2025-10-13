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
          size="lg"
          className="flex-1 md:flex-initial"
        >
          Edit profile
        </Button>
      ) : isSubscribed ? (
        // Subscribed - Message and Subscribed indicator
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
            Subscribed ✓
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
        // Not subscribed - Follow/Following and Subscribe
        <>
          <Button
            onClick={onFollowClick}
            disabled={isFollowLoading}
            variant="secondary"
            size="lg"
            className="flex-1 md:flex-initial"
          >
            {isFollowLoading ? 'Loading...' : isFollowing ? 'Following ✓' : 'Follow'}
          </Button>
          <Button
            onClick={onSubscribeClick}
            variant="default"
            size="lg"
            className="flex-1 md:flex-initial"
          >
            Subscribe
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
