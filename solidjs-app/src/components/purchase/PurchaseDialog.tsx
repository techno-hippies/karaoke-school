/**
 * PurchaseDialog - Base component for purchase/subscription dialogs
 * Provides shared UI for idle, processing, error, and complete states
 */

import { Show, type Component, type JSX } from 'solid-js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle, AlertCircle } from '@/components/icons'
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

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader class="text-left">
          <DialogTitle class="text-2xl flex items-center gap-2">
            <Show when={props.headerIcon}>{props.headerIcon}</Show>
            {props.title}
          </DialogTitle>
          <Show when={getSubtitle()}>
            <DialogDescription class="text-base">
              {getSubtitle()}
            </DialogDescription>
          </Show>
        </DialogHeader>

        <div class="space-y-4 py-4">
          {/* IDLE STATE - Show custom content and action button */}
          <Show when={isIdle()}>
            <div class="space-y-6">
              {props.idleContent}

              <Button
                onClick={props.onPurchase}
                class="w-full h-14 text-lg"
                variant="gradient"
                size="xl"
              >
                {props.actionText || 'Purchase'}
              </Button>
            </div>
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

          {/* ERROR STATE - Show error and retry button */}
          <Show when={isError()}>
            <div class="space-y-4">
              <div class="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg">
                <AlertCircle class="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p
                  class="text-sm text-destructive break-words"
                  style={{ 'overflow-wrap': 'anywhere' }}
                >
                  {props.errorMessage || 'Transaction failed. Please try again.'}
                </p>
              </div>

              <Button
                onClick={props.onRetry}
                class="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                Retry
              </Button>
            </div>
          </Show>

          {/* COMPLETE STATE - Show success and close button */}
          <Show when={isComplete()}>
            <div class="space-y-4">
              <div class="flex flex-col items-center py-4">
                <CheckCircle class="w-16 h-16 text-green-500" weight="fill" />
              </div>

              <Button
                onClick={() => props.onOpenChange(false)}
                class="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                Done
              </Button>
            </div>
          </Show>
        </div>
      </DialogContent>
    </Dialog>
  )
}
