/**
 * Skeleton - Loading placeholder component
 */

import { splitProps, type Component, type JSX } from 'solid-js'
import { cn } from '@/lib/utils'

export interface SkeletonProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: Component<SkeletonProps> = (props) => {
  const [local, others] = splitProps(props, ['class'])
  return (
    <div
      class={cn('animate-pulse rounded-md bg-muted', local.class)}
      {...others}
    />
  )
}
