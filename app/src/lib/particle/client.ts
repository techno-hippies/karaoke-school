/**
 * Particle ConnectKit Client
 * Singleton instance for wallet connection
 */

import { ConnectKitProvider, createConfig } from '@particle-network/connectkit'
import { authWalletConnectors } from '@particle-network/auth-connectors'
import { evmWalletConnectors } from '@particle-network/evm-connectors'
import { baseSepolia } from 'viem/chains'
import { PARTICLE_CONFIG } from './config'

/**
 * Create config lazily to avoid initialization order issues
 */
let _particleConfig: ReturnType<typeof createConfig> | null = null

export function getParticleConfig() {
  if (!_particleConfig) {
    console.log('[Particle] Creating config with:', {
      projectId: PARTICLE_CONFIG.projectId,
      clientKey: PARTICLE_CONFIG.clientKey?.substring(0, 10) + '...',
      appId: PARTICLE_CONFIG.appId,
    })

    try {
      _particleConfig = createConfig({
        projectId: PARTICLE_CONFIG.projectId,
        clientKey: PARTICLE_CONFIG.clientKey,
        appId: PARTICLE_CONFIG.appId,

        appearance: {
          mode: 'dark',
          language: 'en-US',
          connectorsOrder: ['email', 'social', 'wallet'],
          theme: {
            '--pcm-accent-color': '#4F46E5',
          },
        },

        // Wallet connectors - use helper functions that return proper WalletConnector objects
        walletConnectors: [
          authWalletConnectors({
            // Supported: email, phone, google, apple, twitter, github, discord, microsoft, linkedin, twitch
            authTypes: ['email', 'apple', 'twitter', 'discord', 'github', 'microsoft', 'twitch', 'linkedin', 'google', 'phone'],
          }),
          evmWalletConnectors({
            metadata: {
              name: 'Karaoke School',
              description: 'Learn languages through karaoke',
              url: 'https://karaoke.school',
            },
            walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
          }),
        ],

        chains: [baseSepolia],
      })
      console.log('[Particle] Config created successfully')
    } catch (error) {
      console.error('[Particle] Failed to create config:', error)
      throw error
    }
  }
  return _particleConfig
}

// Export for backwards compatibility
export const particleConfig = getParticleConfig()

export { ConnectKitProvider }
