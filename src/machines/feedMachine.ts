import { setup, assign, sendTo, fromCallback, createActor, type ActorRefFrom } from 'xstate';
import { videoMachine, type VideoContext } from './videoMachine';

export interface FeedVideo {
  id: string;
  url: string;
  username: string;
  description: string;
  likes: number;
  comments: number;
  shares: number;
  playbackId: string | null;
}

export interface FeedContext {
  videos: FeedVideo[];
  activeVideoId: string | null;
  videoActors: Map<string, ActorRefFrom<typeof videoMachine>>;
  observerRef: IntersectionObserver | null;
}

export type FeedEvent =
  | { type: 'VIDEOS_LOADED'; videos: FeedVideo[] }
  | { type: 'VIDEO_IN_VIEW'; videoId: string }
  | { type: 'VIDEO_OUT_OF_VIEW'; videoId: string }
  | { type: 'USER_PLAY'; videoId: string }
  | { type: 'USER_PAUSE'; videoId: string }
  | { type: 'SCROLL_TO_VIDEO'; videoId: string };

export const feedMachine = setup({
  types: {
    context: {} as FeedContext,
    events: {} as FeedEvent,
  },
  guards: {
    hasVideos: ({ context }) => context.videos.length > 0,
    isDifferentVideo: ({ context, event }) => {
      if (event.type !== 'VIDEO_IN_VIEW') return false;
      return context.activeVideoId !== event.videoId;
    },
  },
  actions: {
    setVideos: assign({
      videos: (_, params: { videos: FeedVideo[] }) => params.videos,
    }),
    
    createVideoActors: assign({
      videoActors: ({ context }) => {
        const actors = new Map<string, ActorRefFrom<typeof videoMachine>>();
        
        context.videos.forEach(video => {
          const actor = createActor(videoMachine, {
            id: `video-${video.id}`,
            input: {
              videoUrl: video.url,
              playbackId: video.playbackId,
              username: video.username,
              description: video.description,
              likes: video.likes,
              comments: video.comments,
              shares: video.shares,
              hasLiked: false,
              isMuted: true,
            } as VideoContext,
          });
          
          actor.start();
          actors.set(video.id, actor);
        });
        
        return actors;
      },
    }),
    
    setActiveVideo: assign({
      activeVideoId: (_, params: { videoId: string }) => params.videoId,
    }),
    
    pauseActiveVideo: ({ context }) => {
      if (context.activeVideoId && context.videoActors.has(context.activeVideoId)) {
        const actor = context.videoActors.get(context.activeVideoId)!;
        actor.send({ type: 'AUTO_PAUSE' });
      }
    },
    
    playNewVideo: ({ context }, params: { videoId: string }) => {
      if (context.videoActors.has(params.videoId)) {
        const actor = context.videoActors.get(params.videoId)!;
        actor.send({ type: 'AUTO_PLAY' });
      }
    },
    
    cleanupActors: ({ context }) => {
      context.videoActors.forEach(actor => {
        actor.stop();
      });
    },
  },
  actors: {
    // Intersection Observer to detect which video is in viewport
    viewportObserver: fromCallback(({ sendBack, input }: { sendBack: any; input: { videos: FeedVideo[] } }) => {
      const observers = new Map<string, IntersectionObserver>();
      
      // Create observers for each video after DOM is ready
      setTimeout(() => {
        input.videos.forEach(video => {
          const element = document.getElementById(`video-${video.id}`);
          if (!element) return;
          
          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                  console.log('[Feed] Video in view:', video.id);
                  sendBack({ type: 'VIDEO_IN_VIEW', videoId: video.id });
                } else if (!entry.isIntersecting) {
                  console.log('[Feed] Video out of view:', video.id);
                  sendBack({ type: 'VIDEO_OUT_OF_VIEW', videoId: video.id });
                }
              });
            },
            {
              threshold: [0, 0.5, 1],
              rootMargin: '0px',
            }
          );
          
          observer.observe(element);
          observers.set(video.id, observer);
        });
      }, 100);
      
      return () => {
        observers.forEach(observer => observer.disconnect());
      };
    }),
  },
}).createMachine({
  id: 'feed',
  initial: 'idle',
  context: {
    videos: [],
    activeVideoId: null,
    videoActors: new Map(),
    observerRef: null,
  },
  states: {
    idle: {
      on: {
        VIDEOS_LOADED: {
          target: 'loading',
          actions: [
            {
              type: 'setVideos',
              params: ({ event }) => ({ videos: event.videos }),
            },
          ],
        },
      },
    },
    
    loading: {
      entry: ['createVideoActors'],
      always: {
        target: 'ready',
        guard: 'hasVideos',
      },
      on: {
        VIDEOS_LOADED: {
          actions: [
            'cleanupActors',
            {
              type: 'setVideos',
              params: ({ event }) => ({ videos: event.videos }),
            },
            'createVideoActors',
          ],
        },
      },
    },
    
    ready: {
      invoke: {
        id: 'viewportObserver',
        src: 'viewportObserver',
        input: ({ context }) => ({ videos: context.videos }),
      },
      on: {
        VIDEO_IN_VIEW: {
          guard: 'isDifferentVideo',
          actions: [
            'pauseActiveVideo',
            {
              type: 'setActiveVideo',
              params: ({ event }) => ({ videoId: event.videoId }),
            },
            // Don't auto-play on scroll - wait for user interaction
            // {
            //   type: 'playNewVideo',
            //   params: ({ event }) => ({ videoId: event.videoId }),
            // },
          ],
        },
        
        VIDEO_OUT_OF_VIEW: {
          actions: ({ context, event }) => {
            if (context.activeVideoId === event.videoId) {
              // Pause if the active video goes out of view
              const actor = context.videoActors.get(event.videoId);
              actor?.send({ type: 'AUTO_PAUSE' });
            }
          },
        },
        
        USER_PLAY: {
          actions: ({ context, event }) => {
            // Pause any currently playing video
            if (context.activeVideoId && context.activeVideoId !== event.videoId) {
              const currentActor = context.videoActors.get(context.activeVideoId);
              currentActor?.send({ type: 'USER_PAUSE' });
            }
            
            // Play the requested video
            const actor = context.videoActors.get(event.videoId);
            actor?.send({ type: 'USER_PLAY' });
          },
        },
        
        USER_PAUSE: {
          actions: ({ context, event }) => {
            const actor = context.videoActors.get(event.videoId);
            actor?.send({ type: 'USER_PAUSE' });
          },
        },
        
        VIDEOS_LOADED: {
          target: 'loading',
          actions: [
            'cleanupActors',
            {
              type: 'setVideos',
              params: ({ event }) => ({ videos: event.videos }),
            },
          ],
        },
      },
    },
  },
  
  exit: ['cleanupActors'],
});