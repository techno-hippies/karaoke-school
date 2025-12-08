/**
 * PurchaseDialog - Base component for purchase/subscription dialogs
 * Provides shared UI for idle, processing, error, and complete states
 *
 * Responsive: Dialog on desktop, Drawer on mobile
 */

import { Show, type Component, type JSX } from 'solid-js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Icon } from '@/components/icons'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { PurchaseStep } from './types'

export interface PurchaseDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void

  /** Dialog title */
  title: string
  /** Subtitle shown below title (changes based on step) */
  subtitle?: string

  /** Current step in the purchase flow */
  currentStep: PurchaseStep

  /** Status message shown during processing */
  statusMessage?: string
  /** Error message shown on error */
  errorMessage?: string

  /** Called when user clicks the main action button */
  onPurchase?: () => void
  /** Called when user clicks retry after error */
  onRetry?: () => void

  /** Custom content for the idle state (price display, features, etc.) */
  idleContent?: JSX.Element
  /** Custom action button text (default: "Purchase") */
  actionText?: string
  /** Custom success message */
  successMessage?: string
  /** Icon to show in the header (optional) */
  headerIcon?: JSX.Element
}

export const PurchaseDialog: Component<PurchaseDialogProps> = (props) => {
  const isMobile = useIsMobile()

  const isComplete = () => props.currentStep === 'complete'
  const isError = () => props.currentStep === 'error'
  const isIdle = () => props.currentStep === 'idle'
  const isProcessing = () =>
    props.currentStep === 'checking' ||
    props.currentStep === 'signing' ||
    props.currentStep === 'approving' ||
    props.currentStep === 'purchasing'

  const getSubtitle = () => {
    if (isComplete()) return props.successMessage || 'Purchase complete!'
    return props.subtitle || ''
  }

  // Body content (without action button) for both Dialog and Drawer
  const bodyContent = (): JSX.Element => (
    <div class="space-y-3 pt-2">
      {/* IDLE STATE - Show custom content */}
      <Show when={isIdle()}>
        {props.idleContent}
      </Show>

      {/* PROCESSING STATE - Show spinner and status */}
      <Show when={isProcessing()}>
        <div class="flex flex-col items-center py-8 space-y-4">
          <Spinner size="lg" class="text-primary" />
          <Show when={props.statusMessage}>
            <p class="text-base text-center text-muted-foreground animate-pulse">
              {props.statusMessage}
            </p>
          </Show>
        </div>
      </Show>

      {/* ERROR STATE - Show context + error */}
      <Show when={isError()}>
        <div class="space-y-4">
          {props.idleContent}

          <div class="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg">
            <Icon name="warning-circle" class="text-xl text-destructive flex-shrink-0 mt-0.5" />
            <p
              class="text-base text-destructive break-words"
              style={{ 'overflow-wrap': 'anywhere' }}
            >
              {props.errorMessage || 'Transaction failed. Please try again.'}
            </p>
          </div>
        </div>
      </Show>

      {/* COMPLETE STATE - Show success icon */}
      <Show when={isComplete()}>
        <div class="flex flex-col items-center py-4">
          <Icon name="check-circle" class="text-7xl text-green-500" weight="fill" />
        </div>
      </Show>
    </div>
  )

  // Footer button content - separate for sticky positioning
  const footerContent = (): JSX.Element => (
    <>
      <Show when={isIdle()}>
        <Button
          onClick={props.onPurchase}
          class="w-full h-14 text-lg"
          variant="gradient"
          size="xl"
        >
          {props.actionText || 'Purchase'}
        </Button>
      </Show>

      <Show when={isError()}>
        <Button
          onClick={props.onRetry}
          class="w-full h-14 text-base"
          variant="default"
          size="lg"
        >
          Retry
        </Button>
      </Show>

      <Show when={isComplete()}>
        <Button
          onClick={() => props.onOpenChange(false)}
          class="w-full h-14 text-base"
          variant="default"
          size="lg"
        >
          Done
        </Button>
      </Show>
    </>
  )

  // Header content shared between Dialog and Drawer
  const headerContent = (): JSX.Element => (
    <>
      <Show when={props.headerIcon}>{props.headerIcon}</Show>
      {props.title}
    </>
  )

  // Footer element - only show when not processing
  const footer = () => !isProcessing() ? footerContent() : undefined

  // Mobile: Drawer, Desktop: Dialog
  return (
    <Show
      when={isMobile()}
      fallback={
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
          <DialogContent class="sm:max-w-[400px] flex flex-col" footer={footer()}>
            <DialogHeader class="text-left">
              <DialogTitle class="text-2xl flex items-center gap-2">
                {headerContent()}
              </DialogTitle>
              <Show when={getSubtitle()}>
                <DialogDescription class="text-base text-foreground/70">
                  {getSubtitle()}
                </DialogDescription>
              </Show>
            </DialogHeader>
            {bodyContent()}
          </DialogContent>
        </Dialog>
      }
    >
      <Drawer open={props.open} onOpenChange={props.onOpenChange}>
        <DrawerContent footer={footer()}>
          <DrawerHeader class="text-left">
            <DrawerTitle class="text-2xl flex items-center gap-2">
              {headerContent()}
            </DrawerTitle>
            <Show when={getSubtitle()}>
              <DrawerDescription class="text-base text-foreground/70">
                {getSubtitle()}
              </DrawerDescription>
            </Show>
          </DrawerHeader>
          {bodyContent()}
        </DrawerContent>
      </Drawer>
    </Show>
  )
}
