import { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';

interface UseVideoPlayerOptions {
  /**
   * Whether video starts muted (default: true due to browser autoplay policies)
   */
  startMuted?: boolean;
  /**
   * Whether to attempt autoplay when video loads
   */
  autoplay?: boolean;
  /**
   * Username for debugging purposes
   */
  username?: string;
}

interface UseVideoPlayerReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  hlsRef: React.RefObject<Hls | null>;
  isPlaying: boolean;
  isMuted: boolean;
  isReady: boolean;
  togglePlayPause: () => void;
  toggleMute: () => void;
  play: () => Promise<void>;
  pause: () => void;
  setMuted: (muted: boolean) => void;
}

/**
 * Comprehensive video player hook that handles HLS.js setup, play/pause controls, and mute state.
 * Eliminates duplication across VideoPost, VideoDetail, and other video components.
 */
export const useVideoPlayer = (
  videoUrl?: string,
  options: UseVideoPlayerOptions = {}
): UseVideoPlayerReturn => {
  const {
    startMuted = true,
    autoplay = false,
    username = 'unknown'
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(startMuted);
  const [isReady, setIsReady] = useState(false);

  // Video control functions
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.log('Play failed:', e));
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  const play = async (): Promise<void> => {
    if (videoRef.current) {
      try {
        await videoRef.current.play();
      } catch (error) {
        console.log('Play failed:', error);
        throw error;
      }
    }
  };

  const pause = (): void => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const setMuted = (muted: boolean): void => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      setIsMuted(muted);
    }
  };

  // HLS.js setup and video loading
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      const video = videoRef.current;
      setIsReady(false);

      // Cleanup previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // console.log(`[useVideoPlayer] Loading video for @${username}:`, videoUrl);

      // Check if it's an HLS stream
      if (videoUrl.endsWith('.m3u8')) {
        // console.log(`[useVideoPlayer] HLS stream detected for @${username}`);

        if (Hls.isSupported()) {
          // console.log(`[useVideoPlayer] HLS.js supported, creating player for @${username}`);

          const hls = new Hls({
            debug: false, // Disable verbose debug logs
            enableWorker: true,
            lowLatencyMode: true,
          });

          hlsRef.current = hls;

          hls.loadSource(videoUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            // console.log(`[useVideoPlayer] HLS manifest parsed for @${username}`);
            setIsReady(true);
            if (autoplay) {
              video.play().catch(e => console.log('Autoplay failed:', e));
            }
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error(`[useVideoPlayer] HLS error for @${username}:`, data);
            if (data.fatal) {
              console.error(`[useVideoPlayer] HLS fatal error for @${username}:`, data);
            }
          });

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            // console.log(`[useVideoPlayer] HLS media attached for @${username}`);
          });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          // console.log(`[useVideoPlayer] Using native HLS support for @${username}`);
          video.src = videoUrl;
          setIsReady(true);
          if (autoplay) {
            video.play().catch(e => console.log('Autoplay failed:', e));
          }
        } else {
          console.warn(`[useVideoPlayer] HLS not supported for @${username}`);
        }
      } else {
        // Regular video URL (MP4, etc)
        // console.log(`[useVideoPlayer] Regular video URL for @${username}`);
        video.src = videoUrl;
        setIsReady(true);
        if (autoplay) {
          video.play().catch(e => console.log('Autoplay failed:', e));
        }
      }

      // Set up video event listeners
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => setIsPlaying(false);

      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);

      // Cleanup function
      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);

        if (hlsRef.current) {
          // console.log(`[useVideoPlayer] Destroying HLS player for @${username}`);
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    } else {
      // console.log(`[useVideoPlayer] No video URL provided for @${username}`);
    }
  }, [videoUrl, username, autoplay]);

  // Sync muted state with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  return {
    videoRef,
    hlsRef,
    isPlaying,
    isMuted,
    isReady,
    togglePlayPause,
    toggleMute,
    play,
    pause,
    setMuted,
  };
};