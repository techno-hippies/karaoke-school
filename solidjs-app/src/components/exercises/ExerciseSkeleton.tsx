import { type Component } from 'solid-js'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface ExerciseSkeletonProps {
  class?: string
}

/**
 * Loading skeleton for exercise content
 */
export const ExerciseSkeleton: Component<ExerciseSkeletonProps> = (props) => {
  return (
    <div class={cn('space-y-6 p-4', props.class)}>
      {/* Question/prompt skeleton */}
      <div class="space-y-3">
        <Skeleton class="h-5 w-24 rounded-lg" />
        <div class="space-y-2">
          <Skeleton class="h-6 w-full rounded-lg" />
          <Skeleton class="h-6 w-3/4 rounded-lg" />
        </div>
      </div>

      {/* Options/content skeleton */}
      <div class="space-y-3">
        <Skeleton class="h-12 w-full rounded-lg" />
        <Skeleton class="h-12 w-full rounded-lg" />
        <Skeleton class="h-12 w-full rounded-lg" />
        <Skeleton class="h-12 w-full rounded-lg" />
      </div>
    </div>
  )
}
