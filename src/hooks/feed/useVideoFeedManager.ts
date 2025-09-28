import { useEffect, useRef, useState, useCallback } from 'react';

interface VideoElement extends HTMLElement {
  dataset: {
    videoId?: string;
  };
}

interface UseVideoFeedManagerOptions {
  threshold?: number;
  rootMargin?: string;
  autoplay?: boolean;
}

interface UseVideoFeedManagerReturn {
  activeVideoId: string | null;
  registerVideo: (videoId: string, element: HTMLElement | null) => void;
  unregisterVideo: (videoId: string) => void;
  setContainerRef: (element: HTMLDivElement | null) => void;
}

export const useVideoFeedManager = (
  options: UseVideoFeedManagerOptions = {}
): UseVideoFeedManagerReturn => {
  const {
    threshold = 0.6, // 60% of video must be visible
    rootMargin = '0px',
    autoplay = true
  } = options;

  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  // Initialize Intersection Observer
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let mostVisibleEntry: IntersectionObserverEntry | null = null;
        let maxVisibility = 0;

        // Find the most visible video
        entries.forEach((entry) => {
          if (entry.intersectionRatio > maxVisibility) {
            maxVisibility = entry.intersectionRatio;
            mostVisibleEntry = entry;
          }
        });

        // Debug: Log all entries to diagnose issue
        console.log(`[VideoFeedManager] Observer triggered with ${entries.length} entries`);
        entries.forEach((entry) => {
          const videoElement = entry.target as VideoElement;
          const videoId = videoElement.dataset.videoId;
          console.log(`[VideoFeedManager] Entry: ${videoId?.slice(-8)} - ratio: ${entry.intersectionRatio}, isIntersecting: ${entry.isIntersecting}`);
        });

        // Update active video if we have a sufficiently visible one
        if (mostVisibleEntry && mostVisibleEntry.intersectionRatio >= threshold) {
          const videoElement = mostVisibleEntry.target as VideoElement;
          const videoId = videoElement.dataset.videoId;

          if (videoId && videoId !== activeVideoId) {
            console.log(`[VideoFeedManager] Active video changed: ${videoId.slice(-8)} (ratio: ${mostVisibleEntry.intersectionRatio})`);
            setActiveVideoId(videoId);
          }
        } else if (mostVisibleEntry && mostVisibleEntry.intersectionRatio < threshold && activeVideoId) {
          // No video is sufficiently visible
          console.log(`[VideoFeedManager] No video sufficiently active (best ratio: ${mostVisibleEntry.intersectionRatio})`);
          setActiveVideoId(null);
        }
      },
      {
        root: containerRef.current,
        rootMargin: '0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0] // More granular thresholds
      }
    );

    observerRef.current = observer;

    // Observe all currently registered videos
    videoElementsRef.current.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [threshold, rootMargin, activeVideoId]);

  // Register a video element for observation
  const registerVideo = useCallback((videoId: string, element: HTMLElement | null) => {
    if (!element) {
      unregisterVideo(videoId);
      return;
    }

    // Set video ID in dataset for identification
    element.dataset.videoId = videoId;
    videoElementsRef.current.set(videoId, element);

    // Add to observer if it exists
    if (observerRef.current) {
      observerRef.current.observe(element);
    }

    console.log(`[VideoFeedManager] Registered video: ${videoId}`);

    // If this is the first video and no active video is set, make it active
    if (videoElementsRef.current.size === 1 && !activeVideoId) {
      console.log(`[VideoFeedManager] Setting first video as active: ${videoId.slice(-8)}`);
      setActiveVideoId(videoId);
    }
  }, [activeVideoId]);

  // Unregister a video element
  const unregisterVideo = useCallback((videoId: string) => {
    const element = videoElementsRef.current.get(videoId);
    if (element && observerRef.current) {
      observerRef.current.unobserve(element);
    }
    videoElementsRef.current.delete(videoId);

    // Clear active state if this was the active video
    if (activeVideoId === videoId) {
      setActiveVideoId(null);
    }

    console.log(`[VideoFeedManager] Unregistered video: ${videoId}`);
  }, [activeVideoId]);

  // Set the scroll container reference
  const setContainerRef = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
  }, []);

  return {
    activeVideoId,
    registerVideo,
    unregisterVideo,
    setContainerRef
  };
};