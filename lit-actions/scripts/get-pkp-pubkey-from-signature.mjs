import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const pkpCreds = JSON.parse(await readFile(join(__dirname, '../output/pkp-credentials.json'), 'utf-8'));

console.log('🔐 Getting PKP Public Key from Signature');
console.log('PKP Address:', pkpCreds.ethAddress);
console.log('Token ID:', pkpCreds.tokenId);

const testPrivateKey = process.env.PRIVATE_KEY;
const viemAccount = privateKeyToAccount(testPrivateKey);

const authManager = createAuthManager({
  storage: storagePlugins.localStorageNode({
    appName: 'pkp-pubkey-test',
    networkName: 'naga-test',
    storagePath: './lit-auth-storage'
  })
});

const litClient = await createLitClient({ network: nagaTest });

const authContext = await authManager.createEoaAuthContext({
  authConfig: {
    chain: 'ethereum',
    expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    resources: [{
      resource: new LitActionResource('*'),
      ability: 'lit-action-execution'
    }]
  },
  config: { account: viemAccount },
  litClient
});

const litActionCode = `
const go = async () => {
  const testMessage = "test";
  const testMessageHash = ethers.utils.arrayify(ethers.utils.id(testMessage));
  
  const signature = await Lit.Actions.signAndCombineEcdsa({
    toSign: testMessageHash,
    publicKey: "${pkpCreds.ethAddress}", // We'll use the address as a placeholder
    sigName: 'testSig'
  });
  
  const sig = JSON.parse(signature);
  
  // Recover public key from signature
  const recovered = ethers.utils.recoverPublicKey(
    testMessageHash,
    {
      r: sig.r.startsWith('0x') ? sig.r : '0x' + sig.r,
      s: sig.s.startsWith('0x') ? sig.s : '0x' + sig.s,
      v: sig.v < 27 ? sig.v + 27 : sig.v
    }
  );
  
  Lit.Actions.setResponse({ response: JSON.stringify({ publicKey: recovered }) });
};

go();
`;

console.log('\n🚀 Executing test signature to extract public key...');

const result = await litClient.executeJs({
  code: litActionCode,
  authContext,
  jsParams: {}
});

const response = JSON.parse(result.response);
console.log('\n✅ Public Key Retrieved:', response.publicKey);
console.log('\nAdd this to your Lit Actions as PKP_PUBLIC_KEY');

await litClient.disconnect();
