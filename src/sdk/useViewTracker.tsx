import { useEffect, useRef, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { ViewTracker } from './view-tracker';
import { ViewVerifierABI } from './config';

interface UseViewTrackerConfig {
  viewVerifierAddress: string;
  viewVerifierAbi: any;
  rpcUrl: string;
  livepeerApiKey: string;
  autoSubmit?: boolean; // Auto-submit when video ends or user navigates away
}

interface ViewStats {
  totalViews: number;
  uniqueViewers: number;
  totalWatchTime: number;
  lastViewedAt: number;
}

export function useViewTracker(config: UseViewTrackerConfig) {
  const trackerRef = useRef<ViewTracker | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [currentPlaybackId, setCurrentPlaybackId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Initialize tracker
  const initialize = useCallback(async (signer: ethers.Signer) => {
    try {
      if (trackerRef.current) {
        trackerRef.current.destroy();
      }

      const tracker = new ViewTracker(config);
      await tracker.initialize(signer);
      
      trackerRef.current = tracker;
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to initialize ViewTracker:', err);
    }
  }, [config]);

  // Start tracking a video
  const startTracking = useCallback((playbackId: string) => {
    if (!trackerRef.current || !isInitialized) {
      setError(new Error('ViewTracker not initialized'));
      return;
    }

    try {
      // Stop any existing tracking
      if (currentPlaybackId && currentPlaybackId !== playbackId) {
        stopTracking();
      }

      trackerRef.current.startTracking(playbackId);
      setCurrentPlaybackId(playbackId);
      setIsTracking(true);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to start tracking:', err);
    }
  }, [isInitialized, currentPlaybackId]);

  // Pause tracking
  const pauseTracking = useCallback(() => {
    if (!trackerRef.current || !currentPlaybackId) return;
    
    trackerRef.current.pauseTracking(currentPlaybackId);
    setIsTracking(false);
  }, [currentPlaybackId]);

  // Resume tracking
  const resumeTracking = useCallback(() => {
    if (!trackerRef.current || !currentPlaybackId) return;
    
    trackerRef.current.resumeTracking(currentPlaybackId);
    setIsTracking(true);
  }, [currentPlaybackId]);

  // Stop tracking and submit
  const stopTracking = useCallback(async (): Promise<string | null> => {
    if (!trackerRef.current || !currentPlaybackId) return null;

    try {
      const txHash = await trackerRef.current.stopTracking(currentPlaybackId);
      setCurrentPlaybackId(null);
      setIsTracking(false);
      return txHash;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to stop tracking:', err);
      return null;
    }
  }, [currentPlaybackId]);

  // Get video stats
  const getVideoStats = useCallback(async (playbackId: string): Promise<ViewStats | null> => {
    if (!trackerRef.current) return null;
    
    try {
      return await trackerRef.current.getVideoStats(playbackId);
    } catch (err) {
      console.error('Failed to get video stats:', err);
      return null;
    }
  }, []);

  // Get user's view history
  const getUserViews = useCallback(async (address: string) => {
    if (!trackerRef.current) return [];
    
    try {
      return await trackerRef.current.getUserViews(address);
    } catch (err) {
      console.error('Failed to get user views:', err);
      return [];
    }
  }, []);

  // Auto-submit on unmount or page unload
  useEffect(() => {
    if (!config.autoSubmit) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentPlaybackId && trackerRef.current) {
        // Try to submit synchronously (best effort)
        trackerRef.current.stopTracking(currentPlaybackId);
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Cleanup on unmount
      if (currentPlaybackId && trackerRef.current) {
        trackerRef.current.stopTracking(currentPlaybackId);
      }
      
      if (trackerRef.current) {
        trackerRef.current.destroy();
      }
    };
  }, [config.autoSubmit, currentPlaybackId]);

  return {
    // State
    isInitialized,
    isTracking,
    currentPlaybackId,
    error,
    
    // Actions
    initialize,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    
    // Queries
    getVideoStats,
    getUserViews
  };
}

// Example usage component
export function VideoPlayer({ playbackId, src }: { playbackId: string; src: string }) {
  const {
    isInitialized,
    isTracking,
    initialize,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    getVideoStats
  } = useViewTracker({
    viewVerifierAddress: import.meta.env.VITE_VIEW_VERIFIER_ADDRESS!,
    viewVerifierAbi: ViewVerifierABI,
    rpcUrl: import.meta.env.VITE_RPC_URL!,
    livepeerApiKey: import.meta.env.VITE_LIVEPEER_API_KEY!,
    autoSubmit: true
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stats, setStats] = useState<ViewStats | null>(null);

  // Initialize on wallet connect
  useEffect(() => {
    const initializeTracker = async () => {
      // Get signer from wallet (example with ethers)
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        await initialize(signer);
      }
    };

    initializeTracker();
  }, [initialize]);

  // Start tracking when video plays
  useEffect(() => {
    if (!videoRef.current || !isInitialized) return;

    const video = videoRef.current;

    const handlePlay = () => {
      if (!isTracking) {
        startTracking(playbackId);
      } else {
        resumeTracking();
      }
    };

    const handlePause = () => {
      pauseTracking();
    };

    const handleEnded = async () => {
      const txHash = await stopTracking();
      if (txHash) {
        console.log('View verified:', txHash);
        // Refresh stats
        const newStats = await getVideoStats(playbackId);
        setStats(newStats);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [
    isInitialized,
    isTracking,
    playbackId,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    getVideoStats
  ]);

  // Load initial stats
  useEffect(() => {
    const loadStats = async () => {
      const stats = await getVideoStats(playbackId);
      setStats(stats);
    };
    
    if (isInitialized) {
      loadStats();
    }
  }, [isInitialized, playbackId, getVideoStats]);

  return (
    <div>
      <video ref={videoRef} src={src} controls />
      {stats && (
        <div>
          <p>Views: {stats.totalViews}</p>
          <p>Unique Viewers: {stats.uniqueViewers}</p>
          <p>Total Watch Time: {stats.totalWatchTime}s</p>
        </div>
      )}
    </div>
  );
}