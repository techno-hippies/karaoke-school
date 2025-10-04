/**
 * Karaoke Scorer v2 - ClipRegistry Integration
 *
 * SECURITY FIX: Reads lyrics from on-chain ClipRegistry instead of accepting them as params.
 * This prevents score spoofing by ensuring lyrics come from a trusted source.
 *
 * Flow:
 * 1. Query ClipRegistryV1 contract for clip metadata
 * 2. Fetch lyrics from Grove using timestampsUri
 * 3. Transcribe audio using Voxstral API
 * 4. Calculate score by comparing transcript to on-chain lyrics
 * 5. Submit score to KaraokeScoreboardV1 contract
 *
 * Expected params (via jsParams):
 * - audioDataBase64: Base64 encoded audio data
 * - clipId: Clip identifier (e.g., "down-home-blues-verse")
 * - userAddress: User's wallet address (REQUIRED)
 * - pkpPublicKey: PKP public key for signing transactions
 * - language: Language code (default: 'en')
 *
 * Encryption params:
 * - accessControlConditions: IPFS-based access control
 * - ciphertext: Encrypted Voxstral API key
 * - dataToEncryptHash: Hash of encrypted Voxstral key
 *
 * - contractAddressCiphertext: Encrypted scoreboard contract address
 * - contractAddressDataToEncryptHash: Hash for scoreboard contract
 * - contractAddressAccessControlConditions: ACCs for scoreboard contract
 *
 * - clipRegistryAddressCiphertext: Encrypted ClipRegistry address
 * - clipRegistryAddressDataToEncryptHash: Hash for ClipRegistry
 * - clipRegistryAddressAccessControlConditions: ACCs for ClipRegistry (optional)
 *
 * Optional analytics params:
 * - sessionId, userLanguage, userIpCountry, userAgent
 * - dbUrlCiphertext, dbUrlDataToEncryptHash, dbUrlAccessControlConditions
 * - dbTokenCiphertext, dbTokenDataToEncryptHash, dbTokenAccessControlConditions
 */

