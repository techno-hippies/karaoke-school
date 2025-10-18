import { setup, assign } from 'xstate';

export interface VideoPlayerContext {
  videoUrl: string | undefined;
  thumbnailUrl: string | undefined;
  isMuted: boolean;
  hasStartedPlaying: boolean;
  error: string | null;
  shouldAutoplay: boolean;
}

export type VideoPlayerEvent =
  | { type: 'LOAD'; videoUrl: string; thumbnailUrl?: string }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'VIDEO_LOADED' }
  | { type: 'VIDEO_ERROR'; error: string }
  | { type: 'AUTOPLAY_BLOCKED' }
  | { type: 'PLAYING' }
  | { type: 'PAUSED' }
  | { type: 'SET_AUTOPLAY'; autoplay: boolean };

export const videoPlayerMachine = setup({
  types: {
    context: {} as VideoPlayerContext,
    events: {} as VideoPlayerEvent,
    input: {} as {
      videoUrl?: string;
      thumbnailUrl?: string;
      isMuted?: boolean;
      autoplay?: boolean;
    },
  },
}).createMachine({
  id: 'videoPlayer',
  initial: 'idle',
  context: ({ input }) => ({
    videoUrl: input.videoUrl,
    thumbnailUrl: input.thumbnailUrl,
    isMuted: input.isMuted ?? false,
    hasStartedPlaying: false,
    error: null,
    shouldAutoplay: input.autoplay ?? false,
  }),
  states: {
    idle: {
      on: {
        LOAD: {
          target: 'loading',
          actions: assign({
            videoUrl: ({ event }) => event.videoUrl,
            thumbnailUrl: ({ event }) => event.thumbnailUrl,
            hasStartedPlaying: false,
            error: null,
          }),
        },
      },
    },
    loading: {
      on: {
        VIDEO_LOADED: [
          {
            guard: ({ context }) => context.shouldAutoplay === true,
            target: 'loaded.attemptingPlay',
          },
          {
            target: 'loaded.paused',
          },
        ],
        VIDEO_ERROR: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
        LOAD: {
          target: 'loading',
          actions: assign({
            videoUrl: ({ event }) => event.videoUrl,
            thumbnailUrl: ({ event }) => event.thumbnailUrl,
            hasStartedPlaying: false,
            error: null,
          }),
        },
      },
    },
    loaded: {
      on: {
        LOAD: {
          target: 'loading',
          actions: assign({
            videoUrl: ({ event }) => event.videoUrl,
            thumbnailUrl: ({ event }) => event.thumbnailUrl,
            hasStartedPlaying: false,
            error: null,
          }),
        },
        VIDEO_ERROR: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
      states: {
        paused: {
          on: {
            PLAY: { target: 'attemptingPlay' },
            TOGGLE_PLAY: { target: 'attemptingPlay' },
            SET_AUTOPLAY: [
              {
                guard: ({ event }) => event.autoplay === true,
                target: 'attemptingPlay',
                actions: assign({
                  shouldAutoplay: true,
                }),
              },
              {
                actions: assign({
                  shouldAutoplay: false,
                }),
              },
            ],
          },
        },
        attemptingPlay: {
          on: {
            PLAYING: {
              target: 'playing',
              actions: assign({
                hasStartedPlaying: true,
              }),
            },
            AUTOPLAY_BLOCKED: {
              target: 'paused',
              actions: assign({
                shouldAutoplay: false,
              }),
            },
            PAUSE: { target: 'paused' },
            TOGGLE_PLAY: { target: 'paused' },
          },
        },
        playing: {
          on: {
            PAUSE: { target: 'paused' },
            TOGGLE_PLAY: { target: 'paused' },
            PAUSED: { target: 'paused' },
            SET_AUTOPLAY: [
              {
                guard: ({ event }) => event.autoplay === false,
                target: 'paused',
                actions: assign({
                  shouldAutoplay: false,
                }),
              },
              {
                actions: assign({
                  shouldAutoplay: true,
                }),
              },
            ],
          },
        },
      },
    },
    error: {
      on: {
        LOAD: {
          target: 'loading',
          actions: assign({
            videoUrl: ({ event }) => event.videoUrl,
            thumbnailUrl: ({ event }) => event.thumbnailUrl,
            hasStartedPlaying: false,
            error: null,
          }),
        },
      },
    },
  },
  on: {
    TOGGLE_MUTE: {
      actions: assign({
        isMuted: ({ context }) => !context.isMuted,
      }),
    },
  },
});
