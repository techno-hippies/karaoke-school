import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LyricsPage } from '../audio/LyricsPage';
import type { Song, ClipMetadata } from '../../types/song';
import type { SongMetadataV4 } from '../../services/SongRegistryService';

interface LocationState {
  song: Song;
  clips: ClipMetadata[];
  fullMetadata?: SongMetadataV4;
}

export const LyricsPageRoute: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  if (!state || !state.song) {
    navigate('/create/song-picker', { replace: true });
    return null;
  }

  const { song, clips, fullMetadata } = state;

  // Use full metadata if available, otherwise fall back to clips
  const allLyrics = fullMetadata
    ? fullMetadata.lines.map(line => ({
        lineIndex: line.lineIndex,
        originalText: line.originalText,
        translations: line.translations || {},
        start: line.start,
        end: line.end,
        words: line.words || [],
        sectionMarker: line.sectionMarker
      }))
    : clips.flatMap(clip =>
        clip.lineTimestamps?.map(line => ({
          lineIndex: line.lineIndex,
          originalText: line.originalText || line.text,
          translations: {
            cn: line.translatedText || ''
          },
          start: line.start,
          end: line.end,
          words: line.words || []
        })) || []
      ).sort((a, b) => a.start - b.start);

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <LyricsPage
      thumbnailUrl={song.thumbnailUrl}
      title={song.title}
      artist={song.artist}
      audioUrl={song.audioUrl || ''}
      lyrics={allLyrics}
      selectedLanguage="cn"
      onBack={handleBack}
    />
  );
};
