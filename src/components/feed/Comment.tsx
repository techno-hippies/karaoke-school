import React from 'react';
import { Heart } from 'lucide-react';

export interface CommentData {
  id: string;
  username: string;
  text: string;
  likes: number;
  avatar?: string;
}

interface CommentProps {
  comment: CommentData;
  onLike?: (commentId: string) => void;
  showAvatar?: boolean;
}

export const Comment: React.FC<CommentProps> = ({
  comment,
  onLike,
  showAvatar = true
}) => {
  const handleLike = () => {
    onLike?.(comment.id);
  };

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      {showAvatar && (
        <div className="flex-shrink-0">
          {comment.avatar ? (
            <img
              src={comment.avatar}
              alt={comment.username}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {comment.username[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-white block">
              {comment.username}
            </span>
            <p className="text-white mt-1 leading-relaxed">
              {comment.text}
            </p>
          </div>

          {/* Heart button on the right */}
          <button
            onClick={handleLike}
            className="flex-shrink-0 ml-3 flex items-center text-neutral-400 hover:text-red-500 transition-colors"
          >
            <Heart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};