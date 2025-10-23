#!/usr/bin/env bun
import { StoryClient, StoryConfig } from '@story-protocol/core-sdk';
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

console.log('📝 Test: MANUALLY constructed terms with proper 0x for empty bytes');
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
        terms: {
          transferable: true,
          royaltyPolicy: '0x0000000000000000000000000000000000000000' as Address,  // TEST: zero policy for 0% rev share
          defaultMintingFee: 0n,
          expiration: 0n,
          commercialUse: false,  // TEST: disable commercial use for non-royalty test
          commercialAttribution: false,
          commercializerChecker: '0x0000000000000000000000000000000000000000' as Address,
          commercializerCheckerData: '0x' as `0x${string}`,  // FIXED: use 0x not 0x0000...
          commercialRevShare: 0,  // TEST: try 0% to see if error changes
          commercialRevCeiling: 0n,
          derivativesAllowed: true,
          derivativesAttribution: true,
          derivativesApproval: false,
          derivativesReciprocal: true,
          derivativeRevCeiling: 0n,
          currency: '0x1514000000000000000000000000000000000000' as Address,
          uri: 'https://raw.githubusercontent.com/piplabs/pil-document/ad67bb632a310d2557f8abcccd428e4c9c798db1/off-chain-terms/CommercialRemix.json',
        },
        licensingConfig: {
          isSet: false,
          mintingFee: 0n,
          licensingHook: '0x0000000000000000000000000000000000000000' as Address,
          hookData: '0x' as `0x${string}`,  // FIXED: use 0x not 0x0000...
          commercialRevShare: 0,
          disabled: false,
          expectMinimumGroupRewardShare: 0,
          expectGroupRewardPool: '0x0000000000000000000000000000000000000000' as Address,
        },
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
