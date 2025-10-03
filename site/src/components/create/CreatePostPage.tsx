import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MusicNotes } from '@phosphor-icons/react';
import { CameraRecorder } from '../ui/CameraRecorder';
import { ClipPickerSheet } from '../clips/ClipPickerSheet';
import type { ClipMetadata } from '../../types/song';

interface LineTimestamp {
  lineIndex: number;
  originalText: string;
  translatedText: string;
  start: number;
  end: number;
  wordCount: number;
  words?: Array<{ text: string; start: number; end: number }>;
}

interface SelectedSegment {
  start: number;
  end: number;
  lyrics: LineTimestamp[];
}

export const CreatePostPage: React.FC = () => {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedClip, setSelectedClip] = useState<ClipMetadata | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [segment, setSegment] = useState<SelectedSegment | undefined>(undefined);
  const [recordingMode, setRecordingMode] = useState<'cover' | 'lipsync'>('cover');
  const [videoEnabled, setVideoEnabled] = useState(true);

  const handleClipSelect = (clip: ClipMetadata) => {
    console.log('[CreatePostPage] Clip selected:', clip);
    setSelectedClip(clip);

    // Create segment data from clip
    const clipSegment: SelectedSegment = {
      start: 0,
      end: clip.duration,
      lyrics: clip.lineTimestamps?.map(lt => ({
        lineIndex: lt.lineIndex || 0,
        originalText: lt.originalText || lt.text || '',
        translatedText: lt.translatedText || lt.text || '',
        start: lt.start,
        end: lt.end,
        wordCount: lt.wordCount || 0,
        words: lt.words || []
      })) || []
    };

    setSegment(clipSegment);
    setSheetOpen(false);
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleRecord = () => {
    console.log('[CreatePostPage] Starting recording');
    setIsRecording(true);
  };

  const handleStop = () => {
    console.log('[CreatePostPage] Stopping recording');
    setIsRecording(false);
  };

  const handleRecordingComplete = (videoBlob: Blob) => {
    console.log('[CreatePostPage] Recording completed:', videoBlob.size, 'bytes');
    // TODO: Navigate to post editor
    // navigate('/create/post-editor', { state: { videoBlob, selectedClip } });
  };

  const handleModeChange = (mode: 'cover' | 'lipsync') => {
    console.log('[CreatePostPage] Mode changed to:', mode);
    setRecordingMode(mode);
  };

  const handleVideoToggle = (enabled: boolean) => {
    console.log('[CreatePostPage] Video enabled:', enabled);
    setVideoEnabled(enabled);
  };

  return (
    <div className="relative w-full h-screen bg-black">
      {/* Camera Recorder */}
      <CameraRecorder
        isRecording={isRecording}
        segment={segment}
        audioUrl={selectedClip?.audioUrl}
        recordingMode={recordingMode}
        videoEnabled={videoEnabled}
        onRecord={handleRecord}
        onStop={handleStop}
        onBack={handleBack}
        onRecordingComplete={handleRecordingComplete}
        onModeChange={handleModeChange}
        onVideoToggle={handleVideoToggle}
      />

      {/* Add Sound Pill - Top Center (TikTok style) */}
      <button
        onClick={() => setSheetOpen(true)}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-sm border border-white/20 rounded-full hover:bg-black/80 transition-colors"
      >
        <MusicNotes className="w-5 h-5 text-white" />
        <span className="text-white text-sm font-medium">
          {selectedClip ? `${selectedClip.title} - ${selectedClip.sectionType}` : 'Add sound'}
        </span>
      </button>

      {/* Clip Picker Sheet */}
      <ClipPickerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onClipSelect={handleClipSelect}
      />
    </div>
  );
};
