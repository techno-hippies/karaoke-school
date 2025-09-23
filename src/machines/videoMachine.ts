import { setup, assign, fromCallback } from 'xstate';
import Hls from 'hls.js';

// Types for our video state machine
export interface VideoContext {
  videoUrl: string;
  playbackId: string | null;
  username: string;
  description: string;
  
  // Video state
  videoElement: HTMLVideoElement | null;
  hlsInstance: Hls | null;
  isVideoReady: boolean;
  
  // Audio state
  isMuted: boolean;
  
  // Tracking state
  watchTime: number;
  watchStartTime: number | null;
  
  // UI state
  likes: number;
  comments: number;
  shares: number;
  hasLiked: boolean;
  
  // Error state
  error: string | null;
}

export type VideoEvent =
  | { type: 'LOAD_VIDEO'; videoElement: HTMLVideoElement }
  | { type: 'VIDEO_READY' }
  | { type: 'VIDEO_ERROR'; error: string }
  | { type: 'USER_PLAY' }
  | { type: 'USER_PAUSE' }
  | { type: 'AUTO_PLAY' }
  | { type: 'AUTO_PAUSE' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'ENTER_VIEWPORT' }
  | { type: 'LEAVE_VIEWPORT' }
  | { type: 'LIKE' }
  | { type: 'UNLIKE' }
  | { type: 'UPDATE_WATCH_TIME' };

// Helper to check if URL is a video
const isVideoUrl = (url: string) => {
  return !url.includes('gateway.irys.xyz');
};

