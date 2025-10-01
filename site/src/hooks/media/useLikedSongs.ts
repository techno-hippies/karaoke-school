import { useState, useEffect } from 'react';
import { generateCardsFromVideo, type ExerciseCard } from '../../services/FSRSCardGenerator';
import type { EmbeddedKaraokeSegment } from '../../types/feed';

interface LikedSong {
  postId: string;
  username: string;
  description: string;
  timestamp: string;

  // Enhanced karaoke metadata for FSRS card generation
  songId?: string;
  songTitle?: string;
  lyricsUrl?: string;
  segmentStart?: number;
  segmentEnd?: number;
  karaokeSegment?: EmbeddedKaraokeSegment; // Embedded karaoke data

  // Generated exercise cards cache
  exerciseCards?: ExerciseCard[];
  cardsGenerated?: boolean;
}

export function useLikedSongs() {
  const [likedSongs, setLikedSongs] = useState<LikedSong[]>([]);

  // Load liked songs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('likedSongs');
      if (stored) {
        setLikedSongs(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load liked songs from localStorage:', error);
    }
  }, []);

  // Save to localStorage whenever likedSongs changes
  useEffect(() => {
    try {
      localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
    } catch (error) {
      console.error('Failed to save liked songs to localStorage:', error);
    }
  }, [likedSongs]);

  const addLikedSong = async (song: LikedSong) => {
    setLikedSongs(prev => {
      // Avoid duplicates
      if (prev.some(s => s.postId === song.postId)) {
        return prev;
      }
      console.log('[useLikedSongs] Adding liked song:', song);
      return [...prev, song];
    });

    // Generate FSRS cards in background if karaoke data is available
    if (song.karaokeSegment || (song.songId && song.segmentStart !== undefined)) {
      try {
        console.log('[useLikedSongs] Generating FSRS cards for liked song:', song.postId);
        const exerciseCards = await generateCardsFromVideo(song);

        if (exerciseCards.length > 0) {
          console.log(`[useLikedSongs] Generated ${exerciseCards.length} exercise cards`);

          // Update the song with generated cards
          setLikedSongs(current =>
            current.map(s =>
              s.postId === song.postId
                ? { ...s, exerciseCards, cardsGenerated: true }
                : s
            )
          );
        }
      } catch (error) {
        console.error('[useLikedSongs] Failed to generate exercise cards:', error);

        // Mark as attempted but failed
        setLikedSongs(current =>
          current.map(s =>
            s.postId === song.postId
              ? { ...s, cardsGenerated: false }
              : s
          )
        );
      }
    }
  };

  const removeLikedSong = (postId: string) => {
    setLikedSongs(prev => {
      const filtered = prev.filter(s => s.postId !== postId);
      console.log('[useLikedSongs] Removed liked song:', postId);
      return filtered;
    });
  };

  const isLiked = (postId: string) => {
    return likedSongs.some(s => s.postId === postId);
  };

  const clearAllLikedSongs = () => {
    setLikedSongs([]);
    console.log('[useLikedSongs] Cleared all liked songs');
  };

  return {
    likedSongs,
    addLikedSong,
    removeLikedSong,
    isLiked,
    clearAllLikedSongs
  };
}