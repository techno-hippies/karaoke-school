/**
 * Network Configuration
 *
 * Maps environments (testnet/mainnet) to:
 * - Unlock Protocol chain (where subscription locks are deployed)
 * - Lit Protocol network (for encryption)
 */

export type Environment = 'testnet' | 'mainnet';

export interface NetworkConfig {
  unlock: {
    chainId: number;
    chainName: string;
    rpcUrl: string;
  };
  lit: {
    network: string;
    // ACC chain identifier for Lit access control conditions
    accChain: string;
  };
}

export const NETWORKS: Record<Environment, NetworkConfig> = {
  testnet: {
    unlock: {
      chainId: 84532,
      chainName: 'base-sepolia',
      rpcUrl: 'https://sepolia.base.org',
    },
    lit: {
      network: 'naga-dev', // Can override with LIT_NETWORK env
      accChain: 'baseSepolia',
    },
  },
  mainnet: {
    unlock: {
      chainId: 8453,
      chainName: 'base',
      rpcUrl: 'https://mainnet.base.org',
    },
    lit: {
      network: 'naga-mainnet', // Future
      accChain: 'base',
    },
  },
} as const;

/**
 * Get current environment from ENV or default to testnet
 */
export function getEnvironment(): Environment {
  const env = process.env.NETWORK_ENV?.toLowerCase();
  if (env === 'mainnet') return 'mainnet';
  return 'testnet';
}

/**
 * Get network config for current environment
 */
export function getNetworkConfig(env?: Environment): NetworkConfig {
  const environment = env ?? getEnvironment();
  return NETWORKS[environment];
}

/**
 * Get Lit network, allowing LIT_NETWORK env to override
 */
export function getLitNetwork(env?: Environment): string {
  const litNetworkOverride = process.env.LIT_NETWORK?.toLowerCase();
  if (litNetworkOverride) {
    // Validate it's a valid naga network
    const validNetworks = ['naga-dev', 'naga-test', 'naga-staging', 'naga-mainnet'];
    if (validNetworks.includes(litNetworkOverride)) {
      return litNetworkOverride;
    }
    console.warn(`Invalid LIT_NETWORK="${litNetworkOverride}", using default`);
  }
  return getNetworkConfig(env).lit.network;
}

/**
 * Database column suffixes for environment-specific data
 */
export function getDbSuffix(env?: Environment): 'testnet' | 'mainnet' {
  return env ?? getEnvironment();
}
