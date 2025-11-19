
import { createPublicClient, http, formatEther } from 'viem';
import { defineChain } from 'viem';

const LENS_TESTNET = defineChain({
  id: 37111,
  name: 'Lens Testnet',
  network: 'lens-testnet',
  nativeCurrency: { name: 'GRASS', symbol: 'GRASS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.lens.xyz'] },
  },
});

async function checkBalance() {
  const address = '0x3e89ABa33562d4C45E62A97Aa11443F738983bFf';
  const client = createPublicClient({
    chain: LENS_TESTNET,
    transport: http(),
  });

  const balance = await client.getBalance({ address });
  console.log(`Address: ${address}`);
  console.log(`Balance: ${formatEther(balance)} GRASS`);
}

checkBalance();
