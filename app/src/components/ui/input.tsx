/**
 * Input Component for SolidJS
 *
 * Rounded pill-shaped inputs with gray background.
 * Used across auth dialogs, chat, forms.
 */

import { splitProps, type Component, type JSX } from 'solid-js'
import { cn } from '@/lib/utils'

const inputStyles = [
  'flex w-full rounded-full bg-secondary px-4 py-[10px]',
  'text-base text-foreground placeholder:text-muted-foreground leading-6',
  'focus:outline-none focus:ring-2 focus:ring-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')

export interface InputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'class'> {
  class?: string
}

export const Input: Component<InputProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'type'])

  return (
    <input
      type={local.type}
      class={cn(inputStyles, local.class)}
      {...others}
    />
  )
}

/**
 * Textarea - for multi-line input (chat, comments)
 */
export interface TextareaProps extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'class'> {
  class?: string
}

export const Textarea: Component<TextareaProps> = (props) => {
  const [local, others] = splitProps(props, ['class'])

  return (
    <textarea
      class={cn(inputStyles, 'resize-none scrollbar-hide', local.class)}
      {...others}
    />
  )
}
