/**
 * Lit Action Configuration
 *
 * Centralized configuration for all Lit Actions deployed to IPFS
 *
 * Networks:
 * - Lens Chain Testnet: Chain ID 37111
 * - Ethereum Mainnet: Chain ID 1
 */

export const LIT_ACTIONS = {
  /**
   * Speech-to-Text / Karaoke Scorer
   */
  stt: {
    // Production - Karaoke Scorer v3 (Simplified)
    karaokeScorer: {
      cid: 'QmS3Q7pcRXvb12pB2e681YMq1BWqyGY5MUdzT8sFEs4rzs',
      version: 'v3',
      network: 'lens-testnet',
      chainId: 37111,
      description: 'Karaoke scoring with on-chain clip registry',
      contracts: {
        scoreboard: '0xD4A9c232982Bb25299E9F62128617DAC5099B059', // V2 with top-10 leaderboard
        clipRegistry: '0x59fCAe6753041C7b2E2ad443e4F2342Af46b81bf',
      },
      pkp: '0x254AA0096C9287a03eE62b97AA5643A2b8003657',
    },
    // Basic STT (no scoring)
    free: {
      cid: 'QmS3Q7pcRXvb12pB2e681YMq1BWqyGY5MUdzT8sFEs4rzs', // TODO: Upload dedicated free version
      version: 'v8',
      network: 'ethereum',
      description: 'Basic speech-to-text transcription',
    },
  },

  /**
   * Genius Search
   */
  search: {
    // Free version with exposed API key (v8 jsParams pattern)
    free: {
      cid: 'QmQ721ZFN4zwTkQ4DXXCzTdWzWF5dBQTRbjs2LMdjnN4Fj',
      version: 'free-v8',
      network: 'ethereum',
      description: 'Search Genius API for songs (v8 jsParams)',
      geniusApiKeyExposed: true, // API key is in the code
    },
  },
} as const;

export type LitActionConfig = {
  cid: string;
  version: string;
  network: string;
  chainId?: number;
  description: string;
  contracts?: Record<string, string>;
  pkp?: string;
  geniusApiKeyExposed?: boolean;
};

/**
 * Helper to get a lit action config by path
 * @example getLitAction('stt', 'karaokeScorer')
 */
export function getLitAction(category: keyof typeof LIT_ACTIONS, name: string): LitActionConfig | undefined {
  return (LIT_ACTIONS[category] as any)?.[name];
}

/**
 * Gateway URLs for IPFS
 */
export const IPFS_GATEWAYS = {
  pinata: 'https://gateway.pinata.cloud/ipfs/',
  cloudflare: 'https://cloudflare-ipfs.com/ipfs/',
  ipfs: 'https://ipfs.io/ipfs/',
} as const;

/**
 * Get IPFS gateway URL for a CID
 */
export function getIpfsUrl(cid: string, gateway: keyof typeof IPFS_GATEWAYS = 'pinata'): string {
  return `${IPFS_GATEWAYS[gateway]}${cid}`;
}
