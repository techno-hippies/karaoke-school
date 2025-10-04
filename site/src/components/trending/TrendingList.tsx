/**
 * TrendingList Component
 *
 * Displays a list of trending songs with scores and ranks
 *
 * Usage:
 * <TrendingList
 *   trending={trendingSongs}
 *   timeWindow={TimeWindow.Hourly}
 *   onSongClick={(song) => navigate(`/song/${song.songId}`)}
 * />
 */

import React from 'react';
import { TimeWindow } from '@/services/TrendingQueueService';
import { ContentSource } from '@/types/song';
import { formatTrendingScore, type TrendingSong } from '@/services/TrendingService';
import { TrendingBadge } from './TrendingBadge';
import { SongListItem } from '@/components/ui/SongListItem';
import type { Song } from '@/types';

interface TrendingListProps {
  trending: TrendingSong[];
  timeWindow: TimeWindow;
  onSongClick?: (song: TrendingSong) => void;
  className?: string;
}

export const TrendingList: React.FC<TrendingListProps> = ({
  trending,
  timeWindow,
  onSongClick,
  className = ''
}) => {
  if (trending.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p className="text-lg">No trending songs yet</p>
        <p className="text-sm mt-2">Be the first to discover something!</p>
      </div>
    );
  }

  // Convert TrendingSong to Song for SongListItem
  const convertToSong = (trendingSong: TrendingSong): Song => ({
    id: trendingSong.songId,
    title: trendingSong.songId, // Will be replaced by actual title from song data
    artist: '', // Will be replaced by actual artist from song data
    duration: 0,
  });

  return (
    <div className={`space-y-2 ${className}`}>
      {trending.map((song, index) => {
        const rank = index + 1;

        return (
          <div key={`${song.source}-${song.songId}`} className="relative">
            {/* Rank indicator */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 text-2xl font-bold text-neutral-600 w-10 text-right">
              {rank}
            </div>

            {/* Song item */}
            <div className="relative">
              <SongListItem
                song={convertToSong(song)}
                showPlayButton={false}
                onClick={() => onSongClick?.(song)}
                className="rounded-lg"
              />

              {/* Trending badge overlay */}
              <div className="absolute top-2 right-2">
                <TrendingBadge rank={rank} timeWindow={timeWindow} />
              </div>

              {/* Stats overlay */}
              <div className="absolute bottom-2 right-2 flex items-center gap-2 text-xs text-neutral-400">
                {song.clicks > 0 && (
                  <span title="Clicks">👆 {song.clicks}</span>
                )}
                {song.plays > 0 && (
                  <span title="Plays">▶️ {song.plays}</span>
                )}
                {song.completions > 0 && (
                  <span title="Completions">✅ {song.completions}</span>
                )}
                <span className="font-semibold text-neutral-200">
                  🔥 {formatTrendingScore(song.trendingScore)}
                </span>
              </div>

              {/* Source indicator */}
              {song.source === ContentSource.Genius && (
                <div className="absolute top-2 left-2 text-xs bg-purple-600/80 text-white px-2 py-0.5 rounded">
                  Genius
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
