/**
 * Web3 Provider for SolidJS
 *
 * Provides wagmi context for EOA wallet connections.
 * Uses WalletConnect modal for wallet selection.
 *
 * IMPORTANT: We support multiple chains (mainnet + baseSepolia) to allow
 * wallets to connect on any chain. Chain switching happens AFTER connection
 * via explicit user action, not automatically during connect().
 * This prevents Brave and other security-conscious wallets from blocking.
 */

import { type ParentComponent, onCleanup } from 'solid-js'
import { createConfig, http, reconnect, switchChain as wagmiSwitchChain } from '@wagmi/core'
import { mainnet, baseSepolia } from '@wagmi/core/chains'
import { injected, walletConnect } from '@wagmi/connectors'

// WalletConnect project ID - get one at https://cloud.walletconnect.com
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

// Target chain for the app
export const TARGET_CHAIN = baseSepolia
export const TARGET_CHAIN_ID = baseSepolia.id

// Create wagmi config with multiple chains
// This allows wallets to connect on any chain without forcing a switch
export const wagmiConfig = createConfig({
  chains: [mainnet, baseSepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'Karaoke School',
        description: 'Learn languages through music',
        url: 'https://karaoke.school',
        icons: ['https://karaoke.school/icon.png'],
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [baseSepolia.id]: http(),
  },
})

// Auto-reconnect on page load
reconnect(wagmiConfig)

/**
 * Web3Provider - Wraps app to provide wagmi context
 *
 * Note: Unlike React, SolidJS doesn't have wagmi hooks built-in.
 * We use @wagmi/core directly and create reactive wrappers.
 */
export const Web3Provider: ParentComponent = (props) => {
  // Clean up on unmount
  onCleanup(() => {
    // Disconnect all connectors on cleanup
    wagmiConfig.connectors.forEach((connector) => {
      connector.disconnect?.()
    })
  })

  return <>{props.children}</>
}

// Helper to switch to target chain
export async function switchToTargetChain(): Promise<boolean> {
  try {
    await wagmiSwitchChain(wagmiConfig, { chainId: TARGET_CHAIN_ID })
    return true
  } catch (error) {
    console.error('[Web3Provider] Failed to switch chain:', error)
    return false
  }
}

// Re-export wagmi core functions for use in components
export {
  connect,
  disconnect,
  getAccount,
  getWalletClient,
  watchAccount,
  type GetAccountReturnType,
} from '@wagmi/core'
