import { Spinner } from '@/components/ui/spinner'

/**
 * Skeleton loading states for exercises
 *
 * Provides a smooth loading experience while exercise data is being fetched,
 * maintaining layout structure so header/footer remain visible.
 */

interface ExerciseSkeletonProps {
  type?: 'SAY_IT_BACK' | 'MULTIPLE_CHOICE' | 'LOADING'
}

export function ExerciseSkeleton({ type = 'LOADING' }: ExerciseSkeletonProps) {
  // Simple centered spinner - keeps UI clean while prefetching completes
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner size="lg" />
    </div>
  )
}
