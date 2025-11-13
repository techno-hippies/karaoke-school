import { setup, assign } from 'xstate';
import type { VideoPostData } from './types';

export interface FeedContext {
  videos: VideoPostData[];           // Currently loaded videos
  visibleStartIndex: number;         // First visible video index
  visibleEndIndex: number;           // Last visible video index
  totalCount: number;                // Total available videos
  hasMore: boolean;                  // Whether more videos can be loaded
  error: string | null;              // Current error state
  loadingStates: Record<string, boolean | { error: string; loading: boolean }>; // Loading state per video ID
}

export type FeedEvent =
  | { type: 'SET_INITIAL_VIDEOS'; videos: VideoPostData[]; totalCount: number; hasMore: boolean }
  | { type: 'SCROLL'; visibleStartIndex: number; visibleEndIndex: number }
  | { type: 'LOAD_MORE' }
  | { type: 'LOAD_MORE_SUCCESS'; videos: VideoPostData[]; hasMore: boolean }
  | { type: 'LOAD_MORE_ERROR'; error: string }
  | { type: 'VIDEO_LOADED'; videoId: string }
  | { type: 'VIDEO_ERROR'; videoId: string; error: string }
  | { type: 'CLEAR_ERROR' };

export const feedStateMachine = setup({
  types: {
    context: {} as FeedContext,
    events: {} as FeedEvent,
  },
}).createMachine({
  id: 'feedState',
  initial: 'loadingInitial',
  context: {
    videos: [],
    visibleStartIndex: 0,
    visibleEndIndex: 4, // Show first 5 videos initially
    totalCount: 0,
    hasMore: true,
    error: null,
    loadingStates: {},
  },
  states: {
    loadingInitial: {
      on: {
        SET_INITIAL_VIDEOS: {
          target: 'loaded',
          actions: assign({
            videos: ({ event }) => event.videos,
            totalCount: ({ event }) => event.totalCount,
            hasMore: ({ event }) => event.hasMore,
            visibleStartIndex: 0,
            visibleEndIndex: 4, // First 5 videos
            error: null,
          }),
        },
        LOAD_MORE_ERROR: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    loaded: {
      on: {
        SCROLL: {
          target: 'loaded',
          actions: assign({
            visibleStartIndex: ({ event }) => Math.max(0, event.visibleStartIndex - 2), // Load 2 videos before visible
            visibleEndIndex: ({ event, context }) => Math.min(event.visibleEndIndex + 3, context.videos.length - 1), // Load 3 videos after visible
          }),
        },
        LOAD_MORE: {
          target: 'loadingMore',
        },
        VIDEO_ERROR: {
          target: 'loaded',
          actions: assign({
            loadingStates: ({ event, context }) => ({
              ...context.loadingStates,
              [event.videoId]: { error: event.error, loading: false },
            }),
          }),
        },
      },
    },
    loadingMore: {
      // TODO: Implement loadMoreVideos actor in setup() or pass as implementation
      // invoke: {
      //   src: 'loadMoreVideos',
      //   onDone: {
      //     target: 'loaded',
      //     actions: assign({
      //       videos: ({ event, context }) => [...context.videos, ...event.data.videos],
      //       hasMore: ({ event }) => event.data.hasMore,
      //       error: null,
      //     }),
      //   },
      //   onError: {
      //     target: 'error',
      //     actions: assign({
      //       error: ({ event }) => event.data.message || event.data,
      //     }),
      //   },
      // },
      on: {
        LOAD_MORE_SUCCESS: {
          target: 'loaded',
          actions: assign({
            videos: ({ event, context }) => [...context.videos, ...event.videos],
            hasMore: ({ event }) => event.hasMore,
            error: null,
          }),
        },
        LOAD_MORE_ERROR: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    error: {
      on: {
        CLEAR_ERROR: {
          target: 'loaded',
          actions: assign({
            error: null,
          }),
        },
        LOAD_MORE: {
          target: 'loadingMore',
        },
      },
    },
  },
});
