/**
 * Dialog Component for SolidJS
 * Using Kobalte Dialog primitive
 */

import { Dialog as KobalteDialog } from '@kobalte/core/dialog'
import { X } from '@/components/icons'
import { splitProps, type ParentComponent, type Component } from 'solid-js'
import { cn } from '@/lib/utils'

const Dialog = KobalteDialog

const DialogTrigger = KobalteDialog.Trigger

const DialogPortal = KobalteDialog.Portal

const DialogOverlay: Component<{ class?: string }> = (props) => {
  return (
    <KobalteDialog.Overlay
      class={cn(
        'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        props.class
      )}
    />
  )
}

const DialogContent: ParentComponent<{ class?: string }> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children'])

  return (
    <DialogPortal>
      <DialogOverlay />
      <KobalteDialog.Content
        class={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 bg-card p-6 shadow-lg rounded-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          local.class
        )}
        {...others}
      >
        {local.children}
        <KobalteDialog.CloseButton class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X class="h-4 w-4" />
          <span class="sr-only">Close</span>
        </KobalteDialog.CloseButton>
      </KobalteDialog.Content>
    </DialogPortal>
  )
}

const DialogHeader: ParentComponent<{ class?: string }> = (props) => {
  return (
    <div
      class={cn('flex flex-col space-y-1.5 text-center sm:text-left', props.class)}
    >
      {props.children}
    </div>
  )
}

const DialogFooter: ParentComponent<{ class?: string }> = (props) => {
  return (
    <div
      class={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', props.class)}
    >
      {props.children}
    </div>
  )
}

const DialogTitle: ParentComponent<{ class?: string }> = (props) => {
  return (
    <KobalteDialog.Title
      class={cn('text-lg font-semibold leading-none tracking-tight', props.class)}
    >
      {props.children}
    </KobalteDialog.Title>
  )
}

const DialogDescription: ParentComponent<{ class?: string }> = (props) => {
  return (
    <KobalteDialog.Description
      class={cn('text-sm text-muted-foreground', props.class)}
    >
      {props.children}
    </KobalteDialog.Description>
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
