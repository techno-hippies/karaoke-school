import { setup, assign, fromPromise } from 'xstate';
import { ethers } from 'ethers';
import { ViewTracker } from '../sdk/view-tracker';
import { getConfig, ViewVerifierABI } from '../sdk/config';

export interface TrackingSession {
  playbackId: string;
  startTime: number;
  watchTime: number;
  isPaused: boolean;
}

export interface ViewTrackingContext {
  tracker: ViewTracker | null;
  sessions: Map<string, TrackingSession>;
  signer: ethers.Signer | null;
  error: string | null;
  submittedViews: string[]; // Transaction hashes
}

export type ViewTrackingEvent =
  | { type: 'INITIALIZE'; signer: ethers.Signer }
  | { type: 'START_TRACKING'; playbackId: string }
  | { type: 'PAUSE_TRACKING'; playbackId: string }
  | { type: 'RESUME_TRACKING'; playbackId: string }
  | { type: 'STOP_TRACKING'; playbackId: string }
  | { type: 'SUBMIT_VIEW'; playbackId: string; watchTime: number }
  | { type: 'RETRY_INIT' };

export const viewTrackingMachine = setup({
  types: {
    context: {} as ViewTrackingContext,
    events: {} as ViewTrackingEvent,
  },
  guards: {
    hasTracker: ({ context }) => context.tracker !== null,
    hasSigner: ({ context }) => context.signer !== null,
    sessionExists: ({ context, event }) => {
      if (!('playbackId' in event)) return false;
      return context.sessions.has(event.playbackId);
    },
    watchTimeThresholdMet: ({ context, event }) => {
      if (!('playbackId' in event)) return false;
      const session = context.sessions.get(event.playbackId);
      if (!session) return false;
      return session.watchTime >= 3; // Minimum 3 seconds
    },
  },
  actions: {
    storeSigner: assign({
      signer: (_, params: { signer: ethers.Signer }) => params.signer,
    }),
    
    storeTracker: assign({
      tracker: (_, params: { tracker: ViewTracker }) => params.tracker,
    }),
    
    setError: assign({
      error: (_, params: { error: string }) => params.error,
    }),
    
    clearError: assign({
      error: null,
    }),
    
    createSession: assign({
      sessions: ({ context }, params: { playbackId: string }) => {
        const sessions = new Map(context.sessions);
        sessions.set(params.playbackId, {
          playbackId: params.playbackId,
          startTime: Date.now(),
          watchTime: 0,
          isPaused: false,
        });
        return sessions;
      },
    }),
    
    pauseSession: assign({
      sessions: ({ context }, params: { playbackId: string }) => {
        const sessions = new Map(context.sessions);
        const session = sessions.get(params.playbackId);
        if (session && !session.isPaused) {
          // Calculate watch time up to now
          const elapsed = (Date.now() - session.startTime) / 1000;
          session.watchTime += elapsed;
          session.isPaused = true;
        }
        return sessions;
      },
    }),
    
    resumeSession: assign({
      sessions: ({ context }, params: { playbackId: string }) => {
        const sessions = new Map(context.sessions);
        const session = sessions.get(params.playbackId);
        if (session && session.isPaused) {
          session.startTime = Date.now();
          session.isPaused = false;
        }
        return sessions;
      },
    }),
    
    finalizeSession: assign({
      sessions: ({ context }, params: { playbackId: string }) => {
        const sessions = new Map(context.sessions);
        const session = sessions.get(params.playbackId);
        if (session && !session.isPaused) {
          // Calculate final watch time
          const elapsed = (Date.now() - session.startTime) / 1000;
          session.watchTime += elapsed;
          session.isPaused = true;
        }
        return sessions;
      },
    }),
    
    removeSession: assign({
      sessions: ({ context }, params: { playbackId: string }) => {
        const sessions = new Map(context.sessions);
        sessions.delete(params.playbackId);
        return sessions;
      },
    }),
    
    recordSubmittedView: assign({
      submittedViews: ({ context }, params: { txHash: string }) => {
        return [...context.submittedViews, params.txHash];
      },
    }),
    
    startTrackerSession: ({ context }, params: { playbackId: string }) => {
      if (context.tracker) {
        try {
          context.tracker.startTracking(params.playbackId);
          console.log('[Tracking] Started tracking for:', params.playbackId);
        } catch (error) {
          console.error('[Tracking] Failed to start:', error);
        }
      }
    },
    
    pauseTrackerSession: ({ context }, params: { playbackId: string }) => {
      if (context.tracker) {
        context.tracker.pauseTracking(params.playbackId);
        console.log('[Tracking] Paused tracking for:', params.playbackId);
      }
    },
    
    resumeTrackerSession: ({ context }, params: { playbackId: string }) => {
      if (context.tracker) {
        context.tracker.resumeTracking(params.playbackId);
        console.log('[Tracking] Resumed tracking for:', params.playbackId);
      }
    },
  },
  actors: {
    initializeTracker: fromPromise(async ({ input }: { input: { signer: ethers.Signer } }) => {
      console.log('[Tracking] Initializing LIT Protocol...');
      
      const sdkConfig = getConfig('development');
      const tracker = new ViewTracker({
        viewVerifierAddress: sdkConfig.viewVerifierAddress,
        viewVerifierAbi: ViewVerifierABI,
        rpcUrl: sdkConfig.rpcUrl,
        livepeerApiKey: import.meta.env.VITE_LIVEPEER_API_KEY || '',
        litNetwork: sdkConfig.litNetwork,
        minWatchTime: 3,
        pingInterval: 5000,
      });
      
      await tracker.initialize(input.signer);
      console.log('[Tracking] LIT Protocol initialized successfully');
      
      return tracker;
    }),
    
    submitView: fromPromise(async ({ input }: { 
      input: { 
        tracker: ViewTracker; 
        playbackId: string; 
        watchTime: number;
      } 
    }) => {
      console.log('[Tracking] Submitting view:', input.playbackId, 'Watch time:', input.watchTime);
      
      const txHash = await input.tracker.stopTracking(input.playbackId);
      
      if (!txHash) {
        throw new Error('Failed to submit view');
      }
      
      console.log('[Tracking] View submitted:', txHash);
      return txHash;
    }),
  },
}).createMachine({
  id: 'viewTracking',
  initial: 'uninitialized',
  context: {
    tracker: null,
    sessions: new Map(),
    signer: null,
    error: null,
    submittedViews: [],
  },
  states: {
    uninitialized: {
      on: {
        INITIALIZE: {
          target: 'initializing',
          actions: [
            {
              type: 'storeSigner',
              params: ({ event }) => ({ signer: event.signer }),
            },
          ],
        },
      },
    },
    
    initializing: {
      entry: ['clearError'],
      invoke: {
        id: 'initializeTracker',
        src: 'initializeTracker',
        input: ({ context }) => ({ signer: context.signer! }),
        onDone: {
          target: 'ready',
          actions: [
            {
              type: 'storeTracker',
              params: ({ event }) => ({ tracker: event.output }),
            },
          ],
        },
        onError: {
          target: 'error',
          actions: [
            {
              type: 'setError',
              params: ({ event }) => ({ error: event.error.message }),
            },
          ],
        },
      },
    },
    
    ready: {
      on: {
        START_TRACKING: {
          actions: [
            {
              type: 'createSession',
              params: ({ event }) => ({ playbackId: event.playbackId }),
            },
            {
              type: 'startTrackerSession',
              params: ({ event }) => ({ playbackId: event.playbackId }),
            },
          ],
        },
        
        PAUSE_TRACKING: {
          guard: 'sessionExists',
          actions: [
            {
              type: 'pauseSession',
              params: ({ event }) => ({ playbackId: event.playbackId }),
            },
            {
              type: 'pauseTrackerSession',
              params: ({ event }) => ({ playbackId: event.playbackId }),
            },
          ],
        },
        
        RESUME_TRACKING: {
          guard: 'sessionExists',
          actions: [
            {
              type: 'resumeSession',
              params: ({ event }) => ({ playbackId: event.playbackId }),
            },
            {
              type: 'resumeTrackerSession',
              params: ({ event }) => ({ playbackId: event.playbackId }),
            },
          ],
        },
        
        STOP_TRACKING: [
          {
            guard: 'watchTimeThresholdMet',
            target: 'submitting',
            actions: [
              {
                type: 'finalizeSession',
                params: ({ event }) => ({ playbackId: event.playbackId }),
              },
            ],
          },
          {
            // Watch time too short, just remove session
            actions: [
              {
                type: 'removeSession',
                params: ({ event }) => ({ playbackId: event.playbackId }),
              },
            ],
          },
        ],
      },
    },
    
    submitting: {
      invoke: {
        id: 'submitView',
        src: 'submitView',
        input: ({ context, event }) => {
          const playbackId = (event as any).playbackId;
          const session = context.sessions.get(playbackId)!;
          return {
            tracker: context.tracker!,
            playbackId,
            watchTime: Math.floor(session.watchTime),
          };
        },
        onDone: {
          target: 'ready',
          actions: [
            {
              type: 'recordSubmittedView',
              params: ({ event }) => ({ txHash: event.output }),
            },
            {
              type: 'removeSession',
              params: ({ event }) => {
                // Extract playbackId from the original event that triggered submission
                const meta = (event as any).meta;
                return { playbackId: meta?.playbackId || '' };
              },
            },
          ],
        },
        onError: {
          target: 'ready',
          actions: [
            ({ event }) => {
              console.error('[Tracking] Failed to submit view:', event.error);
            },
          ],
        },
      },
    },
    
    error: {
      on: {
        RETRY_INIT: {
          target: 'initializing',
          guard: 'hasSigner',
        },
      },
    },
  },
});