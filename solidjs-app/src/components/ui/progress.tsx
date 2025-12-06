/**
 * Progress component - simple CSS implementation
 */

import { splitProps, type Component } from 'solid-js'
import { cn } from '@/lib/utils'

interface ProgressProps {
  value?: number
  max?: number
  class?: string
  indicatorClass?: string
}

const Progress: Component<ProgressProps> = (props) => {
  const [local] = splitProps(props, ['value', 'max', 'class', 'indicatorClass'])

  const percentage = () => {
    const val = local.value ?? 0
    const max = local.max ?? 100
    return Math.min(100, Math.max(0, (val / max) * 100))
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={local.value ?? 0}
      aria-valuemin={0}
      aria-valuemax={local.max ?? 100}
      class={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', local.class)}
    >
      <div
        class={cn('h-full rounded-full bg-primary transition-all duration-300', local.indicatorClass)}
        style={{ width: `${percentage()}%` }}
      />
    </div>
  )
}

export { Progress }
