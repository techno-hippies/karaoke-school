/**
 * Genius Referents - FREE VERSION (No Authentication Required)
 * Fetches lyric referents (annotated segments) for a Genius song
 * Uses exposed API key - no wallet authentication required
 * Updated for ks_web_1 schema
 *
 * Expected params:
 * - songId: The Genius song ID (required)
 * - page: Optional page number (default 1)
 * - perPage: Optional results per page (default 20, max 50)
 * - pkpPublicKey: PKP public key for trending writes (optional)
 * - userAddress: The user's wallet address (optional)
 * - language: User's browser language (e.g., 'en-US', 'zh-CN')
 * - userIp: User's IP for country detection (not stored in analytics)
 * - userIpCountry: User's country code
 * - userAgent: User agent string
 * - sessionId: Session identifier
 *
 * Analytics params (optional):
 * - dbUrlCiphertext, dbUrlDataToEncryptHash
 * - dbTokenCiphertext, dbTokenDataToEncryptHash
 * - dbUrlAccessControlConditions, dbTokenAccessControlConditions
 */

// Trending contract on Lens Chain Testnet
const TRENDING_TRACKER_ADDRESS = '0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731';
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC_URL = 'https://rpc.testnet.lens.xyz';

// Helper function for deterministic hashing
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const go = async () => {
  const startTime = Date.now();
  let success = false;
  let errorType = null;
  let resultsCount = 0;
  let selectedKeyIndex = null;
  let referents = [];

  // Variables for analytics
  let songIdParam = '';
  let walletAddr = 'anonymous';
  let userIpParam = null;
  let userIpCountryParam = null;
  let sessionIdParam = null;
  let userAgentParam = 'unknown';
  let languageParam = null;
  let dbEndpoint = null;
  let dbCredentials = null;

  try {
    // Extract parameters from jsParams (v8 pattern)
    const {
      songId,
      page,
      perPage,
      pkpPublicKey,
      userAddress,
      userIp,
      userIpCountry,
      userAgent,
      sessionId,
      language,
      userLanguage,
      dbUrlCiphertext,
      dbUrlDataToEncryptHash,
      dbUrlAccessControlConditions,
      dbTokenCiphertext,
      dbTokenDataToEncryptHash,
      dbTokenAccessControlConditions
    } = jsParams || {};

    // Validate required parameters
    if (!songId) {
      throw new Error('songId parameter is required');
    }

    songIdParam = songId;

    // Set analytics parameters
    walletAddr = userAddress || 'anonymous';
    userIpParam = userIp || null;
    userIpCountryParam = typeof userIpCountry !== 'undefined' ? userIpCountry : null;
    // Generate deterministic session ID if not provided
    sessionIdParam = sessionId || `web-${walletAddr}-referents-${songId}`.slice(0, 36);
    userAgentParam = userAgent || 'unknown';
    languageParam = language || userLanguage || null;

    // Use exposed Genius API key (no encryption needed)
    const geniusApiKey = 'z0-uHScJhlvY7rB_HwThSEZhjpmSzlWMnBhaby3tPtqJpfOeQwZ1cc5OG1bdegV7';
    selectedKeyIndex = 0; // Single key, no selection needed

    // Decrypt DB credentials if provided (optional for analytics)
    console.log('🔐 DB creds check:', {
      hasUrlCiphertext: !!dbUrlCiphertext,
      hasTokenCiphertext: !!dbTokenCiphertext,
      hasUrlHash: !!dbUrlDataToEncryptHash,
      hasTokenHash: !!dbTokenDataToEncryptHash,
      hasUrlACC: !!dbUrlAccessControlConditions,
      hasTokenACC: !!dbTokenAccessControlConditions
    });

    if (dbUrlCiphertext && dbTokenCiphertext && dbUrlAccessControlConditions && dbTokenAccessControlConditions) {
      try {
        console.log('🔐 Attempting to decrypt DB credentials...');
        [dbEndpoint, dbCredentials] = await Promise.all([
          Lit.Actions.decryptAndCombine({
            accessControlConditions: dbUrlAccessControlConditions,
            ciphertext: dbUrlCiphertext,
            dataToEncryptHash: dbUrlDataToEncryptHash,
            authSig: null,
            chain: 'ethereum'
          }),
          Lit.Actions.decryptAndCombine({
            accessControlConditions: dbTokenAccessControlConditions,
            ciphertext: dbTokenCiphertext,
            dataToEncryptHash: dbTokenDataToEncryptHash,
            authSig: null,
            chain: 'ethereum'
          })
        ]);
        console.log('✅ DB credentials decrypted successfully');
        console.log('📊 DB endpoint:', dbEndpoint ? dbEndpoint.substring(0, 50) + '...' : 'none');
      } catch (dbError) {
        console.log('❌ Failed to decrypt DB credentials:', dbError.message);
        // Analytics optional - continue without
      }
    } else {
      console.log('⚠️ DB credentials not provided in params (analytics will be skipped)');
    }

    // Set pagination parameters
    const pageNumber = page || 1;
    const pageSize = Math.min(Math.max(perPage || 20, 1), 50);

    // Make the API request to Genius referents endpoint using runOnce for determinism
    const referentsUrl = `https://api.genius.com/referents?song_id=${songId}&per_page=${pageSize}&page=${pageNumber}&text_format=plain`;

    const dataString = await Lit.Actions.runOnce({ waitForResponse: true, name: "geniusReferentsFetch" }, async () => {
      const response = await fetch(referentsUrl, {
        headers: {
          'Authorization': 'Bearer ' + geniusApiKey
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMITED');
        }
        if (response.status === 404) {
          throw new Error('SONG_NOT_FOUND');
        }
        throw new Error(`Genius API error: ${response.status}`);
      }

      const jsonData = await response.json();
      return JSON.stringify(jsonData);
    });

    const data = JSON.parse(dataString);

    if (data.response && data.response.referents) {
      referents = data.response.referents.map(ref => {
        // Clean fragment text (remove [Producer] tags, etc.)
        let fragment = ref.fragment || '';
        fragment = fragment.replace(/\[.*?\]/g, '').trim();

        return {
          id: ref.id,
          fragment: fragment,
          range: ref.range ? {
            start: ref.range.start,
            end: ref.range.end
          } : null,
          annotation_id: ref.annotation_id,
          annotation: ref.annotations?.[0]?.body?.plain || '',
          votes_total: ref.annotations?.[0]?.votes_total || 0,
          verified: ref.annotations?.[0]?.verified || false,
          classification: ref.classification || 'uncategorized'
        };
      }).filter(ref => ref.fragment && ref.fragment.length > 0); // Only include non-empty fragments

      resultsCount = referents.length;
    }

    success = true;

  } catch (error) {
    errorType = error.message || 'unknown_error';
    success = false;
    referents = [];
    resultsCount = 0;
  } finally {
    // Send analytics using new ks_web_1 schema
    let analyticsStatus = 'not_sent';
    try {
      // Make runOnce name unique per request to ensure analytics run for each call
      const analyticsRunOnceName = `referentsAnalytics_${sessionIdParam}`;
      analyticsStatus = await Lit.Actions.runOnce({ waitForResponse: true, name: analyticsRunOnceName }, async () => {

        const METRICS_SALT = 'ks_metrics_2025';
        const countryCode = userIpCountryParam || 'XX';
        const userHash = await sha256(walletAddr + METRICS_SALT);
        const userAgentHash = await sha256(userAgentParam + METRICS_SALT);

        // Prepare analytics data for ks_web_1 schema
        const usageData = {
          timestamp: new Date().toISOString(),
          event_id: crypto.randomUUID(),
          user_hash: userHash,
          country_code: countryCode,
          action_type: 'referents',
          tier: 'free',
          success: success,
          error_type: errorType,
          processing_ms: Date.now() - startTime,
          session_id: sessionIdParam,
          user_agent_hash: userAgentHash,
          language: languageParam,
          parent_event_id: null,
          pipeline_step: null,
          model_used: null,
          tokens_used: null,
          prompt_tokens: null,
          completion_tokens: null,
          provider_latency_ms: null,
          generation_time_ms: null,
          total_latency_ms: Date.now() - startTime,
          cost_usd: null,
          input_text: `song_id:${songIdParam}`,
          output_text: success ? JSON.stringify(referents.slice(0, 3)) : null, // Store first 3 referents
          metadata: JSON.stringify({
            results_count: resultsCount,
            genius_key_index: selectedKeyIndex,
            song_id: songIdParam,
            page: page || 1,
            per_page: perPage || 20,
            api_key_type: 'exposed'
          })
        };

        if (!dbEndpoint || !dbCredentials) {
          console.log('📊 Analytics skipped - missing credentials');
          return "analytics skipped";
        }

        // Convert to NDJSON for ks_web_1
        const ndjsonData = JSON.stringify(usageData) + '\n';
        console.log('📊 Sending analytics to:', dbEndpoint);
        console.log('📊 Analytics data:', ndjsonData);

        try {
          const dataResponse = await fetch(dbEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dbCredentials}`,
              'Content-Type': 'application/x-ndjson'
            },
            body: ndjsonData
          });
          const result = dataResponse.ok ? "analytics sent" : `analytics failed: ${dataResponse.status}`;
          console.log('📊 Analytics result:', result);
          return result;
        } catch (fetchError) {
          console.log('📊 Analytics error:', fetchError.message);
          return "analytics error";
        }
      });
    } catch (metricsError) {
      // Metrics errors are ignored
    }

    // Write to trending contract if PKP provided and request was successful
    let trendingTxHash = null;
    if (success && pkpPublicKey && songId) {
      try {
        await Lit.Actions.runOnce({ waitForResponse: false, name: `trendingWrite_${songId}` }, async () => {
          const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC_URL);

          const trendingTrackerABI = [
            'function updateTrendingBatch(uint8 timeWindow, uint8[] calldata sources, string[] calldata songIds, uint32[] calldata clicks, uint32[] calldata plays, uint32[] calldata completions)'
          ];

          const iface = new ethers.utils.Interface(trendingTrackerABI);

          // Record a click event for Genius source (source=1)
          const callData = iface.encodeFunctionData('updateTrendingBatch', [
            0, // timeWindow: Hourly
            [1], // sources: Genius
            [songId.toString()], // songIds
            [1], // clicks: 1
            [0], // plays: 0
            [0], // completions: 0
          ]);

          const pkpPublicKeyFormatted = pkpPublicKey.startsWith('0x') ? pkpPublicKey : '0x' + pkpPublicKey;
          const pkpEthAddress = ethers.utils.computeAddress(pkpPublicKeyFormatted);
          const nonce = await provider.getTransactionCount(pkpEthAddress);
          const gasPrice = await provider.getGasPrice();

          const unsignedTx = {
            to: TRENDING_TRACKER_ADDRESS,
            data: callData,
            gasLimit: 300000,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: LENS_TESTNET_CHAIN_ID,
            value: 0
          };

          const serializedTx = ethers.utils.serializeTransaction(unsignedTx);
          const txHashToSign = ethers.utils.keccak256(serializedTx);

          const signature = await Lit.Actions.signAndCombineEcdsa({
            toSign: ethers.utils.arrayify(txHashToSign),
            publicKey: pkpPublicKey,
            sigName: "trendingSig",
          });

          const jsonSignature = JSON.parse(signature);
          jsonSignature.r = jsonSignature.r.startsWith('0x') ? jsonSignature.r : '0x' + jsonSignature.r;
          jsonSignature.s = jsonSignature.s.startsWith('0x') ? jsonSignature.s : '0x' + jsonSignature.s;
          const hexSignature = ethers.utils.joinSignature(jsonSignature);

          const signedTx = ethers.utils.serializeTransaction(unsignedTx, hexSignature);

          const tx = await provider.sendTransaction(signedTx);
          trendingTxHash = tx.hash;
          console.log('✅ Trending write tx:', trendingTxHash);
        });
      } catch (trendingError) {
        console.log('⚠️ Trending write failed:', trendingError.message);
      }
    }

    // Now send the response after analytics and trending
    if (success) {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          referents: referents,
          count: resultsCount,
          keyUsed: selectedKeyIndex + 1,
          version: 'referents_free_v1',
          analytics: analyticsStatus,
          trendingTx: trendingTxHash
        })
      });
    } else {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: false,
          error: errorType || 'Referents fetch failed',
          referents: [],
          version: 'referents_free_v1'
        })
      });
    }
  }
};

go();
