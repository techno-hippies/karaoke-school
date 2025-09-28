import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CameraRecorder } from '../ui/CameraRecorder';
import { getSongById } from '../../lib/songs/directory';

interface LineTimestamp {
  lineIndex: number;
  originalText: string;
  translatedText: string;
  start: number;
  end: number;
  wordCount: number;
}

interface SelectedSegment {
  start: number;
  end: number;
  lyrics: LineTimestamp[];
}

interface LocationState {
  segment?: SelectedSegment;
}

export const CameraRecorderPage: React.FC = () => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  const [song, setSong] = useState<{
    id: string;
    title: string;
    artist: string;
    audioUrl: string;
    segments: Array<{
      start: number;
      end: number;
      lyrics: Array<{
        start: number;
        end: number;
        text: string;
      }>;
    }>;
    [key: string]: unknown;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Get segment data from navigation state
  const segment = state?.segment;

  useEffect(() => {
    const loadSong = async () => {
      if (!songId) {
        setError('No song ID provided');
        setLoading(false);
        return;
      }

      if (!segment) {
        setError('No segment data provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('[CameraRecorderPage] Loading song:', songId);
        console.log('[CameraRecorderPage] Segment data:', segment);

        const songData = await getSongById(songId);
        if (!songData) {
          setError('Song not found');
          setLoading(false);
          return;
        }

        setSong({
          ...songData,
          audioUrl: songData.audioUrl || '',
          segments: songData.lineTimestamps ? [{
            start: 0,
            end: songData.duration || 0,
            lyrics: songData.lineTimestamps.map(lt => ({
              start: lt.start,
              end: lt.end,
              text: lt.text
            }))
          }] : []
        });
        console.log('[CameraRecorderPage] Song loaded:', songData);
      } catch (error) {
        console.error('Failed to load song:', error);
        setError('Failed to load song');
      } finally {
        setLoading(false);
      }
    };

    loadSong();
  }, [songId, segment]);

  const handleBack = () => {
    console.log('[CameraRecorderPage] Navigating back, camera cleanup will be handled by CameraRecorder component');
    navigate(`/create/segment-picker/${songId}`, {
      state: { segment } // Pass segment back in case user wants to modify
    });
  };

  const handleRecord = () => {
    console.log('[CameraRecorderPage] Starting recording');
    setIsRecording(true);
  };

  const handleStop = () => {
    console.log('[CameraRecorderPage] Stopping recording');
    setIsRecording(false);
  };

  const handleRecordingComplete = (videoBlob: Blob) => {
    console.log('[CameraRecorderPage] Recording completed with video blob:', videoBlob.size, 'bytes');
    // Navigate to post editor with recorded video data
    navigate(`/create/post-editor/${songId}`, {
      state: {
        segment,
        videoBlob: videoBlob
      }
    });
  };

  const handleFlipCamera = () => {
    console.log('[CameraRecorderPage] Flip camera requested');
    // The actual flip logic is now handled in CameraRecorder component
  };

  const handleFlash = () => {
    console.log('[CameraRecorderPage] Flash toggle requested');
    // TODO: Implement flash toggle logic
  };

  if (loading) {
    return (
      <div className="relative w-full h-screen bg-black overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="text-neutral-400 text-lg">Loading camera...</div>
        </div>
      </div>
    );
  }

  if (error || !song || !segment) {
    return (
      <div className="relative w-full h-screen bg-black overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-neutral-400 text-lg mb-4">
              {error || 'Missing song or segment data'}
            </div>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition-colors"
            >
              Back to Segment Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CameraRecorder
      isRecording={isRecording}
      segment={segment}
      audioUrl={song.audioUrl}
      onRecord={handleRecord}
      onStop={handleStop}
      onFlipCamera={handleFlipCamera}
      onFlash={handleFlash}
      onBack={handleBack}
      onRecordingComplete={handleRecordingComplete}
      showFlash={true}
    />
  );
};