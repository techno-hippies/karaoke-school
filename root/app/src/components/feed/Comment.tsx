import { Heart } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface CommentData {
  id: string
  username: string
  text: string
  likes: number
  isLiked?: boolean
  avatar?: string
}

interface CommentProps {
  comment: CommentData
  onLike?: (commentId: string) => void
  showAvatar?: boolean
  className?: string
}

/**
 * Comment - Individual comment display
 * Shows avatar, username, text, and like button
 */
export function Comment({
  comment,
  onLike,
  showAvatar = true,
  className
}: CommentProps) {
  const handleLike = () => {
    onLike?.(comment.id)
  }

  return (
    <div className={cn('flex gap-3', className)}>
      {/* Avatar */}
      {showAvatar && (
        <div className="flex-shrink-0">
          {comment.avatar ? (
            <img
              src={comment.avatar}
              alt={comment.username}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-base font-medium">
                {comment.username[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-foreground text-base block">
              {comment.username}
            </span>
            <p className="text-foreground text-base mt-1 leading-relaxed">
              {comment.text}
            </p>
          </div>

          {/* Like button */}
          <button
            onClick={handleLike}
            className="flex-shrink-0 flex flex-col items-center gap-0.5 group cursor-pointer"
          >
            <Heart
              className={cn(
                'w-5 h-5 transition-colors',
                comment.isLiked ? 'text-red-500 fill-red-500' : 'text-muted-foreground group-hover:text-red-500'
              )}
              weight={comment.isLiked ? 'fill' : 'regular'}
            />
            {comment.likes > 0 && (
              <span className={cn(
                'text-xs',
                comment.isLiked ? 'text-red-500' : 'text-muted-foreground'
              )}>
                {comment.likes}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
