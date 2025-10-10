/**
 * Minimal test to debug v3 timeout
 */

console.log('=== MINIMAL V3 LOADED ===');

const go = async () => {
  console.log('=== STARTING MINIMAL EXECUTION ===');

  try {
    console.log('Inside try block');

    // Just return success
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        message: 'Minimal v3 test completed'
      })
    });

  } catch (error) {
    console.log('Caught error:', error.message);
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message
      })
    });
  }
};

go().catch(error => {
  console.log('Fatal error:', error.message);
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: false,
      error: error.message || 'Fatal error'
    })
  });
});
