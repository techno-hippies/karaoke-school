import React, { useState, useEffect, useRef } from 'react';
import {
  CameraRotate,
  Lightning,
  CaretLeft
} from '@phosphor-icons/react';

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

interface CameraRecorderProps {
  isRecording?: boolean;
  segment?: SelectedSegment;
  audioUrl?: string;
  onRecord?: () => void;
  onStop?: () => void;
  onFlipCamera?: () => void;
  onFlash?: () => void;
  onBack?: () => void;
  onRecordingComplete?: () => void;
  showFlash?: boolean; // Optional flash control
  className?: string;
}

export const CameraRecorder: React.FC<CameraRecorderProps> = ({
  isRecording = false,
  segment,
  audioUrl,
  onRecord,
  onStop,
  onFlipCamera,
  onFlash,
  onBack,
  onRecordingComplete,
  showFlash = false,
  className = ''
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  // Auto-play audio and start lyrics when recording starts
  useEffect(() => {
    if (isRecording && audioUrl && segment) {
      // Start audio from segment start
      if (audioRef.current) {
        audioRef.current.currentTime = segment.start;
        audioRef.current.play();
      }
      setRecordingStartTime(Date.now());
      setCurrentLyricIndex(0);

      // Stop audio at segment end
      const segmentDuration = (segment.end - segment.start) * 1000; // Convert to milliseconds
      const stopTimer = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }, segmentDuration);

      // Cleanup timer if component unmounts or recording stops
      return () => clearTimeout(stopTimer);
    } else if (!isRecording && audioRef.current) {
      audioRef.current.pause();
      setRecordingStartTime(null);
    }
  }, [isRecording, audioUrl, segment]);

  // Update lyrics based on audio playback time
  useEffect(() => {
    if (!isRecording || !segment || !recordingStartTime) return;

    const interval = setInterval(() => {
      if (audioRef.current) {
        const currentTime = audioRef.current.currentTime;

        // Find which lyric should be showing based on current audio time
        const activeIndex = segment.lyrics.findIndex(lyric =>
          currentTime >= lyric.start && currentTime <= lyric.end
        );

        if (activeIndex !== -1) {
          setCurrentLyricIndex(activeIndex);
        }
      }
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [isRecording, segment, recordingStartTime]);

  const handleRecordClick = () => {
    if (isRecording) {
      onStop?.();
      // Auto-navigate to next screen after stopping
      setTimeout(() => {
        onRecordingComplete?.();
      }, 500);
    } else {
      onRecord?.();
    }
  };

  // Get current 2 lines to display
  const getCurrentLyrics = () => {
    if (!segment?.lyrics) return [];

    const lyrics = segment.lyrics;
    const current = lyrics[currentLyricIndex];
    const next = lyrics[currentLyricIndex + 1];

    return [current, next].filter(Boolean);
  };

  return (
    <div className={`relative w-full h-screen bg-black overflow-hidden ${className}`}>
      {/* Safe area spacer */}
      <div className="h-16 w-full bg-transparent"></div>

      {/* Camera preview area - placeholder for now */}
      <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
        <span className="text-neutral-400 text-lg">Camera Preview</span>
      </div>

      {/* Back button - top left */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 z-50 w-12 h-12 flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer rounded-full"
      >
        <CaretLeft className="w-6 h-6 text-white" />
      </button>

      {/* Rolling lyrics display - positioned near top for eye contact */}
      {segment?.lyrics && (
        <div className="absolute top-20 left-4 right-4 z-20">
          <div className="text-center">
            <div className="space-y-3">
              {getCurrentLyrics().map((lyric, index) => (
                <p
                  key={lyric.lineIndex}
                  className={`text-white text-xl font-medium leading-tight transition-all duration-300 ${
                    index === 0 ? 'opacity-100 scale-100' : 'opacity-70 scale-95'
                  }`}
                >
                  {lyric.originalText}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
        />
      )}

      {/* Top right controls - responsive design */}
      <div
        className="absolute right-4 z-20 flex flex-col gap-4"
        style={{ top: '280px' }}
      >
        {/* Flip camera - mobile only */}
        {onFlipCamera && (
          <div className="flex flex-col items-center gap-0.5 md:hidden">
            <button
              onClick={onFlipCamera}
              className="w-12 h-12 flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer rounded-full"
            >
              <CameraRotate className="w-6 h-6 text-white" />
            </button>
            <span className="text-white text-xs font-medium drop-shadow-lg">Flip</span>
          </div>
        )}

        {/* Flash - only if showFlash is true */}
        {showFlash && onFlash && (
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={onFlash}
              className="w-12 h-12 flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer rounded-full"
            >
              <Lightning className="w-6 h-6 text-white" />
            </button>
            <span className="text-white text-xs font-medium drop-shadow-lg">Flash</span>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className="absolute left-0 right-0 z-20"
        style={{
          bottom: '40px',
          position: 'absolute',
          left: 0,
          right: 0
        }}
      >
        <div className="w-full flex items-center justify-center">
          {/* Record button - center only */}
          <div
            className={`${isRecording ? 'p-0' : 'p-2'} rounded-full transition-all duration-200`}
            style={{
              border: isRecording ? 'none' : '3px solid #ef4444'
            }}
          >
            <button
              onClick={handleRecordClick}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              <div
                className={`${
                  isRecording ? 'w-4 h-4 rounded-sm' : 'w-12 h-12 rounded-full'
                } bg-red-500 transition-all duration-200`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};