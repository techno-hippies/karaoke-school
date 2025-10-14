/**
 * Base Alignment v2: Self-Contained Word-Level Timing
 *
 * PHILOSOPHY: Lit Action reads ALL data from contract (single source of truth)
 * - No frontend state management complexity
 * - Cannot be spoofed with bad data
 * - Robust: if frontend fails, Lit Action still works
 *
 * Flow:
 * 1. Read song data from contract (soundcloudPath, title, artist)
 * 2. Fetch lyrics from LRClib using contract data
 * 3. Download audio from SoundCloud
 * 4. ElevenLabs forced alignment → word-level timing
 * 5. Upload to Grove → song-{geniusId}-base.json
 * 6. Update contract metadataUri using SYSTEM PKP
 *
 * Input (MINIMAL):
 * - geniusId: ONLY required input (everything else read from contract)
 * - elevenlabsKeyAccessControlConditions, elevenlabsKeyCiphertext, elevenlabsKeyDataToEncryptHash
 * - contractAddress
 * - updateContract: true/false
 *
 * Output:
 * - metadataUri: lens://... (Grove storage URI)
 * - lineCount: Number of lyric lines
 * - wordCount: Total words
 * - txHash: Contract update transaction (if updateContract=true)
 *
 * Time: ~20-40s (LRClib + ElevenLabs + Grove + contract)
 * Cost: ~$0.03 (ElevenLabs only)
 */

// Hardcoded system PKP credentials (deployed as trustedProcessor on KaraokeCatalogV2)
const SYSTEM_PKP = {
  publicKey: '043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939',
  address: '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30',
  tokenId: '18495970405190900970517221272825216094387884724482470185691150662171839015831'
};

console.log('=== BASE ALIGNMENT v2 LOADED ===');
console.log('Lit Actions API available:', typeof Lit !== 'undefined');
console.log('ethers available:', typeof ethers !== 'undefined');

