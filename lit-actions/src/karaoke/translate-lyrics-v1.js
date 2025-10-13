/**
 * Translate Lyrics v1: Per-Language Translation (NO Timing)
 *
 * Called on-demand when user needs a specific language.
 * Reuses base alignment from base-alignment-v1.js (no ElevenLabs needed).
 *
 * Benefits:
 * - Cheap operation (~$0.02 per language)
 * - Lazy-loaded (only create translations users need)
 * - No ElevenLabs cost (reuses existing word timing)
 * - Parallel execution (multiple users can translate simultaneously)
 *
 * Flow:
 * 1. Load base alignment from contract metadataUri
 * 2. OpenRouter translation for target language
 * 3. Build translation-only JSON
 * 4. Upload to Grove storage as song-{geniusId}-{lang}.json
 * 5. Update contract via setTranslation(geniusId, languageCode, uri)
 *
 * Input:
 * - geniusId: Genius song ID
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
 * Time: ~5-15s (OpenRouter + Grove + contract write)
 * Cost: ~$0.02 (OpenRouter only)
 */

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
    pkpAddress,
    pkpTokenId,
    pkpPublicKey,
    updateContract = true,
  } = jsParams || {};

  console.log('jsParams received, geniusId:', geniusId, 'targetLanguage:', targetLanguage);

  try {
    // Validate required params
    if (!geniusId) throw new Error('geniusId is required');
    if (!targetLanguage) throw new Error('targetLanguage is required');
    if (!contractAddress || !pkpAddress || !pkpTokenId || !pkpPublicKey) {
      throw new Error('Contract params (contractAddress, pkpAddress, pkpTokenId, pkpPublicKey) are required');
    }

    // Step 1: Load base alignment from contract
    console.log('[1/4] Loading base alignment from contract...');

    const provider = new ethers.providers.JsonRpcProvider('https://sepolia.base.org');
    const catalogAbi = [
      'function getSongByGeniusId(uint32 geniusId) external view returns (tuple(string id, uint32 geniusId, string title, string artist, uint32 duration, bool hasFullAudio, bool requiresPayment, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri, bool enabled, uint64 addedAt))'
    ];
    const catalog = new ethers.Contract(contractAddress, catalogAbi, provider);

    const songData = await catalog.getSongByGeniusId(geniusId);
    console.log('Song found:', songData.title, '-', songData.artist);

    if (!songData.metadataUri || songData.metadataUri === '') {
      throw new Error('Song has no base alignment. Run base-alignment-v1 first!');
    }

    console.log('Base alignment URI:', songData.metadataUri);

    // Download base alignment from Grove
    const metadataUrl = songData.metadataUri.startsWith('lens://')
      ? `https://api.grove.storage/${songData.metadataUri.replace('lens://', '')}`
      : songData.metadataUri;

    const metadataResp = await fetch(metadataUrl);
    if (!metadataResp.ok) {
      throw new Error(`Failed to fetch base alignment: ${metadataResp.status}`);
    }

    const baseAlignment = await metadataResp.json();
    console.log('Base alignment loaded:', baseAlignment.lines.length, 'lines');

    // Step 2: Decrypt OpenRouter key
    console.log('[2/4] Decrypting OpenRouter key...');
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

    // Step 3: Translate lyrics with OpenRouter (using runOnce)
    console.log('[3/4] Translating lyrics...');

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
          const lyricsText = baseAlignment.lines.map(line => line.text).join('\n');

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
          for (let i = 0; i < baseAlignment.lines.length; i++) {
            const originalLine = baseAlignment.lines[i];
            const translatedLine = translatedLines[i] || '';

            translations.push({
              id: originalLine.id,
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

    // Step 4: Upload translation to Grove (using runOnce)
    console.log('[4/4] Uploading translation to Grove...');

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

    const translationUri = groveResult.uri;
    console.log('Translation URI:', translationUri);

    // Step 5: Update contract via setTranslation (using runOnce for transaction)
    let txHash = null;
    let contractError = null;

    if (updateContract) {
      console.log('[5/5] Updating contract with setTranslation...');

      const contractUpdateResult = await Lit.Actions.runOnce(
        { waitForResponse: true, name: "contractUpdate" },
        async () => {
          try {
            // ABI for setTranslation function
            const abi = [
              'function setTranslation(uint32 geniusId, string calldata languageCode, string calldata uri) external'
            ];

            const iface = new ethers.utils.Interface(abi);
            const data = iface.encodeFunctionData('setTranslation', [geniusId, targetLanguage, translationUri]);

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
      console.log('[5/5] Skipping contract update (updateContract=false)');
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
