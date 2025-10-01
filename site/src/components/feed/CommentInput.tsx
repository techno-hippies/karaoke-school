import React, { useState } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';

interface CommentInputProps {
  onSubmit?: (comment: string) => void;
  placeholder?: string;
  showAvatar?: boolean;
  variant?: 'compact' | 'expanded';
  disabled?: boolean;
}

export const CommentInput: React.FC<CommentInputProps> = ({
  onSubmit,
  placeholder = 'Add a comment...',
  showAvatar = true,
  variant = 'compact',
  disabled = false
}) => {
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (comment.trim()) {
      onSubmit?.(comment);
      setComment('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (variant === 'expanded') {
    // Mobile layout with separate button below textarea
    return (
      <div className="p-4 border-t border-neutral-800">
        <div className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-3 py-2 border border-neutral-700 bg-neutral-900 text-white rounded-lg resize-none focus:outline-none focus:border-neutral-500 placeholder:text-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed"
            rows={3}
            onKeyPress={handleKeyPress}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={disabled || !comment.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout with icon inside textarea
  return (
    <div className="p-4 border-t border-neutral-800">
      <div className="flex items-start space-x-3">
        {showAvatar && (
          <div className="w-8 h-8 bg-blue-600 rounded-full flex-shrink-0">
          </div>
        )}
        <div className="flex-1 relative">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-3 py-2 pr-12 border border-neutral-700 bg-neutral-900 text-white rounded-lg resize-none focus:outline-none focus:border-neutral-500 placeholder:text-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed"
            rows={2}
            onKeyPress={handleKeyPress}
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || !comment.trim()}
            className="absolute bottom-2 right-2 p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperPlaneRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};