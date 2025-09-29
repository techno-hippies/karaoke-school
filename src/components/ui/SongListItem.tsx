import React from 'react';
import { Play, CaretRight } from '@phosphor-icons/react';
// import { Button } from './button';
import type { Song } from '../../types/song';

// Re-export for backward compatibility
export type { Song } from '../../types/song';

interface SongListItemProps {
  song: Song;
  isSelected?: boolean;
  isPlaying?: boolean;
  showSelectButton?: boolean;
  onClick?: (song: Song) => void;
  onPlay?: (song: Song) => void;
  onSelect?: (song: Song) => void;
  className?: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const SongListItem: React.FC<SongListItemProps> = ({
  song,
  isSelected = false,
  isPlaying = false,
  showSelectButton = false,
  onClick,
  onPlay,
  onSelect,
  className = ''
}) => {
  const handleClick = () => {
    onClick?.(song);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay?.(song);
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(song);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        w-full flex items-center gap-4 p-3 cursor-pointer transition-colors duration-200
        hover:bg-neutral-800/50 active:bg-neutral-800
        ${isSelected ? 'bg-neutral-800/60' : ''}
        ${className}
      `}
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-20 rounded-md overflow-hidden bg-neutral-700 flex-shrink-0">
        {song.thumbnailUrl ? (
          <img
            src={song.thumbnailUrl}
            alt={`${song.title} by ${song.artist}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error(`Failed to load thumbnail for ${song.title}:`, song.thumbnailUrl);
              (e.target as HTMLImageElement).style.display = 'none';
            }}
            onLoad={() => {
              console.log(`Successfully loaded thumbnail for ${song.title}:`, song.thumbnailUrl);
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-600 to-neutral-800 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-neutral-500" />
          </div>
        )}

        {/* Fallback background when image fails to load */}
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-neutral-600 to-neutral-800 flex items-center justify-center -z-10">
          <div className="w-6 h-6 rounded-full bg-neutral-500" />
        </div>

        {/* Play/Pause button - always visible like TikTok */}
        <button
          onClick={handlePlayClick}
          className="absolute inset-0 bg-black/20 flex items-center justify-center transition-colors duration-200 hover:bg-black/40"
        >
          <div className="w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center">
            {isPlaying ? (
              <div className="w-3 h-3 flex gap-0.5">
                <div className="w-1 h-full bg-white rounded-sm" />
                <div className="w-1 h-full bg-white rounded-sm" />
              </div>
            ) : (
              <Play className="w-4 h-4 text-white fill-white ml-0.5" weight="fill" />
            )}
          </div>
        </button>
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        {/* Song title - larger text */}
        <h4 className="text-white font-medium text-lg truncate leading-tight">
          {song.title}
        </h4>

        {/* Artist name - smaller text, tight spacing */}
        <p className="text-neutral-400 text-base truncate leading-tight">
          {song.artist}
        </p>

        {/* Duration */}
        <p className="text-neutral-400 text-base mt-1">
          {formatDuration(song.duration)}
        </p>
      </div>

      {/* Select button - shows when showSelectButton is true */}
      {showSelectButton && (
        <button
          onClick={handleSelectClick}
          className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
        >
          <CaretRight className="w-5 h-5" />
        </button>
      )}

      {/* Playing indicator */}
      {isPlaying && (
        <div className="flex items-center gap-1 text-[#FE2C55]">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-3 bg-current animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-0.5 h-4 bg-current animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-0.5 h-2 bg-current animate-pulse" style={{ animationDelay: '300ms' }} />
            <div className="w-0.5 h-3 bg-current animate-pulse" style={{ animationDelay: '450ms' }} />
          </div>
        </div>
      )}
    </div>
  );
};