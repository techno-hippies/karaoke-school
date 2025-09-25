import React, { useEffect, useRef } from 'react';
import { Heart, ChatCircle, ShareNetwork, MusicNote, SpeakerHigh, SpeakerX } from '@phosphor-icons/react';
import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import { videoMachine } from '../../machines/videoMachine';
import { useViewTrackingMachine } from '../../hooks/useViewTrackingMachine';

interface VideoPostXStateProps {
  videoId: string;
  actor: ActorRefFrom<typeof videoMachine>;
  isActive: boolean;
  onPlay: () => void;
  onPause: () => void;
}

export function VideoPostXState({ 
  videoId, 
  actor, 
  isActive,
  onPlay,
  onPause 
}: VideoPostXStateProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Subscribe to video machine state
  const state = useSelector(actor, state => state);
  const context = state.context;
  
  // View tracking
  const { 
    isInitialized: trackingInitialized,
    isInitializing: trackingInitializing,
    initializeIfNeeded,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking 
  } = useViewTrackingMachine();
  
  // Initialize video when element is ready
  useEffect(() => {
    if (videoRef.current) {
      actor.send({ type: 'LOAD_VIDEO', videoElement: videoRef.current });
    }
  }, [actor]);
  
  // Handle view tracking based on playback state
  useEffect(() => {
    // Only track if this video is actually playing and active
    if (!isActive) return;
    
    const isPlaying = state.matches({ ready: { playback: 'playing' } });
    const playbackId = context.playbackId;
    
    if (isPlaying && playbackId && trackingInitialized) {
      console.log('[VideoPost] Starting tracking for active video:', playbackId);
      startTracking(playbackId);
    } else if (!isPlaying && playbackId) {
      console.log('[VideoPost] Pausing tracking for:', playbackId);
      pauseTracking(playbackId);
    }
    
    // Cleanup: stop tracking when component unmounts or video changes
    return () => {
      if (playbackId && isActive) {
        console.log('[VideoPost] Cleanup - stopping tracking for:', playbackId);
        stopTracking(playbackId);
      }
    };
  }, [
    isActive,
    state.value,
    context.playbackId,
    trackingInitialized,
    startTracking,
    pauseTracking,
    stopTracking
  ]);
  
  // Handle user interaction
  const handleVideoClick = async () => {
    if (!state.matches('ready')) return;
    
    const isPlaying = state.matches({ ready: { playback: 'playing' } });
    
    if (isPlaying) {
      actor.send({ type: 'USER_PAUSE' });
      onPause();
    } else {
      // Initialize tracking on first play if needed
      if (!trackingInitialized && !trackingInitializing) {
        console.log('[VideoPost] First play - initializing tracker...');
        const success = await initializeIfNeeded();
        if (!success) {
          console.error('[VideoPost] Failed to initialize tracker');
          // Still play the video even if tracking fails
        }
      }
      
      if (trackingInitializing) {
        console.log('[VideoPost] Waiting for tracking initialization...');
        return;
      }
      
      actor.send({ type: 'USER_PLAY' });
      onPlay();
    }
  };
  
  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    actor.send({ type: 'TOGGLE_MUTE' });
  };
  
  const handleLike = () => {
    if (context.hasLiked) {
      actor.send({ type: 'UNLIKE' });
    } else {
      actor.send({ type: 'LIKE' });
    }
  };
  
  // Determine UI state
  const isLoading = state.matches('loading');
  const isError = state.matches('error');
  const isReady = state.matches('ready');
  const isPlaying = state.matches({ ready: { playback: 'playing' } });
  const isMuted = state.matches({ ready: { audio: 'muted' } });
  
  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };
  
  return (
    <div 
      id={`video-${videoId}`}
      ref={containerRef}
      className="relative h-screen w-full bg-black snap-start flex items-center justify-center"
    >
      <div className="relative w-full h-full md:w-[56vh] md:h-[90vh] md:max-w-[500px] md:max-h-[900px] bg-black md:rounded-lg overflow-hidden">
        {/* Video Element */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover cursor-pointer"
          loop
          muted={context.isMuted}
          playsInline
          controls={false}
          preload="metadata"
          onClick={handleVideoClick}
        />
        
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* Error State */}
        {isError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-white text-center">
              <p className="text-red-500 mb-2">Failed to load video</p>
              <p className="text-sm text-neutral-400">{context.error}</p>
            </div>
          </div>
        )}
        
        {/* Mute Button - Top Left */}
        {isPlaying && (
          <button 
            className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-full p-3 hover:bg-black/70 transition-colors z-10"
            onClick={handleMuteToggle}
          >
            {isMuted ? <SpeakerX className="w-6 h-6 text-white" /> : <SpeakerHigh className="w-6 h-6 text-white" />}
          </button>
        )}
        
        {/* Tracking Status - Top Right */}
        {trackingInitialized && context.playbackId && (
          <div className="absolute top-4 right-4 flex flex-col gap-2 text-xs z-10">
            {trackingInitializing && (
              <div className="bg-yellow-500/80 text-white px-2 py-1 rounded">
                Initializing tracking...
              </div>
            )}
            {isPlaying && trackingInitialized && (
              <div className="bg-green-500/80 text-white px-2 py-1 rounded">
                Tracking View ✓
              </div>
            )}
          </div>
        )}
        
        {/* Video Info Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none">
          <div className="text-white mb-4">
            <h3 className="font-semibold mb-2">@{context.username}</h3>
            <p className="text-sm">{context.description}</p>
            <div className="flex items-center mt-2 text-sm">
              <MusicNote className="w-4 h-4 mr-2" />
              <span>Original Audio</span>
            </div>
          </div>
        </div>
        
        {/* Action Buttons - Right Side */}
        <div className="absolute right-4 bottom-20 flex flex-col items-center space-y-6">
          <button 
            className="flex flex-col items-center"
            onClick={handleLike}
          >
            <div className={`${context.hasLiked ? 'bg-red-500/80' : 'bg-white/10'} backdrop-blur-sm rounded-full p-3 transition-colors`}>
              <Heart className={`w-6 h-6 text-white`} weight={context.hasLiked ? 'fill' : 'regular'} />
            </div>
            <span className="text-white text-xs mt-1">{formatCount(context.likes)}</span>
          </button>
          
          <button className="flex flex-col items-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-full p-3">
              <ChatCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xs mt-1">{formatCount(context.comments)}</span>
          </button>
          
          <button className="flex flex-col items-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-full p-3">
              <ShareNetwork className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xs mt-1">{formatCount(context.shares)}</span>
          </button>
          
          {/* Show watch time for debugging */}
          {import.meta.env.DEV && context.watchTime > 0 && (
            <div className="text-white text-xs bg-blue-500/50 px-2 py-1 rounded">
              {Math.floor(context.watchTime)}s watched
            </div>
          )}
        </div>
      </div>
    </div>
  );
}