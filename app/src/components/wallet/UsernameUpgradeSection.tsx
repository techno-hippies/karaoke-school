import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Item } from '@/components/ui/item'
import { Check, X } from '@phosphor-icons/react'

export interface UsernameUpgradeSectionProps {
  currentUsername?: string
  onPurchase?: (username: string) => Promise<boolean>
  onCheckAvailability?: (username: string) => Promise<boolean>
}

/**
 * Calculate username price based on length
 * Shorter names are more expensive (like ENS pricing)
 */
function calculatePrice(username: string): number {
  const length = username.length
  if (length <= 3) return 100 // 3 chars: $100
  if (length === 4) return 50  // 4 chars: $50
  if (length === 5) return 20  // 5 chars: $20
  return 10 // 6+ chars: $10
}

/**
 * UsernameUpgradeSection - Vanity handle purchase interface
 *
 * Features:
 * - Real-time availability checking
 * - Dynamic pricing based on length
 * - Validation for format and length
 * - Visual feedback for availability
 */
export function UsernameUpgradeSection({
  currentUsername,
  onPurchase,
  onCheckAvailability,
}: UsernameUpgradeSectionProps) {
  const [username, setUsername] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [isPurchasing, setIsPurchasing] = useState(false)

  // Check availability when username changes (debounced)
  useEffect(() => {
    if (!username || username.length < 3) {
      setIsAvailable(null)
      return
    }

    // Validate format
    if (!/^[a-z0-9]+$/.test(username)) {
      setIsAvailable(null)
      return
    }

    const timer = setTimeout(async () => {
      setIsChecking(true)
      try {
        // Call availability check handler if provided
        const available = onCheckAvailability
          ? await onCheckAvailability(username)
          : Math.random() > 0.3 // Mock: 70% available

        setIsAvailable(available)
      } catch (error) {
        console.error('Error checking availability:', error)
        setIsAvailable(null)
      } finally {
        setIsChecking(false)
      }
    }, 500) // Debounce 500ms

    return () => clearTimeout(timer)
  }, [username, onCheckAvailability])

  const handlePurchase = async () => {
    if (!isAvailable || !username || isPurchasing) return

    setIsPurchasing(true)
    try {
      const success = onPurchase
        ? await onPurchase(username)
        : true // Mock success

      if (success) {
        // Success handled by parent component
        setUsername('')
        setIsAvailable(null)
      }
    } catch (error) {
      console.error('Error purchasing username:', error)
    } finally {
      setIsPurchasing(false)
    }
  }

  const price = username.length >= 3 ? calculatePrice(username) : 0
  const isValid = username.length >= 3 && /^[a-z0-9]+$/.test(username)

  return (
    <Item variant="muted" className="flex-col items-stretch">
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Upgrade Username
      </h3>
      <p className="text-base text-muted-foreground mb-4">
        {currentUsername
          ? `Current: @${currentUsername}. Purchase a new vanity handle.`
          : 'Get a memorable vanity handle for your profile.'
        }
      </p>

      <div className="space-y-3">
        {/* Username Input */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base text-muted-foreground">@</span>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="username"
              pattern="[a-z0-9]+"
              minLength={3}
              maxLength={26}
              disabled={isPurchasing}
              className="flex-1 text-base"
            />
          </div>

          {/* Availability Status */}
          {username.length > 0 && (
            <div className="flex items-center gap-2 text-base">
              {isChecking ? (
                <span className="text-muted-foreground">Checking...</span>
              ) : !isValid ? (
                <div className="flex items-center gap-2 text-red-500">
                  <X className="w-4 h-4" weight="bold" />
                  <span>3-26 characters, lowercase letters and numbers only</span>
                </div>
              ) : isAvailable === true ? (
                <div className="flex items-center gap-2 text-green-500">
                  <Check className="w-4 h-4" weight="bold" />
                  <span>Available</span>
                </div>
              ) : isAvailable === false ? (
                <div className="flex items-center gap-2 text-red-500">
                  <X className="w-4 h-4" weight="bold" />
                  <span>Unavailable</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Price Display */}
        {isValid && (
          <div className="flex items-center gap-2 text-base">
            <span className="text-muted-foreground">Price:</span>
            <span className="font-semibold text-foreground">${price} USDC</span>
          </div>
        )}

        {/* Purchase Button */}
        <Button
          onClick={handlePurchase}
          disabled={!isAvailable || isPurchasing || !isValid}
          size="lg"
          className="w-full"
        >
          {isPurchasing ? 'Processing...' : 'Purchase'}
        </Button>
      </div>
    </Item>
  )
}
