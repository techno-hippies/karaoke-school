#!/usr/bin/env bun
/**
 * Test Story Protocol minting with direct SDK call (like working implementation)
 */

import { StoryClient, StoryConfig, PILFlavor } from '@story-protocol/core-sdk';
import { http, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createHash } from 'crypto';

const privateKey = process.env.PRIVATE_KEY!;
const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
const account = privateKeyToAccount(formattedKey);

const config: StoryConfig = {
  account: account,
  transport: http('https://aeneid.storyrpc.io'),
  chainId: 1315,
};

const client = StoryClient.newClient(config);

console.log('✅ Connected to Story Protocol');
console.log(`   Wallet: ${account.address}`);
console.log(`   Chain ID: 1315\n`);

// Test metadata URI (one we just uploaded)
const metadataUri = 'https://api.grove.storage/61a4ebd60f9d76602f9c12c44a0bab66e6fe3eb97d6feb83b8bd5319b2925e4d';
const metadataHash = '0xe313f7fe2700bc69f85f56045b8046e928f35d01bcf6e21c8914ae8e9c6d9b01' as `0x${string}`;

const spgNftContract = '0x9b6b673f5CF4967b7f1E5999973173bd1933F923' as Address;
const recipient = '0x35376680E23ee88C8462d3BDa0963eb6989BD94c' as Address;
const currency = '0x1514000000000000000000000000000000000000' as Address;

console.log('📝 Minting with:');
console.log(`   SPG NFT: ${spgNftContract}`);
console.log(`   Recipient: ${recipient}`);
console.log(`   Metadata: ${metadataUri}`);
console.log(`   Metadata Hash: ${metadataHash}\n`);

try {
  const response = await client.ipAsset.registerIpAsset({
    nft: {
      type: "mint",
      spgNftContract,
      recipient,
    },
    ipMetadata: {
      ipMetadataURI: metadataUri,
      ipMetadataHash: metadataHash,
      nftMetadataURI: metadataUri,
      nftMetadataHash: metadataHash,
    },
    licenseTermsData: [
      {
        terms: PILFlavor.commercialRemix({
          defaultMintingFee: 0,
          commercialRevShare: 18,
          currency: currency,
          override: {
            uri: 'https://raw.githubusercontent.com/piplabs/pil-document/ad67bb632a310d2557f8abcccd428e4c9c798db1/off-chain-terms/CommercialRemix.json',
          },
        }),
      },
    ],
    deadline: BigInt(Date.now() + 1000 * 60 * 5),
  });

  console.log('✅ IP Asset minted!');
  console.log(`   IP ID: ${response.ipId}`);
  console.log(`   TX Hash: ${response.txHash}`);
  console.log(`   Explorer: https://aeneid.explorer.story.foundation/ipa/${response.ipId}`);
} catch (error: any) {
  console.error('❌ Error:', error.message);
  if (error.details) {
    console.error('   Details:', error.details);
  }
  process.exit(1);
}
