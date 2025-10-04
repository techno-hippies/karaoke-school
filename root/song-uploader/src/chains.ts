import { defineChain } from 'viem';

/**
 * Lens Chain Testnet (zkSync-based)
 */
export const lensTestnet = defineChain({
  id: 37111,
  name: 'Lens Chain Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.lens.xyz']
    },
    public: {
      http: ['https://rpc.testnet.lens.xyz']
    }
  },
  blockExplorers: {
    default: {
      name: 'Lens Explorer',
      url: 'https://explorer.testnet.lens.xyz'
    }
  },
  testnet: true
});
