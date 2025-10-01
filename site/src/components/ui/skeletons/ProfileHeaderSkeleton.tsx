import React from 'react';
import { SkeletonBase, SkeletonBox, SkeletonCircle, SkeletonText } from './SkeletonBase';

export const ProfileHeaderSkeleton: React.FC = () => {
  return (
    <SkeletonBase className="w-full bg-neutral-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header section */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <SkeletonCircle className="w-24 h-24 md:w-32 md:h-32" />
          </div>

          {/* Profile info */}
          <div className="flex-1 space-y-4">
            {/* Username and verification */}
            <div className="flex items-center gap-3">
              <SkeletonBox className="h-6 w-32" />
              <SkeletonCircle className="w-5 h-5" />
            </div>

            {/* Display name */}
            <SkeletonBox className="h-5 w-48" />

            {/* Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <SkeletonBox className="h-6 w-12 mb-1" />
                <SkeletonBox className="h-4 w-16" />
              </div>
              <div className="text-center">
                <SkeletonBox className="h-6 w-12 mb-1" />
                <SkeletonBox className="h-4 w-16" />
              </div>
              <div className="text-center">
                <SkeletonBox className="h-6 w-16 mb-1" />
                <SkeletonBox className="h-4 w-12" />
              </div>
            </div>

            {/* Bio */}
            <div className="max-w-md">
              <SkeletonText lines={3} lastLineWidth="w-2/3" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4">
              <SkeletonBox className="h-9 w-24 rounded-lg" />
              <SkeletonBox className="h-9 w-20 rounded-lg" />
              <SkeletonBox className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex gap-8 mt-8 border-b border-neutral-800">
          <SkeletonBox className="h-5 w-16 mb-3" />
          <SkeletonBox className="h-5 w-12 mb-3" />
          <SkeletonBox className="h-5 w-14 mb-3" />
        </div>
      </div>
    </SkeletonBase>
  );
};