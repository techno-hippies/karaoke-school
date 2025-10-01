import React, { useState, useEffect, useRef } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { SongListItem } from '../ui/SongListItem';
import type { Song, Clip } from '../../types/song';
import { getAvailableClips } from '../../lib/songs/directory';

interface SongPickerPageProps {
  onBack?: () => void;
  onSongSelect?: (song: Song) => void;
  className?: string;
}

export const SongPickerPage: React.FC<SongPickerPageProps> = ({
  onBack,
  onSongSelect,
  className = ''
}) => {
  const navigate = useNavigate();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load available clips on mount
  useEffect(() => {
    loadClips();
  }, []);

  const loadClips = async () => {
    try {
      setLoading(true);
      console.log('[SongPickerPage] Loading clips...');
      const availableClips = await getAvailableClips();
      console.log('[SongPickerPage] Loaded clips:', availableClips);

      // Convert to Clip format
      const formattedClips: Clip[] = availableClips.map(clip => ({
        id: clip.id,
        title: clip.title,
        artist: clip.artist,
        sectionType: clip.sectionType,
        sectionIndex: clip.sectionIndex,
        duration: clip.duration,
        audioUrl: clip.audioUrl,
        instrumentalUrl: clip.instrumentalUrl,
        thumbnailUrl: clip.thumbnailUrl,
        difficultyLevel: clip.difficultyLevel,
        wordsPerSecond: clip.wordsPerSecond
      }));

      setClips(formattedClips);
      console.log('[SongPickerPage] Formatted clips:', formattedClips);
    } catch (error) {
      console.error('Failed to load clips:', error);
    } finally {
      setLoading(false);
    }
  };


  // Handle clip preview playback
  const handlePlay = (clip: Clip) => {
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
  const handleClipSelect = (clip: Clip) => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingClipId(null);

    // Navigate directly to camera recorder (skip segment picker for clips)
    console.log('[SongPickerPage] Clip selected:', clip);
    navigate(`/create/camera-recorder/${clip.id}`);

    // Also call the callback if provided (convert clip to song format)
    onSongSelect?.({
      id: clip.id,
      title: clip.title,
      artist: clip.artist,
      duration: clip.duration,
      audioUrl: clip.audioUrl,
      thumbnailUrl: clip.thumbnailUrl
    });
  };

  // Stop audio when component unmounts
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, []);

  // Handle audio end
  const handleAudioEnd = () => {
    setPlayingClipId(null);
  };

  return (
    <div className={`relative w-full h-screen bg-neutral-900 overflow-hidden ${className}`}>
      {/* Hidden audio element for previews */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnd}
        preload="none"
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center h-16 px-4">
          <button
            onClick={() => onBack ? onBack() : navigate('/')}
            className="w-12 h-12 flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer rounded-full"
          >
            <CaretLeft className="w-6 h-6 text-white" />
          </button>

          <div className="flex-1 mx-4">
            <h1 className="text-white text-lg font-semibold">Choose a Clip</h1>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="absolute top-16 left-0 right-0 bottom-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-neutral-400 text-lg">Loading clips...</div>
          </div>
        ) : clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="text-neutral-400 text-lg mb-2">
              No clips available
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {clips.map((clip) => {
                // Convert clip to song format for SongListItem
                const clipAsSong: Song = {
                  id: clip.id,
                  title: `${clip.title} - ${clip.sectionType}`,
                  artist: clip.artist,
                  duration: clip.duration,
                  audioUrl: clip.audioUrl,
                  thumbnailUrl: clip.thumbnailUrl
                };

                return (
                  <div key={clip.id} className="relative">
                    <SongListItem
                      song={clipAsSong}
                      isPlaying={playingClipId === clip.id}
                      showSelectButton={true}
                      onClick={() => handleClipSelect(clip)}
                      onPlay={() => handlePlay(clip)}
                      onSelect={() => handleClipSelect(clip)}
                      className="rounded-lg"
                    />
                    {/* Difficulty badge */}
                    <div className="absolute top-2 right-2 px-2 py-1 bg-neutral-800 rounded text-xs text-neutral-300">
                      Level {clip.difficultyLevel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};