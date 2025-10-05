import { CircleNotch } from '@phosphor-icons/react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Comment, type CommentData } from './Comment'
import { CommentInput } from './CommentInput'

export interface CommentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  comments?: CommentData[]
  commentCount?: number
  canComment?: boolean
  isLoading?: boolean
  isSubmitting?: boolean
  onSubmitComment?: (content: string) => Promise<boolean>
  onLikeComment?: (commentId: string) => void
}

/**
 * CommentSheet - Bottom sheet for viewing and posting comments
 * TikTok-style comments interface
 */
export function CommentSheet({
  open,
  onOpenChange,
  comments = [],
  commentCount = 0,
  canComment = false,
  isLoading = false,
  isSubmitting = false,
  onSubmitComment,
  onLikeComment
}: CommentSheetProps) {
  const handleCommentSubmit = async (commentText: string) => {
    if (!onSubmitComment) return

    const success = await onSubmitComment(commentText)
    if (success) {
      console.log('[CommentSheet] Comment submitted successfully')
    } else {
      console.error('[CommentSheet] Failed to submit comment')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[70vh] border-border p-0 flex flex-col"
      >
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="text-foreground text-center text-lg">
            {commentCount > 0 ? `${commentCount} Comments` : 'Comments'}
          </SheetTitle>
        </SheetHeader>

        {/* Comments List */}
        <ScrollArea className="flex-1">
          <div className="py-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <CircleNotch className="w-6 h-6 animate-spin text-neutral-400" />
                <span className="ml-2 text-neutral-400 text-base">Loading comments...</span>
              </div>
            ) : comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="px-4">
                  <Comment
                    comment={comment}
                    onLike={onLikeComment}
                  />
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-neutral-400 text-center text-base">
                  No comments yet. Be the first!
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Comment Input */}
        <CommentInput
          onSubmit={handleCommentSubmit}
          disabled={!canComment || isSubmitting}
          placeholder={
            canComment ? 'Add a comment...' : 'Sign in to comment'
          }
        />
      </SheetContent>
    </Sheet>
  )
}
