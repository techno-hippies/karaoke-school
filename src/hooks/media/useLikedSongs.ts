import { useState, useEffect } from 'react';

interface LikedSong {
  postId: string;
  username: string;
  description: string;
  timestamp: string;
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

  const addLikedSong = (song: LikedSong) => {
    setLikedSongs(prev => {
      // Avoid duplicates
      if (prev.some(s => s.postId === song.postId)) {
        return prev;
      }
      console.log('[useLikedSongs] Adding liked song:', song);
      return [...prev, song];
    });
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