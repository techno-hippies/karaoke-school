import React, { useState, useEffect, useRef } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { SongListItem } from '../ui/SongListItem';
import type { Song } from '../../types/song';
import { getAvailableSongs } from '../../lib/song-directory';

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
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load available songs on mount
  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      setLoading(true);
      console.log('[SongPickerPage] Loading songs...');
      const availableSongs = await getAvailableSongs();
      console.log('[SongPickerPage] Loaded songs:', availableSongs);

      // Convert to Song format expected by SongListItem
      const formattedSongs: Song[] = availableSongs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        audioUrl: song.audioUrl,
        thumbnailUrl: song.thumbnailUrl
      }));

      setSongs(formattedSongs);
      console.log('[SongPickerPage] Formatted songs:', formattedSongs);
    } catch (error) {
      console.error('Failed to load songs:', error);
    } finally {
      setLoading(false);
    }
  };


  // Handle song preview playback
  const handlePlay = (song: Song) => {
    if (playingSongId === song.id) {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingSongId(null);
    } else {
      // Start new playback
      if (audioRef.current && song.audioUrl) {
        audioRef.current.src = song.audioUrl;
        audioRef.current.currentTime = 30; // Start 30 seconds in for preview
        audioRef.current.play();
        setPlayingSongId(song.id);
      }
    }
  };

  // Handle song selection
  const handleSongSelect = (song: Song) => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingSongId(null);

    // Navigate to segment picker with selected song
    console.log('[SongPickerPage] Song selected:', song);
    navigate(`/create/segment-picker/${song.id}`);

    // Also call the callback if provided
    onSongSelect?.(song);
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
    setPlayingSongId(null);
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
            <h1 className="text-white text-lg font-semibold">Choose a Song</h1>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="absolute top-16 left-0 right-0 bottom-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-neutral-400 text-lg">Loading songs...</div>
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="text-neutral-400 text-lg mb-2">
              No songs available
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {songs.map((song) => (
                <SongListItem
                  key={song.id}
                  song={song}
                  isPlaying={playingSongId === song.id}
                  showSelectButton={true}
                  onClick={handleSongSelect}
                  onPlay={handlePlay}
                  onSelect={handleSongSelect}
                  className="rounded-lg"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};