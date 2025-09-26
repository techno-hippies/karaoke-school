import React from 'react';
import { VideoPostSkeleton } from '../ui/skeletons/VideoPostSkeleton';

interface FeedSkeletonProps {
  count?: number;
}

export const FeedSkeleton: React.FC<FeedSkeletonProps> = ({
  count = 3
}) => {
  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory">
      {Array.from({ length: count }).map((_, index) => (
        <VideoPostSkeleton key={`skeleton-${index}`} />
      ))}
    </div>
  );
};