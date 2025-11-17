import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';

const tokenId = '115404661878944453481079359456267201922996414243488720035213882342633261150078';

console.log('🔌 Connecting to nagaTest...');
const litClient = await createLitClient({ network: nagaTest });

console.log('📡 Fetching PKP public key for token:', tokenId);
try {
  const pkpInfo = await litClient.getPkpInfoByTokenId({ tokenId });
  console.log('\n✅ PKP Info Retrieved:');
  console.log('Public Key:', pkpInfo.publicKey);
  console.log('ETH Address:', pkpInfo.ethAddress);
} catch (error) {
  console.error('❌ Error:', error.message);
}

await litClient.disconnect();
