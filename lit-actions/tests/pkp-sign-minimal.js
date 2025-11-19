// Minimal PKP signing test
// Just signs a message with the PKP and returns success/failure

const go = async () => {
  const { messageToSign, pkpPublicKey } = jsParams || {};

  try {
    console.log("[pkp-test] Starting minimal PKP signing test");
    console.log("[pkp-test] PKP Public Key:", pkpPublicKey);
    console.log("[pkp-test] Message to sign (array length):", messageToSign.length);

    const signature = await Lit.Actions.signAndCombineEcdsa({
      toSign: messageToSign,
      publicKey: pkpPublicKey,
      sigName: "testSig"
    });

    console.log("[pkp-test] ✅ PKP Signing SUCCESS!");
    console.log("[pkp-test] Signature type:", typeof signature);
    console.log("[pkp-test] Signature:", signature);

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        signatureExists: !!signature,
        signatureType: typeof signature,
        message: "PKP signing works!"
      })
    });

  } catch (error) {
    console.error("[pkp-test] ❌ PKP Signing FAILED");
    console.error("[pkp-test] Error:", error.message);
    console.error("[pkp-test] Stack:", error.stack);

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    });
  }
};

go();
