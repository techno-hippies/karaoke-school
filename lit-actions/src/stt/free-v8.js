/**
 * Speech-to-Text Free Tier with Analytics using Voxstral API (Mistral)
 * v8 SDK - Uses jsParams pattern
 * No subscription required - for Say It Back exercises
 *
 * Expected params (via jsParams):
 * - audioDataBase64: Base64 encoded audio data
 * - language: Language code (default: 'en' for English)
 * - userAddress: The user's wallet address (optional, for analytics)
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

  // Extract all parameters from jsParams (v8 pattern)
  const {
    audioDataBase64,
    language,
    userAddress,
    userLanguage,
    userIpCountry,
    userAgent,
    sessionId,
    accessControlConditions,
    ciphertext,
    dataToEncryptHash,
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

  try {
    // Required parameters
    if (!audioDataBase64) {
      throw new Error('audioDataBase64 is required');
    }

    // Required encryption parameters
    if (!accessControlConditions || !ciphertext || !dataToEncryptHash) {
      throw new Error('Missing required encryption parameters');
    }

    // Set defaults for optional parameters
    // This is an English learning app - always use English
    const languageCode = language || 'en';
    const modelName = 'voxtral-mini-latest';

    // Analytics parameters
    walletAddr = userAddress || 'anonymous';

    // Decode base64 audio data back to Uint8Array
    const audioData = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0));

    // Decrypt Voxstral API key
    const voxstralApiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions,
      ciphertext,
      dataToEncryptHash,
      authSig: null,
      chain: 'ethereum'
    });

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
        console.log('📊 STT Free: Could not decrypt DB credentials, continuing without analytics');
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

    // Part 3: Language field - always send 'en' for English
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

    success = true;

  } catch (error) {
    errorType = error.message || 'unknown_error';
    success = false;
  } finally {
    // Send analytics
    try {
      const analyticsRunOnceName = `sendSTTFreeAnalytics_${sessionIdParam}`;
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
            action_type: 'stt',
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
              context: 'say_it_back'
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
        error: errorType,
        version: 'free_v8_jsparams'
      })
    });
  }
};

go();