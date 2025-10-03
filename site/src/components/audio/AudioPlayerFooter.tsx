import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface AudioPlayerFooterProps {
  thumbnailUrl?: string;
  title: string;
  artist: string;
  audioUrl: string;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  className?: string;
}

export const AudioPlayerFooter: React.FC<AudioPlayerFooterProps> = ({
  thumbnailUrl,
  title,
  artist,
  audioUrl,
  isPlaying = false,
  onPlayPause,
  className = ''
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => onPlayPause?.();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onPlayPause]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className={cn(
        "fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 z-50",
        className
      )}>
        {/* Player Controls */}
        <div className="flex items-center gap-3 p-3">
          {/* Thumbnail */}
          {thumbnailUrl && (
            <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Song Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-base font-semibold truncate">
              {title}
            </h3>
            <p className="text-neutral-400 text-base truncate">
              {artist}
            </p>
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={onPlayPause}
            className="flex-shrink-0 cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7" weight="fill" style={{ color: '#fafafa' }} />
            ) : (
              <Play className="w-7 h-7" weight="fill" style={{ color: '#fafafa' }} />
            )}
          </button>
        </div>

        {/* Progress Bar - Full Width Bottom */}
        <div className="w-full h-1 bg-neutral-700">
          <div
            className="h-full bg-neutral-50 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </>
  );
};
