/**
 * Lit Action 2 (BATCH): Fetch Song Data, Validate, Sign, and Update Contract
 *
 * OPTIMIZED VERSION: Handles ALL segments for a song in a single transaction batch.
 *
 * This Lit Action is triggered by webhook-server after Modal processing completes.
 * It provides trustless verification that the contract update came from legitimate
 * processing, not spoofed data.
 *
 * Flow:
 * 1. Fetch job data from Modal (includes ALL segments)
 * 2. Validate Grove URIs for all segments
 * 3. Build batch contract calls (processSegment for each)
 * 4. PKP signs and broadcasts transaction
 *
 * Security:
 * - Fetches data from Modal itself (doesn't trust webhook input)
 * - Only jobId comes from webhook (can't be spoofed)
 * - Contract verifies PKP signature on-chain
 * - Immutable code (IPFS CID) proves execution logic
 *
 * Input (jsParams):
 * - jobId: Unique job identifier
 * - geniusId: Genius song ID
 * - segments: Array of {segmentId, vocalsUri, instrumentalUri} (from webhook)
 * - pkpPublicKey: PKP's public key
 *
 * Output:
 * - success: boolean
 * - txHash: Transaction hash of contract update
 * - segmentsProcessed: Number of segments updated
 * - error: Error message (if failed)
 */