const go = async () => {
  console.log('=== STARTING EXECUTION ===');
  const {
    geniusId,
    elevenlabsKeyAccessControlConditions,
    elevenlabsKeyCiphertext,
    elevenlabsKeyDataToEncryptHash,
    contractAddress,
    updateContract = true,
  } = jsParams || {};

  console.log('jsParams received, geniusId:', geniusId);

  try {
    // Validate required params
    if (!geniusId) throw new Error('geniusId is required');
    if (!contractAddress) {
      throw new Error('contractAddress is required');
    }

    // Step 1: Read song data from contract (ALL NODES)
    console.log('[1/6] Reading song data from contract...');
    const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
    const provider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    const catalogAbi = [
      'function getSongByGeniusId(uint32) view returns (tuple(string id, uint32 geniusId, string title, string artist, uint32 duration, string soundcloudPath, bool hasFullAudio, bool requiresPayment, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri, bool enabled, uint64 addedAt))'
    ];
    const catalog = new ethers.Contract(contractAddress, catalogAbi, provider);
    const songData = await catalog.getSongByGeniusId(geniusId);

    const soundcloudPath = songData.soundcloudPath;
    const title = songData.title;
    const artist = songData.artist;

    if (!soundcloudPath) {
      throw new Error('Song has no soundcloudPath in contract. Run match-and-segment first to catalog the song.');
    }

    console.log(`✅ Song data from contract:`);
    console.log(`   Title: ${title}`);
    console.log(`   Artist: ${artist}`);
    console.log(`   SoundCloud path: ${soundcloudPath}`);

    // Step 2: Fetch lyrics from LRClib (SINGLE NODE via runOnce)
    console.log('[2/6] Fetching lyrics from LRClib...');
    const lyricsResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: 'fetchLyrics' },
      async () => {
        try {
          const lrcResp = await fetch(
            'https://lrclib.net/api/search?' +
            new URLSearchParams({
              artist_name: artist,
              track_name: title
            })
          );

          const lrcResults = await lrcResp.json();
          if (lrcResults.length === 0) {
            return JSON.stringify({ error: 'No lyrics found on LRClib' });
          }

          const lrcData = lrcResults[0];
          const syncedLyrics = lrcData.syncedLyrics;

          // Parse synced lyrics to extract plain text
          const lines = syncedLyrics.split('\n').filter(l => l.trim());
          const plainLyrics = lines
            .map(line => {
              const match = line.match(/\[[\d:.]+\]\s*(.+)/);
              return match ? match[1] : '';
            })
            .filter(l => l)
            .join('\n');

          return JSON.stringify({ plainLyrics, lineCount: plainLyrics.split('\n').length });
        } catch (error) {
          return JSON.stringify({ error: `LRClib fetch failed: ${error.message}` });
        }
      }
    );

    const lyricsData = JSON.parse(lyricsResult);
    if (lyricsData.error) {
      throw new Error(lyricsData.error);
    }

    const plainLyrics = lyricsData.plainLyrics;
    console.log(`✅ Lyrics fetched (${lyricsData.lineCount} lines)`);

    // Step 3: Decrypt ElevenLabs key (ALL NODES for threshold decryption)
    console.log('[3/6] Decrypting ElevenLabs key...');
    let elevenlabsKey;
    try {
      elevenlabsKey = await Lit.Actions.decryptAndCombine({
        accessControlConditions: elevenlabsKeyAccessControlConditions,
        ciphertext: elevenlabsKeyCiphertext,
        dataToEncryptHash: elevenlabsKeyDataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      });
      console.log('✅ ElevenLabs key decrypted');
    } catch (decryptError) {
      throw new Error(`Failed to decrypt ElevenLabs key: ${decryptError.message}`);
    }

    // Step 4: ElevenLabs Forced Alignment (SINGLE NODE via runOnce - rate limited API)
    console.log('[4/6] Running ElevenLabs forced alignment...');
    const alignmentResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: 'elevenlabsAlignment' },
      async () => {
        try {
          // Download audio from SoundCloud via restream endpoint
          const maidZoneUrl = `https://sc.maid.zone/_/restream/${soundcloudPath}`;
          console.log(`   Downloading audio from: ${maidZoneUrl}`);

          const audioResp = await fetch(maidZoneUrl);
          if (!audioResp.ok) {
            return JSON.stringify({ error: `Failed to download audio: ${audioResp.status} ${audioResp.statusText}` });
          }

          const audioBuffer = await audioResp.arrayBuffer();
          const audioBytes = new Uint8Array(audioBuffer);
          console.log(`   Audio downloaded (${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

          // Build multipart form for ElevenLabs forced alignment API
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

          // Call ElevenLabs forced alignment API
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
            return JSON.stringify({ error: `ElevenLabs API error: ${alignResp.status} - ${errorText}` });
          }

          const alignData = await alignResp.json();
          return JSON.stringify({ alignment: alignData });
        } catch (error) {
          return JSON.stringify({ error: `Alignment failed: ${error.message}` });
        }
      }
    );

    const alignData = JSON.parse(alignmentResult);
    if (alignData.error) {
      throw new Error(alignData.error);
    }

    const alignment = alignData.alignment;
    console.log(`✅ Alignment completed`);

    // Build lines from words (group by newlines in characters)
    const lines = [];
    let currentLine = { words: [], start: 0, end: 0, text: '' };
    let currentWordText = '';
    let currentWordStart = 0;
    let currentWordEnd = 0;

    for (const char of alignment.characters) {
      if (char.text === '\n') {
        // Flush current word
        if (currentWordText.trim()) {
          currentLine.words.push({
            text: currentWordText.trim(),
            start: currentWordStart,
            end: currentWordEnd
          });
          currentWordText = '';
        }
        // Flush current line
        if (currentLine.words.length > 0) {
          currentLine.text = currentLine.words.map(w => w.text).join(' ');
          currentLine.start = currentLine.words[0].start;
          currentLine.end = currentLine.words[currentLine.words.length - 1].end;
          lines.push(currentLine);
          currentLine = { words: [], start: 0, end: 0, text: '' };
        }
      } else if (char.text === ' ') {
        // Flush current word
        if (currentWordText.trim()) {
          currentLine.words.push({
            text: currentWordText.trim(),
            start: currentWordStart,
            end: currentWordEnd
          });
          currentWordText = '';
        }
      } else {
        // Build current word
        if (!currentWordText) {
          currentWordStart = char.start;
        }
        currentWordText += char.text;
        currentWordEnd = char.end;
      }
    }

    // Flush remaining word and line
    if (currentWordText.trim()) {
      currentLine.words.push({
        text: currentWordText.trim(),
        start: currentWordStart,
        end: currentWordEnd
      });
    }
    if (currentLine.words.length > 0) {
      currentLine.text = currentLine.words.map(w => w.text).join(' ');
      currentLine.start = currentLine.words[0].start;
      currentLine.end = currentLine.words[currentLine.words.length - 1].end;
      lines.push(currentLine);
    }

    const wordCount = alignment.words ? alignment.words.length : lines.reduce((sum, line) => sum + line.words.length, 0);

    // Build metadata JSON (WITHOUT version field - no versioning needed)
    const metadata = {
      geniusId,
      title,
      artist,
      lines,
      words: alignment.words || [],
      alignment: alignment.characters, // Keep raw character data for reference
      wordCount,
      lineCount: lines.length,
      generatedAt: Date.now()
    };

    // Step 5: Upload to Grove (SINGLE NODE via runOnce)
    console.log('[5/6] Uploading to Grove...');
    const uploadResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: 'groveUpload' },
      async () => {
        try {
          const metadataJson = JSON.stringify(metadata);
          console.log(`   Metadata size: ${metadataJson.length} bytes`);

          // Upload to Grove (Lens Testnet chain_id: 37111)
          const groveResp = await fetch('https://api.grove.storage/?chain_id=37111', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: metadataJson
          });

          if (!groveResp.ok) {
            const errorText = await groveResp.text();
            return JSON.stringify({ error: `Grove upload failed: ${groveResp.status} - ${errorText}` });
          }

          const groveResult = await groveResp.json();
          // Grove can return array or object
          const groveData = Array.isArray(groveResult) ? groveResult[0] : groveResult;
          console.log(`   Grove upload successful, key: ${groveData.storage_key}`);

          return JSON.stringify({ storageKey: groveData.storage_key });
        } catch (error) {
          return JSON.stringify({ error: `Grove upload failed: ${error.message}` });
        }
      }
    );

    const uploadData = JSON.parse(uploadResult);
    if (uploadData.error) {
      throw new Error(uploadData.error);
    }

    const metadataUri = `lens://${uploadData.storageKey}`;
    console.log(`✅ Uploaded to Grove: ${metadataUri}`);

    // Step 6: Update contract (SINGLE NODE via runOnce to avoid duplicate txs)
    let txHash = null;
    let contractError = null;

    if (updateContract) {
      console.log('[6/6] Updating contract...');
      const txResult = await Lit.Actions.runOnce(
        { waitForResponse: true, name: 'contractUpdate' },
        async () => {
          try {
            const updateAbi = [
              'function setAlignmentUri(uint32 geniusId, string alignmentUri) returns (bool)'
            ];
            const iface = new ethers.utils.Interface(updateAbi);
            const calldata = iface.encodeFunctionData('setAlignmentUri', [geniusId, metadataUri]);

            // Get gas price and nonce
            const gasPrice = await provider.getGasPrice();
            const nonce = await provider.getTransactionCount(SYSTEM_PKP.address);

            // Build unsigned transaction (no "from" field before serialization)
            const unsignedTx = {
              to: contractAddress,
              data: calldata,
              gasLimit: 3000000,
              gasPrice: gasPrice.toHexString(),
              nonce,
              chainId: 84532, // Base Sepolia
            };

            // Hash the transaction for signing (return as hex string for JSON serialization)
            const txHash = ethers.utils.keccak256(ethers.utils.serializeTransaction(unsignedTx));

            return JSON.stringify({ unsignedTx, txHashHex: txHash });
          } catch (error) {
            return JSON.stringify({ error: `Contract update prep failed: ${error.message}` });
          }
        }
      );

      const txData = JSON.parse(txResult);
      if (txData.error) {
        contractError = txData.error;
        console.error(`❌ Contract update failed: ${contractError}`);
      } else {
        // Convert hex hash to Uint8Array for signing
        const toSign = ethers.utils.arrayify(txData.txHashHex);

        // Sign the transaction (ALL NODES for threshold signature)
        const signature = await Lit.Actions.signAndCombineEcdsa({
          toSign,
          publicKey: SYSTEM_PKP.publicKey,
          sigName: 'contractUpdateSig',
        });

        // Submit transaction (SINGLE NODE via runOnce)
        const submitResult = await Lit.Actions.runOnce(
          { waitForResponse: true, name: 'txSubmit' },
          async () => {
            try {
              // Parse signature from Lit Actions
              const sig = JSON.parse(signature);
              const r = sig.r.startsWith('0x') ? sig.r : '0x' + sig.r;
              const s = sig.s.startsWith('0x') ? sig.s : '0x' + sig.s;

              // Extract recovery ID
              let recid = 0;
              if (sig.recid !== undefined) {
                recid = sig.recid;
              } else if (sig.v !== undefined) {
                recid = sig.v >= 27 ? sig.v - 27 : sig.v;
              }

              // Calculate EIP-155 v value (chainId = 84532 for Base Sepolia)
              const v = 84532 * 2 + 35 + recid;

              // Serialize with signature
              const signedTx = ethers.utils.serializeTransaction(txData.unsignedTx, { r, s, v });
              const txResp = await provider.sendTransaction(signedTx);

              return JSON.stringify({ txHash: txResp.hash });
            } catch (error) {
              return JSON.stringify({ error: `Transaction submission failed: ${error.message}` });
            }
          }
        );

        const submitData = JSON.parse(submitResult);
        if (submitData.error) {
          contractError = submitData.error;
          console.error(`❌ Transaction submission failed: ${contractError}`);
        } else {
          txHash = submitData.txHash;
          console.log(`✅ Contract updated, tx: ${txHash}`);
        }
      }
    }

    // Return success
    const result = {
      success: true,
      metadataUri,
      lineCount: lyricsData.lineCount,
      wordCount,
      txHash,
      contractError
    };

    Lit.Actions.setResponse({ response: JSON.stringify(result) });

  } catch (error) {
    console.error('❌ Error:', error.message);
    const result = {
      success: false,
      error: error.message,
      stack: error.stack
    };
    Lit.Actions.setResponse({ response: JSON.stringify(result) });
  }
};

go();
