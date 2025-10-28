#!/usr/bin/env bun
import { StoryClient, StoryConfig, PILFlavor } from '@story-protocol/core-sdk';
import { http, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const privateKey = process.env.PRIVATE_KEY!;
const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
const account = privateKeyToAccount(formattedKey);

const config: StoryConfig = {
  account: account,
  transport: http('https://aeneid.storyrpc.io'),
  chainId: 1315,
};

const client = StoryClient.newClient(config);

console.log('✅ Connected to Story Protocol Aeneid');
console.log(`   Wallet: ${account.address}\n`);

const spgNftContract = '0x0F8cC1263f720A58e26f8fF3CC1C04339291A93C' as Address;
const metadataUri = 'https://ipfs.io/ipfs/bafkreiabrkevameeffdpjpizchywldogzai7kp5oodawbhgbojyeomk7uq';  // Example from Story tutorial
const metadataHash = '0x018a895030842946f4bd1911f1658dc6c811f53fae70c1609cc1727047315fa4' as `0x${string}`;  // Example from Story tutorial

console.log('📝 Test: MINIMAL - using example from Story tutorial');
console.log(`   Recipient: ${account.address}`);
console.log(`   Metadata: ${metadataUri}\n`);

try {
  const response = await client.ipAsset.registerIpAsset({
    nft: {
      type: "mint",
      spgNftContract,
      recipient: account.address,
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
          commercialRevShare: 10,
          currency: '0x1514000000000000000000000000000000000000' as Address,
        }),
      },
    ],
    deadline: BigInt(Date.now() + 1000 * 60 * 5),
  });

  console.log('✅ IP Asset minted successfully!');
  console.log(`   IP ID: ${response.ipId}`);
  console.log(`   TX Hash: ${response.txHash}`);
  console.log(`   Explorer: https://aeneid.explorer.story.foundation/ipa/${response.ipId}`);
} catch (error: any) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
