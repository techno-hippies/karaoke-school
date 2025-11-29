import { ethers } from 'ethers';

// PKP public key from lit action
const PKP_PUBLIC_KEY = '0x043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939';

// Derive Ethereum address from uncompressed public key
const pkpAddress = ethers.computeAddress(PKP_PUBLIC_KEY);

console.log('PKP Public Key:', PKP_PUBLIC_KEY);
console.log('PKP Ethereum Address:', pkpAddress);
