/**
 * Simple EOA Auth Test Action
 * Tests that EOA authentication and Lit Action execution works correctly
 *
 * Expected params (via jsParams):
 * - testMessage: A test message to echo back
 * - userAddress: The user's wallet address
 */

const go = async () => {
  try {
    // Access parameters from jsParams (v8 SDK pattern)
    const { testMessage, userAddress } = jsParams || {};

    const response = {
      success: true,
      message: "EOA auth works!",
      echo: testMessage || "No message provided",
      user: userAddress || "Anonymous",
      timestamp: Date.now(),
      receivedParamKeys: Object.keys(jsParams || {})
    };

    Lit.Actions.setResponse({ response: JSON.stringify(response) });
  } catch (error) {
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