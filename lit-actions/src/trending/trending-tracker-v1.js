/**
 * Trending Tracker v1 - Aggregated Event Submission
 *
 * Pattern: Similar to karaoke-scorer-v3.js but for trending data
 * - Frontend queues user interactions (clicks, plays, completions)
 * - This action aggregates events by song
 * - PKP submits batch update to TrendingTrackerV1 contract
 * - No user transaction required (background sync)
 *
 * Flow:
 * 1. Receive batched events from frontend via jsParams
 * 2. Aggregate by song and time window
 * 3. Submit batch to contract via PKP signature
 * 4. Optional: Log analytics
 *
 * Expected params (via jsParams):
 * - events: Array of {source, songId, eventType, timestamp}
 * - timeWindow: 0=Hourly, 1=Daily, 2=Weekly
 * - pkpPublicKey: PKP public key for signing transactions
 *
 * Event types:
 * - 'click': User clicked search result
 * - 'play': User played audio preview
 * - 'completion': User completed full song/segment
 *
 * Optional analytics params:
 * - sessionId, userAddress, userAgent, userIpCountry
 * - dbUrlCiphertext, dbTokenCiphertext (encrypted DB credentials)
 */

// ============================================================
// CONFIGURATION - Public contract addresses
// ============================================================

const TRENDING_TRACKER_ADDRESS = '0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731'; // Deployed 2025-10-03
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC_URL = 'https://rpc.testnet.lens.xyz';

// ============================================================
// MAIN EXECUTION
// ============================================================

