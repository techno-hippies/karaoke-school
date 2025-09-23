import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share, Music, Volume2, VolumeX, Plus } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { useAccount } from 'wagmi';
import Hls from 'hls.js';
import { useViewTracking } from '../../contexts/ViewTrackerContext';

interface VideoPostProps {
  username: string;
  description: string;
  likes: number;
  comments: number;
  shares: number;
  thumbnailUrl?: string;
  videoUrl: string;
  audioTitle?: string;
  onChain?: boolean;
  
  // XState coordinator integration (optional)
  isActive?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  registerRef?: (el: HTMLElement | null) => void;
}

// Extract playback ID from Livepeer URL
function extractPlaybackId(url: string): string | null {
  const match = url.match(/\/hls\/([^/]+)\//);
  return match ? match[1] : null;
}

export function VideoPostWithTracking({
  username,
  description,
  likes,
  comments,
  shares,
  thumbnailUrl,
  videoUrl,
  audioTitle = "Original Audio",
  onChain = false,
  // XState coordinator props
  isActive,
  onPlay: onPlayExternal,
  onPause: onPauseExternal,
  registerRef
}: VideoPostProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Get global mute preference from localStorage or default to true
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('globalMutePreference');
    return saved !== null ? saved === 'true' : true;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [realViewCount, setRealViewCount] = useState(0);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  
  // Extract playback ID for view tracking
  const playbackId = extractPlaybackId(videoUrl);
  
  // Wallet integration
  const { address, isConnected } = useAccount();
  
  // Use shared view tracking context
  const {
    initState,
    isTracking,
    initialize,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    getVideoStats
  } = useViewTracking();
  
  const isTrackingThisVideo = playbackId ? isTracking.get(playbackId) || false : false;
  
  // Load view stats on mount (stats can be loaded without initialization)
  useEffect(() => {
    const loadStats = async () => {
      if (playbackId) {
        const stats = await getVideoStats(playbackId);
        if (stats?.totalViews) {
          setRealViewCount(stats.totalViews);
        }
      }
    };
    
    loadStats();
  }, [playbackId, getVideoStats]);
  
  // Handle play/pause with proper initialization
  const handlePlayPause = useCallback(async () => {
    console.log('[Click] Video clicked - checking state...');
    const video = videoRef.current;
    
    console.log('[Click] Video element exists:', !!video);
    console.log('[Click] isVideoReady:', isVideoReady);
    console.log('[Click] playbackId:', playbackId);
    console.log('[Click] videoUrl:', videoUrl);
    
    if (!video) {
      console.error('[Click] No video element found!');
      return;
    }
    
    if (!isVideoReady) {
      console.log('[Click] Video not ready - videoUrl:', videoUrl, 'isVideoReady:', isVideoReady);
      return;
    }
    
    console.log('[Play] Current state - Paused:', video.paused, 'Muted:', video.muted, 'InitState:', initState);
    
    if (video.paused) {
      // Notify coordinator if provided
      onPlayExternal?.();
      // User wants to play
      setIsLoadingAction(true);
      
      // Check if we need to initialize first
      if (initState === 'idle' && isConnected && playbackId) {
        console.log('[Play] First play detected - initializing tracker');
        const success = await initialize();
        if (!success) {
          console.error('[Play] Failed to initialize tracker');
          setIsLoadingAction(false);
          return;
        }
      } else if (initState === 'initializing') {
        console.log('[Play] Already initializing, please wait');
        setIsLoadingAction(false);
        return;
      }
      
      // Now play the video with audio
      try {
        console.log('[Play] Starting playback with audio');
        // Unmute for user-initiated play
        video.muted = false;
        setIsMuted(false);
        // Save unmuted preference globally
        localStorage.setItem('globalMutePreference', 'false');
        console.log('[Audio] Unmuted on play - saved globally');
        
        await video.play();
        setIsPlaying(true);
        
        // Start tracking if initialized and has playback ID
        if (initState === 'initialized' && playbackId && !isTrackingThisVideo) {
          console.log('[Play] Starting view tracking');
          await startTracking(playbackId);
        }
      } catch (error) {
        console.error('[Play] Failed to play video:', error);
        // If autoplay with sound fails, try muted
        if (error.name === 'NotAllowedError') {
          console.log('[Play] Retrying with muted audio');
          video.muted = true;
          setIsMuted(true);
          await video.play();
          setIsPlaying(true);
        }
      }
      
      setIsLoadingAction(false);
    } else {
      // User wants to pause
      console.log('[Play] Pausing video');
      video.pause();
      setIsPlaying(false);
      
      // Notify coordinator AFTER pausing to prevent re-play
      onPauseExternal?.();
      
      if (playbackId && isTrackingThisVideo) {
        pauseTracking(playbackId);
      }
    }
  }, [isVideoReady, initState, isConnected, playbackId, initialize, startTracking, onPlayExternal, onPauseExternal]);
  
  // Toggle mute and save preference globally
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMutedState = !videoRef.current.muted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      // Save preference globally so next videos respect it
      localStorage.setItem('globalMutePreference', String(newMutedState));
      console.log('[Audio] Muted:', newMutedState, '- saved globally');
    }
  }, []);
  
  // Log component mount
  useEffect(() => {
    console.log('[Mount] Component mounted - URL:', videoUrl, 'PlaybackId:', playbackId);
  }, []);
  
  // Setup video and event listeners
  useEffect(() => {
    // Skip if already ready to avoid double setup
    if (isVideoReady) {
      console.log('[Setup] Skipping - video already ready');
      return;
    }
    
    console.log('[Setup] Effect running - videoUrl:', !!videoUrl, 'videoRef:', !!videoRef.current);
    if (videoUrl && videoRef.current) {
      const video = videoRef.current;
      console.log('[Video] Setting up:', videoUrl, 'PlaybackId:', playbackId);
      
      // Event handlers for monitoring actual playback state
      const handlePlay = () => {
        console.log('[Event] Video play event - Muted:', video.muted);
        setIsPlaying(true);
      };
      
      const handlePause = () => {
        console.log('[Event] Video pause event');
        setIsPlaying(false);
      };
      
      const handleEnded = async () => {
        console.log('[Event] Video ended');
        setIsPlaying(false);
        
        if (playbackId && isTrackingThisVideo) {
          console.log('[Track] Submitting view verification');
          const txHash = await stopTracking(playbackId);
          if (txHash) {
            console.log('[Track] ✅ View verified on-chain:', txHash);
            // Refresh stats
            const stats = await getVideoStats(playbackId);
            if (stats?.totalViews) {
              setRealViewCount(stats.totalViews);
            }
          }
        }
      };
      
      const handleError = (e: Event) => {
        console.error('[Event] Video error:', e);
      };
      
      // Add event listeners
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);
      
      // Check what type of content we have
      if (videoUrl.includes('gateway.irys.xyz')) {
        // Irys URLs are not videos - skip loading but keep component functional
        console.log('[Video] Irys URL detected (not a video):', videoUrl);
        // Don't set isVideoReady for non-videos
      } else if (videoUrl.endsWith('.m3u8')) {
        // HLS streaming video
        if (Hls.isSupported()) {
          console.log('[HLS] Setting up HLS stream for', playbackId);
          const hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
          });
          
          hls.loadSource(videoUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('[HLS] Manifest loaded for', playbackId, '- Setting isVideoReady to true');
            video.currentTime = 0.1; // Show first frame
            setIsVideoReady(true);
            console.log('[HLS] Video ready state after manifest parse:', true);
          });
          
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('[HLS] Fatal error:', data);
              setIsVideoReady(false);
            }
          });
          
          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          console.log('[HLS] Using native HLS support for', playbackId);
          video.src = videoUrl;
          video.load();
          setIsVideoReady(true);
        } else {
          console.error('[HLS] No HLS support available');
          setIsVideoReady(false);
        }
      } else {
        // Regular video URL (MP4, etc)
        console.log('[Video] Setting up regular video for', playbackId);
        video.src = videoUrl;
        video.load();
        setIsVideoReady(true);
      }
      
      // Cleanup
      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('error', handleError);
        
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        setIsVideoReady(false);
      };
    }
  }, [videoUrl, playbackId]); // Only re-setup if URL or playbackId changes
  
  // Handle coordinator-driven play/pause
  useEffect(() => {
    const video = videoRef.current;
    // Remove debug log - too noisy
    // console.log(`[Coordinator] isActive changed to ${isActive} for ${playbackId || 'unknown'}`);
    if (!video || !isVideoReady) return;
    
    // NEVER autoplay the first video on page load
    // Only autoplay if user has already interacted (tracker is initialized)
    if (isActive === true && video.paused && initState === 'initialized') {
      // Only autoplay on scroll AFTER user has clicked play at least once
      console.log('[Coordinator] Auto-playing on scroll (user already interacted)');
      
      // Use saved mute preference
      const savedMute = localStorage.getItem('globalMutePreference');
      const shouldMute = savedMute !== null ? savedMute === 'true' : true;
      video.muted = shouldMute;
      setIsMuted(shouldMute);
      
      video.play().then(() => {
        setIsPlaying(true);
        // Start tracking if has playback ID
        if (playbackId && !isTrackingThisVideo) {
          console.log('[Coordinator] Starting view tracking for autoplay');
          startTracking(playbackId);
        }
      }).catch(err => {
        console.error('[Coordinator] Autoplay failed:', err);
        if (err.name === 'NotAllowedError') {
          video.muted = true;
          setIsMuted(true);
          video.play().then(() => setIsPlaying(true));
        }
      });
    }
    
    // Pause this video when it's no longer active
    if (isActive === false && !video.paused) {
      console.log('[Coordinator] Pausing video - no longer active');
      video.pause();
      setIsPlaying(false);
      if (playbackId && isTrackingThisVideo) {
        pauseTracking(playbackId);
      }
    }
  }, [isActive, isVideoReady, initState, playbackId, startTracking]);
  
  // Stop tracking when component unmounts or video changes
  useEffect(() => {
    return () => {
      if (playbackId && isTrackingThisVideo) {
        console.log('[Cleanup] Stopping tracking for:', playbackId);
        stopTracking(playbackId);
      }
    };
  }, [playbackId, isTrackingThisVideo, stopTracking]);
  
  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  console.log('[Render] Rendering component - videoUrl:', !!videoUrl, 'isVideoReady:', isVideoReady, 'playbackId:', playbackId);
  
  return (
    <div 
      ref={registerRef}
      className="relative h-screen w-full bg-black snap-start flex items-center justify-center">
      {/* Video/Thumbnail Background */}
      <div className="relative w-full h-full md:w-[56vh] md:h-[90vh] md:max-w-[500px] md:max-h-[900px] bg-black md:rounded-lg overflow-hidden">
        {videoUrl ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover cursor-pointer"
            loop
            muted={isMuted}
            playsInline
            controls={false}
            preload="metadata"
            onClick={(e) => {
              console.log('[VideoElement] onClick fired');
              handlePlayPause();
            }}
          />
        ) : thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt={description}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-neutral-900" />
        )}

        {/* Loading indicator */}
        {isLoadingAction && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}

        {/* Mute button - top left, only visible when playing */}
        {isPlaying && (
          <button 
            className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-full p-3 hover:bg-black/70 transition-colors"
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering video play/pause
              toggleMute();
            }}
          >
            {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
          </button>
        )}

        {/* Status indicators */}
        {isConnected && playbackId && (
          <div className="absolute top-4 right-4 flex flex-col gap-2 text-xs">
            {initState === 'initializing' && (
              <div className="bg-yellow-500/80 text-white px-2 py-1 rounded">
                Initializing LIT...
              </div>
            )}
            {initState === 'initialized' && isTrackingThisVideo && (
              <div className="bg-green-500/80 text-white px-2 py-1 rounded">
                Tracking View ✓
              </div>
            )}
            {initState === 'error' && (
              <div className="bg-red-500/80 text-white px-2 py-1 rounded">
                Tracking Error
              </div>
            )}
          </div>
        )}

        {/* Video Overlay Content - pointer-events-none to allow video clicks */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none">
          {/* User Info - pointer-events-auto for interactive elements if needed */}
          <div className="text-white mb-4">
            <h3 className="font-semibold mb-2">
              @{username} {onChain && <span className="text-xs bg-blue-500 px-1 py-0.5 rounded ml-1">On-Chain</span>}
            </h3>
            <p className="text-sm">{description}</p>
            <div className="flex items-center mt-2 text-sm">
              <Music className="w-4 h-4 mr-2" />
              <span>{audioTitle}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="absolute right-4 bottom-20 flex flex-col items-center gap-6">
          {/* Profile Avatar with Follow Button */}
          <div className="relative">
            <button 
              onClick={() => {
                console.log(`[Profile] Navigating to profile: @${username}`);
                // TODO: Navigate to /profile/${username}
              }}
              className="w-12 h-12 rounded-full bg-neutral-300 overflow-hidden cursor-pointer"
            >
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
                alt={username}
                className="w-full h-full object-cover"
              />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                console.log(`[Follow] Following user: @${username}`);
                // TODO: Implement follow functionality
              }}
              className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-[#FE2C55] hover:bg-[#FF0F3F] rounded-full flex items-center justify-center cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>

          <ActionButton 
            icon={Heart} 
            count={likes} 
            onClick={() => console.log('[Like] Liked video')}
          />

          <ActionButton 
            icon={MessageCircle} 
            count={comments} 
            onClick={() => console.log('[Comment] Opening comments')}
          />

          <ActionButton 
            icon={Share} 
            count={shares} 
            onClick={() => console.log('[Share] Sharing video')}
          />

          {realViewCount > 0 && (
            <div className="flex flex-col items-center">
              <div className="bg-blue-500/20 backdrop-blur-sm rounded-full p-3">
                <span className="text-white text-sm">👁</span>
              </div>
              <span className="text-white text-xs mt-1">{formatCount(realViewCount)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}