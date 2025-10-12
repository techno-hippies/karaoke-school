/**
 * Match and Segment v2: Combined single-query approach with Gemini 2.5 Flash Lite
 *
 * Single API call that:
 * 1. Determines if Genius and LRClib songs match
 * 2. If they match, segments the song into sections (verse, chorus, etc.)
 * 3. Writes segments to KaraokeCatalogV1 contract on Base Sepolia
 * 4. Returns structured JSON with match decision + sections + txHash
 */

console.log('=== LIT ACTION LOADED ===');
console.log('Lit Actions API available:', typeof Lit !== 'undefined');
console.log('ethers available:', typeof ethers !== 'undefined');

const go = async () => {
  console.log('=== STARTING EXECUTION ===');
  const {
    geniusId,
    geniusKeyAccessControlConditions,
    geniusKeyCiphertext,
    geniusKeyDataToEncryptHash,
    openrouterKeyAccessControlConditions,
    openrouterKeyCiphertext,
    openrouterKeyDataToEncryptHash,
    // Contract write params (optional)
    contractAddress,
    pkpAddress,
    pkpTokenId,
    writeToBlockchain = true
  } = jsParams || {};

  console.log('jsParams received, geniusId:', geniusId, 'writeToBlockchain:', writeToBlockchain);

  try {
    // Step 1: Decrypt keys
    console.log('[1/3] Decrypting keys...');
    console.log('Genius key ACC:', JSON.stringify(geniusKeyAccessControlConditions).substring(0, 150));
    console.log('OpenRouter key ACC:', JSON.stringify(openrouterKeyAccessControlConditions).substring(0, 150));
    console.log('writeToBlockchain:', writeToBlockchain);

    let geniusKey, openrouterKey;
    try {
      [geniusKey, openrouterKey] = await Promise.all([
        Lit.Actions.decryptAndCombine({
          accessControlConditions: geniusKeyAccessControlConditions,
          ciphertext: geniusKeyCiphertext,
          dataToEncryptHash: geniusKeyDataToEncryptHash,
          authSig: null,
          chain: 'ethereum'
        }),
        Lit.Actions.decryptAndCombine({
          accessControlConditions: openrouterKeyAccessControlConditions,
          ciphertext: openrouterKeyCiphertext,
          dataToEncryptHash: openrouterKeyDataToEncryptHash,
          authSig: null,
          chain: 'ethereum'
        })
      ]);
    } catch (decryptError) {
      console.log('Decryption error:', decryptError.message);
      console.log('Decryption error details:', JSON.stringify(decryptError).substring(0, 500));
      throw new Error(`Failed to decrypt keys: ${decryptError.message}`);
    }
    console.log('Keys decrypted');
    console.log('Genius key length:', geniusKey.length, 'first 10 chars:', geniusKey.substring(0, 10));
    console.log('OpenRouter key length:', openrouterKey.length, 'first 10 chars:', openrouterKey.substring(0, 10));

    // Step 2: Fetch Genius
    console.log('[2/3] Fetching Genius...');
    const geniusResp = await fetch(`https://api.genius.com/songs/${geniusId}`, {
      headers: { 'Authorization': `Bearer ${geniusKey}` }
    });
    const geniusData = await geniusResp.json();
    const artist = geniusData.response?.song?.artist_names || 'N/A';
    const title = geniusData.response?.song?.title || 'N/A';
    const album = geniusData.response?.song?.album?.name || 'N/A';
    console.log(`Genius: ${artist} - ${title}`);

    // Step 3: Fetch LRClib with scoring
    console.log('[3/3] Fetching LRClib...');
    const lrcResp = await fetch(`https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
    const lrcData = await lrcResp.json();

    // Score each result
    const scored = lrcData.map(result => {
      let score = 0;

      // Artist match (most important - 50 points)
      const artistLower = artist.toLowerCase();
      const resultArtistLower = result.artistName.toLowerCase();
      if (resultArtistLower.includes(artistLower) || artistLower.includes(resultArtistLower)) {
        score += 50;
      }

      // Title match (critical - 40 points)
      if (result.trackName.toLowerCase() === title.toLowerCase()) {
        score += 40;
      }

      // Album match (nice-to-have - 10 points, only if both exist)
      if (album !== 'N/A' && result.albumName &&
          result.albumName.toLowerCase().includes(album.toLowerCase())) {
        score += 10;
      }

      return { ...result, score };
    });

    // Take highest scoring
    const lrcMatch = scored.sort((a, b) => b.score - a.score)[0];
    console.log(`LRClib: Found ${lrcData.length} results, best match score: ${lrcMatch.score}, duration: ${lrcMatch.duration}s`);

    // Get full synced lyrics
    const lrcFullResp = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(lrcMatch.artistName)}&track_name=${encodeURIComponent(lrcMatch.trackName)}&duration=${lrcMatch.duration}`);
    const lrcFull = await lrcFullResp.json();
    const lyrics = lrcFull.syncedLyrics || '';
    console.log(`Got ${lyrics.split('\n').length} lines of lyrics`);

    // Step 4: Combined match + segment query
    console.log('[4/4] Asking Gemini 2.5 Flash Lite to match and segment...');
    console.log('Creating prompt...');

    const prompt = `Compare these two songs by ARTIST and TITLE only (ignore album):

Genius: ${artist} - ${title}
LRClib: ${lrcMatch.artistName} - ${lrcMatch.trackName}

If the artist and title match, analyze these LRC-formatted lyrics and identify AT MOST 5 BEST song segments for karaoke practice:

${lyrics}

Instructions:
1. Compare artist and title (case-insensitive). If both match, set isMatch=true.
2. If matched, extract AT MOST 5 best segments for karaoke practice.
3. Prioritize verses, choruses, bridge. Skip intros, outros, instrumentals.
4. Labels: Verse 1, Verse 2, Verse 3, Verse 4, Chorus 1, Chorus 2, Bridge.
5. Use Chorus 1 for main chorus. Only use Chorus 2 if vocals/melody differ significantly.
6. Confidence: high (artist+title exact match), medium (close), low (different).
7. CRITICAL - Timestamp conversion: LRC format is [mm:ss.xx]. Convert to TOTAL SECONDS: (mm * 60) + ss.xx
   Example: [01:23.45] = (1 * 60) + 23.45 = 83.45 seconds
   Example: [02:15.80] = (2 * 60) + 15.80 = 135.80 seconds
   All startTime, endTime, duration values MUST be in total seconds, not fractional minutes.`;

    console.log('Prompt created, length:', prompt.length);
    console.log('Calling OpenRouter API...');

    const apiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Karaoke School Match and Segment v2',
        'HTTP-Referer': 'https://karaoke.school'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 4000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'match_and_segment',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                isMatch: {
                  type: 'boolean',
                  description: 'Whether the Genius and LRClib songs are the same'
                },
                confidence: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Confidence level of the match decision'
                },
                sections: {
                  type: 'array',
                  description: 'Song sections (only if isMatch is true)',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        description: 'Section label: Verse 1, Verse 2, Verse 3, Verse 4, Chorus 1, Chorus 2, Bridge'
                      },
                      startTime: { type: 'number' },
                      endTime: { type: 'number' },
                      duration: { type: 'number' }
                    },
                    required: ['type', 'startTime', 'endTime', 'duration'],
                    additionalProperties: false
                  }
                }
              },
              required: ['isMatch', 'confidence', 'sections'],
              additionalProperties: false
            }
          }
        }
      })
    });

    console.log('API call completed, status:', apiResp.status);
    const apiData = await apiResp.json();
    console.log('API response parsed');

    // Check for API errors
    if (apiData.error) {
      throw new Error(`OpenRouter API error: ${apiData.error.message || JSON.stringify(apiData.error)}`);
    }

    const content = apiData.choices?.[0]?.message?.content || '{"isMatch":false,"confidence":"low","sections":[]}';
    console.log('API response content (first 500 chars):', content.substring(0, 500));

    // Structured output guarantees valid JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.log('Failed to parse response (full):', content);
      throw new Error(`JSON parse failed: ${parseError.message}`);
    }

    console.log(`Match: ${result.isMatch} (${result.confidence} confidence)`);
    console.log(`Sections: ${result.sections.length}`);

    // Step 5: Sign and submit transaction for blockchain (if enabled and matched)
    let txHash = null;
    let contractError = null;

    if (writeToBlockchain && result.isMatch && result.sections.length > 0) {
      try {
        console.log('[5/5] Signing and submitting transaction to blockchain...');

        // Validate contract params
        if (!contractAddress || !pkpAddress || !pkpTokenId) {
          throw new Error('Contract address, PKP address, and PKP token ID required for blockchain writes');
        }

        // Prepare contract call data
        const maxDuration = Math.floor(Math.max(...result.sections.map(s => s.endTime)));
        const segmentIds = result.sections.map((s, i) => `${s.type.toLowerCase().replace(/\s+/g, '-')}-${i}`);
        const sectionTypes = result.sections.map(s => s.type);
        const startTimes = result.sections.map(s => Math.floor(s.startTime));
        const endTimes = result.sections.map(s => Math.floor(s.endTime));

        // ABI for createSegmentsBatch
        const abi = [{
          "type": "function",
          "name": "createSegmentsBatch",
          "inputs": [
            {"name": "geniusId", "type": "uint32"},
            {"name": "songId", "type": "string"},
            {"name": "title", "type": "string"},
            {"name": "artist", "type": "string"},
            {"name": "duration", "type": "uint32"},
            {"name": "segmentIds", "type": "string[]"},
            {"name": "sectionTypes", "type": "string[]"},
            {"name": "startTimes", "type": "uint32[]"},
            {"name": "endTimes", "type": "uint32[]"},
            {"name": "createdBy", "type": "address"}
          ],
          "outputs": [],
          "stateMutability": "nonpayable"
        }];

        // Create contract interface
        const iface = new ethers.utils.Interface(abi);
        const data = iface.encodeFunctionData('createSegmentsBatch', [
          geniusId,
          '', // songId (empty for Genius songs)
          title,
          artist,
          maxDuration,
          segmentIds,
          sectionTypes,
          startTimes,
          endTimes,
          pkpAddress
        ]);

        // Use hardcoded RPC URL for Base Sepolia (getRpcUrl may not support it)
        const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
        const provider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC);

        // Get nonce and gas price in parallel
        const [nonce, gasPrice] = await Promise.all([
          provider.getTransactionCount(pkpAddress),
          provider.getGasPrice()
        ]);

        // Build unsigned transaction
        const unsignedTx = {
          to: contractAddress,
          nonce: nonce,
          gasLimit: 2000000, // Batch create with multiple segments
          gasPrice: gasPrice,
          data: data,
          chainId: 84532 // Base Sepolia
        };

        // Get PKP public key (must be provided)
        let pkpPublicKey = jsParams.pkpPublicKey;

        if (!pkpPublicKey) {
          throw new Error('pkpPublicKey is required in jsParams');
        }

        console.log('Using PKP public key (first 20 chars):', pkpPublicKey.substring(0, 20) + '...');

        // Remove 0x prefix if present
        if (pkpPublicKey.startsWith('0x')) {
          pkpPublicKey = pkpPublicKey.substring(2);
        }

        // Sign transaction hash (MUST be outside runOnce - needs 2/3 nodes)
        const transactionHash = ethers.utils.keccak256(ethers.utils.serializeTransaction(unsignedTx));
        const toSign = ethers.utils.arrayify(transactionHash);

        console.log('Signing transaction with PKP...');
        const signature = await Lit.Actions.signAndCombineEcdsa({
          toSign: toSign,
          publicKey: pkpPublicKey,  // Use fetched public key
          sigName: 'segmentBatchTx'
        });

        console.log('Raw signature:', signature.substring(0, 200));

        // Parse and format signature
        const jsonSignature = JSON.parse(signature);
        console.log('Parsed signature keys:', Object.keys(jsonSignature));
        console.log('Parsed signature values:', JSON.stringify({
          r: jsonSignature.r?.substring(0, 20) + '...',
          s: jsonSignature.s?.substring(0, 20) + '...',
          recid: jsonSignature.recid,
          v: jsonSignature.v
        }));

        // Ensure r and s have 0x prefix
        const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
        const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

        // Get recovery ID with fallback logic
        // Lit may return 'recid' (0 or 1) or 'v' (27/28 or EIP-155 format)
        const recid = jsonSignature.recid ?? (jsonSignature.v ? jsonSignature.v - 27 : 0);
        console.log('Extracted recid:', recid);

        // Calculate EIP-155 v value: v = chainId * 2 + 35 + recid
        const chainId = 84532; // Base Sepolia
        const v = chainId * 2 + 35 + recid;
        console.log('Calculated EIP-155 v:', v);

        const sigObject = {
          r: rHex,
          s: sHex,
          v: v
        };

        console.log('Signature: r, s, recid =', recid, ', EIP-155 v =', v);

        // Serialize signed transaction
        const signedTx = ethers.utils.serializeTransaction(unsignedTx, sigObject);

        console.log('✅ Transaction signed successfully');
        console.log('   Signed tx length:', signedTx.length);

        // Submit transaction using runOnce to avoid duplicates from multiple nodes
        console.log('Submitting transaction with runOnce...');
        const txHashResult = await Lit.Actions.runOnce(
          { waitForResponse: true, name: "segmentBatchTx" },
          async () => {
            try {
              const hash = await provider.send("eth_sendRawTransaction", [signedTx]);
              return hash;
            } catch (error) {
              return `TX_SUBMIT_ERROR: ${error.message}`;
            }
          }
        );

        txHash = txHashResult;
        signedTransaction = null; // Not needed - transaction already submitted

        // Check if txHash is an error message
        if (txHash && txHash.startsWith('TX_SUBMIT_ERROR:')) {
          console.log('Transaction submission failed:', txHash);
          contractError = txHash;
          txHash = null;
        } else {
          console.log('✅ Transaction submitted:', txHash);
          console.log('   (Not waiting for confirmation - fire and forget)');
        }
      } catch (error) {
        console.error('Contract write failed:', error.message);
        contractError = error.message;
      }
    } else if (writeToBlockchain && !result.isMatch) {
      console.log('[5/5] Skipping blockchain write - songs did not match');
    } else if (writeToBlockchain && result.sections.length === 0) {
      console.log('[5/5] Skipping blockchain write - no sections found');
    } else {
      console.log('[5/5] Blockchain write disabled');
    }

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        genius: { artist, title, album },
        lrclib: {
          artist: lrcMatch.artistName,
          title: lrcMatch.trackName,
          album: lrcMatch.albumName,
          lyricsLines: lyrics.split('\n').length,
          matchScore: lrcMatch.score
        },
        isMatch: result.isMatch,
        confidence: result.confidence,
        sections: result.sections,
        // Blockchain data (fire-and-forget, no confirmation wait)
        txHash: txHash,
        contractError: contractError,
        contractAddress: contractAddress
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
};

go().catch(error => {
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: false,
      error: error.message || 'Fatal error',
      stack: error.stack
    })
  });
});
