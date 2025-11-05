/**
 * GRC-20 Integration Configuration
 */

export const config = {
  // Network
  network: (process.env.GRC20_NETWORK as 'TESTNET' | 'MAINNET') || 'TESTNET',

  // Neon Database
  neonProjectId: process.env.NEON_PROJECT_ID || 'plain-wave-99802895',
  neonConnectionString: process.env.DATABASE_URL,

  // Wallet (for signing transactions)
  privateKey: process.env.PRIVATE_KEY,

  // GRC-20 Space (create via script or manually)
  spaceId: process.env.GRC20_SPACE_ID,

  // Batching configuration
  batchSize: parseInt(process.env.BATCH_SIZE || '50'),  // Entities per edit
  maxGasPerEdit: 15000,  // Max gas per edit (safety margin)

  // Grove configuration
  groveGateway: process.env.GROVE_GATEWAY || 'https://api.grove.storage',

  // API endpoints
  graphApiOrigin: process.env.GRC20_NETWORK === 'MAINNET'
    ? 'https://api.geobrowser.io'
    : 'https://api-testnet.geobrowser.io',
} as const;

// Validate required config
export function validateConfig() {
  const required = [
    'neonConnectionString',
    'privateKey',
  ];

  const missing = required.filter(key => !config[key as keyof typeof config]);

  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }

  if (!config.spaceId) {
    console.warn('⚠️  No GRC20_SPACE_ID set. Run setup script to create a space.');
  }
}

// Export type-safe config
export type Config = typeof config;
