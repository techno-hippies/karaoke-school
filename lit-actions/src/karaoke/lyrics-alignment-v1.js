/**
 * Lyrics Alignment v1: Per-Language Karaoke Timing
 *
 * Called when user starts recording to generate word-level timing + translation.
 * This action is separated from match-and-segment to enable:
 * - Fast song discovery (match-and-segment runs without alignment)
 * - Lazy loading of alignment data (only when user needs it)
 * - Per-language translation (not all languages upfront)
 *
 * Flow:
 * 1. Fetch existing song data from contract
 * 2. Download audio from SoundCloud
 * 3. ElevenLabs forced alignment → word-level timing
 * 4. OpenRouter translation for target language
 * 5. Build metadata JSON with line timing + translations
 * 6. Upload to Grove storage
 * 7. Update contract metadataUri
 *
 * Input:
 * - geniusId: Genius song ID
 * - soundcloudPermalink: SoundCloud URL
 * - plainLyrics: Plain text lyrics (from LRClib)
 * - targetLanguage: 'zh' | 'vi' | 'es' | 'ja' | 'ko' (single language)
 * - elevenlabsKeyAccessControlConditions, elevenlabsKeyCiphertext, elevenlabsKeyDataToEncryptHash
 * - openrouterKeyAccessControlConditions, openrouterKeyCiphertext, openrouterKeyDataToEncryptHash
 * - contractAddress, pkpAddress, pkpTokenId, pkpPublicKey
 *
 * Output:
 * - metadataUri: lens://... (Grove storage URI)
 * - lineCount: Number of lyric lines
 * - wordCount: Total words
 * - txHash: Contract update transaction
 *
 * Time: ~20-60s (ElevenLabs + LLM + contract write)
 * Cost: ~$0.04 (ElevenLabs) + ~$0.01 (LLM)
 */

console.log('=== LYRICS ALIGNMENT v1 LOADED ===');
console.log('Lit Actions API available:', typeof Lit !== 'undefined');
console.log('ethers available:', typeof ethers !== 'undefined');

