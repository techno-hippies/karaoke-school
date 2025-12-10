/**
 * Shared types for purchase/subscription dialogs
 */

export type PurchaseStep =
  | 'idle'       // Ready to start
  | 'checking'   // Checking wallet balance
  | 'signing'    // User signing transaction
  | 'approving'  // Token approval in progress
  | 'purchasing' // Purchase transaction in progress
  | 'complete'   // Success!
  | 'error'      // Something went wrong

export interface PurchaseDialogState {
  step: PurchaseStep
  statusMessage: string
  errorMessage: string
}

export interface PurchaseDialogHandlers {
  onPurchase?: () => void
  onRetry?: () => void
  onClose?: () => void
}
