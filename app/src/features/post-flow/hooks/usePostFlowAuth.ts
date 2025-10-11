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
    registerWithPasskey,
    signInWithPasskey,
    loginLens,
  } = useAuth()

  const [credits, setCredits] = useState<number>(0)
  const [isLoadingCredits, setIsLoadingCredits] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load credit balance from smart contract
   */
  const loadCredits = async () => {
    if (!isPKPReady || !pkpWalletClient || !pkpAddress) {
      setCredits(0)
      return
    }

    setIsLoadingCredits(true)
    setError(null)

    try {
      const { createPublicClient, http } = await import('viem')
      const { baseSepolia } = await import('viem/chains')

      const contractAddress = import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT as `0x${string}`
      const address = pkpAddress

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      const data = await publicClient.readContract({
        address: contractAddress,
        abi: [{
          name: 'getCredits',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'user', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'getCredits',
        args: [address],
      })

      setCredits(Number(data))
      console.log('[PostFlowAuth] Credits loaded:', data)
    } catch (err) {
      console.error('[PostFlowAuth] Failed to load credits:', err)
      setError('Failed to load credit balance')
      setCredits(0)
    } finally {
      setIsLoadingCredits(false)
    }
  }

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

      // Step 2: Login to Lens if needed
      if (!hasLensAccount) {
        console.log('[PostFlowAuth] Logging in to Lens...')
        await loginLens()
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Step 3: Load credits
      await loadCredits()

      return true
    } catch (err) {
      console.error('[PostFlowAuth] Initialization failed:', err)
      setError(err instanceof Error ? err.message : 'Authentication failed')
      return false
    }
  }

  /**
   * Validate all auth requirements
   * PKP auth context is automatically created, enabling zero-sig Lit Actions
   */
  const validateAuth = (): PostFlowAuthStatus => {
    const isReady = isPKPReady && hasLensAccount

    return {
      isWalletConnected: isPKPReady,
      hasLensAccount,
      isLitReady: true, // PKP auth context enables zero-sig Lit Actions
      hasCredits: credits > 0,
      credits,
      isReady,
      error,
    }
  }

  /**
   * Reload credits (after purchase)
   */
  const reloadCredits = async () => {
    await loadCredits()
  }

  // Load credits when PKP wallet connects
  useEffect(() => {
    if (isPKPReady && pkpWalletClient) {
      loadCredits()
    }
  }, [isPKPReady, pkpWalletClient])

  return {
    // Status
    auth: validateAuth(),
    isLoadingCredits,

    // Actions
    initializeAuth,
    loadCredits,
    reloadCredits,
    registerWithPasskey,
    signInWithPasskey,
    loginLens,
  }
}
