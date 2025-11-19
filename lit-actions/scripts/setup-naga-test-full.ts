
import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { createWalletClient, createPublicClient, http, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

dotenv.config({ path: join(ROOT_DIR, '.env') });

// Configuration
const NETWORK = nagaTest;
const NETWORK_NAME = 'nagaTest';
const CHRONICLE_YELLOWSTONE = defineChain({
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'tstLPX', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com'] },
  },
  blockExplorers: {
    default: { name: 'Chronicle Explorer', url: 'https://yellowstone-explorer.litprotocol.com' },
  },
});

const PKP_NFT_ADDRESS_HARDCODED = '0x8F75a53F65e31DD0D2e40d0827becAaE2299D111';
const PKP_NFT_ADDRESS_FROM_LOG = '0x054ddcfef7e9434413ad62a6f37946bf6b6cfc1a'; // Found in logs

const PKP_NFT_ABI = [
  {
    name: 'getPubkey',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes' }],
  }
];

async function main() {
  console.log('🚀 Starting Full Setup for Naga Testnet...');
  
  // 1. Setup Wallet & Client
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY not found in .env');
  
  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
  console.log(`👤 Using account: ${account.address}`);

  const walletClient = createWalletClient({
    account,
    chain: CHRONICLE_YELLOWSTONE,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: CHRONICLE_YELLOWSTONE,
    transport: http(),
  });

  const litClient = await createLitClient({ network: NETWORK });
  console.log(`🔌 Connected to Lit (${NETWORK_NAME})`);

  // 2. Get PKP (Mint or Load)
  console.log('\n🪙 Checking for existing PKP...');
  const outputPath = join(join(ROOT_DIR, 'output'), 'pkp-naga-test.json');
  
  let pkpInfo = { tokenId: '', publicKey: '', ethAddress: '' };
  let needsMint = true;

  if (existsSync(outputPath)) {
      try {
          const existing = JSON.parse(await readFile(outputPath, 'utf8'));
          if (existing.tokenId && existing.ethAddress) {
              console.log(`   Found existing PKP: ${existing.tokenId}`);
              pkpInfo = existing;
              needsMint = false;
          }
      } catch (e) {
          console.log('   Could not read existing PKP file.');
      }
  }

  if (needsMint) {
      console.log('   No valid existing PKP found. Minting new one...');
      
      try {
        const mintedPkp = await litClient.mintWithEoa({
          account: walletClient.account,
        });
        
        console.log('   Mint Response Structure:', JSON.stringify(mintedPkp, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value
        , 2));

        if (!mintedPkp.pkp) {
             if (mintedPkp.data) {
                 pkpInfo = {
                    tokenId: mintedPkp.data.tokenId.toString(),
                    publicKey: mintedPkp.data.publicKey,
                    ethAddress: mintedPkp.data.ethAddress,
                 };
             } else if (mintedPkp.tokenId) {
                 pkpInfo = {
                    tokenId: mintedPkp.tokenId.toString(),
                    publicKey: mintedPkp.publicKey,
                    ethAddress: mintedPkp.ethAddress,
                 };
             } else {
                 throw new Error('Unknown mint response structure');
             }
        } else {
            pkpInfo = {
                tokenId: mintedPkp.pkp.tokenId.toString(),
                publicKey: mintedPkp.pkp.publicKey,
                ethAddress: mintedPkp.pkp.ethAddress,
            };
        }
        
        console.log(`✅ PKP Minted! Token ID: ${pkpInfo.tokenId}`);
        console.log(`   Public Key: ${pkpInfo.publicKey}`);

      } catch (err) {
          console.error('Minting failed:', err);
          throw err;
      }
  }

  // 2b. Ensure Public Key exists
  if (!pkpInfo.publicKey || pkpInfo.publicKey === 'undefined') {
      console.log('⚠️ Public Key missing. Fetching from contract...');
      
      const tryFetch = async (address) => {
          console.log(`   Trying contract: ${address}`);
          const pkpContract = getContract({
              address: address,
              abi: PKP_NFT_ABI,
              client: publicClient,
          });
          
          // 10s timeout
          return await Promise.race([
              pkpContract.read.getPubkey([BigInt(pkpInfo.tokenId)]),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Contract read timeout')), 10000))
          ]);
      };

      try {
          try {
             pkpInfo.publicKey = await tryFetch(PKP_NFT_ADDRESS_HARDCODED);
          } catch (e) {
             console.log(`   Failed on hardcoded address: ${e.message}`);
             pkpInfo.publicKey = await tryFetch(PKP_NFT_ADDRESS_FROM_LOG);
          }
          
          console.log(`   Fetched Public Key: ${pkpInfo.publicKey}`);
          
          if (existsSync(dirname(outputPath))) {
             await writeFile(outputPath, JSON.stringify(pkpInfo, null, 2)); 
          }
      } catch (err) {
          console.error('❌ Failed to fetch Public Key from ALL contracts:', err.message);
      }
  }

  if (!pkpInfo.publicKey) {
      console.warn('⚠️ Proceeding without Public Key (this will likely fail code generation)...');
  } else {
      console.log(`✅ Using PKP: ${pkpInfo.publicKey}`);
  }

  // 3. Update Code with new PKP
  console.log('\n📝 Updating Lit Actions with new PKP...');
  await updateFileWithPkp(join(ROOT_DIR, 'study/exercise-grader-v1.js'), pkpInfo.publicKey);
  await updateFileWithPkp(join(ROOT_DIR, 'karaoke/karaoke-grader-v1.js'), pkpInfo.publicKey);

  // 4. Upload to IPFS
  console.log('\n📤 Uploading Lit Actions to IPFS...');
  const exerciseCid = await uploadToIpfs(join(ROOT_DIR, 'study/exercise-grader-v1.js'), 'Exercise Grader v1');
  const karaokeCid = await uploadToIpfs(join(ROOT_DIR, 'karaoke/karaoke-grader-v1.js'), 'Karaoke Grader v1');
  console.log(`✅ Exercise CID: ${exerciseCid}`);
  console.log(`✅ Karaoke CID: ${karaokeCid}`);

  // 5. Add Permissions
  console.log('\n🔑 Adding Permissions to PKP...');
  const pkpPermissionsManager = await litClient.getPKPPermissionsManager({
    pkpIdentifier: { tokenId: pkpInfo.tokenId },
    account: walletClient.account,
  });

  await pkpPermissionsManager.addPermittedAction({ ipfsId: exerciseCid, scopes: ["sign-anything"] });
  console.log(`   Permitted: ${exerciseCid}`);
  
  await pkpPermissionsManager.addPermittedAction({ ipfsId: karaokeCid, scopes: ["sign-anything"] });
  console.log(`   Permitted: ${karaokeCid}`);

  // 6. Encrypt Keys
  console.log('\nCw Encrypting API Keys...');
  await encryptKey(litClient, exerciseCid, process.env.VOXTRAL_API_KEY, 'voxtral_api_key_exercise.json');
  await encryptKey(litClient, karaokeCid, process.env.VOXTRAL_API_KEY, 'voxtral_api_key_karaoke.json');
  await encryptKey(litClient, karaokeCid, process.env.OPENROUTER_API_KEY, 'openrouter_api_key_karaoke.json');

  // 7. Update Tests
  console.log('\n🧪 Updating Test Files...');
  await updateTestFile(join(ROOT_DIR, 'tests/test-exercise-grader-say-it-back.mjs'), exerciseCid, 'voxtral_api_key_exercise.json');
  await updateTestFile(join(ROOT_DIR, 'tests/test-karaoke-grader-ngrok.mjs'), karaokeCid, 'voxtral_api_key_karaoke.json', 'openrouter_api_key_karaoke.json');

  // 8. Save PKP Info
  const outputDir = join(ROOT_DIR, 'output');
  if (!existsSync(outputDir)) await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'pkp-naga-test.json'), JSON.stringify({ ...pkpInfo, exerciseCid, karaokeCid }, null, 2));
  
  console.log('\n✨ Setup Complete! Saved info to output/pkp-naga-test.json');
  await litClient.disconnect();
  process.exit(0);
}

