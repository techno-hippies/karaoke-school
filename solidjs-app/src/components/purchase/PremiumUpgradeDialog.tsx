/**
 * PremiumUpgradeDialog
 * Subscription dialog for premium AI chat features (Unlock Protocol)
 * - Better AI model
 * - Premium TTS voice
 */

import { createSignal, onCleanup, type Component } from 'solid-js'
import { PurchaseDialog } from './PurchaseDialog'
import { Sparkle, SpeakerHigh, Play, Stop } from '@/components/icons'
import type { PurchaseStep } from './types'

export interface PremiumUpgradeDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void

  /** Current upgrade step */
  currentStep: PurchaseStep
  /** Status message during processing */
  statusMessage?: string
  /** Error message if upgrade fails */
  errorMessage?: string

  /** Price in ETH (default: 0.001) */
  priceEth?: number
  /** Price display text (optional, overrides priceEth) */
  priceDisplay?: string

  /** Called when user initiates upgrade */
  onUpgrade?: () => void
  /** Called when user retries after error */
  onRetry?: () => void

  /** URL to audio preview file */
  previewAudioUrl?: string
}

export const PremiumUpgradeDialog: Component<PremiumUpgradeDialogProps> = (props) => {
  const [isPlaying, setIsPlaying] = createSignal(false)
  let audioRef: HTMLAudioElement | null = null

  const handlePreviewClick = () => {
    if (!props.previewAudioUrl) return

    if (isPlaying()) {
      audioRef?.pause()
      if (audioRef) audioRef.currentTime = 0
      setIsPlaying(false)
    } else {
      if (!audioRef) {
        audioRef = new Audio(props.previewAudioUrl)
        audioRef.onended = () => setIsPlaying(false)
      }
      audioRef.play()
      setIsPlaying(true)
    }
  }

  // Cleanup audio on unmount
  onCleanup(() => {
    audioRef?.pause()
    audioRef = null
  })

  const priceText = () => props.priceDisplay ?? `${props.priceEth ?? 0.001} ETH`

  const idleContent = (
    <div class="space-y-4">
      {/* Features */}
      <div class="space-y-3">
        <div class="flex items-start gap-3 p-4 rounded-2xl bg-muted/30">
          <Sparkle class="w-6 h-6 text-purple-500 flex-shrink-0 mt-0.5" weight="fill" />
          <div>
            <p class="font-medium">Smarter AI Tutor</p>
            <p class="text-sm text-muted-foreground">
              Advanced language model for better conversations and explanations.
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3 p-4 rounded-2xl bg-muted/30">
          <SpeakerHigh class="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
          <div class="flex-1">
            <p class="font-medium">Premium Voice</p>
            <p class="text-sm text-muted-foreground">
              Natural, expressive text-to-speech for immersive learning.
            </p>
            {props.previewAudioUrl && (
              <button
                type="button"
                onClick={handlePreviewClick}
                class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-secondary/50 hover:bg-secondary/70 transition-colors"
              >
                {isPlaying() ? (
                  <>
                    <Stop class="w-4 h-4" weight="fill" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play class="w-4 h-4" weight="fill" />
                    Preview
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Price */}
      <div class="flex flex-col items-center gap-1 p-6 rounded-2xl bg-muted/30">
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold">{priceText()}</span>
          <span class="text-sm text-muted-foreground">/ month</span>
        </div>
        <span class="text-xs text-muted-foreground">Base Sepolia</span>
      </div>
    </div>
  )

  return (
    <PurchaseDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Premium AI"
      subtitle="Upgrade your learning experience."
      currentStep={props.currentStep}
      statusMessage={props.statusMessage}
      errorMessage={props.errorMessage}
      onPurchase={props.onUpgrade}
      onRetry={props.onRetry}
      idleContent={idleContent}
      actionText="Subscribe"
      successMessage="Welcome to Premium! Enjoy your enhanced AI tutor."
      headerIcon={<Sparkle class="w-6 h-6 text-yellow-500" weight="fill" />}
    />
  )
}
