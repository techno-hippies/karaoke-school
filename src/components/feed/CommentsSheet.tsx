import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Comment, type CommentData } from './Comment';
import { CommentInput } from './CommentInput';

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
  
  // Sample comments data
  const comments: CommentData[] = [
    {
      id: '1',
      username: 'user1',
      text: 'This is amazing! 🔥',
      likes: 234,
      avatar: 'https://picsum.photos/40/40?random=1'
    },
    {
      id: '2',
      username: 'musiclover',
      text: 'What song is this?',
      likes: 89,
      avatar: 'https://picsum.photos/40/40?random=2'
    },
    {
      id: '3',
      username: 'creator99',
      text: 'Great content! Keep it up 👏',
      likes: 456,
      avatar: 'https://picsum.photos/40/40?random=3'
    },
    {
      id: '4',
      username: 'viralking',
      text: 'This deserves more views',
      likes: 123,
      avatar: 'https://picsum.photos/40/40?random=4'
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] bg-neutral-900 border-neutral-800 p-0 flex flex-col">
        <SheetHeader className="border-b border-neutral-800 p-4">
          <SheetTitle className="text-white text-center">
            {comments.length} Comments
          </SheetTitle>
        </SheetHeader>
        
        {/* Comments List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="px-4">
              <Comment
                comment={comment}
                onLike={(commentId) => console.log('Liked comment:', commentId)}
              />
            </div>
          ))}
        </div>

        {/* Comment Input */}
        <CommentInput
          onSubmit={(comment) => console.log('Comment submitted:', comment)}
          variant="expanded"
          showAvatar={false}
        />
      </SheetContent>
    </Sheet>
  );
};