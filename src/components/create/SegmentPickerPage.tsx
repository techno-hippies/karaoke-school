import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SegmentPicker } from '../ui/SegmentPicker';
import { getSongById } from '../../lib/song-directory';

interface LineTimestamp {
  lineIndex: number;
  originalText: string;
  translatedText: string;
  start: number;
  end: number;
  wordCount: number;
}

interface SongWithTimestamps {
  title: string;
  artist: string;
  audioUrl: string;
  lineTimestamps: LineTimestamp[];
  totalLines: number;
  exportedAt: string;
  format: string;
}

interface SelectedSegment {
  start: number;
  end: number;
  lyrics: LineTimestamp[];
}

export const SegmentPickerPage: React.FC = () => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongWithTimestamps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSong = async () => {
      if (!songId) {
        setError('No song ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('[SegmentPickerPage] Loading song:', songId);

        const songData = await getSongById(songId!);
        if (!songData) {
          setError('Song not found');
          setLoading(false);
          return;
        }

        // Convert to the format expected by SegmentPicker
        const songWithTimestamps: SongWithTimestamps = {
          title: songData.title,
          artist: songData.artist,
          audioUrl: songData.audioUrl || '',
          lineTimestamps: songData.lineTimestamps.map((lt, index) => ({
            lineIndex: index,
            originalText: lt.originalText || lt.text || '',
            translatedText: lt.translatedText || lt.text || '',
            start: lt.start,
            end: lt.end,
            wordCount: (lt.originalText || lt.text || '').split(' ').length
          })),
          totalLines: songData.totalLines,
          exportedAt: new Date().toISOString(),
          format: 'v1'
        };

        setSong(songWithTimestamps);
        console.log('[SegmentPickerPage] Song loaded:', songWithTimestamps);
      } catch (error) {
        console.error('Failed to load song:', error);
        setError('Failed to load song');
      } finally {
        setLoading(false);
      }
    };

    loadSong();
  }, [songId]);

  const handleBack = () => {
    navigate('/create/song-picker');
  };

  const handleNext = (segment: SelectedSegment) => {
    console.log('[SegmentPickerPage] Segment selected:', segment);
    // Navigate to camera recorder with selected segment
    navigate(`/create/camera-recorder/${songId}`, {
      state: { segment }
    });
  };

  if (loading) {
    return (
      <div className="relative w-full h-screen bg-neutral-900 overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="text-neutral-400 text-lg">Loading song...</div>
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="relative w-full h-screen bg-neutral-900 overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-neutral-400 text-lg mb-4">
              {error || 'Song not found'}
            </div>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition-colors"
            >
              Back to Song Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SegmentPicker
      song={song}
      onBack={handleBack}
      onNext={handleNext}
    />
  );
};