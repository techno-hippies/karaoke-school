/**
 * TrendingSection Component
 *
 * Displays trending songs with time window tabs (Hourly, Daily, Weekly)
 *
 * Usage:
 * <TrendingSection
 *   hourly={hourlyTrending}
 *   daily={dailyTrending}
 *   weekly={weeklyTrending}
 *   onSongClick={(song) => navigate(`/song/${song.songId}`)}
 *   loading={isLoading}
 * />
 */

import React, { useState } from 'react';
import { TimeWindow } from '@/services/TrendingQueueService';
import type { TrendingSong } from '@/services/TrendingService';
import { TrendingList } from './TrendingList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TrendingSectionProps {
  hourly?: TrendingSong[];
  daily?: TrendingSong[];
  weekly?: TrendingSong[];
  onSongClick?: (song: TrendingSong) => void;
  loading?: boolean;
  className?: string;
}

export const TrendingSection: React.FC<TrendingSectionProps> = ({
  hourly = [],
  daily = [],
  weekly = [],
  onSongClick,
  loading = false,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'hourly' | 'daily' | 'weekly'>('hourly');

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-neutral-500">Loading trending songs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="hourly">
            <span className="mr-1">🔥</span> Trending Now
          </TabsTrigger>
          <TabsTrigger value="daily">
            <span className="mr-1">📅</span> Today
          </TabsTrigger>
          <TabsTrigger value="weekly">
            <span className="mr-1">📊</span> This Week
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hourly">
          <TrendingList
            trending={hourly}
            timeWindow={TimeWindow.Hourly}
            onSongClick={onSongClick}
          />
        </TabsContent>

        <TabsContent value="daily">
          <TrendingList
            trending={daily}
            timeWindow={TimeWindow.Daily}
            onSongClick={onSongClick}
          />
        </TabsContent>

        <TabsContent value="weekly">
          <TrendingList
            trending={weekly}
            timeWindow={TimeWindow.Weekly}
            onSongClick={onSongClick}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
