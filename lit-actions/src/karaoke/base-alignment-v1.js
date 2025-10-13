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
    soundcloudPermalink,
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
    if (!soundcloudPermalink) throw new Error('soundcloudPermalink is required');
    if (!plainLyrics) throw new Error('plainLyrics is required');
    if (!contractAddress || !pkpAddress || !pkpTokenId || !pkpPublicKey) {
      throw new Error('Contract params (contractAddress, pkpAddress, pkpTokenId, pkpPublicKey) are required');
    }

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
          console.log('Downloading audio from:', soundcloudPermalink);

          // Download audio from sc.maid.zone
          const audioUrl = `https://sc.maid.zone/api/download?url=${encodeURIComponent(soundcloudPermalink)}`;
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
          body.push(textEncoder.encode('Content-Disposition: form-data; name="audio"; filename="audio.mp3"\r\n'));
          body.push(textEncoder.encode('Content-Type: audio/mpeg\r\n\r\n'));
          body.push(audioBytes);
          body.push(textEncoder.encode('\r\n'));

          // Add text part
          body.push(textEncoder.encode(`--${boundary}\r\n`));
          body.push(textEncoder.encode('Content-Disposition: form-data; name="text"\r\n\r\n'));
          body.push(textEncoder.encode(plainLyrics));
          body.push(textEncoder.encode('\r\n'));

          // Add language part
          body.push(textEncoder.encode(`--${boundary}\r\n`));
          body.push(textEncoder.encode('Content-Disposition: form-data; name="language"\r\n\r\n'));
          body.push(textEncoder.encode('en'));
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

          console.log('Calling ElevenLabs API...');
          const alignResp = await fetch('https://api.elevenlabs.io/v1/audio-native/alignments', {
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

          if (!alignData.alignment || !alignData.alignment.characters) {
            return JSON.stringify({
              success: false,
              error: 'Invalid alignment response format'
            });
          }

          // Parse alignment into lines with words
          const characters = alignData.alignment.characters;
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
                if (char.character && char.character.trim()) {
                  wordChars.push(char);
                }
                charIndex++;
              }

              // Skip whitespace
              while (charIndex < characters.length && !characters[charIndex].character.trim()) {
                charIndex++;
              }

              if (wordChars.length > 0) {
                const wordStart = wordChars[0].start_time_ms / 1000;
                const wordEnd = wordChars[wordChars.length - 1].end_time_ms / 1000;

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

          // Upload to Grove
          const groveResp = await fetch('https://api.grove.storage/create', {
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

          const groveData = await groveResp.json();
          console.log('Grove upload successful, key:', groveData.key);

          const groveUri = `lens://${groveData.key}`;

          return JSON.stringify({
            success: true,
            uri: groveUri,
            key: groveData.key
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

    // Step 4: Update contract metadataUri (using runOnce for transaction)
    let txHash = null;
    let contractError = null;

    if (updateContract) {
      console.log('[4/4] Updating contract metadataUri...');

      const contractUpdateResult = await Lit.Actions.runOnce(
        { waitForResponse: true, name: "contractUpdate" },
        async () => {
          try {
            // ABI for updateSongMetadata function
            const abi = [
              'function updateSongMetadata(uint32 geniusId, string memory newMetadataUri) external'
            ];

            const iface = new ethers.utils.Interface(abi);
            const data = iface.encodeFunctionData('updateSongMetadata', [geniusId, metadataUri]);

            const provider = new ethers.providers.JsonRpcProvider('https://sepolia.base.org');
            const nonce = await provider.getTransactionCount(pkpAddress);
            const feeData = await provider.getFeeData();

            const tx = {
              to: contractAddress,
              nonce: nonce,
              data: data,
              gasLimit: 200000,
              maxFeePerGas: feeData.maxFeePerGas,
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
              chainId: 84532,
              type: 2,
            };

            console.log('Signing transaction with PKP...');
            const serializedTx = ethers.utils.serializeTransaction(tx);
            const txHash = ethers.utils.keccak256(serializedTx);
            const txHashBytes = ethers.utils.arrayify(txHash);

            const signature = await Lit.Actions.signAndCombineEcdsa({
              toSign: txHashBytes,
              publicKey: pkpPublicKey,
              sigName: 'contractUpdateSig'
            });

            const signatureBytes = ethers.utils.arrayify('0x' + signature);
            const r = signatureBytes.slice(0, 32);
            const s = signatureBytes.slice(32, 64);
            let v = signatureBytes[64];

            // EIP-155 v value calculation for Base Sepolia (chainId 84532)
            if (v < 27) {
              v = v + 27;
            }
            v = v + (84532 * 2) + 8;

            const signedTx = ethers.utils.serializeTransaction(tx, {
              r: ethers.utils.hexlify(r),
              s: ethers.utils.hexlify(s),
              v: v
            });

            console.log('Broadcasting transaction...');
            const txResponse = await provider.sendTransaction(signedTx);
            console.log('Transaction hash:', txResponse.hash);

            return JSON.stringify({
              success: true,
              txHash: txResponse.hash
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

      const contractResult = JSON.parse(contractUpdateResult);
      console.log('Contract result:', contractResult.success ? 'SUCCESS' : 'FAILED');

      if (contractResult.success) {
        txHash = contractResult.txHash;
        console.log('Contract updated successfully, tx:', txHash);
      } else {
        contractError = contractResult.error;
        console.log('Contract update failed:', contractError);
      }
    } else {
      console.log('[4/4] Skipping contract update (updateContract=false)');
    }

    // Return final result
    const result = {
      success: true,
      geniusId: geniusId,
      metadataUri: metadataUri,
      storageKey: groveResult.key,
      gatewayUrl: `https://api.grove.storage/${groveResult.key}`,
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
