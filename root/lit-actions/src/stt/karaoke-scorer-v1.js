/**
 * Karaoke Scorer v1 - Speech-to-Text with On-Chain Score Submission
 * Based on free-v8.js + adds scoring and contract interaction
 *
 * This Lit Action:
 * 1. Transcribes karaoke audio using Voxstral API
 * 2. Calculates accuracy score by comparing to expected lyrics
 * 3. Submits score to KaraokeScoreboardV1 contract on Lens Chain
 * 4. Only PKP can sign transactions (anti-cheat)
 *
 * Expected params (via jsParams):
 * - audioDataBase64: Base64 encoded audio data
 * - language: Language code (default: 'en' for English)
 * - userAddress: The user's wallet address (REQUIRED for scoring)
 * - clipId: Clip identifier (e.g., "scarlett-verse-1")
 * - expectedLyrics: The correct lyrics for this clip
 * - pkpPublicKey: PKP public key for signing transactions
 *
 * - userLanguage: User's browser language (optional, for analytics)
 * - userIpCountry: User's country code (optional)
 * - userAgent: User agent string (optional)
 * - sessionId: Session identifier (optional)
 *
 * Encryption params:
 * - accessControlConditions: IPFS-based access control only
 * - ciphertext: The encrypted Voxstral API key
 * - dataToEncryptHash: The hash of the encrypted data
 *
 * - contractAddressCiphertext: Encrypted scoreboard contract address
 * - contractAddressDataToEncryptHash: Hash for contract address
 * - contractAddressAccessControlConditions: ACCs for contract address
 *
 * Analytics params (optional):
 * - dbUrlCiphertext, dbUrlDataToEncryptHash
 * - dbTokenCiphertext, dbTokenDataToEncryptHash
 * - dbUrlAccessControlConditions, dbTokenAccessControlConditions
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

  // Extract all parameters from jsParams (v8 pattern)
  const {
    audioDataBase64,
    language,
    userAddress,
    clipId,
    expectedLyrics,
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
    dbUrlCiphertext,
    dbUrlDataToEncryptHash,
    dbUrlAccessControlConditions,
    dbTokenCiphertext,
    dbTokenDataToEncryptHash,
    dbTokenAccessControlConditions
  } = jsParams || {};

  // Variables for analytics
  let walletAddr = 'anonymous';
  let sessionIdParam = sessionId || crypto.randomUUID();
  let userAgentParam = userAgent || 'unknown';
  let languageParam = userLanguage || null;
  let userIpCountryParam = userIpCountry || 'XX';
  let dbEndpoint = null;
  let dbCredentials = null;

  /**
   * Calculate karaoke score by comparing transcript to expected lyrics
   * Simple word-matching algorithm (can be improved later)
   */
  function calculateScore(transcript, expectedLyrics) {
    if (!transcript || !expectedLyrics) return 0;

    // Normalize: lowercase, remove punctuation, split into words
    const normalize = (str) => str.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const transcriptWords = normalize(transcript);
    const expectedWords = normalize(expectedLyrics);

    if (expectedWords.length === 0) return 0;

    // Count matching words in order
    let matches = 0;
    const minLength = Math.min(transcriptWords.length, expectedWords.length);

    for (let i = 0; i < minLength; i++) {
      if (transcriptWords[i] === expectedWords[i]) {
        matches++;
      }
    }

    // Penalize for length mismatch
    const lengthPenalty = Math.abs(transcriptWords.length - expectedWords.length) / expectedWords.length;
    const rawScore = (matches / expectedWords.length) * 100;
    const finalScore = Math.max(0, rawScore - (lengthPenalty * 10));

    return Math.round(Math.min(100, finalScore));
  }

  try {
    // Required parameters
    if (!audioDataBase64) {
      throw new Error('audioDataBase64 is required');
    }
    if (!userAddress) {
      throw new Error('userAddress is required for scoring');
    }
    if (!clipId) {
      throw new Error('clipId is required');
    }
    if (!expectedLyrics) {
      throw new Error('expectedLyrics is required for scoring');
    }
    if (!pkpPublicKey) {
      throw new Error('pkpPublicKey is required for transaction signing');
    }

    // Required encryption parameters
    if (!accessControlConditions || !ciphertext || !dataToEncryptHash) {
      throw new Error('Missing required encryption parameters for Voxstral API');
    }
    if (!contractAddressCiphertext || !contractAddressDataToEncryptHash) {
      throw new Error('Missing required encryption parameters for contract address');
    }

    // Set defaults for optional parameters
    const languageCode = language || 'en';
    const modelName = 'voxtral-mini-latest';

    // Analytics parameters
    walletAddr = userAddress || 'anonymous';

    // Decode base64 audio data back to Uint8Array
    const audioData = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0));

    // Decrypt Voxstral API key and contract address in parallel
    const [voxstralApiKey, contractAddress] = await Promise.all([
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
      })
    ]);

    // Decrypt DB credentials if provided (optional for analytics)
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
        // Analytics optional - continue without
        console.log('📊 Karaoke Scorer: Could not decrypt DB credentials, continuing without analytics');
      }
    }

    // Create proper multipart form data using binary arrays
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
    const encoder = new TextEncoder();

    // Build parts as arrays of Uint8Arrays
    const parts = [];

    // Part 1: File field
    parts.push(encoder.encode('--' + boundary + '\r\n'));
    parts.push(encoder.encode('Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n'));
    parts.push(encoder.encode('Content-Type: audio/mpeg\r\n\r\n'));
    parts.push(audioData);
    parts.push(encoder.encode('\r\n'));

    // Part 2: Model field
    parts.push(encoder.encode('--' + boundary + '\r\n'));
    parts.push(encoder.encode('Content-Disposition: form-data; name="model"\r\n\r\n'));
    parts.push(encoder.encode(modelName + '\r\n'));

    // Part 3: Language field
    parts.push(encoder.encode('--' + boundary + '\r\n'));
    parts.push(encoder.encode('Content-Disposition: form-data; name="language"\r\n\r\n'));
    parts.push(encoder.encode(languageCode + '\r\n'));

    // End boundary
    parts.push(encoder.encode('--' + boundary + '--\r\n'));

    // Calculate total length
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);

    // Combine all parts into a single Uint8Array
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
      const errorText = await voxstralResponse.text();

      if (voxstralResponse.status === 429) {
        throw new Error('RATE_LIMITED');
      }

      throw new Error('Voxstral error: ' + voxstralResponse.status + ' ' + voxstralResponse.statusText);
    }

    const voxstralData = await voxstralResponse.json();
    transcript = voxstralData.text || '';

    if (!transcript) {
      throw new Error('No transcript from Voxstral');
    }

    transcriptionLength = transcript.length;
    detectedLang = voxstralData.language || languageCode;

    // Calculate score
    calculatedScore = calculateScore(transcript, expectedLyrics);

    success = true; // Mark success after scoring

    // Submit score to contract (skip if contract submission fails)
    try {
      const lensChainRpcUrl = 'https://rpc.testnet.lens.xyz';

      // Build contract call data
      const contractABI = ['function updateScore(string calldata clipId, address user, uint96 newScore)'];
      const iface = new ethers.utils.Interface(contractABI);
      const callData = iface.encodeFunctionData('updateScore', [clipId, userAddress, calculatedScore]);

      // Create provider with shorter timeout
      const provider = new ethers.providers.JsonRpcProvider(lensChainRpcUrl);

      // Get nonce and gas price
      const pkpPublicKeyFormatted = pkpPublicKey.startsWith('0x') ? pkpPublicKey : '0x' + pkpPublicKey;
      const pkpEthAddress = ethers.utils.computeAddress(pkpPublicKeyFormatted);
      const nonce = await provider.getTransactionCount(pkpEthAddress);
      const gasPrice = await provider.getGasPrice();

      // Build unsigned transaction
      const unsignedTx = {
        to: contractAddress,
        data: callData,
        gasLimit: 500000,
        gasPrice: gasPrice,
        nonce: nonce,
        chainId: 37111, // Lens Chain testnet
        value: 0
      };

      // Serialize and hash the transaction (MUST be outside runOnce for PKP signing)
      const serializedTx = ethers.utils.serializeTransaction(unsignedTx);
      const txHashToSign = ethers.utils.keccak256(serializedTx);

      // Sign with PKP (requires 2/3 nodes, must be outside runOnce)
      const signature = await Lit.Actions.signAndCombineEcdsa({
        toSign: ethers.utils.arrayify(txHashToSign),
        publicKey: pkpPublicKey,
        sigName: "karaokeScoreSig",
      });

      // v8 SDK returns signature as a JSON string - parse and format for ethers.js
      const jsonSignature = JSON.parse(signature);
      jsonSignature.r = jsonSignature.r.startsWith('0x') ? jsonSignature.r : '0x' + jsonSignature.r;
      jsonSignature.s = jsonSignature.s.startsWith('0x') ? jsonSignature.s : '0x' + jsonSignature.s;
      const hexSignature = ethers.utils.joinSignature(jsonSignature);

      // Serialize signed transaction
      const signedTx = ethers.utils.serializeTransaction(unsignedTx, hexSignature);

      // Submit transaction using runOnce (only one node submits)
      // Use waitForResponse: false to avoid blocking
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
      // Don't throw - we still want to return transcript and score
    }

    success = true;

  } catch (error) {
    errorType = error.message || 'unknown_error';
    success = false;
  } finally {
    // Send analytics
    try {
      const analyticsRunOnceName = `sendKaraokeScoreAnalytics_${sessionIdParam}`;
      await Lit.Actions.runOnce({ waitForResponse: true, name: analyticsRunOnceName }, async () => {
        // Quick SHA-256 hash
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

        // Prepare analytics data
        const analyticsData = {
            timestamp: new Date().toISOString(),
            event_id: crypto.randomUUID(),
            user_hash: userHash,
            country_code: countryCode,
            action_type: 'karaoke_score',
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
              expected_lyrics_length: expectedLyrics ? expectedLyrics.length : 0
            })
          };

          if (!dbEndpoint || !dbCredentials) {
            return false;
          }

          // Convert to NDJSON
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
      // Metrics errors are ignored
    }

    // Return response
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: success,
        transcript: transcript,
        score: calculatedScore,
        txHash: txHash,
        error: errorType,
        version: 'karaoke_scorer_v1'
      })
    });
  }
};

go();
