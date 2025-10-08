/**
 * Particle Wallet Hooks
 * React hooks for wallet interaction
 */

import { useAccount, useDisconnect, useModal } from '@particle-network/connectkit'
import { useWalletClient } from 'wagmi'
import type { Address } from 'viem'

/**
 * Main wallet hook
 * Provides wallet connection state and methods
 */
export function useParticleWallet() {
  const { address, isConnected, isConnecting, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: walletClient } = useWalletClient()
  const { setOpen } = useModal()

  return {
    // State
    address: address as Address | undefined,
    isConnected,
    isConnecting,
    chainId,
    walletClient,

    // Methods
    connect: () => setOpen(true), // Opens the ConnectKit modal
    disconnect,
  }
}

/**
 * Check if wallet is ready for transactions
 */
export function useWalletReady() {
  const { isConnected, walletClient } = useParticleWallet()
  return isConnected && !!walletClient
}
