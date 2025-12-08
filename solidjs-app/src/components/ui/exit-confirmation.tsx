/**
 * Exit Confirmation Component
 * Shows a drawer on mobile, dialog on desktop to confirm leaving a session
 */

import { createSignal, Show, type Component } from 'solid-js'
import { useTranslation } from '@/lib/i18n'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from './drawer'

interface ExitConfirmationProps {
  /** Whether the confirmation is open */
  open: boolean
  /** Called when user cancels (closes without confirming) */
  onCancel: () => void
  /** Called when user confirms exit */
  onConfirm: () => void
  /** Type of session being exited - determines messaging */
  sessionType: 'study' | 'karaoke'
}

/**
 * Responsive exit confirmation - drawer on mobile, dialog on desktop
 * Uses localized strings from common.exitConfirmation namespace
 */
export const ExitConfirmation: Component<ExitConfirmationProps> = (props) => {
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  const title = () =>
    props.sessionType === 'study'
      ? t('common.exitStudy.title')
      : t('common.exitKaraoke.title')

  const description = () =>
    props.sessionType === 'study'
      ? t('common.exitStudy.description')
      : t('common.exitKaraoke.description')

  return (
    <Show
      when={isMobile()}
      fallback={
        // Desktop: Dialog
        <Dialog open={props.open} onOpenChange={(open) => !open && props.onCancel()}>
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{title()}</DialogTitle>
              <DialogDescription>{description()}</DialogDescription>
            </DialogHeader>
            <DialogFooter class="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={props.onCancel}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" onClick={props.onConfirm}>
                {t('common.exit')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Mobile: Drawer */}
      <Drawer open={props.open} onOpenChange={(open) => !open && props.onCancel()}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title()}</DrawerTitle>
            <DrawerDescription>{description()}</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter class="flex flex-col gap-2">
            <Button variant="destructive" onClick={props.onConfirm} class="w-full">
              {t('common.exit')}
            </Button>
            <Button variant="ghost" onClick={props.onCancel} class="w-full">
              {t('common.cancel')}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Show>
  )
}

/**
 * Hook to manage exit confirmation state
 * Returns open state, trigger function, and handlers
 */
export function useExitConfirmation(onExit: () => void) {
  const [isOpen, setIsOpen] = createSignal(false)

  return {
    isOpen,
    /** Call this when user clicks X/back button */
    requestExit: () => setIsOpen(true),
    /** Close without exiting */
    cancel: () => setIsOpen(false),
    /** Confirm and exit */
    confirm: () => {
      setIsOpen(false)
      onExit()
    },
  }
}