async function updateFileWithPkp(filePath, publicKey) {
  let content = await readFile(filePath, 'utf8');
  // Match single quotes, double quotes, and multiline
  const regex = /const PKP_PUBLIC_KEY\s*=\s*['"]0x[a-fA-F0-9]+['"];?/;
  
  if (regex.test(content)) {
       content = content.replace(regex, `const PKP_PUBLIC_KEY = '${publicKey}';`);
  } else {
      // Try to handle "undefined" case if previous run failed
      const regexUndefined = /const PKP_PUBLIC_KEY\s*=\s*['"]undefined['"];?/;
      if (regexUndefined.test(content)) {
         content = content.replace(regexUndefined, `const PKP_PUBLIC_KEY = '${publicKey}';`);
      } else {
         console.warn(`⚠️ Could not find PKP_PUBLIC_KEY in ${filePath}`);
      }
  }
 
  await writeFile(filePath, content);
}

async function uploadToIpfs(filePath, name) {
  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) throw new Error('PINATA_JWT not found');

  const jsCode = await readFile(filePath, 'utf8');
  const formData = new FormData();
  const blob = new Blob([jsCode], { type: 'text/javascript' });
  formData.append('file', blob, `${name.replace(/\s+/g, '-')}.js`);
  formData.append('pinataMetadata', JSON.stringify({
    name: name,
    keyvalues: { type: 'lit-action', network: 'naga-test', uploadDate: new Date().toISOString() }
  }));
  formData.append('pinataOptions', JSON.stringify({ wrapWithDirectory: false }));

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
    body: formData
  });

  if (!response.ok) throw new Error(`Pinata upload failed: ${await response.text()}`);
  const result = await response.json();
  return result.IpfsHash;
}

