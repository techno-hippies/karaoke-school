/**
 * Post Flow Auth Hook
 * Validates and manages authentication requirements for the post flow
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { PostFlowAuthStatus } from '../types'

export function usePostFlowAuth() {
  const {
    isPKPReady,
    hasLensAccount,
    pkpWalletClient,
    pkpAddress,
    credits,
    capabilities,
    registerWithPasskey,
    signInWithPasskey,
    loginLens,
  } = useAuth()

  const [isLoadingCredits, setIsLoadingCredits] = useState(false)
  const [error, setError] = useState<string | null>(null)


  /**
   * Initialize authentication (step by step)
   * User must sign in or register first (handled by AuthDialog)
   */
  const initializeAuth = async (): Promise<boolean> => {
    setError(null)

    try {
      // Step 1: PKP should already be ready (user signed in/registered)
      if (!isPKPReady) {
        console.log('[PostFlowAuth] PKP not ready - user needs to sign in')
        return false
      }

      // Step 2: Login to Lens if needed (optional - only for social features)
      if (!hasLensAccount) {
        console.log('[PostFlowAuth] Logging in to Lens (optional for social features)...')
        try {
          await loginLens()
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (lensError) {
          console.warn('[PostFlowAuth] Lens login failed (non-critical):', lensError)
          // Don't fail - user can still use PKP features
        }
      }

      return true
    } catch (err) {
      console.error('[PostFlowAuth] Initialization failed:', err)
      setError(err instanceof Error ? err.message : 'Authentication failed')
      return false
    }
  }

  /**
   * Validate auth requirements
   * Uses granular capabilities instead of single isReady flag
   */
  const validateAuth = (): PostFlowAuthStatus => {
    // Legacy isReady for backward compatibility (PKP + Lens)
    const isReady = isPKPReady && hasLensAccount

    return {
      isWalletConnected: isPKPReady,
      hasLensAccount,
      isLitReady: true, // PKP auth context enables zero-sig Lit Actions
      hasCredits: credits > 0,
      credits,
      isReady,
      error,
      capabilities, // Granular capabilities from AuthContext
    }
  }

  /**
   * Reload credits (after purchase)
   * Credits are managed in AuthContext, this is a no-op for compatibility
   */
  const reloadCredits = async () => {
    console.log('[PostFlowAuth] Credits auto-reload from AuthContext')
  }

  return {
    // Status
    auth: validateAuth(),
    isLoadingCredits,

    // Actions
    initializeAuth,
    reloadCredits,
    registerWithPasskey,
    signInWithPasskey,
    loginLens,
  }
}
