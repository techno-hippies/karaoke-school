import { useRef } from 'react';

interface UseTouchGesturesOptions {
  /**
   * Threshold for detecting tap vs swipe (in pixels)
   */
  tapThreshold?: number;
  /**
   * Minimum distance for swipe detection (in pixels)
   */
  swipeThreshold?: number;
}

interface UseTouchGesturesCallbacks {
  /**
   * Called when a tap is detected
   */
  onTap?: () => void;
  /**
   * Called when a swipe up is detected
   */
  onSwipeUp?: () => void;
  /**
   * Called when a swipe down is detected
   */
  onSwipeDown?: () => void;
  /**
   * Called when a swipe left is detected
   */
  onSwipeLeft?: () => void;
  /**
   * Called when a swipe right is detected
   */
  onSwipeRight?: () => void;
}

interface UseTouchGesturesReturn {
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
}

/**
 * Hook for handling touch gestures (tap, swipe) consistently across video components.
 * Eliminates duplicated touch handling logic.
 */
export const useTouchGestures = (
  callbacks: UseTouchGesturesCallbacks,
  options: UseTouchGesturesOptions = {}
): UseTouchGesturesReturn => {
  const {
    tapThreshold = 10,
    swipeThreshold = 50
  } = options;

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchEnd = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
  };

  const handleTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;

    const xDiff = touchStart.current.x - touchEnd.current.x;
    const yDiff = touchStart.current.y - touchEnd.current.y;

    // Check if this is a tap (small movement) vs swipe
    const isTap = Math.abs(xDiff) < tapThreshold && Math.abs(yDiff) < tapThreshold;

    if (isTap) {
      // Tap detected
      callbacks.onTap?.();
    } else {
      // Determine swipe direction based on the largest movement
      const absXDiff = Math.abs(xDiff);
      const absYDiff = Math.abs(yDiff);

      if (absYDiff > absXDiff) {
        // Vertical swipe
        if (yDiff > swipeThreshold) {
          // Swipe up (finger moved down, content goes up)
          callbacks.onSwipeUp?.();
        } else if (yDiff < -swipeThreshold) {
          // Swipe down (finger moved up, content goes down)
          callbacks.onSwipeDown?.();
        }
      } else {
        // Horizontal swipe
        if (xDiff > swipeThreshold) {
          // Swipe left (finger moved right to left)
          callbacks.onSwipeLeft?.();
        } else if (xDiff < -swipeThreshold) {
          // Swipe right (finger moved left to right)
          callbacks.onSwipeRight?.();
        }
      }
    }
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};