async function encryptKey(litClient, ipfsCid, apiKey, filename) {
  if (!apiKey) throw new Error(`API key missing for ${filename}`);

  const accessControlConditions = [{
    conditionType: 'evmBasic',
    contractAddress: '',
    standardContractType: '',
    chain: 'ethereum',
    method: '',
    parameters: [':currentActionIpfsId'],
    returnValueTest: { comparator: '=', value: ipfsCid },
  }];

  const encryptedData = await litClient.encrypt({
    dataToEncrypt: apiKey,
    unifiedAccessControlConditions: accessControlConditions,
    chain: 'ethereum',
  });

  const encryptedKey = {
    ciphertext: encryptedData.ciphertext,
    dataToEncryptHash: encryptedData.dataToEncryptHash,
    accessControlConditions,
    encryptedAt: new Date().toISOString(),
    cid: ipfsCid,
  };

  await writeFile(join(ROOT_DIR, 'keys', filename), JSON.stringify(encryptedKey, null, 2));
  console.log(`   Saved ${filename}`);
}

async function updateTestFile(filePath, cid, keyFile1, keyFile2) {
  let content = await readFile(filePath, 'utf8');
  
  // Update CID for Exercise Grader (Hardcoded)
  if (filePath.includes('exercise-grader')) {
    content = content.replace(/const LIT_ACTION_CID = ['"]Qm[a-zA-Z0-9]+['"];/, `const LIT_ACTION_CID = '${cid}';`);
  }
  
  // Update CID for Karaoke Grader (Env var fallback)
  if (filePath.includes('karaoke-grader')) {
     // Replace the env var assignment line with hardcoded one for testing stability
     // Handle both original process.env and the one we might have replaced already
     if (content.includes('process.env.KARAOKE_GRADER_CID')) {
        content = content.replace(
            /const LIT_ACTION_CID = .*process\.env\.KARAOKE_GRADER_CID.*/, 
            `const LIT_ACTION_CID = '${cid}'; // process.env.KARAOKE_GRADER_CID`
        );
     } else {
         // If already replaced, just update the CID
         content = content.replace(/const LIT_ACTION_CID = ['"]Qm[a-zA-Z0-9]+['"];/, `const LIT_ACTION_CID = '${cid}';`);
     }
  }
  
  // Update Key Paths
  if (keyFile1) {
     content = content.replace(/keys\/voxtral_api_key\.json/g, `keys/${keyFile1}`);
     content = content.replace(/\.\.\/keys\/voxtral_api_key\.json/g, `../keys/${keyFile1}`);
     // Also catch specific filenames if they were already updated
     content = content.replace(/keys\/voxtral_api_key_.*\.json/g, `keys/${keyFile1}`);
     content = content.replace(/\.\.\/keys\/voxtral_api_key_.*\.json/g, `../keys/${keyFile1}`);
  }
  if (keyFile2) {
      content = content.replace(/keys\/openrouter_api_key\.json/g, `keys/${keyFile2}`);
      content = content.replace(/\.\.\/keys\/openrouter_api_key\.json/g, `../keys/${keyFile2}`);
      content = content.replace(/keys\/openrouter_api_key_.*\.json/g, `keys/${keyFile2}`);
      content = content.replace(/\.\.\/keys\/openrouter_api_key_.*\.json/g, `../keys/${keyFile2}`);
  }

  await writeFile(filePath, content);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
