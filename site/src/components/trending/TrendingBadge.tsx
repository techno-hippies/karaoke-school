/**
 * TrendingBadge Component
 *
 * Displays a trending badge for a song based on its rank
 *
 * Usage:
 * <TrendingBadge rank={1} timeWindow={TimeWindow.Hourly} />
 * <TrendingBadge rank={5} timeWindow={TimeWindow.Daily} />
 */

import React from 'react';
import { TimeWindow } from '@/services/TrendingQueueService';
import { getTrendingBadge } from '@/services/TrendingService';
import { Badge } from '@/components/ui/badge';

interface TrendingBadgeProps {
  rank: number;
  timeWindow: TimeWindow;
  className?: string;
}

export const TrendingBadge: React.FC<TrendingBadgeProps> = ({
  rank,
  timeWindow,
  className = ''
}) => {
  const badgeText = getTrendingBadge(rank, timeWindow);

  if (!badgeText) return null;

  // Different colors based on rank
  const variant = rank === 1 ? 'default' : rank <= 3 ? 'secondary' : 'outline';

  return (
    <Badge variant={variant} className={className}>
      {rank === 1 && '🔥 '}
      {badgeText}
    </Badge>
  );
};
