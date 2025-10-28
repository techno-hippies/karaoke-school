#!/usr/bin/env bun
import { createWalletClient, http, encodeFunctionData, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { aeneid } from '@story-protocol/core-sdk';

const privateKey = process.env.PRIVATE_KEY!;
const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
const account = privateKeyToAccount(formattedKey);

const walletClient = createWalletClient({
  chain: aeneid,
  transport: http('https://aeneid.storyrpc.io'),
  account,
});

console.log('✅ Connected to Story Protocol Aeneid');
console.log(`   Wallet: ${account.address}\n`);

// Get the ABI from Story's deployed contract
// We'll use a minimal ABI with just the function we need
const LICENSE_ATTACHMENT_WORKFLOWS_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spgNftContract",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "components": [
          {
            "internalType": "string",
            "name": "ipMetadataURI",
            "type": "string"
          },
          {
            "internalType": "bytes32",
            "name": "ipMetadataHash",
            "type": "bytes32"
          },
          {
            "internalType": "string",
            "name": "nftMetadataURI",
            "type": "string"
          },
          {
            "internalType": "bytes32",
            "name": "nftMetadataHash",
            "type": "bytes32"
          }
        ],
        "internalType": "struct WorkflowStructs.IPMetadata",
        "name": "ipMetadata",
        "type": "tuple"
      },
      {
        "components": [
          {
            "components": [
              {
                "internalType": "bool",
                "name": "transferable",
                "type": "bool"
              },
              {
                "internalType": "address",
                "name": "royaltyPolicy",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "defaultMintingFee",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "expiration",
                "type": "uint256"
              },
              {
                "internalType": "bool",
                "name": "commercialUse",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "commercialAttribution",
                "type": "bool"
              },
              {
                "internalType": "address",
                "name": "commercializerChecker",
                "type": "address"
              },
              {
                "internalType": "bytes",
                "name": "commercializerCheckerData",
                "type": "bytes"
              },
              {
                "internalType": "uint32",
                "name": "commercialRevShare",
                "type": "uint32"
              },
              {
                "internalType": "uint256",
                "name": "commercialRevCeiling",
                "type": "uint256"
              },
              {
                "internalType": "bool",
                "name": "derivativesAllowed",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "derivativesAttribution",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "derivativesApproval",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "derivativesReciprocal",
                "type": "bool"
              },
              {
                "internalType": "uint256",
                "name": "derivativeRevCeiling",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "currency",
                "type": "address"
              },
              {
                "internalType": "string",
                "name": "uri",
                "type": "string"
              }
            ],
            "internalType": "struct PILTerms",
            "name": "terms",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "bool",
                "name": "isSet",
                "type": "bool"
              },
              {
                "internalType": "uint256",
                "name": "mintingFee",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "licensingHook",
                "type": "address"
              },
              {
                "internalType": "bytes",
                "name": "hookData",
                "type": "bytes"
              },
              {
                "internalType": "uint32",
                "name": "commercialRevShare",
                "type": "uint32"
              },
              {
                "internalType": "bool",
                "name": "disabled",
                "type": "bool"
              },
              {
                "internalType": "uint32",
                "name": "expectMinimumGroupRewardShare",
                "type": "uint32"
              },
              {
                "internalType": "address",
                "name": "expectGroupRewardPool",
                "type": "address"
              }
            ],
            "internalType": "struct Licensing.LicensingConfig",
            "name": "licensingConfig",
            "type": "tuple"
          }
        ],
        "internalType": "struct WorkflowStructs.LicenseTermsData[]",
        "name": "licenseTermsData",
        "type": "tuple[]"
      },
      {
        "internalType": "bool",
        "name": "allowDuplicates",
        "type": "bool"
      }
    ],
    "name": "mintAndRegisterIpAndAttachPILTerms",
    "outputs": [
      {
        "internalType": "address",
        "name": "ipId",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "uint256[]",
        "name": "licenseTermsIds",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

const spgNftContract = '0x0F8cC1263f720A58e26f8fF3CC1C04339291A93C' as Address;
const contractAddress = '0xcC2E862bCee5B6036Db0de6E06Ae87e524a79fd8' as Address;
const metadataUri = 'https://api.grove.storage/f5892d3ac9d1abbbde6fd71e47b91da9ab1d16b5d2616f22ba12059b51c0d4b4';
const metadataHash = '0x56882e76868a678eb62dc71c0f9411faa010fe710c083fbeac2dee72cd5bd04e' as `0x${string}`;

console.log('📝 Testing RAW transaction (bypassing SDK)');
console.log(`   Recipient: ${account.address}`);
console.log(`   Metadata: ${metadataUri}\n`);

try {
  // Encode the function data
  const data = encodeFunctionData({
    abi: LICENSE_ATTACHMENT_WORKFLOWS_ABI,
    functionName: 'mintAndRegisterIpAndAttachPILTerms',
    args: [
      spgNftContract,
      account.address,
      {
        ipMetadataURI: metadataUri,
        ipMetadataHash: metadataHash,
        nftMetadataURI: metadataUri,
        nftMetadataHash: metadataHash,
      },
      [
        {
          terms: {
            transferable: true,
            royaltyPolicy: '0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E' as Address,
            defaultMintingFee: 0n,
            expiration: 0n,
            commercialUse: true,
            commercialAttribution: true,
            commercializerChecker: '0x0000000000000000000000000000000000000000' as Address,
            commercializerCheckerData: '0x' as `0x${string}`,
            commercialRevShare: 18000000, // 18% in parts-per-million
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
            hookData: '0x' as `0x${string}`,
            commercialRevShare: 0,
            disabled: false,
            expectMinimumGroupRewardShare: 0,
            expectGroupRewardPool: '0x0000000000000000000000000000000000000000' as Address,
          },
        },
      ],
      true,
    ],
  });

  console.log('📤 Sending raw transaction...\n');

  const txHash = await walletClient.sendTransaction({
    to: contractAddress,
    data,
    account,
    chain: aeneid,
  });

  console.log('✅ Transaction sent!');
  console.log(`   TX Hash: ${txHash}`);
  console.log(`   Explorer: https://aeneid.storyscan.io/tx/${txHash}`);
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
