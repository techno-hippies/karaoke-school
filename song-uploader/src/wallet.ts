import { createWalletClient, http, type WalletClient } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export interface WalletConfig {
  privateKey: string;
  useTestnet?: boolean;
  rpcUrl?: string;
}

/**
 * Create a wallet client for signing Grove operations
 * Can use private key directly or connect to Ledger (future enhancement)
 */
export function createWallet(config: WalletConfig): WalletClient {
  const account = privateKeyToAccount(config.privateKey as `0x${string}`);

  const chain = config.useTestnet ? baseSepolia : base;
  const transport = http(config.rpcUrl || chain.rpcUrls.default.http[0]);

  return createWalletClient({
    account,
    chain,
    transport,
  });
}

/**
 * Get wallet configuration from environment variables
 */
export function getWalletConfig(): WalletConfig {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required. Make sure to run with dotenvx.');
  }

  // Check if it's still encrypted (dotenvx didn't decrypt it)
  if (privateKey.startsWith('encrypted:')) {
    throw new Error('PRIVATE_KEY is still encrypted. Run with: DOTENV_PRIVATE_KEY=your_key dotenvx run -- bun run upload');
  }

  // Ensure private key has 0x prefix and is 64 hex chars
  let formattedKey = privateKey.trim();
  if (!formattedKey.startsWith('0x')) {
    formattedKey = '0x' + formattedKey;
  }

  if (formattedKey.length !== 66) {
    throw new Error(`PRIVATE_KEY must be 64 hex characters (32 bytes), got ${formattedKey.length} chars`);
  }

  return {
    privateKey: formattedKey,
    useTestnet: true, // Use testnet for now
    rpcUrl: process.env.BASE_RPC_URL,
  };
}

/**
 * Initialize wallet from environment
 */
export function initializeWallet(): WalletClient {
  const config = getWalletConfig();
  return createWallet(config);
}