#!/usr/bin/env bun
import { StoryClient, StoryConfig, PILFlavor, WIP_TOKEN_ADDRESS } from '@story-protocol/core-sdk';
import { http, parseEther } from 'viem';
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

console.log('✅ Testing EXACT example from Story Protocol docs');
console.log(`   Wallet: ${account.address}\n`);

async function main() {
  const response = await client.ipAsset.registerIpAsset({
    nft: {
      type: "mint",
      spgNftContract: "0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc",
    },
    licenseTermsData: [
      {
        terms: PILFlavor.nonCommercialSocialRemixing(),
      },
    ],
  });

  console.log(`Root IPA created at transaction hash ${response.txHash}, IPA ID: ${response.ipId}`);
  console.log(`View on the explorer: https://aeneid.explorer.story.foundation/ipa/${response.ipId}`);
}

main().catch(console.error);
