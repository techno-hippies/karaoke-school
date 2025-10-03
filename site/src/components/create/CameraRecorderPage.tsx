import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CameraRecorder } from '../ui/CameraRecorder';
import { getSongById, getClipById } from '../../lib/songs/directory';

interface WordTimestamp {
  text: string;
  start: number;
  end: number;
}

interface LineTimestamp {
  lineIndex: number;
  originalText: string;
  translatedText: string;
  start: number;
  end: number;
  wordCount: number;
  words?: WordTimestamp[];
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
  const { clipId } = useParams<{ clipId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState & {
    mode?: 'practice' | 'perform' | 'lipsync';
    videoEnabled?: boolean;
    recordingMode?: 'cover' | 'lipsync';
    clip?: any;
  };

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
  const [segment, setSegment] = useState<SelectedSegment | undefined>(state?.segment);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const loadSongOrClip = async () => {
      try {
        setLoading(true);

        // First, check if clip data was passed via state (new SongRegistryV4 flow)
        if (state?.clip) {
          const clipData = state.clip;
          console.log('[CameraRecorderPage] Using clip from state:', clipData);

          // Create segment data automatically from entire clip
          const autoSegment: SelectedSegment = {
            start: 0,
            end: clipData.duration,
            lyrics: clipData.lineTimestamps.map((lt: any) => ({
              lineIndex: lt.lineIndex || 0,
              originalText: lt.originalText || lt.text || '',
              translatedText: lt.translatedText || lt.text || '',
              start: lt.start,
              end: lt.end,
              wordCount: lt.wordCount || 0,
              words: lt.words || [] // Include word-level timestamps for karaoke
            }))
          };

          setSong({
            id: clipData.id,
            title: clipData.title,
            artist: clipData.artist,
            audioUrl: clipData.audioUrl || '',
            instrumentalUrl: clipData.instrumentalUrl,
            segments: [{
              start: autoSegment.start,
              end: autoSegment.end,
              lyrics: autoSegment.lyrics.map(lt => ({
                start: lt.start,
                end: lt.end,
                text: lt.originalText
              }))
            }]
          });

          // Set auto-generated segment
          setSegment(autoSegment);
          setLoading(false);
          return;
        }

        // Fallback: Try loading from URL param (legacy flow)
        if (!clipId) {
          setError('No clip ID provided');
          setLoading(false);
          return;
        }

        console.log('[CameraRecorderPage] Loading clip from ID:', clipId);
        const clipData = await getClipById(clipId);

        if (clipData) {
          console.log('[CameraRecorderPage] Loaded as clip:', clipData);

          // Create segment data automatically from entire clip
          const autoSegment: SelectedSegment = {
            start: 0,
            end: clipData.duration,
            lyrics: clipData.lineTimestamps.map(lt => ({
              lineIndex: lt.lineIndex || 0,
              originalText: lt.originalText || lt.text || '',
              translatedText: lt.translatedText || lt.text || '',
              start: lt.start,
              end: lt.end,
              wordCount: lt.wordCount || 0,
              words: lt.words || [] // Include word-level timestamps for karaoke
            }))
          };

          setSong({
            id: clipData.id,
            title: clipData.title,
            artist: clipData.artist,
            audioUrl: clipData.audioUrl || '',
            segments: [{
              start: autoSegment.start,
              end: autoSegment.end,
              lyrics: autoSegment.lyrics.map(lt => ({
                start: lt.start,
                end: lt.end,
                text: lt.originalText
              }))
            }]
          });

          // Set auto-generated segment
          setSegment(autoSegment);
          setLoading(false);
          return;
        }

        // Fallback: Clip not found
        setError('Clip not found');
        setLoading(false);
      } catch (error) {
        console.error('Failed to load song or clip:', error);
        setError('Failed to load song or clip');
      } finally {
        setLoading(false);
      }
    };

    loadSongOrClip();
  }, [clipId, state?.clip]);

  const handleBack = () => {
    console.log('[CameraRecorderPage] Navigating back, camera cleanup will be handled by CameraRecorder component');
    // Navigate back to song picker (clips don't need segment selection)
    navigate('/create/song-picker');
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
    console.log('[CameraRecorderPage] Recording completed with blob:', videoBlob.size, 'bytes');
    // Navigate to post editor with recorded data
    navigate(`/create/post-editor`, {
      state: {
        segment,
        videoBlob: videoBlob,
        clip: song
      }
    });
  };

  if (loading) {
    return (
      <div className="relative w-full h-screen bg-black overflow-hidden" />
    );
  }

  if (error || !song || !segment) {
    return (
      <div className="relative w-full h-screen bg-black overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-neutral-400 text-lg mb-4">
              {error || 'Missing clip data'}
            </div>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition-colors"
            >
              Back to Clip Selection
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
      audioUrl={
        state?.mode === 'lipsync'
          ? song.audioUrl          // Original vocals for lip sync
          : (song as any).instrumentalUrl || song.audioUrl  // Instrumental for practice/perform
      }
      recordingMode={state?.mode === 'lipsync' ? 'lipsync' : 'cover'}
      videoEnabled={state?.mode !== 'practice'}
      onRecord={handleRecord}
      onStop={handleStop}
      onBack={handleBack}
      onRecordingComplete={handleRecordingComplete}
    />
  );
};