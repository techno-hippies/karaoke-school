/**
 * Configuration for Song Uploader
 * Loads from environment variables
 */

import '@dotenvx/dotenvx/config'

export const config = {
  // Contract Configuration (Base Sepolia)
  contract: {
    address: process.env.KARAOKE_CATALOG_ADDRESS as `0x${string}` || '0x40A2a5bbD54ebB5DB84252c542b4e1BebFf37454',
    chain: 'base-sepolia' as const,
    rpcUrl: 'https://sepolia.base.org',
  },

  // Wallet Configuration
  wallet: {
    privateKey: (process.env.PRIVATE_KEY?.startsWith('0x')
      ? process.env.PRIVATE_KEY
      : `0x${process.env.PRIVATE_KEY}`) as `0x${string}`,
  },

  // API Keys
  apis: {
    genius: process.env.GENIUS_API_KEY || '',
    elevenLabs: process.env.ELEVENLABS_API_KEY || '',
    openRouter: process.env.OPENROUTER_API_KEY || '',
  },

  // Upload Settings
  upload: {
    songsDir: './songs',
    maxSegments: 50,                    // Contract limit
    snippetDuration: 30,                 // 30 second previews
    storageNetwork: 'grove' as const,   // Grove storage on Lens mainnet
  },

  // Processing Options
  processing: {
    uploadToGenius: false,               // Upload to Genius to get geniusId (not implemented)
    separateStems: false,                // Run Demucs for stem separation (not implemented)
    useVocalsForAlignment: true,         // Use vocals-only file if available
  },
} as const

/**
 * Validate required environment variables
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.wallet.privateKey) {
    errors.push('PRIVATE_KEY environment variable is required')
  }

  if (!config.apis.elevenLabs) {
    errors.push('ELEVENLABS_API_KEY environment variable is required')
  }

  if (!config.apis.openRouter) {
    errors.push('OPENROUTER_API_KEY environment variable is required')
  }

  if (config.processing.uploadToGenius && !config.apis.genius) {
    errors.push('GENIUS_API_KEY required when uploadToGenius is enabled')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