const go = async () => {
  const startTime = Date.now();
  let success = false;
  let transcript = '';
  let errorType = null;
  let transcriptionLength = 0;
  let detectedLang = null;
  let calculatedScore = 0;
  let txHash = null;

  // Extract parameters from jsParams
  const {
    audioDataBase64,
    language,
    userAddress,
    clipId,
    pkpPublicKey,
    userLanguage,
    userIpCountry,
    userAgent,
    sessionId,
    accessControlConditions,
    ciphertext,
    dataToEncryptHash,
    contractAddressCiphertext,
    contractAddressDataToEncryptHash,
    contractAddressAccessControlConditions,
    clipRegistryAddressCiphertext,
    clipRegistryAddressDataToEncryptHash,
    clipRegistryAddressAccessControlConditions,
    dbUrlCiphertext,
    dbUrlDataToEncryptHash,
    dbUrlAccessControlConditions,
    dbTokenCiphertext,
    dbTokenDataToEncryptHash,
    dbTokenAccessControlConditions
  } = jsParams || {};

  // Analytics variables
  let walletAddr = 'anonymous';
  let sessionIdParam = sessionId || crypto.randomUUID();
  let userAgentParam = userAgent || 'unknown';
  let languageParam = userLanguage || null;
  let userIpCountryParam = userIpCountry || 'XX';
  let dbEndpoint = null;
  let dbCredentials = null;

  /**
   * Calculate karaoke score by comparing transcript to expected lyrics
   */
  function calculateScore(transcript, expectedLyrics) {
    if (!transcript || !expectedLyrics) return 0;

    const normalize = (str) => str.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const transcriptWords = normalize(transcript);
    const expectedWords = normalize(expectedLyrics);

    if (expectedWords.length === 0) return 0;

    let matches = 0;
    const minLength = Math.min(transcriptWords.length, expectedWords.length);

    for (let i = 0; i < minLength; i++) {
      if (transcriptWords[i] === expectedWords[i]) {
        matches++;
      }
    }

    const lengthPenalty = Math.abs(transcriptWords.length - expectedWords.length) / expectedWords.length;
    const rawScore = (matches / expectedWords.length) * 100;
    const finalScore = Math.max(0, rawScore - (lengthPenalty * 10));

    return Math.round(Math.min(100, finalScore));
  }

  try {
    // Validate required parameters
    if (!audioDataBase64) {
      throw new Error('audioDataBase64 is required');
    }
    if (!userAddress) {
      throw new Error('userAddress is required');
    }
    if (!clipId) {
      throw new Error('clipId is required');
    }
    if (!pkpPublicKey) {
      throw new Error('pkpPublicKey is required');
    }

    // Validate encryption parameters
    if (!accessControlConditions || !ciphertext || !dataToEncryptHash) {
      throw new Error('Missing Voxstral API encryption parameters');
    }
    if (!contractAddressCiphertext || !contractAddressDataToEncryptHash) {
      throw new Error('Missing scoreboard contract encryption parameters');
    }
    if (!clipRegistryAddressCiphertext || !clipRegistryAddressDataToEncryptHash) {
      throw new Error('Missing ClipRegistry encryption parameters');
    }

    const languageCode = language || 'en';
    const modelName = 'voxtral-mini-latest';
    walletAddr = userAddress;

    // Decode audio data
    const audioData = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0));

    // Decrypt all secrets in parallel
    const [voxstralApiKey, scoreboardContractAddress, clipRegistryAddress] = await Promise.all([
      Lit.Actions.decryptAndCombine({
        accessControlConditions,
        ciphertext,
        dataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      }),
      Lit.Actions.decryptAndCombine({
        accessControlConditions: contractAddressAccessControlConditions || accessControlConditions,
        ciphertext: contractAddressCiphertext,
        dataToEncryptHash: contractAddressDataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      }),
      Lit.Actions.decryptAndCombine({
        accessControlConditions: clipRegistryAddressAccessControlConditions || accessControlConditions,
        ciphertext: clipRegistryAddressCiphertext,
        dataToEncryptHash: clipRegistryAddressDataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      })
    ]);

    // Decrypt DB credentials (optional)
    if (dbUrlCiphertext && dbTokenCiphertext) {
      try {
        [dbEndpoint, dbCredentials] = await Promise.all([
          Lit.Actions.decryptAndCombine({
            accessControlConditions: dbUrlAccessControlConditions || accessControlConditions,
            ciphertext: dbUrlCiphertext,
            dataToEncryptHash: dbUrlDataToEncryptHash,
            authSig: null,
            chain: 'ethereum'
          }),
          Lit.Actions.decryptAndCombine({
            accessControlConditions: dbTokenAccessControlConditions || accessControlConditions,
            ciphertext: dbTokenCiphertext,
            dataToEncryptHash: dbTokenDataToEncryptHash,
            authSig: null,
            chain: 'ethereum'
          })
        ]);
      } catch (dbError) {
        console.log('Could not decrypt DB credentials, continuing without analytics');
      }
    }

    // Query ClipRegistry for clip metadata
    const lensChainRpcUrl = 'https://rpc.testnet.lens.xyz';
    const provider = new ethers.providers.JsonRpcProvider(lensChainRpcUrl);

    const clipRegistryABI = [
      'function getClip(string calldata id) external view returns (tuple(string id, string title, string artist, string sectionType, uint16 sectionIndex, uint32 duration, string audioUri, string instrumentalUri, string timestampsUri, string thumbnailUri, string languages, uint8 difficultyLevel, uint8 wordsPerSecond, bool enabled, uint64 addedAt))'
    ];

    const clipRegistryContract = new ethers.Contract(
      clipRegistryAddress,
      clipRegistryABI,
      provider
    );

    const clipData = await clipRegistryContract.getClip(clipId);

    if (!clipData || !clipData.enabled) {
      throw new Error(`Clip ${clipId} not found or disabled`);
    }

    const timestampsUri = clipData.timestampsUri;
    if (!timestampsUri) {
      throw new Error(`No timestampsUri for clip ${clipId}`);
    }

    // Fetch lyrics metadata from Grove
    const gatewayUrl = timestampsUri.replace('lens://', 'https://api.grove.storage/');
    const metadataResponse = await fetch(gatewayUrl);

    if (!metadataResponse.ok) {
      throw new Error(`Failed to fetch clip metadata: ${metadataResponse.status}`);
    }

    const clipMetadata = await metadataResponse.json();

    // Extract lyrics from metadata lines
    if (!clipMetadata.lines || !Array.isArray(clipMetadata.lines)) {
      throw new Error('Invalid clip metadata: missing lines array');
    }

    const expectedLyrics = clipMetadata.lines
      .map(line => line.originalText || '')
      .join(' ')
      .trim();

    if (!expectedLyrics) {
      throw new Error('No lyrics found in clip metadata');
    }

    // Create multipart form data for Voxstral API
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
    const encoder = new TextEncoder();
    const parts = [];

    // File field
    parts.push(encoder.encode('--' + boundary + '\r\n'));
    parts.push(encoder.encode('Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n'));
    parts.push(encoder.encode('Content-Type: audio/mpeg\r\n\r\n'));
    parts.push(audioData);
    parts.push(encoder.encode('\r\n'));

    // Model field
    parts.push(encoder.encode('--' + boundary + '\r\n'));
    parts.push(encoder.encode('Content-Disposition: form-data; name="model"\r\n\r\n'));
    parts.push(encoder.encode(modelName + '\r\n'));

    // Language field
    parts.push(encoder.encode('--' + boundary + '\r\n'));
    parts.push(encoder.encode('Content-Disposition: form-data; name="language"\r\n\r\n'));
    parts.push(encoder.encode(languageCode + '\r\n'));

    // End boundary
    parts.push(encoder.encode('--' + boundary + '--\r\n'));

    // Combine parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }

    // Call Voxstral API
    const voxstralResponse = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + voxstralApiKey,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
      },
      body: body
    });

    if (!voxstralResponse.ok) {
      if (voxstralResponse.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      throw new Error('Voxstral error: ' + voxstralResponse.status);
    }

    const voxstralData = await voxstralResponse.json();
    transcript = voxstralData.text || '';

    if (!transcript) {
      throw new Error('No transcript from Voxstral');
    }

    transcriptionLength = transcript.length;
    detectedLang = voxstralData.language || languageCode;

    // Calculate score using on-chain lyrics
    calculatedScore = calculateScore(transcript, expectedLyrics);
    success = true;

    // Submit score to scoreboard contract
    try {
      const scoreboardABI = ['function updateScore(string calldata clipId, address user, uint96 newScore)'];
      const iface = new ethers.utils.Interface(scoreboardABI);
      const callData = iface.encodeFunctionData('updateScore', [clipId, userAddress, calculatedScore]);

      const pkpPublicKeyFormatted = pkpPublicKey.startsWith('0x') ? pkpPublicKey : '0x' + pkpPublicKey;
      const pkpEthAddress = ethers.utils.computeAddress(pkpPublicKeyFormatted);
      const nonce = await provider.getTransactionCount(pkpEthAddress);
      const gasPrice = await provider.getGasPrice();

      const unsignedTx = {
        to: scoreboardContractAddress,
        data: callData,
        gasLimit: 500000,
        gasPrice: gasPrice,
        nonce: nonce,
        chainId: 37111,
        value: 0
      };

      const serializedTx = ethers.utils.serializeTransaction(unsignedTx);
      const txHashToSign = ethers.utils.keccak256(serializedTx);

      // Sign with PKP
      const signature = await Lit.Actions.signAndCombineEcdsa({
        toSign: ethers.utils.arrayify(txHashToSign),
        publicKey: pkpPublicKey,
        sigName: "karaokeScoreSig",
      });

      // Parse v8 signature format
      const jsonSignature = JSON.parse(signature);
      jsonSignature.r = jsonSignature.r.startsWith('0x') ? jsonSignature.r : '0x' + jsonSignature.r;
      jsonSignature.s = jsonSignature.s.startsWith('0x') ? jsonSignature.s : '0x' + jsonSignature.s;
      const hexSignature = ethers.utils.joinSignature(jsonSignature);

      const signedTx = ethers.utils.serializeTransaction(unsignedTx, hexSignature);

      // Submit transaction (non-blocking)
      txHash = await Lit.Actions.runOnce(
        { waitForResponse: false, name: `submitKaraokeScore_${clipId}_${userAddress}_${Date.now()}` },
        async () => {
          try {
            const tx = await provider.sendTransaction(signedTx);
            return tx.hash;
          } catch (error) {
            return `ERROR: ${error.message}`;
          }
        }
      );

    } catch (contractError) {
      console.error('Contract interaction failed:', contractError.message);
      errorType = `CONTRACT_ERROR: ${contractError.message}`;
    }

  } catch (error) {
    errorType = error.message || 'unknown_error';
    success = false;
  } finally {
    // Send analytics
    try {
      const analyticsRunOnceName = `sendKaraokeScoreAnalytics_${sessionIdParam}`;
      await Lit.Actions.runOnce({ waitForResponse: true, name: analyticsRunOnceName }, async () => {
        async function sha256(message) {
          const encoder = new TextEncoder();
          const data = encoder.encode(message);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        const METRICS_SALT = 'ks_metrics_2025';
        const countryCode = userIpCountryParam || 'XX';
        const userHash = await sha256(walletAddr + METRICS_SALT);
        const userAgentHash = await sha256(userAgentParam + METRICS_SALT);

        const analyticsData = {
          timestamp: new Date().toISOString(),
          event_id: crypto.randomUUID(),
          user_hash: userHash,
          country_code: countryCode,
          action_type: 'karaoke_score_v2',
          tier: 'free',
          success: success,
          error_type: errorType || null,
          processing_ms: Date.now() - startTime,
          session_id: sessionIdParam,
          user_agent_hash: userAgentHash,
          language: languageParam,
          parent_event_id: null,
          pipeline_step: null,
          model_used: 'voxtral-mini-latest',
          tokens_used: null,
          prompt_tokens: null,
          completion_tokens: null,
          provider_latency_ms: null,
          generation_time_ms: null,
          total_latency_ms: Date.now() - startTime,
          cost_usd: 0,
          input_text: null,
          output_text: transcript ? transcript.substring(0, 500) : null,
          metadata: JSON.stringify({
            transcription_length: transcriptionLength,
            language_detected: detectedLang,
            provider: 'Mistral/Voxstral',
            context: 'karaoke_game',
            clip_id: clipId,
            calculated_score: calculatedScore,
            tx_hash: txHash,
            lyrics_source: 'on_chain_clip_registry'
          })
        };

        if (!dbEndpoint || !dbCredentials) {
          return false;
        }

        const ndjsonData = JSON.stringify(analyticsData) + '\n';

        try {
          const dataResponse = await fetch(dbEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dbCredentials}`,
              'Content-Type': 'application/x-ndjson'
            },
            body: ndjsonData
          });

          return dataResponse.ok;
        } catch (fetchError) {
          return false;
        }
      });
    } catch (metricsError) {
      // Metrics errors ignored
    }

    // Return response
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: success,
        transcript: transcript,
        score: calculatedScore,
        txHash: txHash,
        error: errorType,
        version: 'karaoke_scorer_v2'
      })
    });
  }
};

go();
