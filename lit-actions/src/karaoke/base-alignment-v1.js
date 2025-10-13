/**
 * Base Alignment v1: Word-Level Timing (NO Translations)
 *
 * Called ONCE per song to generate base word-level timing using ElevenLabs.
 * Translations are added later via translate-lyrics-v1.js (per-language, on-demand).
 *
 * Benefits:
 * - Most expensive operation (ElevenLabs) runs only ONCE per song
 * - Subsequent users don't pay for alignment
 * - Translations are lazy-loaded per language
 *
 * Flow:
 * 1. Download audio from SoundCloud
 * 2. ElevenLabs forced alignment → word-level timing
 * 3. Build base metadata JSON (NO translations)
 * 4. Upload to Grove storage as song-{geniusId}-base.json
 * 5. Update contract metadataUri
 *
 * Input:
 * - geniusId: Genius song ID
 * - soundcloudPermalink: SoundCloud URL
 * - plainLyrics: Plain text lyrics (from LRClib)
 * - elevenlabsKeyAccessControlConditions, elevenlabsKeyCiphertext, elevenlabsKeyDataToEncryptHash
 * - contractAddress, pkpAddress, pkpTokenId, pkpPublicKey
 * - updateContract: true/false (whether to write to blockchain)
 *
 * Output:
 * - metadataUri: lens://... (Grove storage URI)
 * - lineCount: Number of lyric lines
 * - wordCount: Total words
 * - txHash: Contract update transaction (if updateContract=true)
 *
 * Time: ~15-30s (ElevenLabs + Grove + contract write)
 * Cost: ~$0.03 (ElevenLabs only)
 */

console.log('=== BASE ALIGNMENT v1 LOADED ===');
console.log('Lit Actions API available:', typeof Lit !== 'undefined');
console.log('ethers available:', typeof ethers !== 'undefined');

