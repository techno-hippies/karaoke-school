import React from 'react';
import { VideoPost } from './VideoPost';
import type { VideoPostProps } from './VideoPost';
import { useLensReactions } from '../../hooks/lens/useLensReactions';
import { useLensFollows } from '../../hooks/lens/useLensFollows';
import { useLensComments } from '../../hooks/lens/useLensComments';

/**
 * Smart container component that handles business logic for VideoPost
 * Manages Lens Protocol integration (reactions, follows, and comments)
 */
export interface VideoPostContainerProps extends Omit<VideoPostProps,
  'isLiked' | 'likeCount' | 'onLike' | 'canLike' | 'isLikeLoading' |
  'isFollowing' | 'onFollow' | 'canFollow' | 'isFollowLoading' |
  'commentsData' | 'commentCount' | 'canComment' | 'isCommentsLoading' | 'isCommentSubmitting' | 'onSubmitComment'
> {
  // Container can optionally override computed values for testing
  overrideIsLiked?: boolean;
  overrideLikeCount?: number;
  overrideCanLike?: boolean;
  overrideIsFollowing?: boolean;
  overrideCanFollow?: boolean;
  overrideCommentsData?: VideoPostProps['commentsData'];
  overrideCommentCount?: number;
  overrideCanComment?: boolean;
}

export const VideoPostContainer: React.FC<VideoPostContainerProps> = ({
  lensPostId,
  likes,
  comments,
  userHasLiked,
  onRefreshFeed,
  karaokeSegment,
  creatorAccountAddress,
  overrideIsLiked,
  overrideLikeCount,
  overrideCanLike,
  overrideIsFollowing,
  overrideCanFollow,
  overrideCommentsData,
  overrideCommentCount,
  overrideCanComment,
  ...presentationalProps
}) => {
  // Business logic: Lens reactions
  const {
    isLiked: lensIsLiked,
    likeCount: lensLikeCount,
    isLoading: isLikeLoading,
    toggleLike,
    canLike: lensCanLike
  } = useLensReactions(lensPostId || '', likes || 0, userHasLiked, onRefreshFeed, karaokeSegment);

  // Business logic: Lens follows
  const {
    isFollowing: lensIsFollowing,
    isLoading: isFollowLoading,
    canFollow: lensCanFollow,
    toggleFollow
  } = useLensFollows(creatorAccountAddress || '');

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
    initialCommentCount: comments || 0,
    onRefreshFeed
  });

  // Allow overrides for testing/storybook
  const isLiked = overrideIsLiked ?? lensIsLiked;
  const likeCount = overrideLikeCount ?? lensLikeCount;
  const canLike = overrideCanLike ?? lensCanLike;
  const isFollowing = overrideIsFollowing ?? lensIsFollowing;
  const canFollow = overrideCanFollow ?? lensCanFollow;
  const commentsData = overrideCommentsData ?? lensComments;
  const commentCount = overrideCommentCount ?? lensCommentCount;
  const canComment = overrideCanComment ?? lensCanComment;

  return (
    <VideoPost
      {...presentationalProps}
      lensPostId={lensPostId}
      likes={likes}
      comments={comments}
      userHasLiked={userHasLiked}
      onRefreshFeed={onRefreshFeed}
      karaokeSegment={karaokeSegment}
      creatorAccountAddress={creatorAccountAddress}
      isLiked={isLiked}
      likeCount={likeCount}
      canLike={canLike}
      isLikeLoading={isLikeLoading}
      onLike={toggleLike}
      isFollowing={isFollowing}
      canFollow={canFollow}
      isFollowLoading={isFollowLoading}
      onFollow={toggleFollow}
      commentsData={commentsData}
      commentCount={commentCount}
      canComment={canComment}
      isCommentsLoading={isCommentsLoading}
      isCommentSubmitting={isCommentSubmitting}
      onSubmitComment={submitComment}
    />
  );
};
