/**
 * Test PKP signing
 */

const go = async () => {
  const { pkpPublicKey } = jsParams || {};

  try {
    console.log('1. Starting signing test...');

    if (!pkpPublicKey) {
      throw new Error('MISSING_PKP_PUBLIC_KEY');
    }

    console.log('2. PKP public key received (first 20 chars):', pkpPublicKey.substring(0, 20));

    // Test message to sign
    const testMessage = 'Hello from Lit Action';
    const messageHash = ethers.utils.id(testMessage);
    console.log('3. Message hash:', messageHash);

    console.log('4. Calling signAndCombineEcdsa...');
    const signature = await Lit.Actions.signAndCombineEcdsa({
      toSign: ethers.utils.arrayify(messageHash),
      publicKey: pkpPublicKey,
      sigName: "testSig",
    });
    console.log('5. Signature received');

    // Parse signature
    const jsonSig = JSON.parse(signature);
    console.log('6. Signature parsed:', { r: jsonSig.r.substring(0, 20) + '...', v: jsonSig.v });

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        signatureReceived: true,
        messageHash
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
