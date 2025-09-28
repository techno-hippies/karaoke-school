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

interface ExtendedMediaStream extends MediaStream {
  audioContext?: AudioContext;
  destination?: MediaStreamAudioDestinationNode;
  micGain?: GainNode;
  bgMusicSource?: MediaElementAudioSourceNode;
  bgGain?: GainNode;
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
  onRecordingComplete?: (videoBlob: Blob) => void;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [cameraStream, setCameraStream] = useState<ExtendedMediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user'); // front camera by default
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  // Auto-play audio and start lyrics when recording starts
  useEffect(() => {
    if (isRecording && audioUrl && segment) {
      // Start recording with BOTH microphone and background music
      if (mediaRecorder && mediaRecorder.state === 'inactive') {
        setRecordedChunks([]); // Clear previous recording
        mediaRecorder.start(100); // Record in 100ms chunks for better data collection
        console.log('[CameraRecorder] Video recording started');
      }

      // Connect background music to audio mixing destination AND speakers
      if (audioRef.current && cameraStream && cameraStream.audioContext && cameraStream.destination) {
        console.log('[CameraRecorder] Connecting background music to recording stream');

        // Create audio source from the background music element
        const bgMusicSource = cameraStream.audioContext.createMediaElementSource(audioRef.current);

        // Create gain for background music
        const bgGain = cameraStream.audioContext.createGain();
        bgGain.gain.value = 0.6; // Lower volume so voice can be heard over it

        // Connect to BOTH the recording destination AND the speakers
        // This allows you to hear the music while it's also being recorded
        bgMusicSource.connect(bgGain);
        bgGain.connect(cameraStream.destination); // For recording
        bgGain.connect(cameraStream.audioContext.destination); // For speakers (playback)

        // Store references for cleanup
        cameraStream.bgMusicSource = bgMusicSource;
        cameraStream.bgGain = bgGain;

        // Start audio from segment start
        audioRef.current.currentTime = segment.start;
        audioRef.current.play();
        console.log('[CameraRecorder] Background music connected to both recording and speakers');
      }
      setRecordingStartTime(Date.now());
      setCurrentLyricIndex(0);

      // Stop audio at segment end and auto-progress
      const segmentDuration = (segment.end - segment.start) * 1000; // Convert to milliseconds
      const stopTimer = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
        }

        // Stop video recording
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          console.log('[CameraRecorder] Video recording stopped');
        }

        // Auto-stop recording and progress to next page
        onStop?.();
      }, segmentDuration);

      // Cleanup timer if component unmounts or recording stops
      return () => clearTimeout(stopTimer);
    } else if (!isRecording && audioRef.current) {
      audioRef.current.pause();
      setRecordingStartTime(null);

      // Cleanup background music connection
      if (cameraStream && cameraStream.bgMusicSource) {
        console.log('[CameraRecorder] Disconnecting background music');
        cameraStream.bgMusicSource.disconnect();
        cameraStream.bgGain?.disconnect();
        cameraStream.bgMusicSource = null;
        cameraStream.bgGain = null;
      }
    }
  }, [isRecording, audioUrl, segment, onStop, mediaRecorder]);

  // Handle MediaRecorder stop event and create video blob
  useEffect(() => {
    if (!mediaRecorder) return;

    const handleRecordingStop = () => {
      console.log('[CameraRecorder] MediaRecorder stopped, creating video blob');
      console.log('[CameraRecorder] Recorded chunks count:', recordedChunks.length);

      if (recordedChunks.length === 0) {
        console.error('[CameraRecorder] No recorded chunks available');
        return;
      }

      // Create video blob from recorded chunks using the same MIME type as recorder
      const mimeType = mediaRecorder.mimeType || 'video/webm';
      const videoBlob = new Blob(recordedChunks, {
        type: mimeType
      });

      console.log('[CameraRecorder] Video blob created:', videoBlob.size, 'bytes', 'type:', mimeType);

      // Pass video blob to parent component
      setTimeout(() => {
        onRecordingComplete?.(videoBlob);
      }, 500);
    };

    mediaRecorder.addEventListener('stop', handleRecordingStop);

    return () => {
      mediaRecorder.removeEventListener('stop', handleRecordingStop);
    };
  }, [mediaRecorder, recordedChunks, onRecordingComplete]);

  // Initialize camera on component mount
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        console.log('[CameraRecorder] Requesting camera access...');
        setCameraError(null);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1080 },
            height: { ideal: 1920 }
          },
          audio: true // Include microphone audio
        });

        console.log('[CameraRecorder] Camera access granted');
        setCameraStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        // Set up MediaRecorder with audio mixing capability
        try {
          // Create audio context for mixing
          const audioContext = new AudioContext();

          // Get mic audio from the stream
          const micSource = audioContext.createMediaStreamSource(stream);

          // Create destination for mixed audio
          const destination = audioContext.createMediaStreamDestination();

          // Connect mic to destination with gain control
          const micGain = audioContext.createGain();
          micGain.gain.value = 1.0; // Full mic volume
          micSource.connect(micGain);
          micGain.connect(destination);

          // Store audio context and background music source for later use
          const extendedStream = stream as ExtendedMediaStream;
          extendedStream.audioContext = audioContext;
          extendedStream.destination = destination;
          extendedStream.micGain = micGain;
          setCameraStream(extendedStream);

          // Create combined stream with video + mixed audio
          const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...destination.stream.getAudioTracks()
          ]);

          // Use simpler codec for better reliability
          let mimeType = 'video/webm;codecs=vp8,opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = 'video/mp4';
            }
          }

          const recorder = new MediaRecorder(combinedStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 2000000 // 2 Mbps for good quality
          });

          recorder.ondataavailable = (event) => {
            console.log('[CameraRecorder] Data available:', event.data.size, 'bytes');
            if (event.data.size > 0) {
              setRecordedChunks(prev => [...prev, event.data]);
            }
          };

          recorder.onstart = () => {
            console.log('[CameraRecorder] MediaRecorder started');
          };

          recorder.onstop = () => {
            console.log('[CameraRecorder] MediaRecorder stopped');
          };

          setMediaRecorder(recorder);
          console.log('[CameraRecorder] Mixed audio MediaRecorder initialized, mimeType:', mimeType);
        } catch (error) {
          console.error('[CameraRecorder] MediaRecorder setup failed:', error);
        }
      } catch (error) {
        console.error('[CameraRecorder] Camera access denied:', error);
        setCameraError(
          error instanceof Error ? error.message : 'Camera access denied'
        );
      }
    };

    initializeCamera();

    // Cleanup camera stream on unmount
    return () => {
      if (cameraStream) {
        console.log('[CameraRecorder] Cleaning up camera stream');
        cameraStream.getTracks().forEach(track => {
          track.stop();
          console.log('[CameraRecorder] Stopped camera track:', track.kind);
        });
        setCameraStream(null);
      }
    };
  }, [facingMode]); // Only re-initialize when facing mode changes

  // Additional cleanup on component unmount (backup safety)
  useEffect(() => {
    return () => {
      console.log('[CameraRecorder] Component unmounting, ensuring camera cleanup');
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Handle page unload/navigation - critical for camera privacy
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (cameraStream) {
        console.log('[CameraRecorder] Page unloading, stopping camera');
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };

    const handleVisibilityChange = () => {
      // Only stop camera if we're not recording and page is hidden for more than 5 seconds
      if (document.hidden && cameraStream && !isRecording) {
        setTimeout(() => {
          if (document.hidden && cameraStream && !isRecording) {
            console.log('[CameraRecorder] Page hidden for extended time, stopping camera');
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
          }
        }, 5000);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cameraStream, isRecording]);

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
      // Stop recording
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        console.log('[CameraRecorder] Manual video recording stop');
      }
      onStop?.();
    } else {
      onRecord?.();
    }
  };

  const handleFlipCamera = () => {
    // Toggle between front and back camera
    setFacingMode(current => current === 'user' ? 'environment' : 'user');
    onFlipCamera?.();
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

      {/* Camera preview area */}
      <div className="absolute inset-0 bg-black">
        {cameraError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-4">
              <div className="text-red-400 text-lg mb-4">Camera Error</div>
              <div className="text-neutral-400 text-sm mb-4">{cameraError}</div>
              <div className="text-neutral-500 text-xs">
                Please allow camera access and refresh the page
              </div>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        )}
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
            <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-lg px-4 py-3 mx-4">
              <div className="space-y-3">
                {getCurrentLyrics().length > 0 ? (
                  getCurrentLyrics().map((lyric, index) => (
                    <p
                      key={lyric.lineIndex}
                      className={`text-white text-xl font-medium leading-tight transition-all duration-300 ${
                        index === 0 ? 'opacity-100 scale-100' : 'opacity-70 scale-95'
                      }`}
                    >
                      {lyric.originalText}
                    </p>
                  ))
                ) : (
                  <p className="text-white text-xl font-medium leading-tight">
                    🎤 Ready to sing!
                  </p>
                )}
              </div>
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
              onClick={handleFlipCamera}
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