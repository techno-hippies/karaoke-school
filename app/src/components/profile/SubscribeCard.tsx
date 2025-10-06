import { Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export interface SubscribeCardProps {
  username: string
  userAvatar?: string
  price?: string
  onSubscribe?: () => void
  className?: string
}

/**
 * SubscribeCard - Reusable subscription UI
 * Used in: VideoDetail lock overlay, VideoPost lock overlay
 * Shows creator info, pricing, benefits, and subscribe button
 */
export function SubscribeCard({
  username,
  userAvatar,
  price = '$6.99/month',
  onSubscribe,
  className,
}: SubscribeCardProps) {
  return (
    <div className={className}>
      <div className="flex flex-col items-start gap-3 text-left w-full">
        {/* Creator Avatar */}
        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center mb-2">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={username}
              className="w-full h-full rounded-lg object-cover"
            />
          ) : (
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
              alt={username}
              className="w-full h-full rounded-lg object-cover"
            />
          )}
        </div>

        {/* Title */}
        <div>
          <h3 className="text-xl font-bold text-foreground">
            Subscribe to @{username}
          </h3>
          <p className="text-base text-muted-foreground mt-1">
            {price.replace('/month', ' per month')}
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-2 mb-2 w-full">
          <div className="flex items-center gap-2 text-left">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-primary" weight="bold" />
            </div>
            <p className="text-sm text-foreground">Access all premium videos</p>
          </div>

          <div className="flex items-center gap-2 text-left">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-primary" weight="bold" />
            </div>
            <p className="text-sm text-foreground">Real-time chat</p>
          </div>

          <div className="flex items-center gap-2 text-left">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-primary" weight="bold" />
            </div>
            <p className="text-sm text-foreground">Cancel anytime</p>
          </div>
        </div>

        {/* Subscribe Button */}
        <Button
          size="lg"
          onClick={onSubscribe}
          className="w-full mt-2"
        >
          Subscribe
        </Button>
      </div>
    </div>
  )
}