const go = async () => {
  console.log('=== STARTING EXECUTION ===');
  const {
    geniusId,
    plainLyrics,
    elevenlabsKeyAccessControlConditions,
    elevenlabsKeyCiphertext,
    elevenlabsKeyDataToEncryptHash,
    contractAddress,
    pkpAddress,
    pkpTokenId,
    pkpPublicKey,
    updateContract = true,
  } = jsParams || {};

  console.log('jsParams received, geniusId:', geniusId);

  try {
    // Validate required params
    if (!geniusId) throw new Error('geniusId is required');
    if (!plainLyrics) throw new Error('plainLyrics is required');
    if (!contractAddress || !pkpAddress || !pkpTokenId || !pkpPublicKey) {
      throw new Error('Contract params (contractAddress, pkpAddress, pkpTokenId, pkpPublicKey) are required');
    }

    // Step 0: Read soundcloudPath from contract
    console.log('[0/4] Reading soundcloudPath from contract...');
    const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
    const provider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    const catalogAbi = [
      'function getSongByGeniusId(uint32) view returns (tuple(string id, uint32 geniusId, string title, string artist, uint32 duration, string soundcloudPath, bool hasFullAudio, bool requiresPayment, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri, bool enabled, uint64 addedAt))'
    ];
    const catalog = new ethers.Contract(contractAddress, catalogAbi, provider);
    const songData = await catalog.getSongByGeniusId(geniusId);

    const soundcloudPath = songData.soundcloudPath;
    if (!soundcloudPath) {
      throw new Error('Song has no soundcloudPath in contract. Cannot download audio.');
    }
    console.log(`✅ SoundCloud path from contract: ${soundcloudPath}`);

    // Step 1: Decrypt ElevenLabs key
    console.log('[1/4] Decrypting ElevenLabs key...');
    let elevenlabsKey;
    try {
      elevenlabsKey = await Lit.Actions.decryptAndCombine({
        accessControlConditions: elevenlabsKeyAccessControlConditions,
        ciphertext: elevenlabsKeyCiphertext,
        dataToEncryptHash: elevenlabsKeyDataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      });
      console.log('ElevenLabs key decrypted');
    } catch (decryptError) {
      throw new Error(`Failed to decrypt ElevenLabs key: ${decryptError.message}`);
    }

    // Step 2: ElevenLabs Forced Alignment (using runOnce)
    console.log('[2/4] Running ElevenLabs forced alignment...');

    const alignmentResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "elevenlabsAlignment" },
      async () => {
        try {
          console.log('Downloading audio from:', soundcloudPath);

          // Use restream endpoint with soundcloudPath from contract
          const audioUrl = `https://sc.maid.zone/_/restream/${soundcloudPath}`;
          console.log('Fetching from:', audioUrl);
          const audioResp = await fetch(audioUrl);
          if (!audioResp.ok) {
            return JSON.stringify({
              success: false,
              error: `Audio download failed: ${audioResp.status} ${audioResp.statusText}`
            });
          }

          const audioBuffer = await audioResp.arrayBuffer();
          const audioBytes = new Uint8Array(audioBuffer);
          console.log(`Audio downloaded: ${audioBytes.length} bytes`);

          // Build multipart form for ElevenLabs
          const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
          const textEncoder = new TextEncoder();

          let body = [];

          // Add audio file part
          body.push(textEncoder.encode(`--${boundary}\r\n`));
          body.push(textEncoder.encode('Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n'));
          body.push(textEncoder.encode('Content-Type: audio/mpeg\r\n\r\n'));
          body.push(audioBytes);
          body.push(textEncoder.encode('\r\n'));

          // Add text part
          body.push(textEncoder.encode(`--${boundary}\r\n`));
          body.push(textEncoder.encode('Content-Disposition: form-data; name="text"\r\n\r\n'));
          body.push(textEncoder.encode(plainLyrics));
          body.push(textEncoder.encode('\r\n'));

          // End boundary
          body.push(textEncoder.encode(`--${boundary}--\r\n`));

          // Combine all parts
          let totalLength = 0;
          for (let part of body) {
            totalLength += part.length;
          }

          const combinedBody = new Uint8Array(totalLength);
          let offset = 0;
          for (let part of body) {
            combinedBody.set(part, offset);
            offset += part.length;
          }

          console.log('Calling ElevenLabs Forced Alignment API...');
          const alignResp = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
            method: 'POST',
            headers: {
              'xi-api-key': elevenlabsKey,
              'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: combinedBody
          });

          if (!alignResp.ok) {
            const errorText = await alignResp.text();
            return JSON.stringify({
              success: false,
              error: `ElevenLabs API failed: ${alignResp.status} - ${errorText}`
            });
          }

          const alignData = await alignResp.json();
          console.log('ElevenLabs response received');

          if (!alignData.characters || !Array.isArray(alignData.characters)) {
            return JSON.stringify({
              success: false,
              error: 'Invalid alignment response format'
            });
          }

          // Parse alignment into lines with words
          const characters = alignData.characters;
          const lyricsLines = plainLyrics.split('\n').filter(l => l.trim());

          const lines = [];
          let charIndex = 0;

          for (let lineText of lyricsLines) {
            const lineWords = [];
            let lineStart = null;
            let lineEnd = null;

            // Extract words from this line
            const words = lineText.match(/\S+/g) || [];

            for (let word of words) {
              const wordChars = [];

              // Collect characters for this word
              for (let i = 0; i < word.length && charIndex < characters.length; i++) {
                const char = characters[charIndex];
                if (char.text && char.text.trim()) {
                  wordChars.push(char);
                }
                charIndex++;
              }

              // Skip whitespace
              while (charIndex < characters.length && !characters[charIndex].text.trim()) {
                charIndex++;
              }

              if (wordChars.length > 0) {
                const wordStart = wordChars[0].start;
                const wordEnd = wordChars[wordChars.length - 1].end;

                lineWords.push({
                  text: word,
                  start: parseFloat(wordStart.toFixed(2)),
                  end: parseFloat(wordEnd.toFixed(2))
                });

                if (lineStart === null) lineStart = wordStart;
                lineEnd = wordEnd;
              }
            }

            if (lineWords.length > 0) {
              lines.push({
                id: `line-${lines.length}`,
                start: parseFloat(lineStart.toFixed(2)),
                end: parseFloat(lineEnd.toFixed(2)),
                text: lineText,
                words: lineWords
              });
            }
          }

          return JSON.stringify({
            success: true,
            lines: lines,
            linesCount: lines.length,
            wordsCount: lines.reduce((sum, line) => sum + line.words.length, 0)
          });

        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
          });
        }
      }
    );

    const alignment = JSON.parse(alignmentResult);
    console.log('Alignment result:', alignment.success ? 'SUCCESS' : 'FAILED');

    if (!alignment.success) {
      throw new Error(`Alignment failed: ${alignment.error}`);
    }

    console.log(`Processed ${alignment.linesCount} lines, ${alignment.wordsCount} words`);

    // Step 3: Upload to Grove (using runOnce)
    console.log('[3/4] Uploading base alignment to Grove...');

    const groveUploadResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "groveUpload" },
      async () => {
        try {
          // Build base metadata (NO translations)
          const metadata = {
            geniusId: geniusId,
            type: 'base-alignment',
            version: 1,
            lines: alignment.lines  // Only timing, no translations field
          };

          const metadataJson = JSON.stringify(metadata);
          console.log(`Metadata size: ${metadataJson.length} bytes`);

          // Upload to Grove (one-step immutable upload - use Lens Testnet chain_id)
          const groveResp = await fetch('https://api.grove.storage/?chain_id=37111', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: metadataJson
          });

          if (!groveResp.ok) {
            const errorText = await groveResp.text();
            return JSON.stringify({
              success: false,
              error: `Grove upload failed: ${groveResp.status} - ${errorText}`
            });
          }

          const groveResult = await groveResp.json();
          // Grove can return array or object
          const groveData = Array.isArray(groveResult) ? groveResult[0] : groveResult;
          console.log('Grove upload successful, key:', groveData.storage_key);

          return JSON.stringify({
            success: true,
            storageKey: groveData.storage_key,
            uri: groveData.uri,
            gatewayUrl: groveData.gateway_url
          });

        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
          });
        }
      }
    );

    const groveResult = JSON.parse(groveUploadResult);
    console.log('Grove result:', groveResult.success ? 'SUCCESS' : 'FAILED');

    if (!groveResult.success) {
      throw new Error(`Grove upload failed: ${groveResult.error}`);
    }

    const metadataUri = groveResult.uri;
    console.log('Metadata URI:', metadataUri);

    // Step 4: Update contract metadataUri (sign outside runOnce, submit inside)
    let txHash = null;
    let contractError = null;

    if (updateContract) {
      console.log('[4/4] Updating contract metadataUri...');

      try {
        // ABI for updateSongMetadata function
        const abi = [
          'function updateSongMetadata(uint32 geniusId, string memory newMetadataUri) external'
        ];

        const iface = new ethers.utils.Interface(abi);
        const data = iface.encodeFunctionData('updateSongMetadata', [geniusId, metadataUri]);

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
          chainId: 84532
        };

        console.log('Signing transaction with PKP...');
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

        // Submit transaction using runOnce
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

        if (txHashResult && txHashResult.startsWith('TX_SUBMIT_ERROR:')) {
          console.log('Transaction submission failed:', txHashResult);
          contractError = txHashResult;
        } else {
          txHash = txHashResult;
          console.log('✅ Transaction submitted:', txHash);
        }
      } catch (error) {
        console.error('Contract write failed:', error.message);
        contractError = error.message;
      }
    } else {
      console.log('[4/4] Skipping contract update (updateContract=false)');
    }

    // Return final result
    const result = {
      success: true,
      geniusId: geniusId,
      metadataUri: metadataUri,
      storageKey: groveResult.storageKey,
      gatewayUrl: groveResult.gatewayUrl,
      lineCount: alignment.linesCount,
      wordCount: alignment.wordsCount,
      txHash: txHash,
      contractError: contractError,
      contractAddress: contractAddress
    };

    console.log('=== EXECUTION COMPLETE ===');
    Lit.Actions.setResponse({ response: JSON.stringify(result) });

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);

    const errorResult = {
      success: false,
      error: error.message,
      stack: error.stack
    };

    Lit.Actions.setResponse({ response: JSON.stringify(errorResult) });
  }
};

go();
