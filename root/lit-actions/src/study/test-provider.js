/**
 * Test ethers provider and RPC calls
 */

const LENS_TESTNET_RPC_URL = 'https://rpc.testnet.lens.xyz';

const go = async () => {
  try {
    console.log('1. Creating provider...');
    const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC_URL);
    console.log('2. Provider created');

    console.log('3. Getting block number...');
    const blockNumber = await provider.getBlockNumber();
    console.log('4. Block number:', blockNumber);

    console.log('5. Getting nonce for test address...');
    const nonce = await provider.getTransactionCount('0x254AA0096C9287a03eE62b97AA5643A2b8003657');
    console.log('6. Nonce:', nonce);

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        blockNumber,
        nonce
      })
    });
  } catch (error) {
    console.log('ERROR:', error.message);
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message
      })
    });
  }
};

go();
