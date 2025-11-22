
import { createWalletClient, createPublicClient, http, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as dotenv from 'dotenv';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

dotenv.config({ path: join(ROOT_DIR, '.env') });

const LENS_TESTNET = defineChain({
  id: 37111,
  name: 'Lens Testnet',
  network: 'lens-testnet',
  nativeCurrency: { name: 'GRASS', symbol: 'GRASS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.lens.xyz'] },
  },
});

const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832';
const KARAOKE_EVENTS_ADDRESS = '0x51aA6987130AA7E4654218859E075D8e790f4409';
const NEW_PKP_ADDRESS = '0x5CF2f231D15F3e71f997AAE0f3037ec3fafa8379';

const ABI = [
  {
    name: 'setTrustedPKP',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newPKP', type: 'address' }],
    outputs: [],
  },
  {
    name: 'trustedPKP',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  }
];

async function updatePermissions() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY not found');

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
  console.log(`👤 Admin Account: ${account.address}`);

  const wallet = createWalletClient({
    account,
    chain: LENS_TESTNET,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: LENS_TESTNET,
    transport: http(),
  });

  const updateContract = async (address, name) => {
    console.log(`\nChecking ${name} (${address})...`);
    const contract = getContract({ address, abi: ABI, client: { public: publicClient, wallet } });

    const owner = await contract.read.owner();
    if (owner.toLowerCase() !== account.address.toLowerCase()) {
        console.log(`❌ You are not the owner! Owner is: ${owner}`);
        return;
    }

    const currentPKP = await contract.read.trustedPKP();
    console.log(`   Current PKP: ${currentPKP}`);

    if (currentPKP.toLowerCase() === NEW_PKP_ADDRESS.toLowerCase()) {
        console.log('✅ Already updated.');
        return;
    }

    console.log(`🔄 Updating to ${NEW_PKP_ADDRESS}...`);
    const hash = await contract.write.setTrustedPKP([NEW_PKP_ADDRESS]);
    console.log(`   Tx Sent: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Confirmed!');
  };

  await updateContract(EXERCISE_EVENTS_ADDRESS, 'ExerciseEvents');
  await updateContract(KARAOKE_EVENTS_ADDRESS, 'KaraokeEvents');
}

updatePermissions().catch(console.error);
