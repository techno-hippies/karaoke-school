/**
 * Dialog Component for SolidJS
 * Using Kobalte Dialog primitive
 */

import { Dialog as KobalteDialog } from '@kobalte/core/dialog'
import { Icon } from '@/components/icons'
import { splitProps, onMount, type ParentComponent, type Component, type JSX } from 'solid-js'
import { cn, haptic } from '@/lib/utils'

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

/** Shared button styles for dialog navigation (back/close) */
const dialogNavButtonClass = cn(
  'flex items-center justify-center w-10 h-10 rounded-full',
  'hover:bg-foreground/10 transition-colors cursor-pointer',
  'text-foreground'
)

interface DialogContentProps {
  class?: string
  children?: JSX.Element
  /** Optional back button handler - shows caret-left in top-left */
  onBack?: () => void
  /** Footer content that stays at the bottom */
  footer?: JSX.Element
}

const DialogContent: ParentComponent<DialogContentProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children', 'onBack', 'footer'])

  // Haptic feedback when dialog opens
  onMount(() => haptic.light())

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
        {/* Back button - top left (conditionally rendered) */}
        {local.onBack && (
          <button
            type="button"
            onClick={local.onBack}
            class={cn(dialogNavButtonClass, 'absolute left-3 top-3')}
            aria-label="Go back"
          >
            <Icon name="caret-left" class="text-2xl" />
          </button>
        )}
        {local.children}
        {/* Footer - at the bottom */}
        {local.footer && (
          <div class="mt-auto pt-4">
            {local.footer}
          </div>
        )}
        {/* Close button - top right */}
        <KobalteDialog.CloseButton
          class={cn(dialogNavButtonClass, 'absolute right-3 top-3')}
          aria-label="Close"
        >
          <Icon name="x" class="text-2xl" />
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
