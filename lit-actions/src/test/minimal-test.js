/**
 * Minimal Test - Just return success
 */

const go = async () => {
  console.log('Lit Action started');

  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: true,
      message: 'Minimal test passed',
      timestamp: Date.now()
    })
  });
};

go();
