import React, { useState, useCallback, useEffect } from 'react';
import { postId, uri } from "@lens-protocol/client";
import { post, fetchPostReferences } from "@lens-protocol/client/actions";
import { PostReferenceType } from '@lens-protocol/client';
import { textOnly } from '@lens-protocol/metadata';
import { useLensAuth } from './useLensAuth';
import { lensClient } from '../../lib/lens/client';

interface LensComment {
  id: string;
  content: string;
  author: {
    username: string;
    avatar: string;
  };
  likes: number;
  createdAt: string;
}

interface UseLensCommentsProps {
  postId: string;
  initialCommentCount?: number;
  onRefreshFeed?: () => void;
}

interface UseLensCommentsReturn {
  comments: LensComment[];
  commentCount: number;
  canComment: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  submitComment: (content: string) => Promise<boolean>;
}

export function useLensComments({
  postId: postIdString,
  initialCommentCount = 0,
  onRefreshFeed
}: UseLensCommentsProps): UseLensCommentsReturn {
  const [comments, setComments] = useState<LensComment[]>([]);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use unified auth system
  const { sessionClient, canPost, isAuthenticated } = useLensAuth();

  // Allow commenting if authenticated and can post
  const canComment = canPost && !!sessionClient;

  // Fetch comments from Lens
  const fetchComments = useCallback(async () => {
    if (!postIdString || postIdString.trim() === '') {
      setComments([]);
      setCommentCount(0);
      return;
    }

    setIsLoading(true);
    try {
      // Use authenticated session client if available for better user data
      const clientToUse = sessionClient || lensClient;

      // Fetch comments using fetchPostReferences with CommentOn type
      const result = await fetchPostReferences(clientToUse, {
        referencedPost: postId(postIdString),
        referenceTypes: [PostReferenceType.CommentOn],
      });

      if (result.isErr()) {
        console.error('[useLensComments] Error fetching comments from Lens:', result.error);
        setComments([]);
        setCommentCount(0);
        return;
      }

      const commentPosts = result.value.items;

      // Transform Lens comment posts to our comment format
      const transformedComments: LensComment[] = commentPosts.map(commentPost => {
        const author = commentPost.author || commentPost.by || {};
        const username = author.username?.value || author.handle?.value || author.address || 'Unknown User';
        const address = author.address || 'unknown';

        // Extract content from metadata
        const content = extractCommentContent(commentPost.metadata) || 'No content';

        return {
          id: commentPost.id,
          content: content,
          author: {
            username: username.startsWith('lens/') ? username : `lens/${username}`,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`
          },
          likes: commentPost.stats?.likes || 0,
          createdAt: commentPost.timestamp || commentPost.createdAt || new Date().toISOString()
        };
      });

      // Sort by creation date (newest first)
      const sortedComments = transformedComments.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setComments(sortedComments);
      setCommentCount(sortedComments.length);
    } catch (error) {
      console.error('[useLensComments] Error fetching comments:', error);
      setComments([]);
      setCommentCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [postIdString, sessionClient]);

  // Load comments on mount and when postId changes
  useEffect(() => {
    if (postIdString) {
      fetchComments();
    }
  }, [postIdString, fetchComments]);

  const submitComment = useCallback(async (content: string): Promise<boolean> => {
    if (!canComment || !sessionClient || !postIdString) {
      console.warn('[useLensComments] Cannot comment: not authenticated, no posting permissions, or invalid post');
      return false;
    }

    if (!content.trim()) {
      console.warn('[useLensComments] Cannot comment: Empty content');
      return false;
    }

    if (isSubmitting) {
      return false;
    }

    setIsSubmitting(true);

    try {
      // Create proper TextOnlyMetadata using the textOnly helper
      const commentMetadata = textOnly({
        content: content.trim(),
      });

      // For now, use a data URI (in production, would use storageClient.uploadAsJson)
      const metadataJson = JSON.stringify(commentMetadata);
      const metadataUri = `data:application/json;base64,${btoa(metadataJson)}`;

      // Create the comment post
      const result = await post(sessionClient, {
        contentUri: uri(metadataUri),
        commentOn: {
          post: postId(postIdString)
        }
      });

      if (result.isErr()) {
        console.error('[useLensComments] Comment failed:', result.error);

        // Check for specific authentication errors
        const errorMessage = result.error?.message || result.error?.toString() || 'Unknown error';
        if (errorMessage.includes('ONBOARDING_USER')) {
          console.error('[useLensComments] ❌ Cannot comment: User authenticated as ONBOARDING_USER');
          console.error('[useLensComments] 💡 Solution: User needs to create a Lens account first');
        } else if (errorMessage.includes('Forbidden')) {
          console.error('[useLensComments] ❌ Permission denied - check authentication role and account status');
        } else {
          console.error('[useLensComments] ❌ Comment failed with error:', errorMessage);
        }

        return false;
      }

      console.log('[useLensComments] ✅ Comment submitted successfully');

      // Optimistically add comment to UI immediately
      const newComment: LensComment = {
        id: `temp-${Date.now()}`,
        content: content.trim(),
        author: {
          username: 'You',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=temp-user`
        },
        likes: 0,
        createdAt: new Date().toISOString()
      };

      // Add to beginning of comments list (newest first)
      setComments(prev => [newComment, ...prev]);
      // Update comment count
      setCommentCount(prev => prev + 1);

      // Refresh comments after a short delay to get the real comment from Lens
      setTimeout(() => {
        fetchComments();
      }, 2000);

      // Refresh feed after successful comment
      if (onRefreshFeed) {
        setTimeout(() => {
          onRefreshFeed();
        }, 1000); // Small delay to allow Lens to process the action
      }

      return true;

    } catch (error) {
      console.error('[useLensComments] Comment error:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [postIdString, canComment, sessionClient, isSubmitting]);

  return {
    comments,
    commentCount,
    canComment,
    isLoading,
    isSubmitting,
    submitComment
  };
}

/**
 * Extract content text from Lens comment metadata
 */
function extractCommentContent(metadata: unknown): string {
  if (metadata && typeof metadata === 'object' && 'content' in metadata) {
    return (metadata as { content: string }).content;
  }

  // Check for TextOnlyMetadata
  if (metadata && typeof metadata === 'object' && '__typename' in metadata && metadata.__typename === 'TextOnlyMetadata' && 'content' in metadata) {
    return (metadata as { content: string }).content;
  }

  // Check for other metadata types that might contain content
  if (metadata && typeof metadata === 'object' && 'description' in metadata) {
    return (metadata as { description: string }).description;
  }

  return '';
}