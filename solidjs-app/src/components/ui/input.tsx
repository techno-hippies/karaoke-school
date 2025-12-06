/**
 * Input Component for SolidJS
 *
 * Supports variants:
 * - default: Traditional form input with border (auth dialogs, forms)
 * - chat: Pill-shaped, borderless, gray background (messaging)
 */

import { splitProps, type Component, type JSX } from 'solid-js'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  // Base styles
  'flex w-full text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: [
          'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        ],
        chat: [
          'rounded-full bg-secondary px-4 py-[10px] text-base leading-6',
          'focus:ring-2 focus:ring-ring',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface InputProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'class'>,
    VariantProps<typeof inputVariants> {
  class?: string
}

export const Input: Component<InputProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'type', 'variant'])

  return (
    <input
      type={local.type}
      class={cn(inputVariants({ variant: local.variant }), local.class)}
      {...others}
    />
  )
}

/**
 * Textarea variant - for multi-line input (chat, comments)
 */
export interface TextareaProps
  extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'class'>,
    VariantProps<typeof inputVariants> {
  class?: string
}

export const Textarea: Component<TextareaProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'variant'])

  return (
    <textarea
      class={cn(
        inputVariants({ variant: local.variant }),
        'resize-none scrollbar-hide',
        local.class
      )}
      {...others}
    />
  )
}
