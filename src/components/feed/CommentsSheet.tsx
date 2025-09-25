import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Comment, type CommentData } from './Comment';
import { CommentInput } from './CommentInput';
import { useLensComments } from '../../hooks/useLensComments';
import { CircleNotch } from '@phosphor-icons/react';

interface CommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

export const CommentsSheet: React.FC<CommentsSheetProps> = ({
  open,
  onOpenChange,
  postId,
}) => {

  // Use Lens comments hook
  const {
    comments: lensComments,
    commentCount,
    canComment,
    isLoading,
    isSubmitting,
    submitComment,
    refreshComments
  } = useLensComments({
    postId: postId || '',
    initialCommentCount: 0
  });

  // Transform Lens comments to match existing Comment component interface
  const comments: CommentData[] = lensComments.map(comment => ({
    id: comment.id,
    username: comment.author.username,
    text: comment.content,
    likes: comment.likes,
    avatar: comment.author.avatar
  }));

  const handleCommentSubmit = async (commentText: string) => {
    console.log('[CommentsSheet] Submitting comment:', commentText);
    const success = await submitComment(commentText);
    if (success) {
      console.log('[CommentsSheet] ✅ Comment submitted successfully');
    } else {
      console.error('[CommentsSheet] ❌ Failed to submit comment');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] bg-neutral-900 border-neutral-800 p-0 flex flex-col">
        <SheetHeader className="border-b border-neutral-800 p-4">
          <SheetTitle className="text-white text-center">
            {commentCount > 0 ? `${commentCount} Comments` : 'Comments'}
          </SheetTitle>
        </SheetHeader>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <CircleNotch className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-400">Loading comments...</span>
            </div>
          ) : comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="px-4">
                <Comment
                  comment={comment}
                  onLike={(commentId) => console.log('Liked comment:', commentId)}
                />
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-400 text-center">
                {postId ? 'No comments yet. Be the first!' : 'No post selected'}
              </p>
            </div>
          )}
        </div>

        {/* Comment Input */}
        <CommentInput
          onSubmit={handleCommentSubmit}
          variant="expanded"
          showAvatar={false}
          disabled={!canComment || isSubmitting}
          placeholder={
            !postId ? 'Comments not available for this post' :
            canComment ? 'Add a comment...' :
            'Sign in to comment'
          }
        />
      </SheetContent>
    </Sheet>
  );
};