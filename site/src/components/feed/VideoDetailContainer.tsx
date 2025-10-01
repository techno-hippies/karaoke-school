import React from 'react';
import { VideoDetail, VideoDetailProps } from './VideoDetail';
import { useLensReactions } from '../../hooks/lens/useLensReactions';

/**
 * Smart container component that handles business logic for VideoDetail
 * Manages Lens Protocol integration, authentication state, and data fetching
 */
export interface VideoDetailContainerProps extends Omit<VideoDetailProps, 'isLiked' | 'likeCount' | 'onLike' | 'canLike' | 'isLikeLoading'> {
  // Container can optionally override computed values for testing
  overrideIsLiked?: boolean;
  overrideLikeCount?: number;
  overrideCanLike?: boolean;
}

export const VideoDetailContainer: React.FC<VideoDetailContainerProps> = ({
  lensPostId,
  overrideIsLiked,
  overrideLikeCount,
  overrideCanLike,
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

  // Allow overrides for testing/storybook
  const isLiked = overrideIsLiked ?? lensIsLiked;
  const likeCount = overrideLikeCount ?? lensLikeCount;
  const canLike = overrideCanLike ?? lensCanLike;

  return (
    <VideoDetail
      {...presentationalProps}
      lensPostId={lensPostId}
      isLiked={isLiked}
      likeCount={likeCount}
      canLike={canLike}
      isLikeLoading={isLikeLoading}
      onLike={toggleLike}
    />
  );
};
