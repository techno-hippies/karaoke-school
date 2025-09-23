/**
 * Configuration for different environments
 */

export const config = {
  development: {
    viewVerifierAddress: '0x931AaA75A23256e6D1a4261DD3D9b224aBA289B9',
    rpcUrl: 'https://sepolia.base.org',
    subgraphUrl: 'http://localhost:8000/subgraphs/name/tiktok-views',
    litNetwork: 'datil-dev',
    pkpAddress: '0xF821308B2FEf3505A8dCD9129923125481632Be0',
    litActionCid: 'QmSSEvVHq4JMkYGfhbVxHnU68VK2hoMxbrj2jtB7WGRkr6'
  },
  
  testnet: {
    viewVerifierAddress: '0x931AaA75A23256e6D1a4261DD3D9b224aBA289B9',
    rpcUrl: 'https://sepolia.base.org',
    subgraphUrl: 'https://api.studio.thegraph.com/query/YOUR_ID/tiktok-views/v0.0.1',
    litNetwork: 'datil-dev',
    pkpAddress: '0xF821308B2FEf3505A8dCD9129923125481632Be0',
    litActionCid: 'QmSSEvVHq4JMkYGfhbVxHnU68VK2hoMxbrj2jtB7WGRkr6'
  },
  
  production: {
    viewVerifierAddress: '0x0000000000000000000000000000000000000000', // Deploy to Base mainnet
    rpcUrl: 'https://mainnet.base.org',
    subgraphUrl: 'https://api.thegraph.com/subgraphs/name/YOUR_NAME/tiktok-views',
    litNetwork: 'habanero', // Mainnet LIT
    pkpAddress: '0x0000000000000000000000000000000000000000', // Mint on mainnet
    litActionCid: 'Qm0000000000000000000000000000000000000000' // Upload final version
  }
};

export function getConfig(environment: 'development' | 'testnet' | 'production' = 'development') {
  return config[environment];
}

// Chain configurations
export const chains = {
  baseSepolia: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    }
  },
  base: {
    id: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    }
  },
  chronicleYellowstone: {
    id: 175177,
    name: 'Chronicle Yellowstone',
    rpcUrl: 'https://chain-rpc.litprotocol.com/http',
    explorer: 'https://explorer.litprotocol.com',
    nativeCurrency: {
      name: 'LIT',
      symbol: 'LIT',
      decimals: 18
    }
  }
};

// ABIs
export const ViewVerifierABI = [{"type":"constructor","inputs":[{"name":"_registry","type":"address","internalType":"address"},{"name":"_litPubkey","type":"address","internalType":"address"}],"stateMutability":"nonpayable"},{"type":"function","name":"verifyView","inputs":[{"name":"proofData","type":"bytes","internalType":"bytes"},{"name":"sig","type":"bytes","internalType":"bytes"},{"name":"playbackId","type":"string","internalType":"string"},{"name":"wallet","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"verifyViewSimple","inputs":[{"name":"playbackId","type":"string","internalType":"string"},{"name":"wallet","type":"address","internalType":"address"},{"name":"verifiedTime","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"event","name":"ViewVerified","inputs":[{"name":"playbackId","type":"string","indexed":true,"internalType":"string"},{"name":"wallet","type":"address","indexed":true,"internalType":"address"},{"name":"verifiedTime","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"proofData","type":"bytes","indexed":false,"internalType":"bytes"}],"anonymous":false}];