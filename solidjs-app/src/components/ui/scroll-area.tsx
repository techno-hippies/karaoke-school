/**
 * ScrollArea component - CSS-based scrollable container
 */

import { splitProps, type ParentComponent } from 'solid-js'
import { cn } from '@/lib/utils'

interface ScrollAreaProps {
  class?: string
  orientation?: 'horizontal' | 'vertical'
  hideScrollbar?: boolean
}

const ScrollArea: ParentComponent<ScrollAreaProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'orientation', 'hideScrollbar', 'children'])
  const isHorizontal = local.orientation === 'horizontal'

  return (
    <div
      class={cn(
        'relative',
        isHorizontal ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto overflow-x-hidden',
        local.hideScrollbar && 'scrollbar-hide',
        local.class
      )}
      {...others}
    >
      {local.children}
    </div>
  )
}

export { ScrollArea }
