import React, { useState, useRef, useEffect } from 'react';
import { CaretLeft, Play, Pause } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useKaraokeWords, type WordTimestamp } from '../../hooks/karaoke/useKaraokeWords';
import { TikTokKaraokeRenderer } from '../karaoke/KaraokeWordsRenderer';

interface LyricLine {
  lineIndex: number;
  originalText: string;
  translations?: Record<string, string>;
  start: number;
  end: number;
  sectionMarker?: boolean;
  words?: WordTimestamp[];
}

interface LyricsPageProps {
  thumbnailUrl?: string;
  title: string;
  artist: string;
  audioUrl: string;
  lyrics: LyricLine[];
  selectedLanguage?: string; // Language code for translation (e.g., 'cn', 'vi')
  onBack?: () => void;
  className?: string;
}

interface LyricLineRendererProps {
  line: LyricLine;
  currentTime: number;
  isActive: boolean;
  isPast: boolean;
}

const LyricLineRenderer: React.FC<LyricLineRendererProps> = ({
  line,
  currentTime,
  isActive,
  isPast
}) => {
  // Filter out malformed word timestamps
  const validWords = (line.words || []).filter(word => {
    const duration = word.end - word.start;
    return duration > 0 && duration < 5;
  });

  // Process words with karaoke timing if active
  const processedWords = useKaraokeWords(validWords, isActive ? currentTime : 0);

  if (isActive) {
    console.log('[LyricLineRenderer] Active line:', line.originalText, 'time:', currentTime.toFixed(2), 'lineStart:', line.start.toFixed(2), 'lineEnd:', line.end.toFixed(2), 'validWords:', validWords.length);
  }

  // If we have valid word timestamps and this is the active line, use word-level highlighting
  if (isActive && validWords.length > 0) {
    return (
      <div className="text-3xl font-bold leading-tight flex flex-wrap">
        {processedWords.map((word, i) => (
          <span
            key={`${word.text}-${i}`}
            className={`mr-1 ${word.isActive ? 'text-[#FE2C55]' : 'text-white'}`}
          >
            {word.text}
          </span>
        ))}
      </div>
    );
  }

  // For non-active lines or lines without word data, use line-level highlighting
  return (
    <p
      className="text-3xl font-bold leading-tight transition-colors duration-300"
      style={{
        color: isActive ? '#ffffff' : isPast ? '#a3a3a3' : '#737373'
      }}
    >
      {line.originalText}
    </p>
  );
};

export const LyricsPage: React.FC<LyricsPageProps> = ({
  thumbnailUrl,
  title,
  artist,
  audioUrl,
  lyrics,
  selectedLanguage = 'cn',
  onBack,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Filter out section markers
  const filteredLyrics = lyrics.filter(line => !line.sectionMarker);

  // Find current lyric line - must be within line's start and end time
  const currentLineIndex = filteredLyrics.findIndex((line) => {
    return currentTime >= line.start && currentTime <= line.end;
  });

  // Auto-scroll to active line
  useEffect(() => {
    if (currentLineIndex >= 0 && lyricsContainerRef.current) {
      const activeElement = lyricsContainerRef.current.querySelector(`[data-line-index="${currentLineIndex}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentLineIndex]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleTogglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className={cn("relative w-full h-screen overflow-hidden bg-neutral-900", className)}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center h-16 px-4">
          <button
            onClick={onBack}
            className="w-12 h-12 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer rounded-full"
          >
            <CaretLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white text-base font-semibold flex-1 text-center pr-12">
            {title} - {artist}
          </h1>
        </div>
      </div>

      {/* Top fade gradient */}
      <div
        className="absolute left-0 right-0 z-20 pointer-events-none"
        style={{
          top: '64px',
          height: '60px',
          background: 'linear-gradient(to bottom, rgba(23,23,23,1) 0%, rgba(23,23,23,0) 100%)'
        }}
      />

      {/* Lyrics Container */}
      <div
        ref={lyricsContainerRef}
        className="absolute left-0 right-0 overflow-y-auto px-6 z-10 scrollbar-hide"
        style={{
          top: '64px',
          bottom: '180px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <div className="space-y-8 pt-24 pb-32">
          {filteredLyrics.map((line, index) => {
            const isActive = index === currentLineIndex;
            const isPast = index < currentLineIndex;
            const translation = line.translations?.[selectedLanguage];

            return (
              <div
                key={line.lineIndex}
                data-line-index={index}
                className={cn(
                  "transition-all duration-300",
                  isActive && "scale-105"
                )}
              >
                <LyricLineRenderer
                  line={line}
                  currentTime={currentTime}
                  isActive={isActive}
                  isPast={isPast}
                />
                {translation && (
                  <p
                    className={cn(
                      "text-xl mt-3 transition-colors duration-300",
                      isActive ? "text-neutral-300" : "text-neutral-600"
                    )}
                  >
                    {translation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom fade gradient */}
      <div
        className="absolute left-0 right-0 z-30 pointer-events-none"
        style={{
          bottom: '160px',
          height: '80px',
          background: 'linear-gradient(to top, rgba(23,23,23,1) 0%, rgba(23,23,23,0) 100%)'
        }}
      />

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-neutral-900" style={{ height: '160px' }}>
        <div className="px-6 pt-4 pb-6">
          {/* Play/Pause Button */}
          <button
            onClick={handleTogglePlayPause}
            className="w-14 h-14 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform cursor-pointer mx-auto"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 text-black" weight="fill" />
            ) : (
              <Play className="w-7 h-7 text-black" weight="fill" />
            )}
          </button>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-neutral-700 rounded-full mb-2 mt-8">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-xs text-neutral-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
