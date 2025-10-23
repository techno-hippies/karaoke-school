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
const metadataUri = 'https://api.grove.storage/f5892d3ac9d1abbbde6fd71e47b91da9ab1d16b5d2616f22ba12059b51c0d4b4';
const metadataHash = '0x56882e76868a678eb62dc71c0f9411faa010fe710c083fbeac2dee72cd5bd04e' as `0x${string}`;

console.log('📝 Test: NON-COMMERCIAL license');
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
        terms: PILFlavor.nonCommercialSocialRemixing(),
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
  if (error.details) {
    console.error('   Details:', error.details);
  }
  process.exit(1);
}
