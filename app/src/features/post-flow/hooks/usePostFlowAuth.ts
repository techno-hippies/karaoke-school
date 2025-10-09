/**
 * Post Flow Auth Hook
 * Validates and manages authentication requirements for the post flow
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { PostFlowAuthStatus } from '../types'

export function usePostFlowAuth() {
  const {
    isWalletConnected,
    hasLensAccount,
    litReady,
    walletClient,
    connectWallet,
    loginLens,
    initializeLit,
  } = useAuth()

  const [credits, setCredits] = useState<number>(0)
  const [isLoadingCredits, setIsLoadingCredits] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load credit balance from smart contract
   */
  const loadCredits = async () => {
    if (!isWalletConnected || !walletClient) {
      setCredits(0)
      return
    }

    setIsLoadingCredits(true)
    setError(null)

    try {
      const { createPublicClient, http } = await import('viem')
      const { baseSepolia } = await import('viem/chains')

      const contractAddress = import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT as `0x${string}`
      const [address] = await walletClient.getAddresses()

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
   */
  const initializeAuth = async (): Promise<boolean> => {
    setError(null)

    try {
      // Step 1: Connect wallet
      if (!isWalletConnected) {
        console.log('[PostFlowAuth] Connecting wallet...')
        await connectWallet()
        // Wait for wallet to connect
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Step 2: Login to Lens
      if (!hasLensAccount) {
        console.log('[PostFlowAuth] Logging in to Lens...')
        await loginLens()
        // Wait for Lens login
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Step 3: Initialize Lit Protocol
      if (!litReady) {
        console.log('[PostFlowAuth] Initializing Lit Protocol...')
        await initializeLit()
      }

      // Step 4: Load credits
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
   */
  const validateAuth = (): PostFlowAuthStatus => {
    const isReady = isWalletConnected && hasLensAccount && litReady

    return {
      isWalletConnected,
      hasLensAccount,
      isLitReady: litReady,
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

  // Load credits when wallet connects
  useEffect(() => {
    if (isWalletConnected && walletClient) {
      loadCredits()
    }
  }, [isWalletConnected, walletClient])

  return {
    // Status
    auth: validateAuth(),
    isLoadingCredits,

    // Actions
    initializeAuth,
    loadCredits,
    reloadCredits,
    connectWallet,
    loginLens,
    initializeLit,
  }
}
