/**
 * Lit Action 2: Fetch, Validate, Sign, and Update Karaoke Contract
 *
 * This Lit Action is triggered by Vercel after Modal processing completes.
 * It provides trustless verification that the contract update came from
 * legitimate processing, not spoofed data.
 *
 * Flow:
 * 1. Fetch job data from Modal (using jobId)
 * 2. Validate Grove URIs and job status
 * 3. PKP signs the data (geniusId, segmentId, groveURIs)
 * 4. Build contract transaction
 * 5. PKP signs and broadcasts transaction
 *
 * Security:
 * - Fetches data from Modal itself (doesn't trust Vercel input)
 * - Only jobId comes from Vercel (can't be spoofed)
 * - Contract verifies PKP signature on-chain
 * - Immutable code (IPFS CID) proves execution logic
 *
 * Input (jsParams):
 * - jobId: Unique job identifier
 * - pkpPublicKey: PKP's public key
 *
 * Output:
 * - success: boolean
 * - txHash: Transaction hash of contract update
 * - error: Error message (if failed)
 */

const go = async () => {
  try {
    const { jobId, pkpPublicKey } = jsParams || {};

    if (!jobId) {
      throw new Error('jobId is required');
    }
    if (!pkpPublicKey) {
      throw new Error('pkpPublicKey is required');
    }

    console.log(`[Lit Action 2] Starting for jobId: ${jobId}`);

    // Step 1: Fetch job data from Modal
    console.log('[Lit Action 2] Fetching job data from Modal...');
    const modalUrl = `https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run/job/${jobId}`;

    const modalResp = await fetch(modalUrl);

    if (!modalResp.ok) {
      throw new Error(`Modal fetch failed (${modalResp.status}): ${await modalResp.text()}`);
    }

    const jobData = await modalResp.json();
    console.log('[Lit Action 2] Job data fetched:', JSON.stringify(jobData, null, 2));

    // Step 2: Validate job data
    if (jobData.status !== 'complete') {
      throw new Error(`Job not complete: status=${jobData.status}`);
    }

    const {
      genius_id: geniusId,
      segment_id: segmentId,
      grove_vocals_uri: groveVocalsUri,
      grove_accompaniment_uri: groveAccompanimentUri,
      user_address: userAddress
    } = jobData;

    if (!geniusId || !segmentId || !groveVocalsUri || !groveAccompanimentUri) {
      throw new Error('Missing required fields in job data');
    }

    // Validate Grove URIs format
    if (!groveVocalsUri.startsWith('lens://')) {
      throw new Error(`Invalid vocals URI: ${groveVocalsUri}`);
    }
    if (!groveAccompanimentUri.startsWith('lens://')) {
      throw new Error(`Invalid accompaniment URI: ${groveAccompanimentUri}`);
    }

    console.log('[Lit Action 2] Job data validated');
    console.log(`[Lit Action 2]   Genius ID: ${geniusId}`);
    console.log(`[Lit Action 2]   Segment: ${segmentId}`);
    console.log(`[Lit Action 2]   Vocals: ${groveVocalsUri}`);
    console.log(`[Lit Action 2]   Accompaniment: ${groveAccompanimentUri}`);

    // Step 3: Compute segment hash (match contract logic exactly)
    // Contract at KaraokeCatalogV1.sol:491-494:
    //   if (geniusId > 0) return keccak256(geniusId, segmentId);
    //   else return keccak256(songId, segmentId);
    console.log('[Lit Action 2] Computing segment hash...');

    let segmentHash;
    if (geniusId > 0) {
      // Genius-based song: hash = keccak256(geniusId, segmentId)
      segmentHash = ethers.utils.solidityKeccak256(
        ['uint32', 'string'],
        [geniusId, segmentId]
      );
      console.log('[Lit Action 2] Using Genius-based hash (geniusId + segmentId)');
      console.log('[Lit Action 2]   Genius ID:', geniusId);
    } else {
      // Custom song: hash = keccak256(songId, segmentId)
      // In this case, songId should be passed in jsParams
      const songId = jobData.song_id || '';
      segmentHash = ethers.utils.solidityKeccak256(
        ['string', 'string'],
        [songId, segmentId]
      );
      console.log('[Lit Action 2] Using custom song hash (songId + segmentId)');
      console.log('[Lit Action 2]   Song ID:', songId);
    }
    console.log('[Lit Action 2]   Segment ID:', segmentId);
    console.log('[Lit Action 2] Segment hash:', segmentHash);

    // Step 4: Build contract transaction
    console.log('[Lit Action 2] Building contract transaction...');

    const catalogContract = '0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6'; // Base Sepolia
    const baseSepoliaRpc = 'https://sepolia.base.org';

    const contractInterface = new ethers.utils.Interface([
      'function processSegment(bytes32,string,string,string)'
    ]);

    const txData = contractInterface.encodeFunctionData('processSegment', [
      segmentHash,
      groveVocalsUri,
      groveAccompanimentUri,
      '' // audioSnippetUri (empty for now)
    ]);

    console.log('[Lit Action 2] Transaction data encoded');

    // Step 5: PKP signs and broadcasts transaction
    console.log('[Lit Action 2] Signing and broadcasting transaction...');

    let txHash;
    try {
      const provider = new ethers.providers.JsonRpcProvider(baseSepoliaRpc);

      // Get PKP's Ethereum address
      // PKP public key might already have 0x04 prefix, so handle both cases
      const publicKeyForAddress = pkpPublicKey.startsWith('0x04')
        ? pkpPublicKey
        : '0x04' + pkpPublicKey;
      const pkpAddress = ethers.utils.computeAddress(publicKeyForAddress);
      console.log('[Lit Action 2] PKP address:', pkpAddress);

      // Get nonce and gas data
      const nonce = await provider.getTransactionCount(pkpAddress);
      const feeData = await provider.getFeeData();

      console.log('[Lit Action 2] Nonce:', nonce);
      console.log('[Lit Action 2] Gas price:', feeData.gasPrice?.toString());

      // Build unsigned transaction
      const unsignedTx = {
        to: catalogContract,
        data: txData,
        nonce: nonce,
        gasLimit: 500000,
        gasPrice: feeData.gasPrice,
        chainId: 84532 // Base Sepolia
      };

      // Serialize for signing (ethers v5)
      const unsignedTxSerialized = ethers.utils.serializeTransaction(unsignedTx);
      const txHashToSign = ethers.utils.keccak256(unsignedTxSerialized);

      console.log('[Lit Action 2] Transaction hash to sign:', txHashToSign);

      // PKP signs transaction using signAndCombineEcdsa
      const signatureJson = await Lit.Actions.signAndCombineEcdsa({
        toSign: ethers.utils.arrayify(txHashToSign),
        publicKey: pkpPublicKey,
        sigName: "transaction_signature"
      });

      // Parse the JSON signature
      const sig = JSON.parse(signatureJson);

      // Ensure r and s have 0x prefix (signAndCombineEcdsa may return without it)
      const r = sig.r.startsWith('0x') ? sig.r : '0x' + sig.r;
      const s = sig.s.startsWith('0x') ? sig.s : '0x' + sig.s;

      console.log('[Lit Action 2] Signature components:');
      console.log('[Lit Action 2]   r:', r);
      console.log('[Lit Action 2]   s:', s);
      console.log('[Lit Action 2]   v:', sig.v);

      // Serialize signed transaction (ethers v5)
      const serializedTx = ethers.utils.serializeTransaction(unsignedTx, {
        r: r,
        s: s,
        v: sig.v
      });

      console.log('[Lit Action 2] Serialized signed transaction:', serializedTx);

      // Broadcast transaction (don't wait for confirmation to avoid timeout)
      const txPromise = provider.sendTransaction(serializedTx);
      console.log('[Lit Action 2] Transaction sent, waiting for hash...');

      // Get tx hash without waiting for mining
      txHash = ethers.utils.keccak256(serializedTx);
      console.log('[Lit Action 2] Computed tx hash:', txHash);

      // Optionally verify with actual tx response if it completes quickly
      try {
        const txResponse = await Promise.race([
          txPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        console.log('[Lit Action 2] Transaction broadcast confirmed:', txResponse.hash);
        txHash = txResponse.hash; // Use actual hash if we got it
      } catch (timeoutError) {
        console.log('[Lit Action 2] Using computed hash (broadcast still pending)');
      }
    } catch (txError) {
      console.error('[Lit Action 2] Transaction error:', txError.message);
      console.error('[Lit Action 2] Transaction stack:', txError.stack);
      throw new Error(`Transaction failed: ${txError.message}`);
    }

    console.log('[Lit Action 2] SUCCESS! Transaction hash:', txHash);

    // Return success response
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        txHash: txHash,
        geniusId: geniusId,
        segmentId: segmentId,
        groveVocalsUri: groveVocalsUri,
        groveAccompanimentUri: groveAccompanimentUri
      })
    });

  } catch (error) {
    console.error('[Lit Action 2] Error:', error.message);
    console.error('[Lit Action 2] Stack:', error.stack);

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
