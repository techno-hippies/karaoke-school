/**
 * Karaoke Scorer v4 - Complete Rewrite for New Architecture
 *
 * NEW ARCHITECTURE:
 * - Uses SongCatalogV1 for song metadata (replaces ClipRegistry)
 * - Uses KaraokeScoreboardV4 with multi-source support
 * - Scores individual segments (not clips)
 * - Supports ContentSource.Native (0) for on-chain songs
 *
 * Flow:
 * 1. Query SongCatalogV1 for song metadata (Grove URI to word-level timestamps)
 * 2. Fetch segment lyrics from metadataUri (filter to specific segment)
 * 3. Transcribe user audio using Voxstral STT API
 * 4. Calculate score by comparing transcript to expected lyrics
 * 5. Submit score to KaraokeScoreboardV4 via PKP signing
 *
 * Expected params (via jsParams):
 * - audioDataBase64: Base64 encoded audio data
 * - songId: Song identifier from SongCatalog (e.g., "heat-of-the-night-scarlett-x")
 * - segmentId: Segment identifier (e.g., "verse-1", "chorus-1")
 * - userAddress: User's wallet address (REQUIRED)
 * - pkpPublicKey: PKP public key for signing transactions
 * - language: Language code (default: 'en')
 *
 * Encryption params (ONLY for secrets):
 * - accessControlConditions: IPFS-based access control
 * - ciphertext: Encrypted Voxstral API key
 * - dataToEncryptHash: Hash of encrypted Voxstral key
 */

// ============================================================
// CONFIGURATION - Public contract addresses (hardcoded)
// ============================================================
const SONG_CATALOG_ADDRESS = '0x88996135809cc745E6d8966e3a7A01389C774910';
const SCOREBOARD_CONTRACT_ADDRESS = '0x8301E4bbe0C244870a4BC44ccF0241A908293d36'; // V4 with multi-source
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC_URL = 'https://rpc.testnet.lens.xyz';
const CONTENT_SOURCE_NATIVE = 0; // ContentSource.Native

