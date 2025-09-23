import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { ViewTracker } from '../sdk/view-tracker';
import { getConfig, ViewVerifierABI } from '../sdk/config';

type InitializationState = 'idle' | 'initializing' | 'initialized' | 'error';

interface ViewTrackerContextType {
  initState: InitializationState;
  isTracking: Map<string, boolean>;
  initialize: () => Promise<boolean>;
  startTracking: (playbackId: string) => Promise<void>;
  pauseTracking: (playbackId: string) => void;
  resumeTracking: (playbackId: string) => void;
  stopTracking: (playbackId: string) => Promise<string | null>;
  getVideoStats: (playbackId: string) => Promise<any>;
}

const ViewTrackerContext = createContext<ViewTrackerContextType | null>(null);

export function ViewTrackerProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const [initState, setInitState] = useState<InitializationState>('idle');
  const [isTracking, setIsTracking] = useState<Map<string, boolean>>(new Map());
  const trackerRef = useRef<ViewTracker | null>(null);

  // Single initialization function exposed to components
  const initialize = useCallback(async () => {
    console.log('[Init] Current state:', initState);
    
    // Check prerequisites
    if (!isConnected || !address || !window.ethereum) {
      console.error('[Init] Missing prerequisites - Connected:', isConnected, 'Address:', address, 'Ethereum:', !!window.ethereum);
      return false;
    }

    // Already initialized or initializing
    if (initState === 'initialized') {
      console.log('[Init] Already initialized');
      return true;
    }
    
    if (initState === 'initializing') {
      console.log('[Init] Already initializing, please wait...');
      return false;
    }

    setInitState('initializing');
    console.log('[Init] Starting initialization for address:', address);

    let tracker: ViewTracker | null = null;
    
    try {
      const sdkConfig = getConfig('development');
      console.log('[Init] Creating ViewTracker with config:', {
        network: sdkConfig.litNetwork,
        verifier: sdkConfig.viewVerifierAddress,
        hasApiKey: !!import.meta.env.VITE_LIVEPEER_API_KEY
      });
      
      tracker = new ViewTracker({
        viewVerifierAddress: sdkConfig.viewVerifierAddress,
        viewVerifierAbi: ViewVerifierABI,
        rpcUrl: sdkConfig.rpcUrl,
        livepeerApiKey: import.meta.env.VITE_LIVEPEER_API_KEY || '',
        litNetwork: sdkConfig.litNetwork,
        minWatchTime: 3,
        pingInterval: 5000
      });

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      console.log('[Init] Requesting SIWE signature for LIT Protocol...');
      await tracker.initialize(signer);
      
      trackerRef.current = tracker;
      setInitState('initialized');
      console.log('[Init] ✅ Initialization complete');
      
      // Clear any stale session data on success
      if (localStorage.getItem('lit-session-sigs')) {
        const cached = JSON.parse(localStorage.getItem('lit-session-sigs') || '{}');
        console.log('[Init] Session cached until:', cached.expiry);
      }
      
      return true;
    } catch (error) {
      console.error('[Init] ❌ Initialization failed:', error);
      // Still set tracker ref even if session sigs fail (will use authSig)
      if (tracker) {
        trackerRef.current = tracker;
        setInitState('initialized'); // Allow tracking with authSig fallback
        console.warn('[Init] Continuing with authSig fallback');
        return true;
      }
      setInitState('error');
      return false;
    }
  }, [isConnected, address, initState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackerRef.current) {
        console.log('[ViewTrackerContext] Destroying tracker');
        trackerRef.current.destroy();
      }
    };
  }, []);

  const startTracking = useCallback(async (playbackId: string) => {
    if (initState !== 'initialized' || !trackerRef.current) {
      console.error('[Track] Cannot start tracking - Not initialized. State:', initState);
      return;
    }

    // Check if already tracking this video
    if (isTracking.get(playbackId)) {
      console.log('[Track] Already tracking:', playbackId);
      return;
    }

    try {
      console.log('[Track] Starting tracking for:', playbackId);
      trackerRef.current.startTracking(playbackId);
      setIsTracking(prev => new Map(prev).set(playbackId, true));
      console.log('[Track] ✅ Tracking started for:', playbackId);
    } catch (error) {
      console.error('[Track] ❌ Failed to start tracking:', error);
    }
  }, [initState, isTracking]);

  const pauseTracking = useCallback((playbackId: string) => {
    if (!trackerRef.current) {
      console.log('[Track] Cannot pause - tracker not initialized');
      return;
    }
    
    console.log('[Track] Pausing tracking for:', playbackId);
    trackerRef.current.pauseTracking(playbackId);
    setIsTracking(prev => new Map(prev).set(playbackId, false));
  }, []);

  const resumeTracking = useCallback((playbackId: string) => {
    if (!trackerRef.current) {
      console.log('[Track] Cannot resume - tracker not initialized');
      return;
    }
    
    console.log('[Track] Resuming tracking for:', playbackId);
    trackerRef.current.resumeTracking(playbackId);
    setIsTracking(prev => new Map(prev).set(playbackId, true));
  }, []);

  const stopTracking = useCallback(async (playbackId: string): Promise<string | null> => {
    if (!trackerRef.current) return null;

    try {
      const txHash = await trackerRef.current.stopTracking(playbackId);
      setIsTracking(prev => {
        const next = new Map(prev);
        next.delete(playbackId);
        return next;
      });
      return txHash;
    } catch (error) {
      console.error('[ViewTrackerContext] Failed to stop tracking:', error);
      return null;
    }
  }, []);

  const getVideoStats = useCallback(async (playbackId: string): Promise<any> => {
    if (!trackerRef.current) return null;
    
    try {
      return await trackerRef.current.getVideoStats(playbackId);
    } catch (error) {
      console.error('[ViewTrackerContext] Failed to get video stats:', error);
      return null;
    }
  }, []);

  const value: ViewTrackerContextType = {
    initState,
    isTracking,
    initialize,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    getVideoStats
  };

  return (
    <ViewTrackerContext.Provider value={value}>
      {children}
    </ViewTrackerContext.Provider>
  );
}

export function useViewTracking() {
  const context = useContext(ViewTrackerContext);
  if (!context) {
    throw new Error('useViewTracking must be used within ViewTrackerProvider');
  }
  return context;
}