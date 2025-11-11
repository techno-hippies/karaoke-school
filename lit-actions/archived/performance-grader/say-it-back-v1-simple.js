/**
 * Karaoke Grader v9 - Simple 5-Parameter Pattern (Working v6 Revival)
 *
 * Deployed PerformanceGrader on Lens Testnet:
 * - Contract: 0x0c550395DEDad24c6DEa13704E92E07A63376832
 * - Trusted PKP: 0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7
 * - Network: Lens Testnet (Chain ID: 37111)
 * - Deployment: 2025-11-05
 *
 * CRITICAL FIX: Use simple 5-parameter gradePerformance() function
 * - Based on proven working v6 pattern (QmYUFYxDmcENmy4M4V89fJVCP4K6riWqMXXozXgmEMFSK1)
 * - 16-field zkSync RLP structure identical to v6
 * - Isolates function signature vs RLP encoding issues
 *
 * Flow:
 * 1. Transcribe user audio via Voxtral STT
 * 2. Calculate pronunciation score
 * 3. Submit score to PerformanceGrader via PKP signing (zkSync type 0x71)
 * 4. Emit PerformanceGraded event for leaderboard indexing
 */

// ============================================================
// CONTRACT CONFIGURATION
// ============================================================
const PERFORMANCE_GRADER_ADDRESS = '0x0c550395DEDad24c6DEa13704E92E07A63376832';
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz';

// PKP Configuration (must match contract's trustedPKP)
const PKP_PUBLIC_KEY = '0x049cab6a18225dd566f3a4d6816b2c080fc885b21d3b9021fd80491573bf15141177eca2685a9a5eb0082957bd6581dcd71a43039914e07f4a45146f8246d01b77';

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

  const {
    audioDataBase64,
    userAddress,
    segmentHash,
    performanceId,
    metadataUri,
    expectedText,
    language,
    voxtralEncryptedKey,  // Encrypted key passed from frontend
    testMode  // Skip actual API calls for testing
  } = jsParams || {};

  try {
    // Validate parameters
    if (!userAddress || !segmentHash) {
      throw new Error('Missing required parameters');
    }

    if (!audioDataBase64 && !testMode) {
      throw new Error('Missing audioDataBase64');
    }

    // TEST MODE: Skip encryption and transcription
    if (testMode) {
      transcript = "Hey I'm Scarlett, how are you doing?";  // Mock transcript
      calculatedScore = 95;  // Mock score
      success = true;
      errorType = null;

      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          transcript,
          score: calculatedScore,
          rating: scoreToRating(calculatedScore),
          version: 'v9-simple-5param',
          executionTime: Date.now() - startTime,
          testMode: true
        })
      });
      return;
    }

    if (!voxtralEncryptedKey) {
      throw new Error('Missing voxtralEncryptedKey');
    }

    // Decrypt Voxtral API key (passed from frontend)
    const voxtralApiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: voxtralEncryptedKey.accessControlConditions,
      ciphertext: voxtralEncryptedKey.ciphertext,
      dataToEncryptHash: voxtralEncryptedKey.dataToEncryptHash,
      authSig: null,
      chain: 'ethereum'
    });

    // Transcribe audio via Voxtral
    const audioData = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0));

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);

    // Multipart form with model parameter (required by Voxstral API)
    const modelPart = `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nvoxtral-mini-latest\r\n`;
    const filePart = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    // Build complete multipart body: model field + file field + footer
    const modelPartBytes = new TextEncoder().encode(modelPart);
    const filePartBytes = new TextEncoder().encode(filePart);
    const footerBytes = new TextEncoder().encode(footer);

    const bodyBytes = new Uint8Array(
      modelPartBytes.length +
      filePartBytes.length +
      audioData.length +
      footerBytes.length
    );

    let offset = 0;
    bodyBytes.set(modelPartBytes, offset);
    offset += modelPartBytes.length;

    bodyBytes.set(filePartBytes, offset);
    offset += filePartBytes.length;

    bodyBytes.set(audioData, offset);
    offset += audioData.length;

    bodyBytes.set(footerBytes, offset);

    const transcriptionResponse = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${voxtralApiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBytes
    });

    if (!transcriptionResponse.ok) {
      const errorBody = await transcriptionResponse.text();
      const errorMessage = `Voxtral API error: ${transcriptionResponse.status} ${transcriptionResponse.statusText}`;
      const details = errorBody ? ` - Response: ${errorBody.substring(0, 200)}` : '';
      throw new Error(errorMessage + details);
    }

    const transcriptionData = await transcriptionResponse.json();

    if (!transcriptionData) {
      throw new Error('Voxtral returned empty response');
    }

    if (transcriptionData.error) {
      throw new Error(`Voxtral error: ${transcriptionData.error.message || JSON.stringify(transcriptionData.error)}`);
    }

    transcript = transcriptionData.text || '';

    if (!transcript) {
      throw new Error('Voxtral returned empty transcript (no text field)');
    }

    // Calculate score
    const expectedLyrics = expectedText || "sample lyrics here";
    calculatedScore = calculatePronunciationScore(transcript, expectedLyrics);

    // Try to submit to PerformanceGrader contract using SIMPLE 5-parameter function
    // But if it fails, still return the transcript and score
    try {
      txHash = await submitToPerformanceGrader({
        performanceId: performanceId || Date.now(),
        segmentHash,
        performer: userAddress,
        score: calculatedScore * 100, // Convert to basis points
        metadataUri: metadataUri || `grove://${generateRandomCID()}`
      });
      success = true;
    } catch (txError) {
      // Even if contract submission fails, the grading was successful
      success = true; // We successfully transcribed and scored
      errorType = `Contract submission failed: ${txError.message}`;
      // txHash remains null, indicating the transaction wasn't submitted
    }

  } catch (error) {
    success = false;
    errorType = error.message;
  }

  // Return results
  const endTime = Date.now();

  Lit.Actions.setResponse({
    response: JSON.stringify({
      success,
      score: calculatedScore,
      rating: scoreToRating(calculatedScore),
      transcript,
      performanceId: performanceId || Date.now(),
      txHash,
      errorType,
      executionTime: endTime - startTime,
      version: 'v9-simple-5param'
    })
  });
};