// ============================================================
// MAIN EXECUTION
// ============================================================
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
    songId,
    segmentId,
    pkpPublicKey,
    accessControlConditions,
    ciphertext,
    dataToEncryptHash
  } = jsParams || {};

  /**
   * Calculate karaoke score by comparing transcript to expected lyrics
   * Matches words in order and applies penalties for missing/extra words
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

    // Count matching words in order
    for (let i = 0; i < minLength; i++) {
      if (transcriptWords[i] === expectedWords[i]) {
        matches++;
      }
    }

    // Calculate score with length penalty
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
    if (!songId) {
      throw new Error('songId is required');
    }
    if (!segmentId) {
      throw new Error('segmentId is required');
    }
    if (!pkpPublicKey) {
      throw new Error('pkpPublicKey is required');
    }

    // Validate Voxstral API key encryption parameters
    if (!accessControlConditions || !ciphertext || !dataToEncryptHash) {
      throw new Error('Missing Voxstral API encryption parameters');
    }

    const languageCode = language || 'en';
    const modelName = 'voxtral-mini-latest';

    // Decode audio data
    const audioData = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0));

    // Decrypt Voxstral API key
    const voxstralApiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions,
      ciphertext,
      dataToEncryptHash,
      authSig: null,
      chain: 'ethereum'
    });

    // Query SongCatalogV1 for song metadata
    const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC_URL);

    const songCatalogABI = [
      'function getSong(string calldata id) external view returns (tuple(string id, uint32 geniusId, uint32 geniusArtistId, string title, string artist, uint32 duration, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri, string segmentIds, string languages, bool enabled, uint64 addedAt))'
    ];

    const songCatalogContract = new ethers.Contract(
      SONG_CATALOG_ADDRESS,
      songCatalogABI,
      provider
    );

    const songData = await songCatalogContract.getSong(songId);

    if (!songData || !songData.enabled) {
      throw new Error(`Song ${songId} not found or disabled`);
    }

    const metadataUri = songData.metadataUri;
    if (!metadataUri) {
      throw new Error(`No metadataUri for song ${songId}`);
    }

    // Verify segment exists in song's segment list
    const songSegments = songData.segmentIds.split(',').map(s => s.trim());
    if (!songSegments.includes(segmentId)) {
      throw new Error(`Segment ${segmentId} not found in song ${songId}. Available: ${songSegments.join(', ')}`);
    }

    // Fetch full song metadata from Grove
    const gatewayUrl = metadataUri.replace('lens://', 'https://api.grove.storage/');
    const metadataResponse = await fetch(gatewayUrl);

    if (!metadataResponse.ok) {
      throw new Error(`Failed to fetch song metadata: ${metadataResponse.status}`);
    }

    const songMetadata = await metadataResponse.json();

    // Extract lyrics for the specific segment
    // Metadata structure: { lines: [{ words: [], segmentId: "verse-1", ... }] }
    if (!songMetadata.lines || !Array.isArray(songMetadata.lines)) {
      throw new Error('Invalid song metadata: missing lines array');
    }

    // Filter lines for this segment
    const segmentLines = songMetadata.lines.filter(line => line.segmentId === segmentId);

    if (segmentLines.length === 0) {
      throw new Error(`No lyrics found for segment ${segmentId} in song metadata`);
    }

    // Reconstruct expected lyrics from segment lines
    const expectedLyrics = segmentLines
      .map(line => {
        if (line.words && Array.isArray(line.words)) {
          return line.words.map(w => w.word || w.text || '').join(' ');
        }
        return line.originalText || '';
      })
      .join(' ')
      .trim();

    if (!expectedLyrics) {
      throw new Error(`No lyrics content found for segment ${segmentId}`);
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

    // Calculate total length
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const bodyBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      bodyBytes.set(part, offset);
      offset += part.length;
    }

    // Call Voxstral STT API (hosted at Mistral AI)
    const transcriptionResponse = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${voxstralApiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBytes
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      throw new Error(`Voxstral API error: ${transcriptionResponse.status} - ${errorText}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    transcript = transcriptionResult.text || '';
    detectedLang = transcriptionResult.language || languageCode;
    transcriptionLength = transcript.length;

    if (!transcript) {
      throw new Error('Empty transcription result from Voxstral');
    }

    // Calculate score
    calculatedScore = calculateScore(transcript, expectedLyrics);

    // Submit score to KaraokeScoreboardV4 using PKP signing
    const scoreboardABI = [
      'function updateScore(uint8 source, string calldata trackId, string calldata segmentId, address user, uint96 newScore) external'
    ];

    const scoreboardContract = new ethers.Contract(
      SCOREBOARD_CONTRACT_ADDRESS,
      scoreboardABI,
      provider
    );

    // Normalize user address (checksum and validate)
    const normalizedUserAddress = ethers.utils.getAddress(userAddress.toLowerCase());

    // Encode the transaction data
    const updateScoreTxData = scoreboardContract.interface.encodeFunctionData('updateScore', [
      CONTENT_SOURCE_NATIVE,  // source = 0 (Native)
      songId,                 // trackId
      segmentId,              // segmentId
      normalizedUserAddress,  // user address (checksummed)
      calculatedScore         // score (0-100)
    ]);

    // Get PKP ETH address from public key
    const pkpEthAddress = ethers.utils.computeAddress(`0x${pkpPublicKey}`);

    // Get current nonce for PKP address
    const nonce = await provider.getTransactionCount(pkpEthAddress);

    // Get gas price (use as maxFeePerGas for zkSync EIP-1559 style)
    const gasPrice = await provider.getGasPrice();

    // For zkSync, set maxPriorityFeePerGas to 0 (fixed priority in L2)
    const maxPriorityFeePerGas = ethers.BigNumber.from(0);

    // zkSync gasPerPubdataByteLimit (typical value for L2 tx)
    const gasPerPubdataByteLimit = ethers.BigNumber.from(800);

    // zkSync defaults: no factory deps
    const factoryDeps = [];

    // Normalize addresses (checksummed format for RLP encoding)
    const from = ethers.utils.getAddress(pkpEthAddress);
    const to = ethers.utils.getAddress(SCOREBOARD_CONTRACT_ADDRESS);

    // Helper to convert to hex or default to '0x'
    const toHexOrEmpty = (value) => {
      if (!value || value === 0 || value === '0') return '0x';
      const hex = ethers.utils.hexlify(value);
      return ethers.utils.stripZeros(hex) || '0x';
    };

    // Build unsigned fields for RLP encoding to get txHash
    const unsignedFields = [
      toHexOrEmpty(nonce),                                  // 1. nonce
      toHexOrEmpty(maxPriorityFeePerGas),                   // 2. maxPriorityFeePerGas
      toHexOrEmpty(gasPrice),                               // 3. maxFeePerGas
      toHexOrEmpty(500000),                                 // 4. gas
      to,                                                   // 5. to
      toHexOrEmpty(0),                                      // 6. value
      updateScoreTxData || '0x',                            // 7. data
      toHexOrEmpty(LENS_TESTNET_CHAIN_ID),                  // 8. chainId
      '0x',                                                 // 9. empty string
      '0x',                                                 // 10. empty string
      toHexOrEmpty(LENS_TESTNET_CHAIN_ID),                  // 11. chainId (again)
      from,                                                 // 12. from
      toHexOrEmpty(gasPerPubdataByteLimit),                 // 13. gasPerPubdata
      factoryDeps || [],                                    // 14. factoryDeps (array)
      '0x',                                                 // 15. empty signature placeholder
      []                                                    // 16. paymaster params (empty array)
    ];

    // RLP encode the unsigned transaction
    const unsignedRlp = ethers.utils.RLP.encode(unsignedFields);

    // Prepend type 0x71 for zkSync EIP-712
    const unsignedSerialized = '0x71' + unsignedRlp.slice(2);

    // Calculate hash of unsigned transaction
    const unsignedTxHash = ethers.utils.keccak256(unsignedSerialized);

    // zkSync DefaultAccount validates against the raw unsigned tx hash (no personal sign wrapping)
    // Sign the raw hash directly
    const toSign = ethers.utils.arrayify(unsignedTxHash);

    // Sign with PKP
    const signature = await Lit.Actions.signAndCombineEcdsa({
      toSign: toSign,
      publicKey: pkpPublicKey,
      sigName: 'scoreboardTx'
    });

    // Parse signature (Lit returns v as 0/1 or 27/28 depending on implementation)
    const jsonSignature = JSON.parse(signature);

    // Ensure r and s have 0x prefix before arrayify
    const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
    const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

    const r = ethers.utils.stripZeros(ethers.utils.arrayify(rHex));
    const s = ethers.utils.stripZeros(ethers.utils.arrayify(sHex));

    // zkSync DefaultAccount expects yParity (0 or 1), not Ethereum format (27/28)
    // Extract yParity from v (handle both 0/1 and 27/28 formats)
    let v = jsonSignature.v;
    if (v >= 27) {
      v = v - 27; // Convert 27/28 to 0/1
    }
    // Now v should be 0 or 1 (yParity)

    // Verify signature recovery for debugging (need 27/28 for recovery function)
    const vForRecovery = v + 27;
    const recovered = ethers.utils.recoverAddress(unsignedTxHash, { r: rHex, s: sHex, v: vForRecovery });
    if (recovered.toLowerCase() !== pkpEthAddress.toLowerCase()) {
      throw new Error(`Signature recovery failed: expected ${pkpEthAddress}, got ${recovered}`);
    }

    // Build signed fields with v, r, s in fields 8, 9, 10 (for DefaultAccount/EOA)
    // customSignature (field 15) must be '0x' for EOA accounts
    const signedFields = [
      toHexOrEmpty(nonce),                                  // 1. nonce
      toHexOrEmpty(maxPriorityFeePerGas),                   // 2. maxPriorityFeePerGas
      toHexOrEmpty(gasPrice),                               // 3. maxFeePerGas
      toHexOrEmpty(500000),                                 // 4. gasLimit
      to,                                                   // 5. to
      toHexOrEmpty(0),                                      // 6. value
      updateScoreTxData || '0x',                            // 7. data
      toHexOrEmpty(v),                                      // 8. v (0 or 1 as hex for yParity)
      ethers.utils.hexlify(r),                              // 9. r (stripped Uint8Array)
      ethers.utils.hexlify(s),                              // 10. s (stripped Uint8Array)
      toHexOrEmpty(LENS_TESTNET_CHAIN_ID),                  // 11. chainId
      from,                                                 // 12. from
      toHexOrEmpty(gasPerPubdataByteLimit),                 // 13. gasPerPubdata
      factoryDeps || [],                                    // 14. factoryDeps (array)
      '0x',                                                 // 15. customSignature (empty for EOA)
      []                                                    // 16. paymaster params (empty array)
    ];

    // RLP encode signed fields
    const signedRlp = ethers.utils.RLP.encode(signedFields);

    // Prepend type 0x71
    const signedTxSerialized = '0x71' + signedRlp.slice(2);

    // Submit transaction using runOnce to avoid duplicates from multiple nodes
    const response = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "txSender" },
      async () => {
        try {
          // Use raw RPC call since ethers.js v5 doesn't support zkSync type 0x71
          txHash = await provider.send("eth_sendRawTransaction", [signedTxSerialized]);
          return txHash;
        } catch (error) {
          return `TX_SUBMIT_ERROR: ${error.message}`;
        }
      }
    );

    txHash = response; // If error, it will be the error string

    // Check if txHash is an error message
    if (txHash && txHash.startsWith('TX_SUBMIT_ERROR:')) {
      errorType = txHash;
      txHash = null;
    }

    success = true;

  } catch (error) {
    success = false;
    errorType = error.message || 'Unknown error';
    console.error('Karaoke scorer error:', error);
  }

  // Return results
  const endTime = Date.now();
  const executionTime = endTime - startTime;

  Lit.Actions.setResponse({
    response: JSON.stringify({
      success,
      score: calculatedScore,
      transcript,
      transcriptionLength,
      detectedLanguage: detectedLang,
      txHash,
      errorType,
      executionTime,
      version: 'v4',
      timestamp: new Date().toISOString()
    })
  });
};

// Execute
go().catch(error => {
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: false,
      error: error.message || 'Fatal error',
      version: 'v4'
    })
  });
});
