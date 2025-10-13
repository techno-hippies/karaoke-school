import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const contractAddress = '0x422f686f5CdFB48d962E1D7E0F5035D286a1ccAa';

const abi = [
  {
    name: 'songExistsByGeniusId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusId', type: 'uint32' }],
    outputs: [{ name: '', type: 'bool' }],
  }
];

const contract = new ethers.Contract(contractAddress, abi, provider);

// Test a few songs
const testIds = [2165830, 5108762, 12325692];

for (const id of testIds) {
  const exists = await contract.songExistsByGeniusId(id);
  const status = exists ? 'EXISTS' : 'NOT IN CONTRACT ✅';
  console.log('Genius ID ' + id + ': ' + status);
}
