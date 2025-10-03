import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClipPickerPage } from '../clips/ClipPickerPage';
import type { Song, ClipMetadata } from '../../types/song';
import type { SongMetadataV4 } from '../../services/SongRegistryService';

interface LocationState {
  song: Song;
  clips: ClipMetadata[];
  fullMetadata?: SongMetadataV4;
}

export const ClipPickerPageRoute: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  if (!state || !state.song || !state.clips) {
    // Redirect back to song picker if no state
    navigate('/create/song-picker', { replace: true });
    return null;
  }

  const { song, clips, fullMetadata } = state;

  const handleClipSelect = (clip: ClipMetadata) => {
    console.log('[ClipPickerPageRoute] Clip selected:', clip);
    navigate('/create/mode-selector', {
      state: { clip }
    });
  };

  const handleBack = () => {
    navigate('/create/song-picker');
  };

  const handlePlaySong = () => {
    console.log('[ClipPickerPageRoute] Play song clicked');
    navigate('/create/lyrics', {
      state: { song, clips, fullMetadata }
    });
  };

  return (
    <ClipPickerPage
      clips={clips}
      onClipSelect={handleClipSelect}
      onBack={handleBack}
      songTitle={song.title}
      artist={song.artist}
      thumbnailUrl={song.thumbnailUrl}
      isExternal={false}
      audioUrl={song.audioUrl}
      onPlaySong={handlePlaySong}
    />
  );
};
