/**
 * Match and Segment v6: Fast Song Structure Extraction
 *
 * OPTIMIZED: Removes ElevenLabs alignment for faster contract writes.
 * Alignment and translations will be done separately per-language when user starts recording.
 *
 * Single Lit Action that:
 * 1. Determines if Genius and LRClib songs match
 * 2. If they match, segments the song into sections (verse, chorus, etc.)
 * 3. Writes segments to KaraokeCatalogV2 contract IMMEDIATELY (no alignment required)
 * 4. Returns structured JSON with match decision + sections + txHash
 *
 * Changes from v5:
 * - Removed ElevenLabs forced alignment (moved to lyrics-alignment-v1.js)
 * - Removed translations (zh, vi) from LLM prompt (moved to per-language action)
 * - Contract write no longer requires alignment success
 * - Fast execution: ~5-10s (was ~30-60s with alignment)
 * - Robust: Always writes to contract if match succeeds
 *
 * Time: ~5-10s
 * Cost: ~$0.01 (OpenRouter LLM only)
 */

console.log('=== LIT ACTION v6 LOADED ===');
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
    console.log('[1/4] Decrypting keys...');

    let geniusKey, openrouterKey;
    try {
      console.log('Creating decrypt promises for Genius and OpenRouter...');
      const decryptPromises = [
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
      ];

      console.log('Awaiting Promise.all for decryption...');
      const keys = await Promise.all(decryptPromises);
      console.log('Promise.all resolved, extracting keys...');
      geniusKey = keys[0];
      openrouterKey = keys[1];
      console.log('Keys extracted successfully');

    } catch (decryptError) {
      console.log('Decryption error:', decryptError.message);
      throw new Error(`Failed to decrypt keys: ${decryptError.message}`);
    }
    console.log('Keys decrypted');

    // Step 2: Fetch Genius
    console.log('[2/4] Fetching Genius...');
    console.log('About to fetch from Genius API...');
    const geniusResp = await fetch(`https://api.genius.com/songs/${geniusId}`, {
      headers: { 'Authorization': `Bearer ${geniusKey}` }
    });
    console.log('Genius API responded');

    const geniusData = await geniusResp.json();
    console.log('Genius JSON parsed');
    if (geniusData.meta?.status !== 200) {
      throw new Error(`Genius API error: ${geniusData.meta?.status} ${geniusData.error || ''}`);
    }

    const song = geniusData.response.song;
    const artist = song.artist_names;
    const title = song.title;
    const album = song.album?.name || '';

    // Extract SoundCloud permalink from song.media array
    const soundcloudMedia = song.media?.find(m => m.provider === 'soundcloud');
    const soundcloudPermalink = soundcloudMedia?.url || null;

    console.log(`Genius: ${artist} - ${title} (Album: ${album || 'N/A'})`);
    console.log(`SoundCloud: ${soundcloudPermalink || 'NOT FOUND'}`);

    // Step 3: Fetch LRClib (try with album, then without if no matches)
    console.log('[3/4] Fetching LRClib...');
    console.log('About to fetch from LRClib API...');

    // Try with album first
    let lrcResp = await fetch(
      'https://lrclib.net/api/search?' +
      new URLSearchParams({
        artist_name: artist,
        track_name: title,
        album_name: album
      })
    );
    console.log('LRClib API responded');

    let lrcResults = await lrcResp.json();
    console.log(`LRClib JSON parsed: ${lrcResults.length} matches`);

    // If no matches and we had an album, try without album
    if (lrcResults.length === 0 && album) {
      console.log('No matches with album, retrying without album...');
      lrcResp = await fetch(
        'https://lrclib.net/api/search?' +
        new URLSearchParams({
          artist_name: artist,
          track_name: title
        })
      );
      lrcResults = await lrcResp.json();
      console.log(`LRClib retry: ${lrcResults.length} matches`);
    }

    if (lrcResults.length === 0) {
      throw new Error('No LRClib matches found');
    }

    // Use top match
    const lrcMatch = lrcResults[0];
    const lyrics = lrcMatch.syncedLyrics;

    if (!lyrics) {
      throw new Error('No synced lyrics available in LRClib');
    }

    console.log(`LRClib: ${lrcMatch.artistName} - ${lrcMatch.trackName}`);
    console.log(`Match score: ${lrcMatch.score || 'N/A'}`);
    console.log(`Synced lyrics: ${lyrics.split('\n').length} lines`);

    // Parse synced lyrics (.lrc format)
    const lrcLines = [];
    const plainLines = [];
    for (const line of lyrics.split('\n')) {
      const match = line.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
      if (match) {
        const mins = parseInt(match[1]);
        const secs = parseFloat(match[2]);
        const timestamp = mins * 60 + secs;
        const text = match[3];
        lrcLines.push({ timestamp, text });
        plainLines.push(text);
      }
    }

    const plainLyrics = plainLines.join('\n');
    console.log(`Parsed ${lrcLines.length} timestamped lines`);

    // Step 4: AI matching + segmentation (NO translations)
    console.log('[4/4] AI matching + segmentation...');

    // Build numbered lyrics for AI prompt
    const numberedLyrics = lrcLines.map((l, i) => `${i}: ${l.text}`).join('\n');

    const prompt = `You are a music structure analyzer. Compare these two songs and segment if they match.

Genius API:
- Artist: ${artist}
- Title: ${title}
- Album: ${album || 'N/A'}

LRClib Result:
- Artist: ${lrcMatch.artistName}
- Title: ${lrcMatch.trackName}
- Album: ${lrcMatch.albumName || 'N/A'}
- Match score: ${lrcMatch.score || 'N/A'}

Synced Lyrics (${lrcLines.length} lines, numbered for reference):
${numberedLyrics}

Instructions:
1. Compare artist and title (case-insensitive). If both match, set isMatch=true.
2. If matched, extract AT MOST 5 best segments for karaoke practice.
3. Prioritize verses, choruses, bridge. Skip intros, outros, instrumentals.
4. Labels: Verse 1, Verse 2, Verse 3, Verse 4, Chorus 1, Chorus 2, Bridge.
5. Use Chorus 1 for main chorus. Only use Chorus 2 if vocals/melody differ significantly.
6. Confidence: high (artist+title exact match), medium (close), low (different).
7. For each section, return the LINE NUMBER (0-based index) where it starts and ends.
8. Example: if Verse 1 goes from line 5 to line 12, return startLine: 5, endLine: 12.`;

    console.log('About to call OpenRouter API (using runOnce to prevent 3x calls)...');

    // Use runOnce to ensure only ONE node makes the LLM call (not all 3)
    const llmResponseJson = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "openrouterLLM" },
      async () => {
        try {
          const apiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'Content-Type': 'application/json',
              'X-Title': 'Karaoke School Match and Segment v6',
              'HTTP-Referer': 'https://karaoke.school'
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite-preview-09-2025',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0,
              max_tokens: 2000,
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
                            startLine: {
                              type: 'number',
                              description: 'Line index where section starts (0-based)'
                            },
                            endLine: {
                              type: 'number',
                              description: 'Line index where section ends (0-based, inclusive)'
                            }
                          },
                          required: ['type', 'startLine', 'endLine'],
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

          if (apiData.error) {
            return JSON.stringify({
              error: true,
              message: apiData.error.message || JSON.stringify(apiData.error)
            });
          }

          const content = apiData.choices?.[0]?.message?.content || '{"isMatch":false,"confidence":"low","sections":[]}';
          return content;
        } catch (error) {
          return JSON.stringify({
            error: true,
            message: error.message
          });
        }
      }
    );

    console.log('OpenRouter API responded via runOnce');
    console.log(`AI response length: ${llmResponseJson.length} chars`);

    // Parse JSON response from runOnce
    let result;
    try {
      result = JSON.parse(llmResponseJson);

      // Check if runOnce returned an error
      if (result.error) {
        throw new Error(`OpenRouter API error: ${result.message}`);
      }
    } catch (e) {
      // If parsing fails, it might be a JSON string, try again
      console.error('JSON parse failed:', e.message);
      console.error('Response preview:', llmResponseJson.substring(0, 300));
      throw new Error(`AI returned invalid JSON: ${e.message}\nResponse: ${llmResponseJson.substring(0, 500)}`);
    }

    console.log(`Match: ${result.isMatch} (${result.confidence} confidence)`);
    console.log(`Sections: ${result.sections.length}`);

    // Convert line indices to timestamps
    const sections = result.sections.map(section => {
      const startTime = lrcLines[section.startLine]?.timestamp || 0;
      const endTime = lrcLines[section.endLine]?.timestamp || 0;
      const duration = endTime - startTime;
      return {
        type: section.type,
        startTime,
        endTime,
        duration
      };
    });

    console.log(`Converted ${sections.length} sections to timestamps`);

    // Step 5: Sign and submit transaction for blockchain (if enabled and matched)
    let txHash = null;
    let contractError = null;

    if (writeToBlockchain && result.isMatch && sections.length > 0) {
      try {
        console.log('[5/5] Signing and submitting transaction to blockchain...');

        // Validate contract params
        if (!contractAddress || !pkpAddress || !pkpTokenId) {
          throw new Error('Contract address, PKP address, and PKP token ID required for blockchain writes');
        }

        // Prepare full song data WITHOUT alignment metadata (will be added later)
        const maxDuration = Math.floor(Math.max(...sections.map(s => s.endTime)));
        const songId = `genius-${geniusId}`;

        // Song data struct for addFullSong (V2 OPTIMIZED - removed geniusArtistId and languages)
        const songData = {
          id: songId,
          geniusId: geniusId,
          title: title,
          artist: artist,
          duration: maxDuration,
          requiresPayment: false, // Free songs (alignment will be added per-language later)
          audioUri: '', // Could be added later
          metadataUri: '', // EMPTY - will be populated by lyrics-alignment-v1.js per language
          coverUri: '', // Could be added later
          thumbnailUri: '', // Could be added later
          musicVideoUri: '' // Optional
        };

        // ABI for addFullSong (V2 OPTIMIZED - 11 fields, no geniusArtistId/languages)
        const abi = [{
          "type": "function",
          "name": "addFullSong",
          "inputs": [{
            "name": "params",
            "type": "tuple",
            "components": [
              { "name": "id", "type": "string" },
              { "name": "geniusId", "type": "uint32" },
              { "name": "title", "type": "string" },
              { "name": "artist", "type": "string" },
              { "name": "duration", "type": "uint32" },
              { "name": "requiresPayment", "type": "bool" },
              { "name": "audioUri", "type": "string" },
              { "name": "metadataUri", "type": "string" },
              { "name": "coverUri", "type": "string" },
              { "name": "thumbnailUri", "type": "string" },
              { "name": "musicVideoUri", "type": "string" }
            ]
          }],
          "outputs": [],
          "stateMutability": "nonpayable"
        }];

        // Create contract interface
        const iface = new ethers.utils.Interface(abi);
        const data = iface.encodeFunctionData('addFullSong', [songData]);

        // Use hardcoded RPC URL for Base Sepolia
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
          gasLimit: 500000, // addFullSong (lower than batch create)
          gasPrice: gasPrice,
          data: data,
          chainId: 84532 // Base Sepolia
        };

        // Get PKP public key
        let pkpPublicKey = jsParams.pkpPublicKey;
        if (!pkpPublicKey) {
          throw new Error('pkpPublicKey is required in jsParams');
        }

        if (pkpPublicKey.startsWith('0x')) {
          pkpPublicKey = pkpPublicKey.substring(2);
        }

        // Sign transaction hash
        const transactionHash = ethers.utils.keccak256(ethers.utils.serializeTransaction(unsignedTx));
        const toSign = ethers.utils.arrayify(transactionHash);

        const signature = await Lit.Actions.signAndCombineEcdsa({
          toSign: toSign,
          publicKey: pkpPublicKey,
          sigName: 'addFullSongTx'
        });

        // Parse and format signature
        const jsonSignature = JSON.parse(signature);
        const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
        const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

        // Extract recovery ID - Lit returns recid (0 or 1)
        let recid = 0;
        if (jsonSignature.recid !== undefined) {
          recid = jsonSignature.recid;
        } else if (jsonSignature.v !== undefined) {
          // Handle legacy v format (27/28)
          recid = jsonSignature.v >= 27 ? jsonSignature.v - 27 : jsonSignature.v;
        }

        // Calculate EIP-155 v value
        const chainId = 84532;
        const v = chainId * 2 + 35 + recid;

        const sigObject = { r: rHex, s: sHex, v: v };

        // Serialize signed transaction
        const signedTx = ethers.utils.serializeTransaction(unsignedTx, sigObject);
        console.log('✅ Transaction signed');

        // Submit transaction using runOnce
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

        if (txHash && txHash.startsWith('TX_SUBMIT_ERROR:')) {
          console.log('Transaction submission failed:', txHash);
          contractError = txHash;
          txHash = null;
        } else {
          console.log('✅ Transaction submitted:', txHash);
        }
      } catch (error) {
        console.error('Contract write failed:', error.message);
        contractError = error.message;
      }
    } else if (writeToBlockchain && !result.isMatch) {
      console.log('[5/5] Skipping blockchain write - songs did not match');
    } else if (writeToBlockchain && sections.length === 0) {
      console.log('[5/5] Skipping blockchain write - no sections found');
    } else {
      console.log('[5/5] Blockchain write disabled');
    }

    console.log('=== PREPARING FINAL RESPONSE ===');
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        genius: { artist, title, album, soundcloudPermalink },
        lrclib: {
          artist: lrcMatch.artistName,
          title: lrcMatch.trackName,
          album: lrcMatch.albumName,
          lyricsLines: lyrics.split('\n').length,
          matchScore: lrcMatch.score
        },
        isMatch: result.isMatch,
        confidence: result.confidence,
        sections: sections,
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
