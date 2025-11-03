/**
 * Karaoke Scorer v4 - Simplified for PerformanceGrader Integration
 * 
 * Streamlined version focused on PerformanceGrader contract integration
 * 
 * Flow:
 * 1. Transcribe user audio via Voxstral STT
 * 2. Calculate pronunciation score (simplified)
 * 3. Submit score to PerformanceGrader via PKP signing
 * 4. Emit PerformanceGraded event for leaderboard indexing
 */

// ============================================================
// CONFIGURATION - PerformanceGrader Contract
// ============================================================
const PERFORMANCE_GRADER_ADDRESS = '0xaB92C2708D44fab58C3c12aAA574700E80033B7D';
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC_URL = 'https://rpc.testnet.lens.xyz';
const PKP_PUBLIC_KEY = '0x043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939';

// ============================================================
// MAIN EXECUTION
// ============================================================
const go = async () => {
  const startTime = Date.now();
  let success = false;
  let transcript = '';
  let errorType = null;
  let calculatedScore = 0;
  let txHash = null;

  // Extract parameters from jsParams
  const {
    audioDataBase64,
    language,
    userAddress,
    songId,
    segmentId,
    accessControlConditions,
    ciphertext,
    dataToEncryptHash
  } = jsParams || {};

  /**
   * Calculate karaoke score by comparing transcript to expected lyrics
   * Simplified scoring algorithm for PerformanceGrader integration
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

    // Create provider for contract interactions
    const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC_URL);

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
    const detectedLang = transcriptionResult.language || languageCode;
    const transcriptionLength = transcript.length;

    if (!transcript) {
      throw new Error('Empty transcription result from Voxstral');
    }

    // For PerformanceGrader, use simplified scoring without complex metadata fetching
    // In production, you'd fetch expected lyrics based on segmentHash from your database
    const expectedLyrics = "hello world music song lyrics"; // Placeholder

    // Calculate score
    calculatedScore = calculateScore(transcript, expectedLyrics);

    // Submit score to PerformanceGrader using PKP signing
    const performanceGraderABI = [
      'function gradePerformance(uint256 performanceId, bytes32 segmentHash, address performer, uint16 score, string metadataUri) external',
      'event PerformanceGraded(uint256 indexed performanceId, bytes32 indexed segmentHash, address indexed performer, uint16 score, string metadataUri, uint64 timestamp)'
    ];

    const performanceGraderContract = new ethers.Contract(
      PERFORMANCE_GRADER_ADDRESS,
      performanceGraderABI,
      provider
    );

    // Normalize user address (checksum and validate)
    const normalizedUserAddress = ethers.utils.getAddress(userAddress.toLowerCase());

    // Generate performance ID and segment hash
    const performanceId = Date.now(); // Simple timestamp-based ID
    const segmentHashBytes = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`${songId}-${segmentId}`));

    // Create metadata URI (placeholder - replace with actual Grove URI)
    const metadataUri = `grove://${generateCID()}`;

    // Encode the transaction data
    const gradePerformanceTxData = performanceGraderContract.interface.encodeFunctionData('gradePerformance', [
      performanceId,              // performanceId (uint256)
      segmentHashBytes,           // segmentHash (bytes32)
      normalizedUserAddress,      // performer (address)
      calculatedScore * 100,      // score in basis points (uint16) - multiply by 100
      metadataUri                 // metadataUri (string)
    ]);

    // Get PKP ETH address from public key
    const pkpEthAddress = ethers.utils.computeAddress(`0x${PKP_PUBLIC_KEY}`);

    // Get current nonce for PKP address
    const nonce = await provider.getTransactionCount(pkpEthAddress);

    // Get gas price (use as maxFeePerGas for zkSync EIP-1559 style)
    const gasPrice = await provider.getGasPrice();

    // For zkSync, set maxPriorityFeePerGas to 0 (fixed priority in L2)
    const maxPriorityFeePerGas = ethers.BigNumber.from(0);

    // zkSync gasPerPubdataByteLimit (typical value for L2 tx)
    const gasPerPubdataByteLimit = ethers.BigNumber.from(800);

    // Normalize addresses (checksummed format for RLP encoding)
    const from = ethers.utils.getAddress(pkpEthAddress);
    const to = ethers.utils.getAddress(PERFORMANCE_GRADER_ADDRESS);

    // zkSync uses EIP-712 typed data hashing, not simple keccak256(RLP)
    // Domain: { name: "zkSync", version: "2", chainId: 37111 }
    // We need to calculate: keccak256("\x19\x01" + domainSeparator + structHash)

    // Calculate EIP-712 domain separator
    const domainTypeHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId)')
    );
    const nameHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('zkSync'));
    const versionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('2'));

    const domainSeparator = ethers.utils.keccak256(
      ethers.utils.concat([
        domainTypeHash,
        nameHash,
        versionHash,
        ethers.utils.zeroPad(ethers.utils.hexlify(LENS_TESTNET_CHAIN_ID), 32)
      ])
    );

    // Calculate EIP-712 struct hash
    const txTypeHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes('Transaction(uint256 txType,uint256 from,uint256 to,uint256 gasLimit,uint256 gasPerPubdataByteLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 paymaster,uint256 nonce,uint256 value,bytes data,bytes32[] factoryDeps,bytes paymasterInput)')
    );

    // Encode struct fields (all as uint256 except bytes/bytes32[])
    const structHash = ethers.utils.keccak256(
      ethers.utils.concat([
        txTypeHash,
        ethers.utils.zeroPad(ethers.utils.hexlify(113), 32),           // txType: 113 (0x71)
        ethers.utils.zeroPad(from, 32),                                // from: address as uint256
        ethers.utils.zeroPad(to, 32),                                  // to: address as uint256
        ethers.utils.zeroPad(ethers.utils.hexlify(2000000), 32),       // gasLimit (2M for gradePerformance)
        ethers.utils.zeroPad(ethers.utils.hexlify(gasPerPubdataByteLimit), 32), // gasPerPubdata
        ethers.utils.zeroPad(ethers.utils.hexlify(gasPrice), 32),      // maxFeePerGas
        ethers.utils.zeroPad(ethers.utils.hexlify(maxPriorityFeePerGas), 32), // maxPriorityFeePerGas
        ethers.utils.zeroPad('0x00', 32),                              // paymaster: 0
        ethers.utils.zeroPad(ethers.utils.hexlify(nonce), 32),         // nonce
        ethers.utils.zeroPad('0x00', 32),                              // value: 0
        ethers.utils.keccak256(gradePerformanceTxData || '0x'),        // data: keccak256(data)
        ethers.utils.keccak256('0x'),                                  // factoryDeps: keccak256([]) = keccak256(0xc0)
        ethers.utils.keccak256('0x')                                   // paymasterInput: keccak256(0x)
      ])
    );

    // Calculate final EIP-712 hash
    const eip712Hash = ethers.utils.keccak256(
      ethers.utils.concat([
        ethers.utils.toUtf8Bytes('\x19\x01'),
        domainSeparator,
        structHash
      ])
    );

    // Sign the EIP-712 hash with PKP
    const toSign = ethers.utils.arrayify(eip712Hash);

    // Sign with PKP
    const signature = await Lit.Actions.signAndCombineEcdsa({
      toSign: toSign,
      publicKey: PKP_PUBLIC_KEY,
      sigName: 'performanceGraderTx'
    });

    // Parse signature (Lit returns v as 0/1 or 27/28 depending on implementation)
    const jsonSignature = JSON.parse(signature);

    // Ensure r and s have 0x prefix
    const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
    const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

    // Keep r and s as full 32-byte arrays (DO NOT strip zeros - zkSync requires full length!)
    const r = ethers.utils.zeroPad(rHex, 32);
    const s = ethers.utils.zeroPad(sHex, 32);

    // Ensure v is in Ethereum format (27/28) for recovery check
    let v = jsonSignature.v;
    if (v < 27) {
      v = v + 27; // Convert 0/1 to 27/28
    }

    // Verify signature recovery against EIP-712 hash
    const recovered = ethers.utils.recoverAddress(eip712Hash, { r: rHex, s: sHex, v: v });
    if (recovered.toLowerCase() !== pkpEthAddress.toLowerCase()) {
      throw new Error(`Signature recovery failed: expected ${pkpEthAddress}, got ${recovered}`);
    }

    // Convert v to yParity for zkSync RLP encoding
    // zkSync uses yParity (0 or 1) in RLP, NOT v (27 or 28)
    const yParity = v - 27;

    // Helper: mimics ethers v6 toBeArray() - converts number to minimal big-endian bytes
    // 0 becomes empty array [], which RLP encodes as 0x80
    const toBeArray = (value) => {
      if (!value || value === 0 || value === '0') {
        return new Uint8Array([]); // Empty for zero
      }
      const hex = ethers.utils.hexlify(value);
      return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
    };

    // Build RLP fields following zksync-ethers serializeEip712 structure exactly
    // IMPORTANT: Field 7 must be yParity (0 or 1), NOT v (27 or 28)
    const signedFields = [
      toBeArray(nonce),                                     // 0. nonce
      toBeArray(maxPriorityFeePerGas),                      // 1. maxPriorityFeePerGas
      toBeArray(gasPrice),                                  // 2. maxFeePerGas
      toBeArray(2000000),                                   // 3. gasLimit (2M for gradePerformance)
      to || '0x',                                           // 4. to (address or '0x')
      toBeArray(0),                                         // 5. value
      gradePerformanceTxData || '0x',                       // 6. data
      toBeArray(yParity),                                   // 7. yParity (0 or 1) - CRITICAL FIX!
      ethers.utils.arrayify(r),                             // 8. r (full 32 bytes)
      ethers.utils.arrayify(s),                             // 9. s (full 32 bytes)
      toBeArray(LENS_TESTNET_CHAIN_ID),                     // 10. chainId
      from,                                                 // 11. from (address)
      toBeArray(gasPerPubdataByteLimit),                    // 12. gasPerPubdata
      [],                                                   // 13. factoryDeps (empty array)
      '0x',                                                 // 14. customSignature (empty string for EOA)
      []                                                    // 15. paymasterParams (empty array)
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

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  
  /**
   * Generate a random CID-like string for metadata URI
   * In production, this should be replaced with actual Grove upload
   */
  function generateCID() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  // Return results
  const endTime = Date.now();
  const executionTime = endTime - startTime;

  Lit.Actions.setResponse({
    response: JSON.stringify({
      success,
      score: calculatedScore,
      transcript,
      txHash,
      errorType,
      executionTime,
      version: 'v4-simplified-performance-grader',
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
      version: 'v4-simplified-performance-grader'
    })
  });
});