// Helper to extract playback ID from Livepeer URL
const extractPlaybackId = (url: string): string | null => {
  const match = url.match(/\/hls\/([^/]+)\//);
  return match ? match[1] : null;
};

export const videoMachine = setup({
  types: {
    context: {} as VideoContext,
    events: {} as VideoEvent,
  },
  guards: {
    isVideoUrl: ({ context }) => isVideoUrl(context.videoUrl),
    hasPlaybackId: ({ context }) => context.playbackId !== null,
    isInViewport: ({ context }) => {
      // This will be set by viewport detection
      return true; // placeholder
    },
  },
  actions: {
    setVideoElement: assign({
      videoElement: (_, params: { videoElement: HTMLVideoElement }) => params.videoElement,
    }),
    
    setupHLS: assign({
      hlsInstance: ({ context }) => {
        if (!context.videoElement || !context.videoUrl.endsWith('.m3u8')) {
          return null;
        }
        
        if (!Hls.isSupported()) {
          // Try native HLS support
          context.videoElement.src = context.videoUrl;
          context.videoElement.load();
          return null;
        }
        
        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: true,
        });
        
        hls.loadSource(context.videoUrl);
        hls.attachMedia(context.videoElement);
        
        return hls;
      },
    }),
    
    markVideoReady: assign({
      isVideoReady: true,
    }),
    
    playVideo: ({ context }) => {
      if (context.videoElement && context.isVideoReady) {
        console.log('[VideoMachine] Playing video');
        // Keep muted state as is - don't automatically unmute
        context.videoElement.play().catch(err => {
          console.error('[Video] Play failed:', err);
          // If autoplay fails, try muted
          if (err.name === 'NotAllowedError') {
            context.videoElement!.muted = true;
            context.videoElement!.play();
          }
        });
      }
    },
    
    playVideoWithSound: ({ context }) => {
      if (context.videoElement && context.isVideoReady) {
        console.log('[VideoMachine] Playing video with sound');
        // Unmute for user-initiated play
        context.videoElement.muted = false;
        context.videoElement.play().catch(err => {
          console.error('[Video] Play with sound failed:', err);
          // If autoplay with sound fails, try muted
          if (err.name === 'NotAllowedError') {
            context.videoElement!.muted = true;
            context.videoElement!.play();
          }
        });
      }
    },
    
    pauseVideo: ({ context }) => {
      if (context.videoElement) {
        context.videoElement.pause();
      }
    },
    
    muteVideo: assign({
      isMuted: true,
    }),
    
    unmuteVideo: assign({
      isMuted: false,
    }),
    
    toggleMute: assign({
      isMuted: ({ context }) => {
        if (context.videoElement) {
          context.videoElement.muted = !context.isMuted;
        }
        return !context.isMuted;
      },
    }),
    
    startWatchTime: assign({
      watchStartTime: () => Date.now(),
    }),
    
    stopWatchTime: assign({
      watchTime: ({ context }) => {
        if (context.watchStartTime) {
          return context.watchTime + (Date.now() - context.watchStartTime) / 1000;
        }
        return context.watchTime;
      },
      watchStartTime: null,
    }),
    
    incrementLikes: assign({
      likes: ({ context }) => context.likes + 1,
      hasLiked: true,
    }),
    
    decrementLikes: assign({
      likes: ({ context }) => context.likes - 1,
      hasLiked: false,
    }),
    
    setError: assign({
      error: (_, params: { error: string }) => params.error,
    }),
    
    cleanup: ({ context }) => {
      if (context.hlsInstance) {
        context.hlsInstance.destroy();
      }
      if (context.videoElement) {
        context.videoElement.pause();
        context.videoElement.src = '';
      }
    },
  },
  actors: {
    // Actor to handle HLS loading
    hlsLoader: fromCallback(({ sendBack, input }: { sendBack: any; input: VideoContext }) => {
      const { videoElement, hlsInstance } = input;
      
      if (!hlsInstance || !videoElement) {
        sendBack({ type: 'VIDEO_READY' });
        return;
      }
      
      const handleManifestParsed = () => {
        console.log('[HLS] Manifest loaded');
        videoElement.currentTime = 0.1; // Show first frame
        sendBack({ type: 'VIDEO_READY' });
      };
      
      const handleError = (event: any, data: any) => {
        if (data.fatal) {
          console.error('[HLS] Fatal error:', data);
          sendBack({ type: 'VIDEO_ERROR', error: data.type });
        }
      };
      
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
      hlsInstance.on(Hls.Events.ERROR, handleError);
      
      return () => {
        hlsInstance.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
        hlsInstance.off(Hls.Events.ERROR, handleError);
      };
    }),
  },
}).createMachine({
  id: 'video',
  initial: 'idle',
  context: ({ input }: { input: VideoContext }) => ({
    ...input,
    videoElement: null,
    hlsInstance: null,
    isVideoReady: false,
    watchTime: 0,
    watchStartTime: null,
    error: null,
  }),
  states: {
    idle: {
      on: {
        LOAD_VIDEO: {
          target: 'loading',
          actions: [
            {
              type: 'setVideoElement',
              params: ({ event }) => ({ videoElement: event.videoElement }),
            },
          ],
        },
      },
    },
    
    loading: {
      entry: ['setupHLS'],
      invoke: {
        id: 'hlsLoader',
        src: 'hlsLoader',
        input: ({ context }) => context,
      },
      on: {
        VIDEO_READY: {
          target: 'ready',
          actions: ['markVideoReady'],
        },
        VIDEO_ERROR: {
          target: 'error',
          actions: [
            {
              type: 'setError',
              params: ({ event }) => ({ error: event.error }),
            },
          ],
        },
      },
    },
    
    ready: {
      type: 'parallel',
      states: {
        playback: {
          initial: 'paused',
          states: {
            paused: {
              on: {
                USER_PLAY: {
                  target: 'playing',
                  actions: ['playVideoWithSound', 'unmuteVideo'],
                },
                AUTO_PLAY: {
                  target: 'playing',
                  actions: ['playVideo'], // Keep muted for auto-play
                },
                ENTER_VIEWPORT: {
                  target: 'playing', 
                  actions: ['playVideo'], // Keep muted for auto-play
                },
              },
            },
            playing: {
              entry: ['startWatchTime'],
              exit: ['pauseVideo', 'stopWatchTime'],
              on: {
                USER_PAUSE: 'paused',
                AUTO_PAUSE: 'paused',
                LEAVE_VIEWPORT: 'paused',
              },
            },
          },
        },
        
        audio: {
          initial: 'muted', // Start muted for autoplay compatibility
          states: {
            muted: {
              on: {
                TOGGLE_MUTE: {
                  target: 'unmuted',
                  actions: ['unmuteVideo'],
                },
              },
            },
            unmuted: {
              on: {
                TOGGLE_MUTE: {
                  target: 'muted',
                  actions: ['muteVideo'],
                },
              },
            },
          },
        },
        
        engagement: {
          initial: 'neutral',
          states: {
            neutral: {
              on: {
                LIKE: {
                  target: 'liked',
                  actions: ['incrementLikes'],
                },
              },
            },
            liked: {
              on: {
                UNLIKE: {
                  target: 'neutral',
                  actions: ['decrementLikes'],
                },
              },
            },
          },
        },
      },
    },
    
    error: {
      on: {
        LOAD_VIDEO: {
          target: 'loading',
          actions: [
            {
              type: 'setVideoElement',
              params: ({ event }) => ({ videoElement: event.videoElement }),
            },
          ],
        },
      },
    },
  },
  
  exit: ['cleanup'],
});