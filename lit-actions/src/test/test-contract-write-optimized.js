/**
 * Test: Optimized alignment data upload + contract write
 *
 * Purpose: Validate the complete flow for adding a full song with word-level lyrics timing
 *
 * Steps:
 * 1. Fetch mock alignment data (simulating ElevenLabs response)
 * 2. Optimize data: remove loss field, round timestamps to 2 decimals
 * 3. Upload optimized data to Grove
 * 4. Write Grove URI to KaraokeCatalog.metadataUri via PKP signing
 *
 * Expected optimizations:
 * - Original size: ~150KB (755 words with loss + full precision)
 * - Optimized size: ~60KB (60% reduction)
 *
 * Contract call: addFullSong() with metadataUri = lens://...
 */

(async () => {
  try {
    const {
      pkpPublicKey,
      pkpAddress,
      contractAddress,
      writeToBlockchain = false
    } = jsParams || {};

    // Mock alignment data (simulating ElevenLabs response)
    // In production, this would come from match-and-segment-v3
    const mockAlignment = {
      words: [
        { text: "Party", start: 1.159999999, end: 1.539999999, loss: 1.1563140869140625 },
        { text: " ", start: 1.539999999, end: 1.619999999, loss: 0.0218505859375 },
        { text: "girls", start: 1.619999999, end: 2.059999999, loss: 0.012625503540039062 },
        { text: " ", start: 2.059999999, end: 2.279999999, loss: 0.0087890625 },
        { text: "don't", start: 2.279999999, end: 2.639999999, loss: 0.005620574951171875 }
      ],
      characters: [
        { text: "P", start: 1.159, end: 1.22, loss: 0.5 },
        { text: "a", start: 1.22, end: 1.339, loss: 0.3 }
        // ... more characters
      ],
      loss: 0.11857939722767266
    };

    console.log('Step 1: Optimize alignment data');
    console.log(`Original words: ${mockAlignment.words.length}`);
    console.log(`Original characters: ${mockAlignment.characters.length}`);

    // Optimization: Remove loss, round timestamps to 2 decimals
    const optimized = {
      words: mockAlignment.words.map(w => ({
        text: w.text,
        start: Math.round(w.start * 100) / 100,  // 2 decimal precision (10ms)
        end: Math.round(w.end * 100) / 100
      })),
      // Optionally keep characters for fine-grained karaoke highlighting
      // For now, exclude to reduce size further
      // characters: mockAlignment.characters.map(c => ({
      //   text: c.text,
      //   start: Math.round(c.start * 100) / 100,
      //   end: Math.round(c.end * 100) / 100
      // }))
    };

    const originalJson = JSON.stringify(mockAlignment);
    const optimizedJson = JSON.stringify(optimized);

    console.log(`Original size: ${originalJson.length} bytes`);
    console.log(`Optimized size: ${optimizedJson.length} bytes`);
    console.log(`Reduction: ${((1 - optimizedJson.length / originalJson.length) * 100).toFixed(1)}%`);

    // Step 2: Upload to Grove
    console.log('\nStep 2: Upload to Grove');

    const groveResp = await fetch('https://api.grove.storage/?chain_id=37111', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: optimizedJson
    });

    if (!groveResp.ok) {
      const groveError = await groveResp.text();
      throw new Error(`Grove upload failed (${groveResp.status}): ${groveError}`);
    }

    const groveResult = await groveResp.json();
    // Grove returns an array
    const groveData = Array.isArray(groveResult) ? groveResult[0] : groveResult;

    console.log('✅ Grove upload successful');
    console.log(`Storage Key: ${groveData.storage_key}`);
    console.log(`URI: ${groveData.uri}`);
    console.log(`Gateway: ${groveData.gateway_url}`);

    const metadataUri = groveData.uri; // lens://...

    // Step 3: Contract write (if enabled)
    let txHash = null;
    let contractError = null;

    if (writeToBlockchain && contractAddress && pkpAddress && pkpPublicKey) {
      console.log('\nStep 3: Write to contract');

      try {
        // Mock song data for testing
        const songData = {
          id: 'test-song-sia-chandelier',
          geniusId: 378195,
          geniusArtistId: 489,
          title: 'Chandelier',
          artist: 'Sia',
          duration: 216, // ~3.6 minutes
          requiresPayment: false, // Free for testing
          audioUri: 'grove://test_audio.mp3', // Mock
          metadataUri: metadataUri,  // Real Grove URI with word timestamps!
          coverUri: 'grove://test_cover.jpg', // Mock
          thumbnailUri: 'grove://test_thumb.jpg', // Mock
          musicVideoUri: '', // Optional
          languages: 'en'
        };

        // ABI for addFullSong
        const abi = [{
          "type": "function",
          "name": "addFullSong",
          "inputs": [{
            "name": "params",
            "type": "tuple",
            "components": [
              { "name": "id", "type": "string" },
              { "name": "geniusId", "type": "uint32" },
              { "name": "geniusArtistId", "type": "uint32" },
              { "name": "title", "type": "string" },
              { "name": "artist", "type": "string" },
              { "name": "duration", "type": "uint32" },
              { "name": "requiresPayment", "type": "bool" },
              { "name": "audioUri", "type": "string" },
              { "name": "metadataUri", "type": "string" },
              { "name": "coverUri", "type": "string" },
              { "name": "thumbnailUri", "type": "string" },
              { "name": "musicVideoUri", "type": "string" },
              { "name": "languages", "type": "string" }
            ]
          }],
          "outputs": [],
          "stateMutability": "nonpayable"
        }];

        const iface = new ethers.utils.Interface(abi);
        const data = iface.encodeFunctionData('addFullSong', [songData]);

        const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
        const provider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC);

        // Get nonce and gas price
        const [nonce, gasPrice] = await Promise.all([
          provider.getTransactionCount(pkpAddress),
          provider.getGasPrice()
        ]);

        // Build unsigned transaction
        const unsignedTx = {
          to: contractAddress,
          nonce: nonce,
          gasLimit: 500000, // addFullSong
          gasPrice: gasPrice,
          data: data,
          chainId: 84532 // Base Sepolia
        };

        // Remove 0x prefix from public key
        let cleanPkpPublicKey = pkpPublicKey;
        if (cleanPkpPublicKey.startsWith('0x')) {
          cleanPkpPublicKey = cleanPkpPublicKey.substring(2);
        }

        // Sign transaction
        const transactionHash = ethers.utils.keccak256(ethers.utils.serializeTransaction(unsignedTx));
        const toSign = ethers.utils.arrayify(transactionHash);

        console.log('Signing transaction with PKP...');
        const signature = await Lit.Actions.signAndCombineEcdsa({
          toSign: toSign,
          publicKey: cleanPkpPublicKey,
          sigName: 'addFullSongTx'
        });

        const jsonSignature = JSON.parse(signature);

        // Calculate EIP-155 v value
        const v = jsonSignature.recid + 35 + (84532 * 2); // EIP-155: v = recid + 35 + chainId * 2

        // Serialize signed transaction
        const signedTx = ethers.utils.serializeTransaction(unsignedTx, {
          r: jsonSignature.r,
          s: jsonSignature.s,
          v: v
        });

        // Submit via runOnce (single node submits)
        const submitResult = await Lit.Actions.runOnce(
          { waitForResponse: true, name: "submitTx" },
          async () => {
            try {
              const txResp = await provider.sendTransaction(signedTx);
              return JSON.stringify({ hash: txResp.hash });
            } catch (error) {
              return JSON.stringify({ error: error.message });
            }
          }
        );

        const submitData = JSON.parse(submitResult);

        if (submitData.error) {
          contractError = submitData.error;
          console.log('❌ Transaction failed:', contractError);
        } else {
          txHash = submitData.hash;
          console.log('✅ Transaction submitted:', txHash);
        }

      } catch (error) {
        contractError = error.message;
        console.log('❌ Contract write error:', contractError);
      }
    } else {
      console.log('\nStep 3: Contract write skipped (disabled or missing params)');
    }

    // Return results
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        optimization: {
          originalSize: originalJson.length,
          optimizedSize: optimizedJson.length,
          reduction: `${((1 - optimizedJson.length / originalJson.length) * 100).toFixed(1)}%`,
          wordsCount: optimized.words.length
        },
        grove: {
          storageKey: groveData.storage_key,
          uri: groveData.uri,
          gatewayUrl: groveData.gateway_url
        },
        contract: {
          txHash: txHash,
          error: contractError,
          metadataUri: metadataUri
        },
        sample: optimized.words.slice(0, 3) // Show first 3 words
      })
    });

  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    });
  }
})();
