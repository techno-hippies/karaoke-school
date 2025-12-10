/**
 * Item primitives for list items (songs, artists, etc.)
 * Simplified from React version for SolidJS
 */

import { splitProps, type JSX, type ParentComponent } from 'solid-js'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Item Group
export const ItemGroup: ParentComponent<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children'])
  return (
    <div
      role="list"
      class={cn('flex flex-col', local.class)}
      {...others}
    >
      {local.children}
    </div>
  )
}

// Item variants
const itemVariants = cva(
  'group flex flex-wrap items-center rounded-md border border-transparent text-sm outline-none transition-colors duration-100',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border-border',
        muted: 'bg-muted/50',
      },
      size: {
        default: 'gap-4 p-4',
        sm: 'gap-2.5 px-4 py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ItemProps extends JSX.HTMLAttributes<HTMLDivElement>, VariantProps<typeof itemVariants> {}

export const Item: ParentComponent<ItemProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'variant', 'size', 'children'])
  return (
    <div
      class={cn(itemVariants({ variant: local.variant, size: local.size }), local.class)}
      {...others}
    >
      {local.children}
    </div>
  )
}

// Item Media variants
const itemMediaVariants = cva(
  'flex shrink-0 items-center justify-center gap-2',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: 'bg-muted size-8 rounded-sm border',
        image: 'size-10 overflow-hidden rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface ItemMediaProps extends JSX.HTMLAttributes<HTMLDivElement>, VariantProps<typeof itemMediaVariants> {}

export const ItemMedia: ParentComponent<ItemMediaProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'variant', 'children'])
  return (
    <div
      class={cn(itemMediaVariants({ variant: local.variant }), local.class)}
      {...others}
    >
      {local.children}
    </div>
  )
}

// Item Content
export const ItemContent: ParentComponent<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children'])
  return (
    <div class={cn('flex flex-1 flex-col gap-1', local.class)} {...others}>
      {local.children}
    </div>
  )
}

// Item Title
export const ItemTitle: ParentComponent<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children'])
  return (
    <div
      class={cn('flex w-fit items-center gap-2 text-base font-semibold leading-snug', local.class)}
      {...others}
    >
      {local.children}
    </div>
  )
}

// Item Description
export const ItemDescription: ParentComponent<JSX.HTMLAttributes<HTMLParagraphElement>> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children'])
  return (
    <p
      class={cn('text-muted-foreground line-clamp-2 text-base font-normal leading-normal', local.class)}
      {...others}
    >
      {local.children}
    </p>
  )
}

// Item Actions
export const ItemActions: ParentComponent<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children'])
  return (
    <div class={cn('flex items-center gap-2', local.class)} {...others}>
      {local.children}
    </div>
  )
}
