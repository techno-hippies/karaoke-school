/**
 * Simple Grove Upload Test - Lit Action
 *
 * Uploads a simple JSON object to Grove and returns the CID/URI
 */

(async () => {
  try {
    // Create a simple test object
    const testData = {
      timestamp: Date.now(),
      message: "Hello from Lit Action!",
      test: true,
      numbers: [1, 2, 3, 4, 5],
      nested: {
        foo: "bar",
        baz: 42
      }
    };

    console.log('Test data:', JSON.stringify(testData, null, 2));

    // Convert to JSON string
    const jsonString = JSON.stringify(testData);
    console.log('JSON size:', jsonString.length, 'bytes');

    // Upload to Grove
    console.log('Uploading to Grove...');
    const groveResp = await fetch('https://api.grove.storage/?chain_id=37111', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: jsonString
    });

    console.log('Grove response status:', groveResp.status);

    if (!groveResp.ok) {
      const errorText = await groveResp.text();
      throw new Error(`Grove upload failed (${groveResp.status}): ${errorText}`);
    }

    const groveResult = await groveResp.json();
    console.log('Grove result:', JSON.stringify(groveResult, null, 2));

    // Return success with Grove details AND full raw response for debugging
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        // Try different possible field names from Grove response
        cid: groveResult.cid || groveResult.id || groveResult.txId,
        storageKey: groveResult.storageKey || groveResult.storage_key,
        uri: groveResult.uri,
        gatewayUrl: groveResult.gatewayUrl || groveResult.gateway_url,
        dataSize: jsonString.length,
        testData: testData,
        // Include raw Grove response for debugging
        rawGroveResponse: groveResult
      })
    });

  } catch (error) {
    console.error('Error:', error.message);
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    });
  }
})();
