import React from 'react';
import { VideoPost } from './VideoPost';
import type { VideoPostProps } from './VideoPost';
import { useLensReactions } from '../../hooks/lens/useLensReactions';
import { useLensFollows } from '../../hooks/lens/useLensFollows';

/**
 * Smart container component that handles business logic for VideoPost
 * Manages Lens Protocol integration (reactions and follows)
 */
export interface VideoPostContainerProps extends Omit<VideoPostProps,
  'isLiked' | 'likeCount' | 'onLike' | 'canLike' | 'isLikeLoading' |
  'isFollowing' | 'onFollow' | 'canFollow' | 'isFollowLoading'
> {
  // Container can optionally override computed values for testing
  overrideIsLiked?: boolean;
  overrideLikeCount?: number;
  overrideCanLike?: boolean;
  overrideIsFollowing?: boolean;
  overrideCanFollow?: boolean;
}

export const VideoPostContainer: React.FC<VideoPostContainerProps> = ({
  lensPostId,
  likes,
  userHasLiked,
  onRefreshFeed,
  karaokeSegment,
  creatorAccountAddress,
  overrideIsLiked,
  overrideLikeCount,
  overrideCanLike,
  overrideIsFollowing,
  overrideCanFollow,
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

  // Allow overrides for testing/storybook
  const isLiked = overrideIsLiked ?? lensIsLiked;
  const likeCount = overrideLikeCount ?? lensLikeCount;
  const canLike = overrideCanLike ?? lensCanLike;
  const isFollowing = overrideIsFollowing ?? lensIsFollowing;
  const canFollow = overrideCanFollow ?? lensCanFollow;

  return (
    <VideoPost
      {...presentationalProps}
      lensPostId={lensPostId}
      likes={likes}
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
    />
  );
};
