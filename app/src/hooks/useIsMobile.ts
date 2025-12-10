/**
 * useIsMobile - Reactive hook for detecting mobile viewport
 *
 * Uses matchMedia for efficient, reactive viewport detection.
 * Default breakpoint is 640px (Tailwind's `sm` breakpoint).
 */

import { createSignal, onCleanup, onMount } from 'solid-js'

const MOBILE_BREAKPOINT = 640

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = createSignal(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )

  onMount(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)

    // Set initial value
    setIsMobile(mediaQuery.matches)

    // Listen for changes
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    onCleanup(() => {
      mediaQuery.removeEventListener('change', handleChange)
    })
  })

  return isMobile
}
