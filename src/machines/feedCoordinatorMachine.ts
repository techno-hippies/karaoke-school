import { setup, assign } from 'xstate';

// This machine ONLY manages video playback coordination
// It does NOT handle UI state like tabs, modals, etc.
export interface FeedCoordinatorContext {
  activeVideoId: string | null;
  previousVideoId: string | null;
  videoStates: Map<string, 'idle' | 'playing' | 'paused'>;
  playbackMode: 'auto' | 'manual'; // Track if playback was user-initiated
  hasUserInteracted: boolean; // Track if user has played a video manually
}

export type FeedCoordinatorEvent =
  | { type: 'VIDEO_PLAY'; videoId: string }
  | { type: 'VIDEO_PAUSE'; videoId: string }
  | { type: 'VIDEO_ENTER_VIEWPORT'; videoId: string }
  | { type: 'VIDEO_LEAVE_VIEWPORT'; videoId: string }
  | { type: 'SCROLL_TO_VIDEO'; videoId: string };

export const feedCoordinatorMachine = setup({
  types: {
    context: {} as FeedCoordinatorContext,
    events: {} as FeedCoordinatorEvent,
  },
  actions: {
    setActiveVideo: assign({
      activeVideoId: (_, params: { videoId: string }) => params.videoId,
      previousVideoId: ({ context }) => context.activeVideoId,
    }),
    
    clearActiveVideo: assign({
      activeVideoId: null,
      previousVideoId: ({ context }) => context.activeVideoId,
    }),
    
    updateVideoState: assign({
      videoStates: ({ context }, params: { videoId: string; state: 'idle' | 'playing' | 'paused' }) => {
        const newStates = new Map(context.videoStates);
        newStates.set(params.videoId, params.state);
        return newStates;
      },
    }),
    
    pauseAllVideos: assign({
      videoStates: ({ context }) => {
        const newStates = new Map(context.videoStates);
        newStates.forEach((_, videoId) => {
          newStates.set(videoId, 'paused');
        });
        return newStates;
      },
    }),
  },
}).createMachine({
  id: 'feedCoordinator',
  initial: 'idle',
  context: {
    activeVideoId: null,
    previousVideoId: null,
    videoStates: new Map(),
    playbackMode: 'auto',
    hasUserInteracted: false,
  },
  states: {
    idle: {
      on: {
        VIDEO_ENTER_VIEWPORT: [
          {
            // If user has interacted before, transition to active and play
            guard: ({ context }) => context.hasUserInteracted,
            target: 'active',
            actions: [
              'pauseAllVideos',
              {
                type: 'setActiveVideo',
                params: ({ event }) => ({ videoId: event.videoId }),
              },
              {
                type: 'updateVideoState',
                params: ({ event }) => ({ videoId: event.videoId, state: 'playing' as const }),
              },
              assign({ playbackMode: 'auto' }),
            ],
          },
          {
            // Otherwise just set active video but don't play
            actions: [
              {
                type: 'setActiveVideo',
                params: ({ event }) => ({ videoId: event.videoId }),
              },
            ],
          },
        ],
        VIDEO_PLAY: {
          target: 'active',
          actions: [
            'pauseAllVideos',
            {
              type: 'setActiveVideo',
              params: ({ event }) => ({ videoId: event.videoId }),
            },
            {
              type: 'updateVideoState',
              params: ({ event }) => ({ videoId: event.videoId, state: 'playing' as const }),
            },
            assign({ 
              playbackMode: 'manual',
              hasUserInteracted: true  // Mark that user has interacted
            }),
          ],
        },
      },
    },
    
    active: {
      on: {
        VIDEO_PLAY: {
          actions: [
            'pauseAllVideos',
            {
              type: 'setActiveVideo',
              params: ({ event }) => ({ videoId: event.videoId }),
            },
            {
              type: 'updateVideoState',
              params: ({ event }) => ({ videoId: event.videoId, state: 'playing' as const }),
            },
            assign({ 
              playbackMode: 'manual',
              hasUserInteracted: true
            }),
          ],
        },
        
        VIDEO_PAUSE: {
          actions: [
            {
              type: 'updateVideoState',
              params: ({ event }) => ({ videoId: event.videoId, state: 'paused' as const }),
            },
            // Keep manual mode when user pauses - don't auto-replay
            assign({ playbackMode: 'manual' }),
          ],
        },
        
        VIDEO_ENTER_VIEWPORT: {
          actions: [
            'pauseAllVideos',
            {
              type: 'setActiveVideo',
              params: ({ event }) => ({ videoId: event.videoId }),
            },
            {
              type: 'updateVideoState',
              params: ({ event }) => ({ videoId: event.videoId, state: 'playing' as const }),
            },
            // Reset to auto mode when scrolling to new video
            assign({ playbackMode: 'auto' }),
          ],
        },
        
        VIDEO_LEAVE_VIEWPORT: [
          {
            guard: ({ context, event }) => event.videoId === context.activeVideoId,
            target: 'idle',
            actions: [
              'clearActiveVideo',
              {
                type: 'updateVideoState',
                params: ({ event }) => ({ videoId: event.videoId, state: 'paused' as const }),
              },
            ],
          },
        ],
        
        SCROLL_TO_VIDEO: {
          actions: [
            'pauseAllVideos',
            {
              type: 'setActiveVideo',
              params: ({ event }) => ({ videoId: event.videoId }),
            },
          ],
        },
      },
    },
  },
});