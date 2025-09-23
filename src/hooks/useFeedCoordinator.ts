import { useMachine } from '@xstate/react';
import { feedCoordinatorMachine } from '../machines/feedCoordinatorMachine';
import { useEffect, useRef, useCallback } from 'react';

export function useFeedCoordinator(feedItems: any[]) {
  const [state, send] = useMachine(feedCoordinatorMachine);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  // Handle video play/pause based on coordinator state
  const handleVideoPlay = useCallback((videoId: string) => {
    console.log('[FeedCoordinator] Play video:', videoId);
    // When playing a video, pause all others
    send({ type: 'VIDEO_PLAY', videoId });
  }, [send]);
  
  const handleVideoPause = useCallback((videoId: string) => {
    console.log('[FeedCoordinator] Pause video:', videoId);
    send({ type: 'VIDEO_PAUSE', videoId });
  }, [send]);
  
  // Set up intersection observer for viewport detection
  useEffect(() => {
    // Keep track of the current most visible video
    let currentActiveVideo: string | null = null;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the most visible video from ALL observed elements
        let mostVisible: { id: string; ratio: number } | null = null;
        
        // Process all entries to find the most visible
        entries.forEach((entry) => {
          const videoId = entry.target.getAttribute('data-video-id');
          if (!videoId) return;
          
          console.log(`[Observer] ${videoId} - intersecting: ${entry.isIntersecting}, ratio: ${entry.intersectionRatio.toFixed(2)}`);
          
          // Consider this video if it's visible enough
          if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            if (!mostVisible || entry.intersectionRatio > mostVisible.ratio) {
              mostVisible = { id: videoId, ratio: entry.intersectionRatio };
            }
          }
        });
        
        // If we found a most visible video and it's different from current
        if (mostVisible && mostVisible.id !== currentActiveVideo) {
          // Leave the old video
          if (currentActiveVideo) {
            console.log('[FeedCoordinator] Video left viewport:', currentActiveVideo);
            send({ type: 'VIDEO_LEAVE_VIEWPORT', videoId: currentActiveVideo });
          }
          
          // Enter the new video
          console.log('[FeedCoordinator] Video entered viewport:', mostVisible.id);
          send({ type: 'VIDEO_ENTER_VIEWPORT', videoId: mostVisible.id });
          currentActiveVideo = mostVisible.id;
        }
      },
      { 
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        rootMargin: '-10% 0px' // Slightly shrink the viewport to avoid edge cases
      }
    );
    
    return () => {
      observerRef.current?.disconnect();
    };
  }, [send]);
  
  // Register video element for observation
  const registerVideo = useCallback((videoId: string, element: HTMLElement | null) => {
    console.log(`[Register] ${videoId} - element: ${element ? 'provided' : 'null'}`);
    
    if (!element) {
      // Unobserve if it was being observed
      const existingElement = videoRefs.current.get(videoId);
      if (existingElement && observerRef.current) {
        console.log(`[Register] Unobserving ${videoId}`);
        observerRef.current.unobserve(existingElement);
      }
      videoRefs.current.delete(videoId);
      return;
    }
    
    // Check if we're already observing this element
    const existingElement = videoRefs.current.get(videoId);
    if (existingElement === element) {
      console.log(`[Register] Already observing ${videoId}`);
      return; // Already observing this element
    }
    
    // Unobserve the old element if there was one
    if (existingElement && observerRef.current) {
      console.log(`[Register] Unobserving old element for ${videoId}`);
      observerRef.current.unobserve(existingElement);
    }
    
    // Set up new observation
    console.log(`[Register] Starting observation for ${videoId}`);
    element.setAttribute('data-video-id', videoId);
    videoRefs.current.set(videoId, element as HTMLVideoElement);
    observerRef.current?.observe(element);
  }, []);
  
  // Check if a video should be playing
  const isVideoActive = useCallback((videoId: string) => {
    // Video is only "active" if it's the current video AND not paused
    const isCurrentVideo = state.context.activeVideoId === videoId;
    const videoState = state.context.videoStates.get(videoId);
    return isCurrentVideo && videoState !== 'paused';
  }, [state.context.activeVideoId, state.context.videoStates]);
  
  // Get video state
  const getVideoState = useCallback((videoId: string) => {
    return state.context.videoStates.get(videoId) || 'idle';
  }, [state.context.videoStates]);
  
  return {
    activeVideoId: state.context.activeVideoId,
    handleVideoPlay,
    handleVideoPause,
    registerVideo,
    isVideoActive,
    getVideoState,
  };
}