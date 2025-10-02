import React from 'react';
import { VideoDetail } from './VideoDetail';
import type { VideoDetailProps } from './VideoDetail';
import { useLensReactions } from '../../hooks/lens/useLensReactions';
import { useLensComments } from '../../hooks/lens/useLensComments';

/**
 * Smart container component that handles business logic for VideoDetail
 * Manages Lens Protocol integration (reactions and comments), authentication state, and data fetching
 */
export interface VideoDetailContainerProps extends Omit<VideoDetailProps,
  'isLiked' | 'likeCount' | 'onLike' | 'canLike' | 'isLikeLoading' |
  'commentsData' | 'commentCount' | 'canComment' | 'isCommentsLoading' | 'isCommentSubmitting' | 'onSubmitComment'
> {
  // Container can optionally override computed values for testing
  overrideIsLiked?: boolean;
  overrideLikeCount?: number;
  overrideCanLike?: boolean;
  overrideCommentsData?: VideoDetailProps['commentsData'];
  overrideCommentCount?: number;
  overrideCanComment?: boolean;
}

export const VideoDetailContainer: React.FC<VideoDetailContainerProps> = ({
  lensPostId,
  onRefreshFeed,
  overrideIsLiked,
  overrideLikeCount,
  overrideCanLike,
  overrideCommentsData,
  overrideCommentCount,
  overrideCanComment,
  ...presentationalProps
}) => {
  // Business logic: Lens reactions integration
  const {
    isLiked: lensIsLiked,
    likeCount: lensLikeCount,
    isLoading: isLikeLoading,
    toggleLike,
    canLike: lensCanLike
  } = useLensReactions(lensPostId || '', presentationalProps.likes || 0, presentationalProps.userHasLiked);

  // Business logic: Lens comments
  const {
    comments: lensComments,
    commentCount: lensCommentCount,
    canComment: lensCanComment,
    isLoading: isCommentsLoading,
    isSubmitting: isCommentSubmitting,
    submitComment
  } = useLensComments({
    postId: lensPostId || '',
    initialCommentCount: presentationalProps.comments || 0,
    onRefreshFeed
  });

  // Allow overrides for testing/storybook
  const isLiked = overrideIsLiked ?? lensIsLiked;
  const likeCount = overrideLikeCount ?? lensLikeCount;
  const canLike = overrideCanLike ?? lensCanLike;
  const commentsData = overrideCommentsData ?? lensComments;
  const commentCount = overrideCommentCount ?? lensCommentCount;
  const canComment = overrideCanComment ?? lensCanComment;

  return (
    <VideoDetail
      {...presentationalProps}
      lensPostId={lensPostId}
      onRefreshFeed={onRefreshFeed}
      isLiked={isLiked}
      likeCount={likeCount}
      canLike={canLike}
      isLikeLoading={isLikeLoading}
      onLike={toggleLike}
      commentsData={commentsData}
      commentCount={commentCount}
      canComment={canComment}
      isCommentsLoading={isCommentsLoading}
      isCommentSubmitting={isCommentSubmitting}
      onSubmitComment={submitComment}
    />
  );
};
