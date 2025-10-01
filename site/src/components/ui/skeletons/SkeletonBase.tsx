import React from 'react';

interface SkeletonBaseProps {
  className?: string;
  children?: React.ReactNode;
}

export const SkeletonBase: React.FC<SkeletonBaseProps> = ({
  className = '',
  children
}) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {children}
    </div>
  );
};

export const SkeletonBox: React.FC<{ className?: string }> = ({
  className = ''
}) => {
  return (
    <div className={`bg-neutral-800 rounded ${className}`} />
  );
};

export const SkeletonCircle: React.FC<{ className?: string }> = ({
  className = ''
}) => {
  return (
    <div className={`bg-neutral-800 rounded-full ${className}`} />
  );
};

export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}> = ({
  lines = 1,
  className = '',
  lastLineWidth = 'w-3/4'
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          className={`h-4 ${i === lines - 1 ? lastLineWidth : 'w-full'}`}
        />
      ))}
    </div>
  );
};