const go = async () => {
  console.log('=== STARTING EXECUTION ===');
  const {
    geniusId,
    soundcloudPermalink,
    plainLyrics,
    targetLanguage,
    elevenlabsKeyAccessControlConditions,
    elevenlabsKeyCiphertext,
    elevenlabsKeyDataToEncryptHash,
    openrouterKeyAccessControlConditions,
    openrouterKeyCiphertext,
    openrouterKeyDataToEncryptHash,
    contractAddress,
    pkpAddress,
    pkpTokenId,
    pkpPublicKey,
  } = jsParams || {};

  console.log('jsParams received, geniusId:', geniusId, 'targetLanguage:', targetLanguage);

  try {
    // Validate required params
    if (!geniusId) throw new Error('geniusId is required');
    if (!soundcloudPermalink) throw new Error('soundcloudPermalink is required');
    if (!plainLyrics) throw new Error('plainLyrics is required');
    if (!targetLanguage) throw new Error('targetLanguage is required');
    if (!contractAddress || !pkpAddress || !pkpTokenId || !pkpPublicKey) {
      throw new Error('Contract params (contractAddress, pkpAddress, pkpTokenId, pkpPublicKey) are required');
    }

    // Step 1: Decrypt keys
    console.log('[1/5] Decrypting keys...');
    let elevenlabsKey, openrouterKey;
    try {
      const keys = await Promise.all([
        Lit.Actions.decryptAndCombine({
          accessControlConditions: elevenlabsKeyAccessControlConditions,
          ciphertext: elevenlabsKeyCiphertext,
          dataToEncryptHash: elevenlabsKeyDataToEncryptHash,
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
      elevenlabsKey = keys[0];
      openrouterKey = keys[1];
      console.log('Keys decrypted');
    } catch (decryptError) {
      throw new Error(`Failed to decrypt keys: ${decryptError.message}`);
    }

    // Step 2: ElevenLabs Forced Alignment (using runOnce)
    console.log('[2/5] Running ElevenLabs forced alignment (using runOnce)...');
    console.log(`   SoundCloud: ${soundcloudPermalink}`);
    console.log(`   Lyrics: ${plainLyrics.length} chars`);

    const alignmentResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "elevenlabsAlignment" },
      async () => {
        try {
          // Download audio from sc.maid.zone
          const soundcloudPath = soundcloudPermalink.split('/').slice(-2).join('/');
          const audioUrl = `https://sc.maid.zone/_/restream/${soundcloudPath}`;

          console.log(`   Downloading audio from: ${audioUrl}`);
          const audioResp = await fetch(audioUrl);
          if (!audioResp.ok) {
            throw new Error(`Failed to download audio: ${audioResp.status}`);
          }

          const audioBlob = await audioResp.arrayBuffer();
          console.log(`   Audio downloaded: ${audioBlob.byteLength} bytes`);

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
          console.log('   Calling ElevenLabs API...');
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
          console.log(`   ElevenLabs responded with ${alignmentData.words?.length || 0} words`);

          // Parse words into lines (split on \n)
          const lines = [];
          let currentLine = { words: [], start: null, end: null };

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

          console.log(`   Parsed into ${lines.length} lines`);

          // Return serialized alignment data
          return JSON.stringify({
            success: true,
            lines: lines
          });
        } catch (e) {
          return JSON.stringify({
            success: false,
            error: e.message,
            stack: e.stack?.substring(0, 500)
          });
        }
      }
    );

    // Parse alignment result
    let lines;
    try {
      const alignmentParsed = JSON.parse(alignmentResult);
      if (!alignmentParsed.success) {
        throw new Error(`ElevenLabs alignment failed: ${alignmentParsed.error}${alignmentParsed.stack ? '\n' + alignmentParsed.stack : ''}`);
      }
      lines = alignmentParsed.lines;
      console.log(`[2/5] ✅ Alignment completed: ${lines.length} lines`);
    } catch (e) {
      throw new Error(`Failed to parse alignment result: ${e.message}`);
    }

    // Step 3: Translate to target language (using runOnce for LLM)
    console.log(`[3/5] Translating to ${targetLanguage} (using runOnce)...`);

    // Build numbered lines for LLM
    const numberedLines = lines.map((l, i) => `${i}: ${l.text}`).join('\n');

    const languageNames = {
      zh: 'Simplified Chinese',
      vi: 'Vietnamese',
      es: 'Spanish',
      ja: 'Japanese',
      ko: 'Korean'
    };

    const translationPrompt = `Translate these English song lyrics to ${languageNames[targetLanguage] || targetLanguage}.

Lyrics (${lines.length} lines, numbered for reference):
${numberedLines}

Instructions:
1. Translate each line to ${languageNames[targetLanguage] || targetLanguage}
2. Maintain the same order
3. Return exactly ${lines.length} translations
4. Keep translations natural and singable
5. Preserve line breaks and structure`;

    const translationsJson = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "openrouterTranslation" },
      async () => {
        try {
          const apiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'Content-Type': 'application/json',
              'X-Title': 'Karaoke School Lyrics Alignment v1',
              'HTTP-Referer': 'https://karaoke.school'
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite-preview-09-2025',
              messages: [{ role: 'user', content: translationPrompt }],
              temperature: 0,
              max_tokens: 4000,
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'translations',
                  strict: true,
                  schema: {
                    type: 'object',
                    properties: {
                      translations: {
                        type: 'array',
                        description: 'Translated lines in same order',
                        items: { type: 'string' }
                      }
                    },
                    required: ['translations'],
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

          const content = apiData.choices?.[0]?.message?.content || '{"translations":[]}';
          return content;
        } catch (error) {
          return JSON.stringify({
            error: true,
            message: error.message
          });
        }
      }
    );

    // Parse translation result
    let translations;
    try {
      const translationsParsed = JSON.parse(translationsJson);
      if (translationsParsed.error) {
        throw new Error(`Translation failed: ${translationsParsed.message}`);
      }
      translations = translationsParsed.translations;
      console.log(`[3/5] ✅ Translated ${translations.length} lines to ${targetLanguage}`);
    } catch (e) {
      throw new Error(`Failed to parse translations: ${e.message}`);
    }

    // Step 4: Build metadata with translations and upload to Grove
    console.log('[4/5] Building metadata and uploading to Grove (using runOnce)...');

    const groveUploadResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "groveUpload" },
      async () => {
        try {
          // Embed translations into lines
          const linesWithTranslations = lines.map((line, i) => {
            const translationObj = {};
            translationObj[targetLanguage] = translations[i] || '';

            return {
              id: `line-${i}`,
              start: line.start,
              end: line.end,
              text: line.text,
              translations: translationObj,
              words: line.words
            };
          });

          const metadata = { lines: linesWithTranslations };

          // Upload to Grove
          const groveResp = await fetch('https://api.grove.storage/?chain_id=37111', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
          });

          if (!groveResp.ok) {
            const groveError = await groveResp.text();
            throw new Error(`Grove upload failed (${groveResp.status}): ${groveError}`);
          }

          const groveResult = await groveResp.json();
          const groveData = Array.isArray(groveResult) ? groveResult[0] : groveResult;

          return JSON.stringify({
            success: true,
            storageKey: groveData.storage_key,
            uri: groveData.uri,
            gatewayUrl: groveData.gateway_url,
            lineCount: linesWithTranslations.length,
            wordCount: linesWithTranslations.reduce((sum, line) => sum + line.words.length, 0)
          });
        } catch (e) {
          return JSON.stringify({
            success: false,
            error: e.message
          });
        }
      }
    );

    // Parse Grove upload result
    let groveData;
    try {
      groveData = JSON.parse(groveUploadResult);
      if (!groveData.success) {
        throw new Error(`Grove upload failed: ${groveData.error}`);
      }
      console.log(`[4/5] ✅ Uploaded to Grove: ${groveData.uri}`);
    } catch (e) {
      throw new Error(`Failed to parse Grove result: ${e.message}`);
    }

    // Step 5: Update contract with metadataUri
    console.log('[5/5] Updating contract with metadataUri...');

    // ABI for updateSongMetadata
    const abi = [{
      "type": "function",
      "name": "updateSongMetadata",
      "inputs": [
        { "name": "geniusId", "type": "uint32" },
        { "name": "metadataUri", "type": "string" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    }];

    const iface = new ethers.utils.Interface(abi);
    const data = iface.encodeFunctionData('updateSongMetadata', [geniusId, groveData.uri]);

    const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
    const provider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC);

    const [nonce, gasPrice] = await Promise.all([
      provider.getTransactionCount(pkpAddress),
      provider.getGasPrice()
    ]);

    const unsignedTx = {
      to: contractAddress,
      nonce: nonce,
      gasLimit: 300000,
      gasPrice: gasPrice,
      data: data,
      chainId: 84532 // Base Sepolia
    };

    let cleanPkpPublicKey = pkpPublicKey;
    if (cleanPkpPublicKey.startsWith('0x')) {
      cleanPkpPublicKey = cleanPkpPublicKey.substring(2);
    }

    const transactionHash = ethers.utils.keccak256(ethers.utils.serializeTransaction(unsignedTx));
    const toSign = ethers.utils.arrayify(transactionHash);

    const signature = await Lit.Actions.signAndCombineEcdsa({
      toSign: toSign,
      publicKey: cleanPkpPublicKey,
      sigName: 'updateMetadataTx'
    });

    const jsonSignature = JSON.parse(signature);
    const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
    const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

    let recid = 0;
    if (jsonSignature.recid !== undefined) {
      recid = jsonSignature.recid;
    } else if (jsonSignature.v !== undefined) {
      recid = jsonSignature.v >= 27 ? jsonSignature.v - 27 : jsonSignature.v;
    }

    const chainId = 84532;
    const v = chainId * 2 + 35 + recid;
    const sigObject = { r: rHex, s: sHex, v: v };

    const signedTx = ethers.utils.serializeTransaction(unsignedTx, sigObject);
    console.log('✅ Transaction signed');

    const txHashResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "updateMetadataTx" },
      async () => {
        try {
          const hash = await provider.send("eth_sendRawTransaction", [signedTx]);
          return hash;
        } catch (error) {
          return `TX_SUBMIT_ERROR: ${error.message}`;
        }
      }
    );

    let txHash = null;
    let contractError = null;

    if (txHashResult && txHashResult.startsWith('TX_SUBMIT_ERROR:')) {
      console.log('Transaction submission failed:', txHashResult);
      contractError = txHashResult;
    } else {
      txHash = txHashResult;
      console.log('✅ Transaction submitted:', txHash);
    }

    console.log('=== PREPARING FINAL RESPONSE ===');
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        geniusId,
        targetLanguage,
        metadataUri: groveData.uri,
        storageKey: groveData.storageKey,
        gatewayUrl: groveData.gatewayUrl,
        lineCount: groveData.lineCount,
        wordCount: groveData.wordCount,
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
