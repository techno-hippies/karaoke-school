/**
 * Translate Lyrics v1: Self-Contained Translation
 *
 * PHILOSOPHY: Decoupled from base alignment - fetches lyrics independently
 * - No dependency on base-alignment running first
 * - Can run in parallel with base-alignment
 * - Simplifies state management in frontend
 *
 * Benefits:
 * - Cheap operation (~$0.02 per language)
 * - Parallel execution with alignment (faster unlock flow)
 * - Independent translation updates (can retranslate without re-aligning)
 *
 * Flow:
 * 1. Read song data from contract (title, artist) - validates song was cataloged
 * 2. Fetch synced lyrics from LRClib (same source as base-alignment)
 * 3. OpenRouter translation for target language
 * 4. Build translation-only JSON with line IDs
 * 5. Upload to Grove storage as song-{geniusId}-{lang}.json
 * 6. Update contract via setTranslation(geniusId, languageCode, uri)
 *
 * Input:
 * - geniusId: Genius song ID (ONLY required input)
 * - targetLanguage: 'zh' | 'vi' | 'es' | 'ja' | 'ko' | 'tr' (ISO 639-1 code)
 * - openrouterKeyAccessControlConditions, openrouterKeyCiphertext, openrouterKeyDataToEncryptHash
 * - contractAddress, pkpAddress, pkpTokenId, pkpPublicKey
 * - updateContract: true/false (whether to write to blockchain)
 *
 * Output:
 * - translationUri: lens://... (Grove storage URI for this language)
 * - lineCount: Number of translated lines
 * - txHash: Contract update transaction (if updateContract=true)
 *
 * Time: ~5-15s (LRClib + OpenRouter + Grove + contract write)
 * Cost: ~$0.02 (OpenRouter only)
 */

// Hardcoded system PKP credentials (deployed as trustedProcessor on KaraokeCatalogV2)
const SYSTEM_PKP = {
  publicKey: '043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939',
  address: '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30',
  tokenId: '18495970405190900970517221272825216094387884724482470185691150662171839015831'
};

console.log('=== TRANSLATE LYRICS v1 LOADED ===');
console.log('Lit Actions API available:', typeof Lit !== 'undefined');
console.log('ethers available:', typeof ethers !== 'undefined');

