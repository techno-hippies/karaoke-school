import { createContext, useContext, useRef, type ReactNode } from 'react'

interface VideoPlaybackContextType {
  hasUserInteracted: () => boolean
  setUserInteracted: () => void
}

const VideoPlaybackContext = createContext<VideoPlaybackContextType | null>(null)

/**
 * VideoPlaybackProvider - Global state for video playback behavior
 *
 * Tracks whether user has interacted with any video player in the session.
 * Once user clicks play on any video, all subsequent videos will autoplay.
 * This provides consistent UX across Feed, Profile, and VideoDetail pages.
 */
export function VideoPlaybackProvider({ children }: { children: ReactNode }) {
  const hasInteractedRef = useRef(false)

  const hasUserInteracted = () => hasInteractedRef.current

  const setUserInteracted = () => {
    hasInteractedRef.current = true
  }

  return (
    <VideoPlaybackContext.Provider value={{ hasUserInteracted, setUserInteracted }}>
      {children}
    </VideoPlaybackContext.Provider>
  )
}

/**
 * useVideoPlaybackContext - Access global video playback state
 *
 * Use this to check if user has interacted with any video player,
 * which determines autoplay behavior across the app.
 */
export function useVideoPlaybackContext() {
  const context = useContext(VideoPlaybackContext)
  if (!context) {
    throw new Error('useVideoPlaybackContext must be used within VideoPlaybackProvider')
  }
  return context
}
