import { useMachine } from '@xstate/react';
import { viewTrackingMachine } from '../machines/viewTrackingMachine';
import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

export function useViewTrackingMachine() {
  const [state, send, actor] = useMachine(viewTrackingMachine);
  const { address, isConnected } = useAccount();
  
  // Don't auto-initialize - wait for user action
  // This will be triggered on first play instead
  const initializeIfNeeded = async () => {
    if (isConnected && address && window.ethereum && state.value === 'uninitialized') {
      try {
        console.log('[useViewTracking] Initializing on first play...');
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        send({ type: 'INITIALIZE', signer });
        return true;
      } catch (error) {
        console.error('[useViewTracking] Failed to get signer:', error);
        return false;
      }
    }
    return state.value === 'ready';
  };
  
  // Helper functions
  const startTracking = (playbackId: string) => {
    if (state.value === 'ready') {
      send({ type: 'START_TRACKING', playbackId });
    }
  };
  
  const pauseTracking = (playbackId: string) => {
    if (state.value === 'ready') {
      send({ type: 'PAUSE_TRACKING', playbackId });
    }
  };
  
  const resumeTracking = (playbackId: string) => {
    if (state.value === 'ready') {
      send({ type: 'RESUME_TRACKING', playbackId });
    }
  };
  
  const stopTracking = (playbackId: string) => {
    if (state.value === 'ready') {
      send({ type: 'STOP_TRACKING', playbackId });
    }
  };
  
  const retryInitialization = async () => {
    if (state.value === 'error' && isConnected && address && window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        send({ type: 'RETRY_INIT' });
      } catch (error) {
        console.error('[useViewTracking] Retry failed:', error);
      }
    }
  };
  
  return {
    state,
    send,
    actor,
    isInitialized: state.value === 'ready',
    isInitializing: state.value === 'initializing',
    hasError: state.value === 'error',
    error: state.context.error,
    submittedViews: state.context.submittedViews,
    initializeIfNeeded,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    retryInitialization,
  };
}