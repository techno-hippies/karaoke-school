import { createMachine, assign } from 'xstate';

interface FeedCoordinatorContext {
  activeVideoId: string | null;
  registeredVideos: Map<string, {
    element: HTMLElement | null;
    wasPlaying: boolean;
    currentTime: number;
  }>;
  autoplayEnabled: boolean;
}

type FeedCoordinatorEvent =
  | { type: 'REGISTER_VIDEO'; videoId: string; element: HTMLElement | null }
  | { type: 'UNREGISTER_VIDEO'; videoId: string }
  | { type: 'VIDEO_BECAME_ACTIVE'; videoId: string }
  | { type: 'VIDEO_BECAME_INACTIVE'; videoId: string }
  | { type: 'VIDEO_PLAYED'; videoId: string }
  | { type: 'VIDEO_PAUSED'; videoId: string }
  | { type: 'VIDEO_ENDED'; videoId: string }
  | { type: 'TOGGLE_AUTOPLAY' }
  | { type: 'PAUSE_ALL_VIDEOS' }
  | { type: 'RESET' };

export const feedCoordinatorMachine = createMachine({
  id: 'feedCoordinator',
  context: {
    activeVideoId: null,
    registeredVideos: new Map(),
    autoplayEnabled: true,
  } as FeedCoordinatorContext,

  initial: 'idle',

  states: {
    idle: {
      on: {
        REGISTER_VIDEO: {
          actions: 'registerVideo'
        },
        UNREGISTER_VIDEO: {
          actions: 'unregisterVideo'
        },
        VIDEO_BECAME_ACTIVE: {
          target: 'managing',
          actions: 'setActiveVideo'
        },
        TOGGLE_AUTOPLAY: {
          actions: 'toggleAutoplay'
        },
        PAUSE_ALL_VIDEOS: {
          actions: 'pauseAllVideos'
        },
        RESET: {
          actions: 'resetState'
        }
      }
    },

    managing: {
      on: {
        REGISTER_VIDEO: {
          actions: 'registerVideo'
        },
        UNREGISTER_VIDEO: {
          actions: 'unregisterVideo'
        },
        VIDEO_BECAME_ACTIVE: {
          actions: ['pauseInactiveVideos', 'setActiveVideo', 'autoplayActiveVideo']
        },
        VIDEO_BECAME_INACTIVE: {
          target: 'idle',
          actions: ['clearActiveVideo', 'pauseAllVideos']
        },
        VIDEO_PLAYED: {
          actions: 'markVideoAsPlaying'
        },
        VIDEO_PAUSED: {
          actions: 'markVideoAsPaused'
        },
        VIDEO_ENDED: {
          actions: 'handleVideoEnded'
        },
        TOGGLE_AUTOPLAY: {
          actions: 'toggleAutoplay'
        },
        PAUSE_ALL_VIDEOS: {
          actions: 'pauseAllVideos'
        },
        RESET: {
          target: 'idle',
          actions: 'resetState'
        }
      }
    }
  }
}, {
  actions: {
    registerVideo: assign({
      registeredVideos: ({ context, event }) => {
        if (event.type !== 'REGISTER_VIDEO') return context.registeredVideos;

        const newMap = new Map(context.registeredVideos);
        newMap.set(event.videoId, {
          element: event.element,
          wasPlaying: false,
          currentTime: 0
        });

        console.log(`[FeedCoordinator] Registered video: ${event.videoId}`);
        return newMap;
      }
    }),

    unregisterVideo: assign({
      registeredVideos: ({ context, event }) => {
        if (event.type !== 'UNREGISTER_VIDEO') return context.registeredVideos;

        const newMap = new Map(context.registeredVideos);
        newMap.delete(event.videoId);

        console.log(`[FeedCoordinator] Unregistered video: ${event.videoId}`);
        return newMap;
      },
      activeVideoId: ({ context, event }) => {
        if (event.type !== 'UNREGISTER_VIDEO') return context.activeVideoId;
        return context.activeVideoId === event.videoId ? null : context.activeVideoId;
      }
    }),

    setActiveVideo: assign({
      activeVideoId: ({ event }) => {
        if (event.type !== 'VIDEO_BECAME_ACTIVE') return null;
        console.log(`[FeedCoordinator] Active video set: ${event.videoId}`);
        return event.videoId;
      }
    }),

    clearActiveVideo: assign({
      activeVideoId: () => {
        console.log(`[FeedCoordinator] Active video cleared`);
        return null;
      }
    }),

    pauseInactiveVideos: ({ context }) => {
      context.registeredVideos.forEach((videoData, videoId) => {
        if (videoId !== context.activeVideoId && videoData.element) {
          const videoElement = videoData.element.querySelector('video') as HTMLVideoElement;
          if (videoElement && !videoElement.paused) {
            console.log(`[FeedCoordinator] Pausing inactive video: ${videoId}`);
            videoData.wasPlaying = true;
            videoData.currentTime = videoElement.currentTime;
            videoElement.pause();
          }
        }
      });
    },

    autoplayActiveVideo: ({ context }) => {
      if (!context.autoplayEnabled || !context.activeVideoId) return;

      const activeVideoData = context.registeredVideos.get(context.activeVideoId);
      if (activeVideoData?.element) {
        const videoElement = activeVideoData.element.querySelector('video') as HTMLVideoElement;
        if (videoElement && videoElement.paused) {
          console.log(`[FeedCoordinator] Autoplaying active video: ${context.activeVideoId}`);

          // Restore previous position if video was playing before
          if (activeVideoData.wasPlaying && activeVideoData.currentTime > 0) {
            videoElement.currentTime = activeVideoData.currentTime;
          }

          videoElement.play().catch(e =>
            console.log(`[FeedCoordinator] Autoplay failed for ${context.activeVideoId}:`, e)
          );
        }
      }
    },

    pauseAllVideos: ({ context }) => {
      console.log(`[FeedCoordinator] Pausing all videos`);
      context.registeredVideos.forEach((videoData, videoId) => {
        if (videoData.element) {
          const videoElement = videoData.element.querySelector('video') as HTMLVideoElement;
          if (videoElement && !videoElement.paused) {
            videoData.wasPlaying = true;
            videoData.currentTime = videoElement.currentTime;
            videoElement.pause();
          }
        }
      });
    },

    markVideoAsPlaying: assign({
      registeredVideos: ({ context, event }) => {
        if (event.type !== 'VIDEO_PLAYED') return context.registeredVideos;

        const newMap = new Map(context.registeredVideos);
        const videoData = newMap.get(event.videoId);
        if (videoData) {
          videoData.wasPlaying = true;
          newMap.set(event.videoId, videoData);
        }
        return newMap;
      }
    }),

    markVideoAsPaused: assign({
      registeredVideos: ({ context, event }) => {
        if (event.type !== 'VIDEO_PAUSED') return context.registeredVideos;

        const newMap = new Map(context.registeredVideos);
        const videoData = newMap.get(event.videoId);
        if (videoData?.element) {
          const videoElement = videoData.element.querySelector('video') as HTMLVideoElement;
          if (videoElement) {
            videoData.wasPlaying = false;
            videoData.currentTime = videoElement.currentTime;
            newMap.set(event.videoId, videoData);
          }
        }
        return newMap;
      }
    }),

    handleVideoEnded: assign({
      registeredVideos: ({ context, event }) => {
        if (event.type !== 'VIDEO_ENDED') return context.registeredVideos;

        const newMap = new Map(context.registeredVideos);
        const videoData = newMap.get(event.videoId);
        if (videoData) {
          videoData.wasPlaying = false;
          videoData.currentTime = 0;
          newMap.set(event.videoId, videoData);
        }
        return newMap;
      }
    }),

    toggleAutoplay: assign({
      autoplayEnabled: ({ context }) => {
        const newValue = !context.autoplayEnabled;
        console.log(`[FeedCoordinator] Autoplay ${newValue ? 'enabled' : 'disabled'}`);
        return newValue;
      }
    }),

    resetState: assign({
      activeVideoId: () => null,
      registeredVideos: () => new Map(),
      autoplayEnabled: () => true
    })
  }
});