const go = async () => {
  console.log('=== STARTING EXECUTION ===');
  const {
    geniusId,
    targetLanguage,
    openrouterKeyAccessControlConditions,
    openrouterKeyCiphertext,
    openrouterKeyDataToEncryptHash,
    contractAddress,
    updateContract = true,
  } = jsParams || {};

  console.log('jsParams received, geniusId:', geniusId, 'targetLanguage:', targetLanguage);

  try {
    // Validate required params
    if (!geniusId) throw new Error('geniusId is required');
    if (!targetLanguage) throw new Error('targetLanguage is required');
    if (!contractAddress) {
      throw new Error('contractAddress is required');
    }

    // Step 1: Read song data from contract (ALL NODES)
    console.log('[1/5] Reading song data from contract...');
    const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
    const provider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    const catalogAbi = [
      'function getSongByGeniusId(uint32) view returns (tuple(string id, uint32 geniusId, string title, string artist, uint32 duration, string soundcloudPath, bool hasFullAudio, bool requiresPayment, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri, string sectionsUri, string alignmentUri, bool enabled, uint64 addedAt))'
    ];
    const catalog = new ethers.Contract(contractAddress, catalogAbi, provider);
    const songData = await catalog.getSongByGeniusId(geniusId);

    const title = songData.title;
    const artist = songData.artist;
    const alignmentUri = songData.alignmentUri || '';

    if (!title || !artist) {
      throw new Error('Song has no title/artist in contract. Run match-and-segment first to catalog the song.');
    }

    console.log(`✅ Song data from contract:`);
    console.log(`   Title: ${title}`);
    console.log(`   Artist: ${artist}`);
    console.log(`   AlignmentUri: ${alignmentUri || '(none - will use LRClib)'}`);

    // Step 2: Fetch lyrics (try alignmentUri for native songs, fall back to LRClib)
    console.log('[2/5] Fetching lyrics...');
    const lyricsResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: 'fetchLyrics' },
      async () => {
        try {
          // Helper function to convert lens:// to https://
          const lensToGroveUrl = (uri) => {
            if (!uri) return '';
            const lower = uri.toLowerCase();
            if (!lower.startsWith('lens') && !lower.startsWith('glen')) return uri;
            const hash = uri.replace(/^(lens|glens?):\/\//i, '');
            return `https://api.grove.storage/${hash}`;
          };

          // Try alignmentUri first (native songs with full alignment data)
          if (alignmentUri) {
            console.log('   Using alignmentUri (native song)...');
            const alignmentUrl = lensToGroveUrl(alignmentUri);
            const alignmentResp = await fetch(alignmentUrl);

            if (alignmentResp.ok) {
              const alignmentData = await alignmentResp.json();

              if (alignmentData.lines && Array.isArray(alignmentData.lines) && alignmentData.lines.length > 0) {
                // Extract text from alignment data
                const lyricsLines = alignmentData.lines.map((line, i) => ({
                  id: line.lineIndex !== undefined ? line.lineIndex : i,
                  text: line.text
                }));

                console.log(`   ✅ Loaded ${lyricsLines.length} lines from alignmentUri`);
                return JSON.stringify({ lyricsLines, lineCount: lyricsLines.length, source: 'alignment' });
              }
            }

            console.log('   ⚠️ AlignmentUri exists but failed to load, falling back to LRClib...');
          }

          // Fall back to LRClib (Genius songs)
          console.log('   Using LRClib (Genius song)...');
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

          if (!syncedLyrics) {
            return JSON.stringify({ error: 'No synced lyrics available' });
          }

          // Parse synced lyrics to extract plain text lines with IDs
          const lines = syncedLyrics.split('\n').filter(l => l.trim());
          const lyricsLines = [];

          for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/\[[\d:.]+\]\s*(.+)/);
            if (match && match[1]) {
              lyricsLines.push({
                id: i,
                text: match[1]
              });
            }
          }

          console.log(`   ✅ Loaded ${lyricsLines.length} lines from LRClib`);
          return JSON.stringify({ lyricsLines, lineCount: lyricsLines.length, source: 'lrclib' });
        } catch (error) {
          return JSON.stringify({ error: `Lyrics fetch failed: ${error.message}` });
        }
      }
    );

    const lyricsData = JSON.parse(lyricsResult);
    if (lyricsData.error) {
      throw new Error(lyricsData.error);
    }

    const lyricsLines = lyricsData.lyricsLines;
    console.log(`✅ Lyrics fetched (${lyricsData.lineCount} lines from ${lyricsData.source || 'unknown'})`);

    // Step 3: Decrypt OpenRouter key (ALL NODES for threshold decryption)
    console.log('[3/5] Decrypting OpenRouter key...');
    let openrouterKey;
    try {
      openrouterKey = await Lit.Actions.decryptAndCombine({
        accessControlConditions: openrouterKeyAccessControlConditions,
        ciphertext: openrouterKeyCiphertext,
        dataToEncryptHash: openrouterKeyDataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      });
      console.log('OpenRouter key decrypted');
    } catch (decryptError) {
      throw new Error(`Failed to decrypt OpenRouter key: ${decryptError.message}`);
    }

    // Step 4: Translate lyrics with OpenRouter (SINGLE NODE via runOnce)
    console.log('[4/5] Translating lyrics...');

    // Language names for better LLM understanding
    const languageNames = {
      'zh': 'Chinese (Simplified)',
      'vi': 'Vietnamese',
      'es': 'Spanish',
      'ja': 'Japanese',
      'ko': 'Korean',
      'tr': 'Turkish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'th': 'Thai'
    };

    const languageName = languageNames[targetLanguage] || targetLanguage;

    const translationsJson = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "openrouterTranslation" },
      async () => {
        try {
          // Build lyrics text for translation
          const lyricsText = lyricsLines.map(line => line.text).join('\n');

          const prompt = `You are a professional song translator. Translate these English song lyrics to ${languageName}.

CRITICAL RULES:
1. Preserve the meaning and emotion of each line
2. Keep translations natural and singable
3. Maintain the same number of lines (one translation per line)
4. Do NOT add explanations or notes
5. Output ONLY the translated lyrics, one line per line

ENGLISH LYRICS:
${lyricsText}

TRANSLATE TO ${languageName.toUpperCase()}:`;

          console.log('Calling OpenRouter API...');
          const apiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'Content-Type': 'application/json',
              'X-Title': 'Karaoke School Translate Lyrics v1',
              'HTTP-Referer': 'https://karaoke.school'
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite-preview-09-2025',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3,
              max_tokens: 4000
            })
          });

          if (!apiResp.ok) {
            const errorText = await apiResp.text();
            return JSON.stringify({
              success: false,
              error: `OpenRouter API failed: ${apiResp.status} - ${errorText}`
            });
          }

          const apiData = await apiResp.json();

          if (apiData.error) {
            return JSON.stringify({
              success: false,
              error: apiData.error.message || JSON.stringify(apiData.error)
            });
          }

          const translatedText = apiData.choices?.[0]?.message?.content;
          if (!translatedText) {
            return JSON.stringify({
              success: false,
              error: 'No translation returned from API'
            });
          }

          console.log('Translation received');

          // Parse translations (one per line)
          const translatedLines = translatedText.trim().split('\n');

          // Match with original lines
          const translations = [];
          for (let i = 0; i < lyricsLines.length; i++) {
            const originalLine = lyricsLines[i];
            const translatedLine = translatedLines[i] || '';

            translations.push({
              id: originalLine.id,
              text: originalLine.text,
              translation: translatedLine.trim()
            });
          }

          return JSON.stringify({
            success: true,
            translations: translations
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

    const translationResult = JSON.parse(translationsJson);
    console.log('Translation result:', translationResult.success ? 'SUCCESS' : 'FAILED');

    if (!translationResult.success) {
      throw new Error(`Translation failed: ${translationResult.error}`);
    }

    console.log(`Translated ${translationResult.translations.length} lines`);

    // Step 5: Upload translation to Grove (SINGLE NODE via runOnce)
    console.log('[5/5] Uploading translation to Grove...');

    const groveUploadResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "groveUpload" },
      async () => {
        try {
          // Build translation-only metadata
          const metadata = {
            geniusId: geniusId,
            language: targetLanguage,
            type: 'translation',
            version: 1,
            lines: translationResult.translations
          };

          const metadataJson = JSON.stringify(metadata);
          console.log(`Metadata size: ${metadataJson.length} bytes`);

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
            return JSON.stringify({
              success: false,
              error: `Grove upload failed: ${groveResp.status} - ${errorText}`
            });
          }

          const groveResult = await groveResp.json();
          // Grove can return array or object
          const groveData = Array.isArray(groveResult) ? groveResult[0] : groveResult;
          console.log('Grove upload successful, key:', groveData.storage_key);

          const groveUri = `lens://${groveData.storage_key}`;

          return JSON.stringify({
            success: true,
            uri: groveUri,
            key: groveData.storage_key
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

    const translationUri = groveResult.uri;
    console.log('Translation URI:', translationUri);

    // Step 6: Update contract via setTranslation (SINGLE NODE via runOnce)
    let txHash = null;
    let contractError = null;

    if (updateContract) {
      console.log('[6/6] Updating contract with setTranslation...');

      const contractUpdateResult = await Lit.Actions.runOnce(
        { waitForResponse: true, name: "contractUpdate" },
        async () => {
          try {
            // ABI for setTranslation function
            const abi = [
              'function setTranslation(uint32 geniusId, string calldata languageCode, string calldata uri) external'
            ];

            const iface = new ethers.utils.Interface(abi);
            const calldata = iface.encodeFunctionData('setTranslation', [geniusId, targetLanguage, translationUri]);

            // Get gas price and nonce
            const gasPrice = await provider.getGasPrice();
            const nonce = await provider.getTransactionCount(SYSTEM_PKP.address);

            // Build unsigned transaction (no "from" field before serialization)
            const unsignedTx = {
              to: contractAddress,
              data: calldata,
              gasLimit: 200000,
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

      const txData = JSON.parse(contractUpdateResult);
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
    } else {
      console.log('[6/6] Skipping contract update (updateContract=false)');
    }

    // Return final result
    const result = {
      success: true,
      geniusId: geniusId,
      targetLanguage: targetLanguage,
      translationUri: translationUri,
      storageKey: groveResult.key,
      gatewayUrl: `https://api.grove.storage/${groveResult.key}`,
      lineCount: translationResult.translations.length,
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
