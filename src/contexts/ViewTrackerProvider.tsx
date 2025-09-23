import React, { createContext, useContext } from 'react';
import { useViewTrackingMachine } from '../hooks/useViewTrackingMachine';

interface ViewTrackerContextType {
  isInitialized: boolean;
  isInitializing: boolean;
  hasError: boolean;
  error: string | null;
  submittedViews: string[];
  initializeIfNeeded: () => Promise<boolean>;
  startTracking: (playbackId: string) => void;
  pauseTracking: (playbackId: string) => void;
  resumeTracking: (playbackId: string) => void;
  stopTracking: (playbackId: string) => void;
  retryInitialization: () => Promise<void>;
}

const ViewTrackerContext = createContext<ViewTrackerContextType | null>(null);

export function ViewTrackerProvider({ children }: { children: React.ReactNode }) {
  const trackingMachine = useViewTrackingMachine();
  
  return (
    <ViewTrackerContext.Provider value={trackingMachine}>
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