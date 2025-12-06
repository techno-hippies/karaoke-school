/**
 * Web3 Provider for SolidJS
 *
 * Provides wagmi context for EOA wallet connections.
 * Uses WalletConnect modal for wallet selection.
 */

import { type ParentComponent, onCleanup } from 'solid-js'
import { createConfig, http, reconnect } from '@wagmi/core'
import { baseSepolia } from '@wagmi/core/chains'
import { injected, walletConnect } from '@wagmi/connectors'

// WalletConnect project ID - get one at https://cloud.walletconnect.com
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

// Create wagmi config
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
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

// Re-export wagmi core functions for use in components
export {
  connect,
  disconnect,
  getAccount,
  getWalletClient,
  watchAccount,
  type GetAccountReturnType,
} from '@wagmi/core'
