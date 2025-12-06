/**
 * SongPurchaseDialog
 * One-time purchase dialog for full song access (~$0.10 USDC)
 * Uses SongAccess ERC-721 contract (NOT Unlock Protocol)
 */

import { Show, type Component } from 'solid-js'
import { PurchaseDialog } from './PurchaseDialog'
import { MusicNote } from '@/components/icons'
import { useCurrency } from '@/contexts/CurrencyContext'
import type { PurchaseStep } from './types'

export interface SongPurchaseDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void

  /** Song title to display */
  songTitle: string
  /** Artist name */
  artistName?: string
  /** Cover image URL */
  coverUrl?: string

  /** Current purchase step */
  currentStep: PurchaseStep
  /** Status message during processing */
  statusMessage?: string
  /** Error message if purchase fails */
  errorMessage?: string

  /** Price in USD (default: 0.10) */
  priceUsd?: number

  /** Called when user initiates purchase */
  onPurchase?: () => void
  /** Called when user retries after error */
  onRetry?: () => void
}

export const SongPurchaseDialog: Component<SongPurchaseDialogProps> = (props) => {
  const { currency, formatLocal } = useCurrency()
  const price = () => props.priceUsd ?? 0.10

  const idleContent = (
    <div class="space-y-4">
      {/* Song Info */}
      <div class="flex items-center gap-4 p-4 rounded-2xl bg-black/30">
        {props.coverUrl ? (
          <img
            src={props.coverUrl}
            alt={props.songTitle}
            class="w-16 h-16 rounded-lg object-cover"
          />
        ) : (
          <div class="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
            <MusicNote class="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <div class="flex-1 min-w-0">
          <p class="font-semibold truncate">{props.songTitle}</p>
          {props.artistName && (
            <p class="text-sm text-muted-foreground truncate">{props.artistName}</p>
          )}
        </div>
      </div>

      {/* What you get */}
      <ul class="space-y-2 text-sm">
        <li class="flex items-center gap-2">
          <span class="text-green-500">&#10003;</span>
          Full song karaoke practice
        </li>
        <li class="flex items-center gap-2">
          <span class="text-green-500">&#10003;</span>
          Word-by-word lyrics timing
        </li>
        <li class="flex items-center gap-2">
          <span class="text-green-500">&#10003;</span>
          Lifetime access
        </li>
      </ul>

      {/* Price */}
      <div class="flex flex-col items-center gap-1 p-6 rounded-2xl bg-white/5 border border-white/10">
        <span class="text-2xl font-bold">{price().toFixed(2)} USDC</span>
        <Show when={currency() !== 'USD'}>
          <span class="text-lg text-muted-foreground">{formatLocal(price())}</span>
        </Show>
      </div>
    </div>
  )

  return (
    <PurchaseDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Buy Song"
      subtitle="Get lifetime access to the full song."
      currentStep={props.currentStep}
      statusMessage={props.statusMessage}
      errorMessage={props.errorMessage}
      onPurchase={props.onPurchase}
      onRetry={props.onRetry}
      idleContent={idleContent}
      actionText="Purchase"
      successMessage={`${props.songTitle} purchased! Start practicing now.`}
      headerIcon={<MusicNote class="w-6 h-6 text-primary" />}
    />
  )
}
