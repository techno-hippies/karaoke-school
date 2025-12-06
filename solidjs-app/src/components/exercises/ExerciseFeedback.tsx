import { type Component } from 'solid-js'
import { cn } from '@/lib/utils'

export interface ExerciseFeedbackProps {
  /** Whether the answer was correct */
  isCorrect: boolean
  /** Optional custom message (defaults to "Correct!" or "Try again") */
  message?: string
  /** Whether to animate the feedback (default: false, footer slides up instead) */
  animated?: boolean
}

export const ExerciseFeedback: Component<ExerciseFeedbackProps> = (props) => {
  const displayMessage = () => props.message || (props.isCorrect ? 'Correct!' : 'Try again')

  return (
    <div
      class={cn(
        'flex items-center gap-3',
        props.isCorrect
          ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]'
          : 'text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.4)]',
        props.animated && 'animate-bounce-in'
      )}
    >
      {props.isCorrect ? (
        // Check circle icon
        <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 256 256">
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z" />
        </svg>
      ) : (
        // X circle icon
        <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 256 256">
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm37.66,130.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
        </svg>
      )}
      <span class="text-base md:text-lg font-semibold">{displayMessage()}</span>
    </div>
  )
}
