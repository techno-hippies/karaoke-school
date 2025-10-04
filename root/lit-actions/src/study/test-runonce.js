/**
 * Test runOnce with transaction submission
 */

const LENS_TESTNET_RPC_URL = 'https://rpc.testnet.lens.xyz';
const STUDY_PROGRESS_ADDRESS = '0x784Ff3655B8FDb37b5CFB831C531482A606365f1';

const go = async () => {
  const { pkpPublicKey, userAddress } = jsParams || {};

  try {
    console.log('1. Starting runOnce test...');

    const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC_URL);
    const pkpPublicKeyFormatted = pkpPublicKey.startsWith('0x') ? pkpPublicKey : '0x' + pkpPublicKey;
    const pkpEthAddress = ethers.utils.computeAddress(pkpPublicKeyFormatted);
    const nonce = await provider.getTransactionCount(pkpEthAddress);

    console.log('2. Got nonce:', nonce, 'for PKP:', pkpEthAddress);

    const StudyProgressABI = [
      'function recordStudySession(address user, uint8 source, string calldata contentId, uint16 itemsReviewed, uint8 averageScore) external'
    ];

    const iface = new ethers.utils.Interface(StudyProgressABI);
    const callData = iface.encodeFunctionData('recordStudySession', [
      userAddress,
      0, // source
      'test-content',
      10, // itemsReviewed
      85  // averageScore
    ]);

    const unsignedTx = {
      to: STUDY_PROGRESS_ADDRESS,
      from: pkpEthAddress,
      data: callData,
      chainId: 37111,
      gasLimit: ethers.BigNumber.from('300000'),
      gasPrice: ethers.utils.parseUnits('300', 'gwei'),
      nonce: nonce,
      type: 2,
      maxFeePerGas: ethers.utils.parseUnits('300', 'gwei'),
      maxPriorityFeePerGas: ethers.utils.parseUnits('1', 'gwei')
    };

    console.log('3. Built transaction');

    const serializedTx = ethers.utils.serializeTransaction(unsignedTx);
    const txHashToSign = ethers.utils.keccak256(serializedTx);

    console.log('4. Signing transaction...');
    const signature = await Lit.Actions.signAndCombineEcdsa({
      toSign: ethers.utils.arrayify(txHashToSign),
      publicKey: pkpPublicKey,
      sigName: "txSig",
    });

    console.log('5. Signature received');

    const jsonSig = JSON.parse(signature);
    jsonSig.r = jsonSig.r.startsWith('0x') ? jsonSig.r : '0x' + jsonSig.r;
    jsonSig.s = jsonSig.s.startsWith('0x') ? jsonSig.s : '0x' + jsonSig.s;
    const hexSig = ethers.utils.joinSignature(jsonSig);

    const signedTx = ethers.utils.serializeTransaction(unsignedTx, hexSig);

    console.log('6. Transaction signed, calling runOnce...');

    const txHash = await Lit.Actions.runOnce(
      { waitForResponse: false, name: `testTx_${Date.now()}` },
      async () => {
        try {
          console.log('7. Inside runOnce, sending transaction...');
          const tx = await provider.sendTransaction(signedTx);
          console.log('8. Transaction sent, hash:', tx.hash);
          // DON'T wait for confirmation - too slow for Lit Action timeout
          return tx.hash;
        } catch (error) {
          console.log('ERROR in runOnce:', error.message);
          return `ERROR: ${error.message}`;
        }
      }
    );

    console.log('10. runOnce completed with result:', txHash);

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        txHash
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
