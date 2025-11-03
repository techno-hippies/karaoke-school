/**
 * GRC-20 v2 Configuration
 * Songverse v2 - Complete music metadata graph
 */

import { Graph } from '@graphprotocol/grc-20';

export const config = {
  // Network (TESTNET or MAINNET)
  network: (process.env.GRC20_NETWORK || 'TESTNET') as 'TESTNET' | 'MAINNET',

  // Wallet private key (from .env) - use same as PKP minting
  privateKey: process.env.PRIVATE_KEY,

  // Database
  neonConnectionString: process.env.DATABASE_URL,

  // Space ID (set after creation)
  spaceId: process.env.GRC20_SPACE_ID_V2,

  // API endpoint
  get graphApiOrigin() {
    return this.network === 'TESTNET'
      ? Graph.TESTNET_API_ORIGIN
      : Graph.MAINNET_API_ORIGIN;
  },
};

// Validate required env vars
export function validateConfig() {
  const required = {
    PRIVATE_KEY: config.privateKey,
    DATABASE_URL: config.neonConnectionString,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
