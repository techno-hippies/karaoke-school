import React, { useState, useCallback } from 'react';
import { postId, uri } from "@lens-protocol/client";
import { post, fetchPostReferences } from "@lens-protocol/client/actions";
import { PostReferenceType } from '@lens-protocol/client';
import { textOnly } from '@lens-protocol/metadata';
import { getLensSession } from '../../lib/lens/session';
import { lensClient } from '../../lib/lens/client';
import { useAccount } from 'wagmi';

interface LensComment {
  id: string;
  content: string;
  author: {
    username: string;
    address: string;
    avatar?: string;
  };
  createdAt: string;
  likes: number;
  replies: LensComment[];
}

interface UseLensCommentsProps {
  postId: string;
  initialCommentCount?: number;
}

interface UseLensCommentsReturn {
  comments: LensComment[];
  commentCount: number;
  canComment: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  submitComment: (content: string) => Promise<boolean>;
  refreshComments: () => Promise<void>;
}

export function useLensComments({
  postId: postIdString,
  initialCommentCount = 0,
}: UseLensCommentsProps): UseLensCommentsReturn {
  const [comments, setComments] = useState<LensComment[]>([]);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canComment, setCanComment] = useState(false); // Start as false, will be updated when we check permissions

  // Get wallet connection from RainbowKit/wagmi
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();

  const sessionClient = getLensSession();

  // Allow commenting if wallet is connected AND we have a session
  const hasAuth = isWalletConnected && !!walletAddress;
  const hasSession = !!sessionClient;


  // Check comment permissions
  React.useEffect(() => {
    const updateCanComment = () => {
      // Can comment if we have both authentication and a session AND a valid post ID
      const hasValidPostId = postIdString && postIdString.trim() !== '';
      const canCommentNow = hasAuth && hasSession && hasValidPostId;
      setCanComment(canCommentNow);

    };

    updateCanComment();
  }, [hasAuth, hasSession, postIdString]);

  // Refresh comments from Lens
  const refreshComments = useCallback(async () => {
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
            address: address,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`
          },
          createdAt: commentPost.timestamp || commentPost.createdAt || new Date().toISOString(),
          likes: commentPost.stats?.likes || 0,
          replies: [] // TODO: Implement nested replies if needed
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

  // Load comments on mount
  React.useEffect(() => {
    if (postIdString) {
      refreshComments();
    }
  }, [postIdString, refreshComments]);

  // Submit a new comment
  const submitComment = useCallback(async (content: string): Promise<boolean> => {
    if (!hasAuth || !hasSession || !sessionClient || !postIdString) {
      console.warn('[useLensComments] Cannot comment: Missing auth, session, or post ID', {
        hasAuth,
        hasSession,
        hasSessionClient: !!sessionClient,
        hasPostId: !!postIdString
      });
      return false;
    }

    if (!content.trim()) {
      console.warn('[useLensComments] Cannot comment: Empty content');
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
        console.error('[useLensComments] Comment creation failed:', result.error);
        return false;
      }

      // Add optimistic comment to UI
      const newComment: LensComment = {
        id: `temp-${Date.now()}`,
        content: content,
        author: {
          username: walletAddress || 'You',
          address: walletAddress || '0x...',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${walletAddress}`
        },
        createdAt: new Date().toISOString(),
        likes: 0,
        replies: []
      };

      setComments(prev => [newComment, ...prev]);
      setCommentCount(prev => prev + 1);

      // Note: We rely on optimistic update only. The real comment will appear
      // when refreshComments() is called next time (e.g., when reopening comments)

      return true;
    } catch (error) {
      console.error('[useLensComments] Error submitting comment:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [postIdString, hasAuth, hasSession, sessionClient, walletAddress]);

  return {
    comments,
    commentCount,
    canComment,
    isLoading,
    isSubmitting,
    submitComment,
    refreshComments
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