// ============================================================
// PERFORMANCEGRADER INTEGRATION - SIMPLE 5-PARAMETER VERSION
// (Based on proven working v6 pattern)
// ============================================================
async function submitToPerformanceGrader({ performanceId, segmentHash, performer, score, metadataUri }) {
  const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);

  // Create contract instance with SIMPLE 5-parameter gradePerformance function
  const performanceGraderABI = [
    'function gradePerformance(uint256 performanceId, bytes32 segmentHash, address performer, uint16 score, string metadataUri) external',
    'event PerformanceGraded(uint256 indexed performanceId, bytes32 indexed segmentHash, address indexed performer, uint16 score, string metadataUri, uint64 timestamp)'
  ];

  const contract = new ethers.Contract(
    PERFORMANCE_GRADER_ADDRESS,
    performanceGraderABI,
    provider
  );

  // Encode function call for SIMPLE 5-parameter grading
  const gradePerformanceTxData = contract.interface.encodeFunctionData('gradePerformance', [
    performanceId,
    segmentHash,
    performer,
    score,
    metadataUri
  ]);

  // Get PKP address
  const pkpEthAddress = ethers.utils.computeAddress(PKP_PUBLIC_KEY);
  const nonce = await provider.getTransactionCount(pkpEthAddress);
  const gasPrice = await provider.getGasPrice();

  // zkSync parameters
  const maxPriorityFeePerGas = ethers.BigNumber.from(0);
  const gasPerPubdataByteLimit = ethers.BigNumber.from(800);
  const gasLimit = 500000;

  // Normalize addresses (checksummed format)
  const from = ethers.utils.getAddress(pkpEthAddress);
  const to = ethers.utils.getAddress(PERFORMANCE_GRADER_ADDRESS);

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

  const structHash = ethers.utils.keccak256(
    ethers.utils.concat([
      txTypeHash,
      ethers.utils.zeroPad(ethers.utils.hexlify(113), 32),           // txType: 113 (0x71)
      ethers.utils.zeroPad(from, 32),                                // from
      ethers.utils.zeroPad(to, 32),                                  // to
      ethers.utils.zeroPad(ethers.utils.hexlify(gasLimit), 32),      // gasLimit
      ethers.utils.zeroPad(ethers.utils.hexlify(gasPerPubdataByteLimit), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(gasPrice), 32),      // maxFeePerGas
      ethers.utils.zeroPad(ethers.utils.hexlify(maxPriorityFeePerGas), 32),
      ethers.utils.zeroPad('0x00', 32),                              // paymaster
      ethers.utils.zeroPad(ethers.utils.hexlify(nonce), 32),         // nonce
      ethers.utils.zeroPad('0x00', 32),                              // value
      ethers.utils.keccak256(gradePerformanceTxData || '0x'),        // data hash
      ethers.utils.keccak256('0x'),                                  // factoryDeps
      ethers.utils.keccak256('0x')                                   // paymasterInput
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

  const signature = await Lit.Actions.signAndCombineEcdsa({
    toSign: toSign,
    publicKey: PKP_PUBLIC_KEY,
    sigName: 'performanceGraderTx'
  });

  // Parse signature
  const jsonSignature = JSON.parse(signature);

  const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
  const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

  const r = ethers.utils.zeroPad(rHex, 32);
  const s = ethers.utils.zeroPad(sHex, 32);

  let v = jsonSignature.v;
  if (v < 27) {
    v = v + 27;
  }

  // Verify signature recovery
  const recovered = ethers.utils.recoverAddress(eip712Hash, { r: rHex, s: sHex, v: v });
  if (recovered.toLowerCase() !== pkpEthAddress.toLowerCase()) {
    throw new Error(`Signature recovery failed: expected ${pkpEthAddress}, got ${recovered}`);
  }

  // Convert v to yParity for zkSync
  const yParity = v - 27;

  // Helper function: mimics ethers v6 toBeArray() - converts number to minimal big-endian bytes
  const toBeArray = (value) => {
    if (!value || value === 0 || value === '0') {
      return new Uint8Array([]);
    }
    const hex = ethers.utils.hexlify(value);
    return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
  };

  // Build 16-field RLP structure - EXACT WORKING PATTERN FROM v6
  const signedFields = [
    toBeArray(nonce),                                     // 0. nonce
    toBeArray(maxPriorityFeePerGas),                      // 1. maxPriorityFeePerGas
    toBeArray(gasPrice),                                  // 2. maxFeePerGas
    toBeArray(gasLimit),                                  // 3. gasLimit
    to || '0x',                                           // 4. to
    toBeArray(0),                                         // 5. value
    gradePerformanceTxData || '0x',                       // 6. data
    toBeArray(yParity),                                   // 7. yParity (0 or 1)
    ethers.utils.arrayify(r),                             // 8. r
    ethers.utils.arrayify(s),                             // 9. s
    toBeArray(LENS_TESTNET_CHAIN_ID),                     // 10. chainId
    from,                                                 // 11. from
    toBeArray(gasPerPubdataByteLimit),                    // 12. gasPerPubdata
    [],                                                   // 13. factoryDeps
    '0x',                                                 // 14. customSignature
    []                                                    // 15. paymasterParams
  ];

  // RLP encode signed fields
  const signedRlp = ethers.utils.RLP.encode(signedFields);

  // Prepend type 0x71
  const signedTxSerialized = '0x71' + signedRlp.slice(2);

  // Submit transaction using runOnce
  const response = await Lit.Actions.runOnce(
    { waitForResponse: true, name: "txSender" },
    async () => {
      try {
        const txHash = await provider.send("eth_sendRawTransaction", [signedTxSerialized]);
        return txHash;
      } catch (error) {
        return `TX_SUBMIT_ERROR: ${error.message}`;
      }
    }
  );

  // Check if response is an error
  if (response && response.startsWith('TX_SUBMIT_ERROR:')) {
    throw new Error(response);
  }

  return response;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Calculate Levenshtein distance between two strings
 * Measures minimum number of single-character edits (insertions, deletions, substitutions)
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create matrix
  const matrix = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        // Characters match, no operation needed
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Take minimum of:
        // - Substitution (diagonal)
        // - Insertion (left)
        // - Deletion (top)
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize text for comparison
 * - Convert to lowercase
 * - Remove punctuation
 * - Normalize whitespace
 * - Trim
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim();
}

/**
 * Calculate pronunciation score (0-100) based on Levenshtein similarity
 * Uses character-level edit distance for robust fuzzy matching
 */
function calculatePronunciationScore(transcript, expectedLyrics) {
  // Handle edge cases
  if (!expectedLyrics || !transcript) return 0;

  // Normalize both strings
  const normalizedExpected = normalizeText(expectedLyrics);
  const normalizedActual = normalizeText(transcript);

  // Both empty after normalization = perfect match (shouldn't happen)
  if (normalizedExpected.length === 0 && normalizedActual.length === 0) {
    return 100;
  }

  // One is empty = total failure
  if (normalizedExpected.length === 0 || normalizedActual.length === 0) {
    return 0;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalizedExpected, normalizedActual);

  // Calculate similarity as percentage
  const maxLength = Math.max(normalizedExpected.length, normalizedActual.length);
  const similarity = 1 - (distance / maxLength);

  // Convert to 0-100 score
  const score = Math.max(0, Math.min(100, Math.round(similarity * 100)));

  return score;
}

/**
 * Convert score to FSRS rating name for display
 * Thresholds:
 * - 90-100: Easy - Excellent pronunciation
 * - 75-89:  Good - Good with minor errors
 * - 60-74:  Hard - Difficult but recognizable
 * - 0-59:   Again - Failed, needs practice
 */
function scoreToRating(score) {
  if (score >= 90) return 'Easy';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Hard';
  return 'Again';
}

function generateRandomCID() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// Execute
go().catch(error => {
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: false,
      error: error.message,
      version: 'v9-simple-5param'
    })
  });
});
