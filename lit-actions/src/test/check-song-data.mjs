import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const contractAddress = '0x422f686f5CdFB48d962E1D7E0F5035D286a1ccAa';

const abi = [
  {
    name: 'getSongByGeniusId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusId', type: 'uint32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'string' },
          { name: 'geniusId', type: 'uint32' },
          { name: 'title', type: 'string' },
          { name: 'artist', type: 'string' },
          { name: 'duration', type: 'uint32' },
          { name: 'hasFullAudio', type: 'bool' },
          { name: 'requiresPayment', type: 'bool' },
          { name: 'audioUri', type: 'string' },
          { name: 'metadataUri', type: 'string' },
          { name: 'coverUri', type: 'string' },
          { name: 'thumbnailUri', type: 'string' },
          { name: 'musicVideoUri', type: 'string' },
          { name: 'enabled', type: 'bool' },
          { name: 'addedAt', type: 'uint64' },
        ],
      },
    ],
  }
];

const geniusId = process.argv[2] || 378195;
const contract = new ethers.Contract(contractAddress, abi, provider);
const song = await contract.getSongByGeniusId(geniusId);

console.log(`\n=== Song ${geniusId} ===`);
console.log('Title:', song.title);
console.log('Artist:', song.artist);
console.log('Metadata URI:', song.metadataUri);
console.log('Audio URI:', song.audioUri);
console.log('Cover URI:', song.coverUri);
console.log('Thumbnail URI:', song.thumbnailUri);
console.log('Requires Payment:', song.requiresPayment);
