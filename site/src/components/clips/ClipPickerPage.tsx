import React, { useState, useEffect, useRef } from 'react';
import { CaretLeft, CaretRight, Play, MusicNotes, BookOpen } from '@phosphor-icons/react';
import { SongListItem } from '../ui/SongListItem';
import { ExternalLinksSheet } from './ExternalLinksSheet';
import type { Song, ClipMetadata } from '../../types/song';
import { cn } from '@/lib/utils';

interface ExternalLink {
  label: string;
  url: string;
}

interface ClipPickerPageProps {
  clips: ClipMetadata[];
  onClipSelect: (clip: ClipMetadata) => void;
  onBack?: () => void;
  onViewLeaderboard?: () => void;
  yourScore?: number;
  topScore?: number;
  topUser?: string;
  songTitle?: string;
  artist?: string;
  thumbnailUrl?: string;
  isExternal?: boolean; // true = SoundCloud, false = local
  onPlaySong?: () => void;
  externalSongLinks?: ExternalLink[];
  externalLyricsLinks?: ExternalLink[];
  audioUrl?: string; // For local playback
  className?: string;
  geniusSongId?: number; // Genius song ID for trivia generation
  onStudy?: () => void; // Callback when Study button is clicked
  isGeneratingStudy?: boolean; // Loading state for study generation
}

export const ClipPickerPage: React.FC<ClipPickerPageProps> = ({
  clips,
  onClipSelect,
  onBack,
  onViewLeaderboard,
  yourScore,
  topScore,
  topUser,
  songTitle,
  artist,
  thumbnailUrl,
  isExternal = false,
  onPlaySong,
  externalSongLinks = [],
  externalLyricsLinks = [],
  audioUrl,
  className = '',
  geniusSongId,
  onStudy,
  isGeneratingStudy = false
}) => {
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [isExternalSheetOpen, setIsExternalSheetOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Handle clip preview playback
  const handlePlay = (clip: ClipMetadata) => {
    if (playingClipId === clip.id) {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingClipId(null);
    } else {
      // Start new playback (clips are short, play from start)
      if (audioRef.current && clip.audioUrl) {
        audioRef.current.src = clip.audioUrl;
        audioRef.current.currentTime = 0; // Clips are short, start from beginning
        audioRef.current.play();
        setPlayingClipId(clip.id);
      }
    }
  };

  // Handle clip selection
  const handleClipSelect = (clip: ClipMetadata) => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingClipId(null);

    console.log('[ClipPickerPage] Clip selected:', clip);
    onClipSelect(clip);
  };

  // Handle audio end
  const handleAudioEnd = () => {
    setPlayingClipId(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <div className={`relative w-full h-screen bg-neutral-900 overflow-hidden ${className}`}>
      {/* Hidden audio element for previews */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnd}
        preload="none"
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <div className="flex items-center h-16 px-4">
          <button
            onClick={onBack}
            className="w-12 h-12 flex items-center justify-center hover:bg-neutral-800/50 transition-colors cursor-pointer rounded-full"
          >
            <CaretLeft className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="absolute top-0 left-0 right-0 bottom-0 overflow-y-auto">
        {clips.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4 pt-16">
            <p className="text-gray-400 text-center">
              No clips available for this song
            </p>
          </div>
        ) : (
          <>
            {/* Album Art Hero */}
            <div className="relative w-full" style={{ height: 'min(384px, 40vh)' }}>
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt={songTitle}
                  className="w-full h-full object-cover"
                />
              )}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.95) 100%)'
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-white text-2xl font-bold mb-1">
                      {songTitle}
                    </h1>
                    <p className="text-neutral-300 text-base">
                      {artist}
                    </p>
                  </div>
                  {onPlaySong && (
                    <button
                      onClick={() => {
                        if (isExternal) {
                          setIsExternalSheetOpen(true);
                        } else {
                          onPlaySong?.();
                        }
                      }}
                      className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer",
                        isExternal ? "bg-purple-600 hover:bg-purple-700" : "bg-green-500 hover:bg-green-600"
                      )}
                    >
                      {isExternal ? (
                        <MusicNotes className="w-7 h-7 text-white" weight="fill" />
                      ) : (
                        <Play className="w-7 h-7 text-white" weight="fill" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={cn(
              "px-4 mt-4 space-y-4",
              geniusSongId && onStudy ? "pb-32" : "pb-4"
            )}>
              {/* Leaderboard Stats */}
              <div className="flex gap-2 md:gap-4">
                <div className="flex-1 bg-neutral-900 rounded-lg p-3 md:p-4 border border-neutral-800">
                  <div className="text-xl md:text-2xl font-bold text-white mb-1">
                    {yourScore ?? '—'}
                  </div>
                  <div className="text-neutral-400 text-base font-medium">
                    Your Score
                  </div>
                </div>

                <button
                  onClick={onViewLeaderboard}
                  className="flex-1 bg-neutral-900 rounded-lg p-3 md:p-4 border border-neutral-800 hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-green-400 mb-1 text-left">
                      {topScore ?? '—'}
                    </div>
                    <div className="text-neutral-400 text-base font-medium text-left">
                      {topUser || 'Top Score'}
                    </div>
                  </div>
                  <CaretRight className="w-5 h-5 text-neutral-400" />
                </button>
              </div>

            {/* Clips list */}
            <div className="space-y-1">
              {clips.map((clip) => {
                // Convert clip to song format for SongListItem
                const clipAsSong: Song = {
                  id: clip.id,
                  title: clip.sectionType,
                  artist: clip.duration > 0 ? `${Math.floor(clip.duration)}s` : '', // Only show duration if > 0
                  duration: clip.duration,
                  audioUrl: clip.audioUrl,
                  thumbnailUrl: clip.thumbnailUrl
                };

                return (
                  <SongListItem
                    key={clip.id}
                    song={clipAsSong}
                    isPlaying={playingClipId === clip.id}
                    showSelectButton={true}
                    showThumbnail={false}
                    onClick={() => handleClipSelect(clip)}
                    onPlay={() => handlePlay(clip)}
                    onSelect={() => handleClipSelect(clip)}
                    className="rounded-lg"
                  />
                );
              })}
            </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky Footer with Study Button */}
      {geniusSongId && onStudy && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-neutral-900 via-neutral-900 to-transparent pt-8 pb-4 px-4">
          <button
            onClick={onStudy}
            disabled={isGeneratingStudy}
            className={cn(
              "w-full font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-lg",
              isGeneratingStudy
                ? "bg-purple-800 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            )}
          >
            {isGeneratingStudy ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                <span className="text-lg">Generating Study Cards...</span>
              </>
            ) : (
              <>
                <BookOpen className="w-6 h-6" weight="duotone" />
                <span className="text-lg">Study This Song</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* External Links Sheet */}
      <ExternalLinksSheet
        open={isExternalSheetOpen}
        onOpenChange={setIsExternalSheetOpen}
        songLinks={externalSongLinks}
        lyricsLinks={externalLyricsLinks}
      />

    </div>
  );
};
