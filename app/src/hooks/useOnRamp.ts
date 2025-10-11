/**
 * On-Ramp Hook
 * TODO: Implement on-ramp functionality (Particle removed)
 */

import { useCallback } from 'react'

export function useOnRamp() {
  /**
   * Open on-ramp to buy USDC
   * TODO: Implement replacement for Particle on-ramp
   */
  const openBuyUSDC = useCallback(() => {
    console.warn('[OnRamp] On-ramp functionality not implemented (Particle removed)')
    // TODO: Implement on-ramp provider (e.g., Coinbase On-Ramp, Transak, etc.)
  }, [])

  return {
    openBuyUSDC,
  }
}
