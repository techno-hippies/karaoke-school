/**
 * Match and Segment v4: With Line-Based ElevenLabs Alignment
 *
 * Adds word-level timing organized into lines using ElevenLabs forced alignment API.
 *
 * Single Lit Action that:
 * 1. Determines if Genius and LRClib songs match
 * 2. If they match, segments the song into sections (verse, chorus, etc.)
 * 3. Downloads audio and runs ElevenLabs forced alignment for word-level timing
 * 4. Organizes word-level data into lines (split on \n) with line-level timestamps
 * 5. Writes segments to KaraokeCatalogV1 contract on Base Sepolia
 * 6. Returns structured JSON with match decision + sections + alignment + txHash
 */

console.log('=== LIT ACTION v4 LOADED ===');
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
    elevenlabsKeyAccessControlConditions,
    elevenlabsKeyCiphertext,
    elevenlabsKeyDataToEncryptHash,
    // Contract write params (optional)
    contractAddress,
    pkpAddress,
    pkpTokenId,
    writeToBlockchain = true,
    runAlignment = true  // Can disable alignment for testing
  } = jsParams || {};

  console.log('jsParams received, geniusId:', geniusId, 'writeToBlockchain:', writeToBlockchain, 'runAlignment:', runAlignment);

  try {
    // Step 1: Decrypt keys
    console.log('[1/4] Decrypting keys...');
    console.log('runAlignment:', runAlignment);

    let geniusKey, openrouterKey, elevenlabsKey;
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
      console.log('Basic decrypt promises created, count:', decryptPromises.length);

      // Add ElevenLabs key decryption if alignment is enabled
      if (runAlignment) {
        console.log('Adding ElevenLabs decrypt promise...');
        decryptPromises.push(
          Lit.Actions.decryptAndCombine({
            accessControlConditions: elevenlabsKeyAccessControlConditions,
            ciphertext: elevenlabsKeyCiphertext,
            dataToEncryptHash: elevenlabsKeyDataToEncryptHash,
            authSig: null,
            chain: 'ethereum'
          })
        );
        console.log('Total decrypt promises:', decryptPromises.length);
      }

      console.log('Awaiting Promise.all for decryption...');
      const keys = await Promise.all(decryptPromises);
      console.log('Promise.all resolved, extracting keys...');
      geniusKey = keys[0];
      openrouterKey = keys[1];
      elevenlabsKey = runAlignment ? keys[2] : null;
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
    console.log('Genius API responded, parsing JSON...');
    const geniusData = await geniusResp.json();
    console.log('Genius JSON parsed');
    const artist = geniusData.response?.song?.artist_names || 'N/A';
    const title = geniusData.response?.song?.title || 'N/A';
    const album = geniusData.response?.song?.album?.name || 'N/A';

    // Extract SoundCloud permalink for audio download
    console.log('Extracting SoundCloud permalink...');
    const soundcloudPermalink = geniusData.response?.song?.media?.find(m => m.provider === 'soundcloud')?.url || null;
    console.log(`Genius: ${artist} - ${title}`);
    if (soundcloudPermalink) {
      console.log(`SoundCloud: ${soundcloudPermalink}`);
    } else {
      console.log('⚠️ No SoundCloud link found');
    }

    // Step 3: Fetch LRClib with scoring
    console.log('[3/4] Fetching LRClib...');
    console.log('About to fetch from LRClib API...');
    const lrcResp = await fetch(`https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
    console.log('LRClib API responded, parsing JSON...');
    const lrcData = await lrcResp.json();
    console.log('LRClib JSON parsed, got', lrcData.length, 'results');

    // Score each result
    const scored = lrcData.map(result => {
      let score = 0;

      // Has synced lyrics (CRITICAL for ElevenLabs - 100 points)
      if (result.syncedLyrics) {
        score += 100;
      }

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

    // Use synced lyrics from search result (already includes full lyrics)
    const lyrics = lrcMatch.syncedLyrics || '';
    console.log(`Got ${lyrics.split('\n').length} lines of synced lyrics`);

    // Parse LRC to get timestamped lines
    const lrcLines = lyrics.split('\n')
      .map(line => {
        const match = line.match(/^\[(\d+):(\d+\.\d+)\]\s*(.*)$/);
        if (match) {
          const minutes = parseInt(match[1]);
          const seconds = parseFloat(match[2]);
          const timestamp = minutes * 60 + seconds;
          const text = match[3].trim();
          return { timestamp, text, raw: line };
        }
        return null;
      })
      .filter(x => x && x.text);

    console.log(`Parsed ${lrcLines.length} timestamped lyrics lines`);

    // Plain lyrics for ElevenLabs (just the text)
    const plainLyrics = lrcLines.map(l => l.text).join('\n');
    console.log(`Plain lyrics length: ${plainLyrics.length} chars, ${plainLyrics.split(/\s+/).length} words`);

    // Step 4: Combined match + segment query
    console.log('[4/4] Asking Gemini 2.5 Flash Lite to match and segment...');

    // Create numbered lyrics for AI to reference
    const numberedLyrics = lrcLines.map((l, i) => `${i}: ${l.text}`).join('\n');

    const prompt = `Compare these two songs by ARTIST and TITLE only (ignore album):

Genius: ${artist} - ${title}
LRClib: ${lrcMatch.artistName} - ${lrcMatch.trackName}

If the artist and title match, analyze these lyrics and identify AT MOST 5 BEST song segments for karaoke practice:

${numberedLyrics}

Instructions:
1. Compare artist and title (case-insensitive). If both match, set isMatch=true.
2. If matched, extract AT MOST 5 best segments for karaoke practice.
3. Prioritize verses, choruses, bridge. Skip intros, outros, instrumentals.
4. Labels: Verse 1, Verse 2, Verse 3, Verse 4, Chorus 1, Chorus 2, Bridge.
5. Use Chorus 1 for main chorus. Only use Chorus 2 if vocals/melody differ significantly.
6. Confidence: high (artist+title exact match), medium (close), low (different).
7. For each section, return the LINE NUMBER (0-based index) where it starts and ends.
8. Example: if Verse 1 goes from line 5 to line 12, return startLine: 5, endLine: 12.
9. IMPORTANT: Also translate EVERY line of the synced lyrics to Simplified Chinese (zh) and Vietnamese (vi).
10. Return translations as two arrays (zh and vi) in the EXACT same order as the original lines.
11. Each array must have exactly ${lrcLines.length} translations, one per line.`;

    console.log('About to call OpenRouter API...');
    const apiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Karaoke School Match and Segment v3',
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
                },
                translations: {
                  type: 'object',
                  description: 'Line-by-line translations in Chinese and Vietnamese',
                  properties: {
                    zh: {
                      type: 'array',
                      description: 'Simplified Chinese translations, one per line in same order',
                      items: { type: 'string' }
                    },
                    vi: {
                      type: 'array',
                      description: 'Vietnamese translations, one per line in same order',
                      items: { type: 'string' }
                    }
                  },
                  required: ['zh', 'vi'],
                  additionalProperties: false
                }
              },
              required: ['isMatch', 'confidence', 'sections', 'translations'],
              additionalProperties: false
            }
          }
        }
      })
    });

    console.log('OpenRouter API responded, parsing JSON...');
    const apiData = await apiResp.json();
    console.log('OpenRouter JSON parsed');
    if (apiData.error) {
      throw new Error(`OpenRouter API error: ${apiData.error.message || JSON.stringify(apiData.error)}`);
    }

    const content = apiData.choices?.[0]?.message?.content || '{"isMatch":false,"confidence":"low","sections":[]}';
    console.log(`AI response length: ${content.length} chars`);

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse failed:', e.message);
      console.error('Response preview:', content.substring(0, 300));
      throw new Error(`AI returned invalid JSON: ${e.message}\nResponse: ${content.substring(0, 500)}`);
    }

    console.log(`Match: ${result.isMatch} (${result.confidence} confidence)`);
    console.log(`Sections: ${result.sections.length}`);
    console.log(`Translations: zh=${result.translations?.zh?.length || 0}, vi=${result.translations?.vi?.length || 0}`);

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

    // Step 5: ElevenLabs Forced Alignment (if enabled and matched)
    let alignment = null;
    let alignmentError = null;

    console.log(`[5/6] Alignment check: runAlignment=${runAlignment}, isMatch=${result.isMatch}, hasSoundcloud=${!!soundcloudPermalink}, hasLyrics=${!!plainLyrics} (${plainLyrics.length} chars)`);

    if (runAlignment && result.isMatch && soundcloudPermalink && plainLyrics) {
      try {
        console.log('[5/6] ✅ All conditions met - Running ElevenLabs forced alignment...');
        console.log(`   SoundCloud: ${soundcloudPermalink}`);
        console.log(`   Lyrics: ${plainLyrics.length} chars`);

        const alignmentResult = await Lit.Actions.runOnce(
          { waitForResponse: true, name: "elevenlabsAlignment" },
          async () => {
            try {
              // Download audio from maid.zone (need last 2 parts: artist/song)
              const soundcloudPath = soundcloudPermalink.split('/').slice(-2).join('/');
              const audioUrl = `https://sc.maid.zone/_/restream/${soundcloudPath}`;

              const audioResp = await fetch(audioUrl);
              if (!audioResp.ok) {
                throw new Error(`Failed to download audio: ${audioResp.status}`);
              }

              const audioBlob = await audioResp.arrayBuffer();

              // Build multipart form manually (FormData doesn't work in Lit environment)
              const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2);
              const chunks = [];

              // Add 'file' field
              chunks.push(`--${boundary}\r\n`);
              chunks.push(`Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n`);
              chunks.push(`Content-Type: audio/mpeg\r\n\r\n`);
              chunks.push(audioBlob);
              chunks.push(`\r\n`);

              // Add 'text' field
              chunks.push(`--${boundary}\r\n`);
              chunks.push(`Content-Disposition: form-data; name="text"\r\n\r\n`);
              chunks.push(plainLyrics);
              chunks.push(`\r\n--${boundary}--\r\n`);

              // Encode chunks to single Uint8Array
              let totalLength = 0;
              const textEncoder = new TextEncoder();
              const encodedChunks = chunks.map(chunk => {
                if (typeof chunk === 'string') {
                  const encoded = textEncoder.encode(chunk);
                  totalLength += encoded.byteLength;
                  return encoded;
                } else {
                  totalLength += chunk.byteLength;
                  return new Uint8Array(chunk);
                }
              });

              const body = new Uint8Array(totalLength);
              let offset = 0;
              for (const chunk of encodedChunks) {
                body.set(chunk, offset);
                offset += chunk.byteLength;
              }

              // Call ElevenLabs
              const elevenResp = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
                method: 'POST',
                headers: {
                  'xi-api-key': elevenlabsKey,
                  'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: body
              });

              if (!elevenResp.ok) {
                const error = await elevenResp.text();
                throw new Error(`ElevenLabs error (${elevenResp.status}): ${error}`);
              }

              const alignmentData = await elevenResp.json();

              // Parse words into lines (split on \n) and optimize
              const lines = [];
              let currentLine = {
                words: [],
                start: null,
                end: null
              };

              for (const word of (alignmentData.words || [])) {
                const roundedWord = {
                  text: word.text,
                  start: Math.round(word.start * 100) / 100,
                  end: Math.round(word.end * 100) / 100
                };

                if (word.text === '\n') {
                  // End of line - finalize current line
                  if (currentLine.words.length > 0) {
                    currentLine.end = currentLine.words[currentLine.words.length - 1].end;
                    currentLine.text = currentLine.words.map(w => w.text).join('');
                    lines.push(currentLine);
                    currentLine = { words: [], start: null, end: null };
                  }
                } else {
                  // Add word to current line
                  if (currentLine.start === null) {
                    currentLine.start = roundedWord.start;
                  }
                  currentLine.words.push(roundedWord);
                }
              }

              // Add final line if exists
              if (currentLine.words.length > 0) {
                currentLine.end = currentLine.words[currentLine.words.length - 1].end;
                currentLine.text = currentLine.words.map(w => w.text).join('');
                lines.push(currentLine);
              }

              // Embed translations into lines
              const linesWithTranslations = lines.map((line, i) => ({
                id: `line-${i}`,
                start: line.start,
                end: line.end,
                text: line.text,
                translations: {
                  zh: result.translations?.zh?.[i] || '',
                  vi: result.translations?.vi?.[i] || ''
                },
                words: line.words
              }));

              const optimizedAlignment = { lines: linesWithTranslations };

              // Upload optimized alignment to Grove
              const groveResp = await fetch('https://api.grove.storage/?chain_id=37111', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(optimizedAlignment)
              });

              if (!groveResp.ok) {
                const groveError = await groveResp.text();
                throw new Error(`Grove upload failed (${groveResp.status}): ${groveError}`);
              }

              const groveResult = await groveResp.json();
              // Grove returns an array, take first element
              const groveData = Array.isArray(groveResult) ? groveResult[0] : groveResult;

              // Calculate total word count across all lines
              const totalWords = optimizedAlignment.lines.reduce((sum, line) => sum + line.words.length, 0);

              // Create preview with line timing and translations (first 5 lines)
              const linePreview = optimizedAlignment.lines.slice(0, 5).map(line => ({
                start: line.start,
                end: line.end,
                text: line.text,
                translations: {
                  zh: line.translations.zh,
                  vi: line.translations.vi
                }
              }));

              // Return alignment metadata with Grove storage info
              return JSON.stringify({
                success: true,
                lineCount: optimizedAlignment.lines.length,
                wordCount: totalWords,
                // Grove storage info
                storageKey: groveData.storage_key,
                uri: groveData.uri,
                gatewayUrl: groveData.gateway_url,
                // Preview: first 5 lines with timing
                lines: linePreview
              });
            } catch (e) {
              // Return error details instead of throwing
              return JSON.stringify({
                success: false,
                error: e.message,
                stack: e.stack?.substring(0, 500)
              });
            }
          }
        );

        // Extract alignment data from runOnce result (parse JSON string)
        try {
          const result = JSON.parse(alignmentResult);
          if (result.success) {
            // Success - extract alignment data with line timing
            alignment = {
              storageKey: result.storageKey,
              uri: result.uri,
              gatewayUrl: result.gatewayUrl,
              lineCount: result.lineCount,
              wordCount: result.wordCount,
              lines: result.lines // First 5 lines with start/end/text
            };
          } else {
            // Error occurred
            console.error('Alignment failed:', result.error);
            alignment = null;
            alignmentError = `${result.error}${result.stack ? '\n' + result.stack : ''}`;
          }
        } catch (e) {
          console.error('Failed to parse alignment result:', e.message);
          alignment = null;
          alignmentError = `Failed to parse result: ${e.message}. Raw: ${alignmentResult.substring(0, 200)}`;
        }
      } catch (error) {
        console.error('ElevenLabs alignment failed:', error.message);
        alignmentError = error.message;
      }
    } else if (runAlignment && !result.isMatch) {
      console.log('[5/6] Skipping alignment - songs did not match');
    } else if (runAlignment && !soundcloudPermalink) {
      console.log('[5/6] Skipping alignment - no SoundCloud link');
      alignmentError = 'No SoundCloud link available';
    } else {
      console.log('[5/6] Alignment disabled');
    }

    // Step 6: Sign and submit transaction for blockchain (if enabled and matched)
    let txHash = null;
    let contractError = null;

    if (writeToBlockchain && result.isMatch && alignment && alignment.uri) {
      try {
        console.log('[6/6] Signing and submitting transaction to blockchain...');

        // Validate contract params
        if (!contractAddress || !pkpAddress || !pkpTokenId) {
          throw new Error('Contract address, PKP address, and PKP token ID required for blockchain writes');
        }

        // Prepare full song data with alignment metadata
        const maxDuration = Math.floor(Math.max(...sections.map(s => s.endTime)));
        const songId = `genius-${geniusId}`;
        const geniusArtistId = 0; // TODO: Could extract from Genius API if needed

        // Song data struct for addFullSong (V2 OPTIMIZED - removed geniusArtistId and languages)
        const songData = {
          id: songId,
          geniusId: geniusId,
          title: title,
          artist: artist,
          duration: maxDuration,
          requiresPayment: false, // Free songs with alignment data
          audioUri: '', // Could be added later
          metadataUri: alignment.uri, // lens:// URI with word-level timing + translations!
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
      console.log('[6/6] Skipping blockchain write - songs did not match');
    } else if (writeToBlockchain && sections.length === 0) {
      console.log('[6/6] Skipping blockchain write - no sections found');
    } else {
      console.log('[6/6] Blockchain write disabled');
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
        alignment: alignment,
        alignmentError: alignmentError,
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
