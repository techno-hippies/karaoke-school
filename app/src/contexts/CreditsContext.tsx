/**
 * Credits Context
 * Manages karaoke credits (separate from core auth)
 *
 * Responsibilities:
 * - Load credit balance from KaraokeCredits contract
 * - Auto-refresh when PKP wallet connects
 * - Provide credit state to consumers
 *
 * Depends on: PKP wallet address
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Address } from 'viem'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'

interface CreditsContextType {
  credits: number
  isLoading: boolean
  error: Error | null
  loadCredits: () => Promise<void>
}

const CreditsContext = createContext<CreditsContextType | null>(null)

interface CreditsProviderProps {
  children: ReactNode
  pkpAddress: Address | null
  isConnected: boolean
}

/**
 * Credits Provider
 * Loads and tracks credit balance from smart contract
 */
export function CreditsProvider({ children, pkpAddress, isConnected }: CreditsProviderProps) {
  const [credits, setCredits] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Load credit balance from smart contract
   */
  const loadCredits = async () => {
    if (!isConnected || !pkpAddress) {
      setCredits(0)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { createPublicClient, http } = await import('viem')
      const { baseSepolia } = await import('viem/chains')

      const contractAddress = BASE_SEPOLIA_CONTRACTS.karaokeCredits

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
        args: [pkpAddress],
      })

      setCredits(Number(data))
    } catch (err) {
      console.error('[Credits] Failed to load credits:', err)
      const errorObj = err instanceof Error ? err : new Error('Failed to load credits')
      setError(errorObj)
      setCredits(0)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Auto-load credits when PKP wallet connects
   */
  useEffect(() => {
    if (isConnected && pkpAddress) {
      loadCredits()
    } else {
      setCredits(0)
    }
  }, [isConnected, pkpAddress])

  const value: CreditsContextType = {
    credits,
    isLoading,
    error,
    loadCredits,
  }

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>
}

/**
 * Hook to access credits context
 */
export function useCredits() {
  const context = useContext(CreditsContext)
  if (!context) {
    throw new Error('useCredits must be used within CreditsProvider')
  }
  return context
}
