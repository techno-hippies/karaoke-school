import { useEffect } from 'react'

// Auto-scroll container to active element
export function useAutoScroll(
  activeIndex: number,
  containerRef: React.RefObject<HTMLElement | null>,
  dataAttribute = 'data-line-index'
) {
  useEffect(() => {
    if (activeIndex < 0 || !containerRef.current) return

    const activeElement = containerRef.current.querySelector(
      `[${dataAttribute}="${activeIndex}"]`
    )

    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [activeIndex, containerRef, dataAttribute])
}