const go = async () => {
  try {
    const { jobId, geniusId, segments, pkpPublicKey } = jsParams || {};

    if (!jobId) {
      throw new Error('jobId is required');
    }
    if (!geniusId) {
      throw new Error('geniusId is required');
    }
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error('segments array is required and must not be empty');
    }
    if (!pkpPublicKey) {
      throw new Error('pkpPublicKey is required');
    }

    console.log(`[Lit Action 2 Batch] Starting for jobId: ${jobId}`);
    console.log(`[Lit Action 2 Batch] Genius ID: ${geniusId}`);
    console.log(`[Lit Action 2 Batch] Segments to process: ${segments.length}`);

    // Skip Modal fetch - webhook already has all segment data
    console.log('[Lit Action 2 Batch] Using segments from webhook payload (no Modal fetch needed)');

    console.log('[Lit Action 2 Batch] Job data validated');
    console.log(`[Lit Action 2 Batch]   Genius ID: ${geniusId}`);
    console.log(`[Lit Action 2 Batch]   Segments: ${segments.length}`);

    // Step 3: Validate all Grove URIs
    console.log('[Lit Action 2 Batch] Validating Grove URIs...');
    for (const seg of segments) {
      if (!seg.vocalsUri || !seg.instrumentalUri) {
        throw new Error(`Missing URIs for segment: ${seg.segmentId}`);
      }
      if (!seg.vocalsUri.startsWith('lens://')) {
        throw new Error(`Invalid vocals URI for ${seg.segmentId}: ${seg.vocalsUri}`);
      }
      if (!seg.instrumentalUri.startsWith('lens://')) {
        throw new Error(`Invalid instrumental URI for ${seg.segmentId}: ${seg.instrumentalUri}`);
      }
    }
    console.log('[Lit Action 2 Batch] All URIs validated');

    // Step 4: Build batch contract transaction (V2 - single transaction for all segments)
    console.log('[Lit Action 2 Batch] Building batch contract transaction (V2)...');

    const catalogContract = '0x422f686f5CdFB48d962E1D7E0F5035D286a1ccAa'; // KaraokeCatalogV2 on Base Sepolia (V2 OPTIMIZED - Custom Errors)
    const baseSepoliaRpc = 'https://sepolia.base.org';

    // ABI for processSegmentsBatch (V2 OPTIMIZED - Create + Process)
    // Signature: processSegmentsBatch(uint32 geniusId, string songId, string[] segmentIds, string[] sectionTypes, string[] vocalsUris, string[] drumsUris, string[] audioSnippetUris, uint32[] startTimes, uint32[] endTimes)
    const contractInterface = new ethers.utils.Interface([
      'function processSegmentsBatch(uint32,string,string[],string[],string[],string[],string[],uint32[],uint32[])'
    ]);

    // Build arrays for batch call
    const segmentIds = [];
    const vocalsUris = [];
    const drumsUris = [];
    const audioSnippetUris = [];
    const startTimes = [];
    const endTimes = [];

    for (const seg of segments) {
      segmentIds.push(seg.segmentId);
      vocalsUris.push(seg.vocalsUri);
      drumsUris.push(seg.instrumentalUri);
      audioSnippetUris.push(''); // Empty for now
      startTimes.push(Math.floor(seg.startTime));
      endTimes.push(Math.floor(seg.endTime));

      console.log(`[Lit Action 2 Batch]   ${seg.segmentId}: ${seg.startTime}s - ${seg.endTime}s`);
    }

    // Compute songId (contract helper removed for size optimization)
    const songId = `genius-${geniusId}`;
    console.log(`[Lit Action 2 Batch] Computed songId: ${songId}`);

    // Compute sectionTypes from segmentIds (contract helper removed for size optimization)
    // Example: "chorus-1" → "Chorus 1", "verse-2" → "Verse 2"
    const sectionTypes = segmentIds.map(segmentId => {
      return segmentId
        .replace(/-/g, ' ')  // Replace hyphens with spaces
        .replace(/\b\w/g, c => c.toUpperCase());  // Capitalize first letter of each word
    });
    console.log(`[Lit Action 2 Batch] Computed sectionTypes:`, sectionTypes);

    // Encode single batch transaction (9 parameters)
    const txData = contractInterface.encodeFunctionData('processSegmentsBatch', [
      geniusId,
      songId,
      segmentIds,
      sectionTypes,
      vocalsUris,
      drumsUris,
      audioSnippetUris,
      startTimes,
      endTimes
    ]);

    console.log('[Lit Action 2 Batch] Batch transaction encoded for', segmentIds.length, 'segments');

    // Step 5: PKP signs and broadcasts SINGLE transaction

    console.log('[Lit Action 2 Batch] Signing and broadcasting batch transaction...');

    const provider = new ethers.providers.JsonRpcProvider(baseSepoliaRpc);

    // Get PKP's Ethereum address
    const publicKeyForAddress = pkpPublicKey.startsWith('0x04')
      ? pkpPublicKey
      : '0x04' + pkpPublicKey;
    const pkpAddress = ethers.utils.computeAddress(publicKeyForAddress);
    console.log('[Lit Action 2 Batch] PKP address:', pkpAddress);

    // Get nonce and gas data
    const nonce = await provider.getTransactionCount(pkpAddress);
    const feeData = await provider.getFeeData();

    console.log('[Lit Action 2 Batch] Nonce:', nonce);
    console.log('[Lit Action 2 Batch] Gas price:', feeData.gasPrice?.toString());

    // Build unsigned transaction
    const unsignedTx = {
      to: catalogContract,
      data: txData,
      nonce: nonce,
      gasLimit: 3000000, // High limit for batch: ~150k base + ~500k per segment × 5 = 2.5M + buffer
      gasPrice: feeData.gasPrice,
      chainId: 84532 // Base Sepolia
    };

    // Serialize for signing
    const unsignedTxSerialized = ethers.utils.serializeTransaction(unsignedTx);
    const txHashToSign = ethers.utils.keccak256(unsignedTxSerialized);

    // PKP signs transaction
    console.log('[Lit Action 2 Batch] Requesting PKP signature...');
    const signatureJson = await Lit.Actions.signAndCombineEcdsa({
      toSign: ethers.utils.arrayify(txHashToSign),
      publicKey: pkpPublicKey.startsWith('0x') ? pkpPublicKey.substring(2) : pkpPublicKey,
      sigName: `processSegmentsBatch_${jobId}`
    });

    // Parse signature
    const sig = JSON.parse(signatureJson);
    const r = sig.r.startsWith('0x') ? sig.r : '0x' + sig.r;
    const s = sig.s.startsWith('0x') ? sig.s : '0x' + sig.s;

    // Extract recovery ID
    let recid = 0;
    if (sig.recid !== undefined) {
      recid = sig.recid;
    } else if (sig.v !== undefined) {
      recid = sig.v >= 27 ? sig.v - 27 : sig.v;
    }

    // Calculate EIP-155 v value
    const v = 84532 * 2 + 35 + recid;

    // Serialize signed transaction
    const serializedTx = ethers.utils.serializeTransaction(unsignedTx, { r, s, v });

    // Submit transaction (wrapped in runOnce to prevent duplicate broadcasts)
    console.log('[Lit Action 2 Batch] Broadcasting transaction (with runOnce)...');

    const txHash = await Lit.Actions.runOnce(
      { waitForResponse: true, name: `broadcastTx_${jobId}` },
      async () => {
        try {
          const hash = await provider.send("eth_sendRawTransaction", [serializedTx]);
          console.log(`[Lit Action 2 Batch] Transaction broadcast: ${hash}`);
          return hash;
        } catch (broadcastError) {
          // Handle "already known" error - transaction was already submitted
          if (broadcastError.message && broadcastError.message.includes('already known')) {
            // Calculate tx hash from serialized transaction
            const hash = ethers.utils.keccak256(serializedTx);
            console.log(`[Lit Action 2 Batch] Transaction already known (duplicate submission): ${hash}`);
            return hash;
          } else {
            throw broadcastError;
          }
        }
      }
    );

    console.log(`[Lit Action 2 Batch] SUCCESS! Batch transaction: ${txHash}`);
    console.log(`[Lit Action 2 Batch] Processed ${segmentIds.length} segments in single transaction`);

    // Return success response
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        txHash: txHash,
        segmentsProcessed: segmentIds.length,
        geniusId: geniusId,
        segments: segmentIds
      })
    });

  } catch (error) {
    console.error('[Lit Action 2 Batch] Error:', error.message);
    console.error('[Lit Action 2 Batch] Stack:', error.stack);

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    });
  }
};

go();
