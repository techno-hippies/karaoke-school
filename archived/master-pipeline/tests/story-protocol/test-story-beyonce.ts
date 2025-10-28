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

// Use beyonce metadata that worked on Oct 17
const spgNftContract = '0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc' as Address;
const metadataUri = 'https://api.grove.storage/f65f759b0ad991d8170b5dc014233fd97758fe310f6413a852a46dd69df6631c';
const metadataHash = '0xd5a5d0a20c8c806c8ba77cbf6ff0c8ebe62f7fa1b8e9bfe1e5ce15f58c4e9050' as `0x${string}`;
const currency = '0x1514000000000000000000000000000000000000' as Address;

console.log('📝 Test: Minting BEYONCE metadata (worked Oct 17)');
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
          commercialRevShare: 18,
          currency: currency,
          override: {
            uri: 'https://raw.githubusercontent.com/piplabs/pil-document/ad67bb632a310d2557f8abcccd428e4c9c798db1/off-chain-terms/CommercialRemix.json',
          },
        }),
      },
    ],
    deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 5),  // Unix seconds, not milliseconds!
  });

  console.log('✅ IP Asset minted successfully!');
  console.log(`   IP ID: ${response.ipId}`);
  console.log(`   TX Hash: ${response.txHash}`);
  console.log(`   Explorer: https://aeneid.explorer.story.foundation/ipa/${response.ipId}`);
} catch (error: any) {
  console.error('❌ Error:', error.message);
  if (error.details) {
    console.error('   Details:', error.details);
  }
  if (error.cause) {
    console.error('   Cause:', error.cause);
  }
  process.exit(1);
}
