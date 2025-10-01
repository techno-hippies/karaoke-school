import React from 'react';
import { SkeletonBase, SkeletonBox, SkeletonCircle, SkeletonText } from './SkeletonBase';

export const VideoPostSkeleton: React.FC = () => {
  return (
    <SkeletonBase className="relative w-full h-screen bg-neutral-900 snap-start">
      {/* Video area skeleton */}
      <SkeletonBox className="absolute inset-0 bg-neutral-800" />

      {/* User info (bottom left) */}
      <div className="absolute bottom-20 left-4 z-10">
        <div className="flex items-center gap-3 mb-3">
          <SkeletonCircle className="w-10 h-10" />
          <div className="space-y-1">
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-3 w-16" />
          </div>
        </div>

        {/* Description */}
        <div className="max-w-72">
          <SkeletonText lines={2} lastLineWidth="w-1/2" />
        </div>

        {/* Hashtags */}
        <div className="flex gap-2 mt-2">
          <SkeletonBox className="h-4 w-16" />
          <SkeletonBox className="h-4 w-12" />
          <SkeletonBox className="h-4 w-20" />
        </div>
      </div>

      {/* Action buttons (right side) */}
      <div className="absolute bottom-20 right-4 z-10 space-y-6">
        {/* Like button */}
        <div className="flex flex-col items-center">
          <SkeletonCircle className="w-12 h-12" />
          <SkeletonBox className="h-3 w-8 mt-2" />
        </div>

        {/* Comment button */}
        <div className="flex flex-col items-center">
          <SkeletonCircle className="w-12 h-12" />
          <SkeletonBox className="h-3 w-6 mt-2" />
        </div>

        {/* Share button */}
        <div className="flex flex-col items-center">
          <SkeletonCircle className="w-12 h-12" />
          <SkeletonBox className="h-3 w-8 mt-2" />
        </div>

        {/* More button */}
        <div className="flex flex-col items-center">
          <SkeletonCircle className="w-12 h-12" />
        </div>
      </div>

      {/* Progress indicator (optional) */}
      <div className="absolute bottom-2 left-4 right-4">
        <SkeletonBox className="h-1 w-full rounded-full" />
      </div>
    </SkeletonBase>
  );
};