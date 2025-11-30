/**
 * PremiumUpgradeDialog
 * Dialog for upgrading to premium AI chat features
 * - Better AI model (zai-org-glm-4.6)
 * - Better TTS (ElevenLabs v3 expressive)
 */

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle, Sparkle, Brain, SpeakerHigh, Play, Stop } from '@phosphor-icons/react'

type UpgradeStep = 'idle' | 'approving' | 'purchasing' | 'complete' | 'error'

export interface PremiumUpgradeDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void
  /** Current upgrade step */
  currentStep: UpgradeStep
  /** Whether currently processing */
  isProcessing?: boolean
  /** Status message for current step */
  statusMessage?: string
  /** Error message */
  errorMessage?: string
  /** Called when user clicks Upgrade button */
  onUpgrade?: () => void
  /** Called when user clicks Retry after error */
  onRetry?: () => void
}

export function PremiumUpgradeDialog({
  open,
  onOpenChange,
  currentStep,
  isProcessing = false,
  statusMessage = '',
  errorMessage = '',
  onUpgrade,
  onRetry,
}: PremiumUpgradeDialogProps) {
  const isComplete = currentStep === 'complete'
  const isError = currentStep === 'error'
  const isIdle = currentStep === 'idle'

  // Audio preview state
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePreviewClick = () => {
    if (isPlayingPreview) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      setIsPlayingPreview(false)
    } else {
      // Start playing
      if (!audioRef.current) {
        audioRef.current = new Audio('/audio/upgrade-tts.mp3')
        audioRef.current.onended = () => setIsPlayingPreview(false)
      }
      audioRef.current.play()
      setIsPlayingPreview(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkle className="w-6 h-6 text-yellow-500" weight="fill" />
            Premium AI
          </DialogTitle>
          <p className="text-base text-muted-foreground">
            {isComplete
              ? 'Welcome to Premium!'
              : 'Unlock smarter AI and natural voices.'}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-6">
          {/* Idle State - Show features and upgrade button */}
          {isIdle && (
            <div className="space-y-6">
              {/* Features */}
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border">
                  <Brain className="w-6 h-6 text-purple-500 flex-shrink-0 mt-0.5" weight="duotone" />
                  <div>
                    <p className="font-medium">Smarter AI Model</p>
                    <p className="text-sm text-muted-foreground">
                      Advanced reasoning and more natural conversations
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border">
                  <SpeakerHigh className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" weight="duotone" />
                  <div className="flex-1">
                    <p className="font-medium">Premium Voice</p>
                    <p className="text-sm text-muted-foreground">
                      Expressive voice with realistic emotions
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviewClick}
                      className="mt-2 gap-1.5"
                    >
                      {isPlayingPreview ? (
                        <>
                          <Stop className="w-4 h-4" weight="fill" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" weight="fill" />
                          Preview
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Price Display */}
              <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-muted/30 border border-border">
                <div className="text-center">
                  <div className="flex items-baseline gap-2 justify-center">
                    <span className="text-4xl font-bold">0.001 ETH</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Base Sepolia
                  </div>
                </div>
              </div>

              {/* Upgrade Button */}
              <Button
                onClick={onUpgrade}
                disabled={isProcessing}
                className="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                {isProcessing && <Spinner size="sm" />}
                Upgrade
              </Button>
            </div>
          )}

          {/* Processing State - Show spinner and status */}
          {(currentStep === 'approving' || currentStep === 'purchasing') && (
            <div className="space-y-4 py-8">
              <div className="flex flex-col items-center gap-4">
                <Spinner className="w-12 h-12" />
                {statusMessage && (
                  <p className="text-base text-center text-muted-foreground">
                    {statusMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="space-y-4">
              <div className="text-base text-center p-4 bg-destructive/10 text-destructive rounded-lg break-words" style={{ overflowWrap: 'anywhere' }}>
                {errorMessage || 'Transaction failed. Please try again.'}
              </div>

              <Button
                onClick={onRetry}
                className="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Complete State */}
          {isComplete && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" weight="fill" />
                <p className="text-base text-muted-foreground">
                  You now have access to premium AI features!
                </p>
              </div>

              <Button
                onClick={() => onOpenChange(false)}
                className="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