const go = async () => {
  const startTime = Date.now();
  let success = false;
  let errorType = null;
  let txHash = null;
  let aggregatedCount = 0;

  // Extract parameters from jsParams
  const {
    events,
    timeWindow,
    pkpPublicKey,
    sessionId,
    userAddress,
    userAgent,
    userIpCountry,
    dbUrlCiphertext,
    dbUrlDataToEncryptHash,
    dbUrlAccessControlConditions,
    dbTokenCiphertext,
    dbTokenDataToEncryptHash,
    dbTokenAccessControlConditions
  } = jsParams || {};

  // Analytics variables
  let sessionIdParam = sessionId || crypto.randomUUID();
  let userAgentParam = userAgent || 'unknown';
  let userIpCountryParam = userIpCountry || 'XX';
  let dbEndpoint = null;
  let dbCredentials = null;

  /**
   * Aggregate events by song
   * Returns: { songKey: { source, songId, clicks, plays, completions } }
   */
  function aggregateEvents(events) {
    const aggregated = {};

    for (const event of events) {
      const { source, songId, eventType } = event;
      const songKey = `${source}:${songId}`;

      if (!aggregated[songKey]) {
        aggregated[songKey] = {
          source: parseInt(source),
          songId: songId,
          clicks: 0,
          plays: 0,
          completions: 0
        };
      }

      if (eventType === 'click') {
        aggregated[songKey].clicks++;
      } else if (eventType === 'play') {
        aggregated[songKey].plays++;
      } else if (eventType === 'completion') {
        aggregated[songKey].completions++;
      }
    }

    return Object.values(aggregated);
  }

  /**
   * Convert aggregated data to contract call format
   */
  function prepareContractData(aggregated) {
    const sources = [];
    const songIds = [];
    const clicks = [];
    const plays = [];
    const completions = [];

    for (const item of aggregated) {
      sources.push(item.source);
      songIds.push(item.songId);
      clicks.push(item.clicks);
      plays.push(item.plays);
      completions.push(item.completions);
    }

    return { sources, songIds, clicks, plays, completions };
  }

  try {
    // Validate required parameters
    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new Error('events array is required and must not be empty');
    }
    if (timeWindow === undefined || timeWindow === null) {
      throw new Error('timeWindow is required');
    }
    if (!pkpPublicKey) {
      throw new Error('pkpPublicKey is required');
    }

    // Validate time window
    if (timeWindow < 0 || timeWindow > 2) {
      throw new Error('Invalid timeWindow (must be 0, 1, or 2)');
    }

    // Decrypt DB credentials (optional for analytics)
    if (dbUrlCiphertext && dbTokenCiphertext) {
      try {
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
      } catch (dbError) {
        console.log('Could not decrypt DB credentials, continuing without analytics');
      }
    }

    // Aggregate events
    const aggregated = aggregateEvents(events);
    aggregatedCount = aggregated.length;

    if (aggregatedCount === 0) {
      throw new Error('No valid events to aggregate');
    }

    // Prepare contract call data
    const { sources, songIds, clicks, plays, completions } = prepareContractData(aggregated);

    // Submit to TrendingTrackerV1 contract
    const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC_URL);

    const trendingTrackerABI = [
      'function updateTrendingBatch(uint8 timeWindow, uint8[] calldata sources, string[] calldata songIds, uint32[] calldata clicks, uint32[] calldata plays, uint32[] calldata completions)'
    ];

    const iface = new ethers.utils.Interface(trendingTrackerABI);
    const callData = iface.encodeFunctionData('updateTrendingBatch', [
      timeWindow,
      sources,
      songIds,
      clicks,
      plays,
      completions
    ]);

    const pkpPublicKeyFormatted = pkpPublicKey.startsWith('0x') ? pkpPublicKey : '0x' + pkpPublicKey;
    const pkpEthAddress = ethers.utils.computeAddress(pkpPublicKeyFormatted);
    const nonce = await provider.getTransactionCount(pkpEthAddress);
    const gasPrice = await provider.getGasPrice();

    const unsignedTx = {
      to: TRENDING_TRACKER_ADDRESS,
      data: callData,
      gasLimit: 500000 + (aggregatedCount * 50000), // Scale gas with batch size
      gasPrice: gasPrice,
      nonce: nonce,
      chainId: LENS_TESTNET_CHAIN_ID,
      value: 0
    };

    const serializedTx = ethers.utils.serializeTransaction(unsignedTx);
    const txHashToSign = ethers.utils.keccak256(serializedTx);

    // Sign with PKP
    const signature = await Lit.Actions.signAndCombineEcdsa({
      toSign: ethers.utils.arrayify(txHashToSign),
      publicKey: pkpPublicKey,
      sigName: "trendingTrackerSig",
    });

    // Parse v8 signature format
    const jsonSignature = JSON.parse(signature);
    jsonSignature.r = jsonSignature.r.startsWith('0x') ? jsonSignature.r : '0x' + jsonSignature.r;
    jsonSignature.s = jsonSignature.s.startsWith('0x') ? jsonSignature.s : '0x' + jsonSignature.s;
    const hexSignature = ethers.utils.joinSignature(jsonSignature);

    const signedTx = ethers.utils.serializeTransaction(unsignedTx, hexSignature);

    // Submit transaction (non-blocking)
    txHash = await Lit.Actions.runOnce(
      { waitForResponse: false, name: `submitTrendingBatch_${timeWindow}_${Date.now()}` },
      async () => {
        try {
          const tx = await provider.sendTransaction(signedTx);
          return tx.hash;
        } catch (error) {
          return `ERROR: ${error.message}`;
        }
      }
    );

    success = true;

  } catch (error) {
    errorType = error.message || 'unknown_error';
    success = false;
  } finally {
    // Send analytics
    try {
      const analyticsRunOnceName = `sendTrendingAnalytics_${sessionIdParam}`;
      await Lit.Actions.runOnce({ waitForResponse: true, name: analyticsRunOnceName }, async () => {
        async function sha256(message) {
          const encoder = new TextEncoder();
          const data = encoder.encode(message);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        const METRICS_SALT = 'trending_tracker_2025';
        const countryCode = userIpCountryParam || 'XX';
        const userHash = userAddress ? await sha256(userAddress + METRICS_SALT) : 'anonymous';
        const userAgentHash = await sha256(userAgentParam + METRICS_SALT);

        const analyticsData = {
          timestamp: new Date().toISOString(),
          event_id: crypto.randomUUID(),
          user_hash: userHash,
          country_code: countryCode,
          action_type: 'trending_tracker_v1',
          tier: 'free',
          success: success,
          error_type: errorType || null,
          processing_ms: Date.now() - startTime,
          session_id: sessionIdParam,
          user_agent_hash: userAgentHash,
          language: null,
          parent_event_id: null,
          pipeline_step: null,
          model_used: null,
          tokens_used: null,
          prompt_tokens: null,
          completion_tokens: null,
          provider_latency_ms: null,
          generation_time_ms: null,
          total_latency_ms: Date.now() - startTime,
          cost_usd: 0,
          input_text: null,
          output_text: null,
          metadata: JSON.stringify({
            time_window: timeWindow,
            event_count: events?.length || 0,
            aggregated_song_count: aggregatedCount,
            tx_hash: txHash,
            contract_address: TRENDING_TRACKER_ADDRESS,
            context: 'trending_discovery'
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
        txHash: txHash,
        eventCount: events?.length || 0,
        aggregatedCount: aggregatedCount,
        timeWindow: timeWindow,
        error: errorType,
        version: 'trending_tracker_v1'
      })
    });
  }
};

go();
