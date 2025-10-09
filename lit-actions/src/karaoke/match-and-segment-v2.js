/**
 * Match and Segment v2: Combined single-query approach with Gemini 2.5 Flash Lite
 *
 * Single API call that:
 * 1. Determines if Genius and LRClib songs match
 * 2. If they match, segments the song into sections (verse, chorus, etc.)
 * 3. Writes segments to KaraokeCatalogV1 contract on Base Sepolia
 * 4. Returns structured JSON with match decision + sections + txHash
 */

const go = async () => {
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

  try {
    // Step 1: Decrypt keys
    console.log('[1/3] Decrypting keys...');
    const [geniusKey, openrouterKey] = await Promise.all([
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

    const prompt = `Compare these two songs and determine if they are the EXACT same song:

Genius: ${artist} - ${title} (${album})
LRClib: ${lrcMatch.artistName} - ${lrcMatch.trackName} (${lrcMatch.albumName || 'N/A'})

If they ARE the same song, analyze these LRC-formatted lyrics and SELECT AT MOST 5 BEST SEGMENTS for karaoke practice:

${lyrics}

Instructions:
1. Determine if the songs match (compare artist and title)
2. If they match, SELECT AT MOST 5 BEST SEGMENTS for karaoke singing practice
3. Prioritize sections with strong vocals: verses, choruses, bridge
4. SKIP instrumental sections, intros, outros, interludes, breaks
5. Label sections using ONLY these options: "Verse 1", "Verse 2", "Verse 3", "Verse 4", "Chorus 1", "Chorus 2", "Bridge"
6. Use "Chorus 1" for the main chorus. Only use "Chorus 2" if a later chorus has different vocals, melody, harmonies, or structure worth practicing separately
7. Set confidence based on match quality: high (exact match), medium (similar), low (uncertain)

WRONG (too many segments):
{
  "isMatch": true,
  "confidence": "high",
  "sections": [
    { "type": "Intro", "startTime": 0, "endTime": 8, "duration": 8 },
    { "type": "Verse 1", "startTime": 8, "endTime": 28, "duration": 20 },
    { "type": "Pre-Chorus", "startTime": 28, "endTime": 38, "duration": 10 },
    { "type": "Chorus 1", "startTime": 38, "endTime": 58, "duration": 20 },
    { "type": "Verse 2", "startTime": 58, "endTime": 78, "duration": 20 },
    { "type": "Chorus 2", "startTime": 88, "endTime": 108, "duration": 20 },
    { "type": "Bridge", "startTime": 108, "endTime": 128, "duration": 20 },
    { "type": "Outro", "startTime": 168, "endTime": 180, "duration": 12 }
  ]
}

RIGHT (at most 5 best karaoke segments):
{
  "isMatch": true,
  "confidence": "high",
  "sections": [
    { "type": "Verse 1", "startTime": 8, "endTime": 28, "duration": 20 },
    { "type": "Verse 2", "startTime": 58, "endTime": 78, "duration": 20 },
    { "type": "Chorus 1", "startTime": 38, "endTime": 58, "duration": 20 },
    { "type": "Bridge", "startTime": 108, "endTime": 128, "duration": 20 }
  ]
}

Focus on giving users the most valuable practice sections, not a complete song breakdown.`;

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

    const apiData = await apiResp.json();

    // Check for API errors
    if (apiData.error) {
      throw new Error(`OpenRouter API error: ${apiData.error.message || JSON.stringify(apiData.error)}`);
    }

    const content = apiData.choices?.[0]?.message?.content || '{"isMatch":false,"confidence":"low","sections":[]}';

    // Structured output guarantees valid JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.log('Failed to parse response:', content.substring(0, 200));
      throw new Error(`JSON parse failed: ${parseError.message}`);
    }

    console.log(`Match: ${result.isMatch} (${result.confidence} confidence)`);
    console.log(`Sections: ${result.sections.length}`);

    // Step 5: Sign transaction for blockchain (if enabled and matched)
    let txHash = null;
    let contractError = null;
    let signedTransaction = null;

    if (writeToBlockchain && result.isMatch && result.sections.length > 0) {
      try {
        console.log('[5/5] Signing transaction for blockchain...');

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

        // Parse and format signature
        const jsonSignature = JSON.parse(signature);

        // Ensure r and s have 0x prefix
        const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
        const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

        // Get recovery ID (Lit may return 'recid' or 'v')
        const recid = jsonSignature.recid !== undefined ? jsonSignature.recid : jsonSignature.v;

        // Calculate EIP-155 v value: v = chainId * 2 + 35 + recid
        const chainId = 84532; // Base Sepolia
        const v = chainId * 2 + 35 + recid;

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

        // Return signed transaction for submission by caller
        // (Submitting here causes timeouts due to total execution time)
        signedTransaction = signedTx;
        txHash = null; // Will be set by caller after submission
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
        // Blockchain data
        signedTransaction: signedTransaction, // Raw signed tx for submission by caller
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
