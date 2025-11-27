/**
 * Exercise Grader v1 - Unified FSRS Exercise Grading
 *
 * Deployed ExerciseEvents on Lens Testnet:
 * - Contract: 0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832
 * - Trusted PKP: 0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7
 * - Network: Lens Testnet (Chain ID: 37111)
 * - Deployment: TBD
 *
 * Exercise Types:
 * 1. SAY_IT_BACK - Audio pronunciation exercises (line-level)
 * 2. TRANSLATION_QUIZ - Translation multiple choice (line-level)
 * 3. TRIVIA_QUIZ - Trivia multiple choice (song-level)
 *
 * Flow (Say It Back):
 * 1. Transcribe user audio via Voxtral STT
 * 2. Calculate pronunciation score using Levenshtein distance
 * 3. Submit via gradeSayItBackAttempt() (8 params)
 * 4. Emit SayItBackAttemptGraded event for FSRS tracking
 *
 * Flow (Multiple Choice):
 * 1. Validate user's answer against correct answer
 * 2. Calculate score (10000 for correct, 0 for incorrect)
 * 3. Submit via gradeMultipleChoiceAttempt() (6 params)
 * 4. Emit MultipleChoiceAttemptGraded event for FSRS tracking
 */

// ============================================================
// CONTRACT CONFIGURATION
// ============================================================
const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832';
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz';

// PKP Configuration (must match contract's trustedPKP)
const PKP_PUBLIC_KEY = '0x047037fa3f1ba0290880f20afb8a88a8af8a125804a9a3f593ff2a63bf7addd3e2d341e8e3d5a0ef02790ab7e92447e59adeef9915ce5d2c0ee90e0e9ed1b0c5f7';

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
    exerciseType,     // Required: 'SAY_IT_BACK' | 'TRANSLATION_QUIZ' | 'TRIVIA_QUIZ'

    // Common params
    userAddress,
    testMode,         // Skip actual API calls for testing

    // Say It Back params
    audioDataBase64,
    segmentHash,
    lineId,           // UUID from karaoke_lines table
    lineIndex,        // Position within segment (0-based)
    expectedText,
    language,
    voxtralEncryptedKey,  // Encrypted key passed from frontend

    // Multiple Choice params
    questionId,       // For translation/trivia quizzes
    userAnswer,       // User's selected answer
    correctAnswer,    // Correct answer from database

    // Metadata
    attemptId,        // Unique attempt identifier
    metadataUri,      // Grove URI for result metadata

    // Debug / overrides
    txDebugStage,     // Optional: 'simulate' | 'prepare' to aid debugging
    rpcUrlOverride,   // Optional: override RPC URL (e.g., via Lit.Actions.getRpcUrl)
    nonceOverride     // Optional: deterministic nonce to prevent collisions
  } = jsParams || {};

  try {
    // Validate common parameters
    if (!exerciseType || !userAddress) {
      throw new Error('Missing required parameters: exerciseType and userAddress');
    }

    // Route to appropriate handler based on exercise type
    switch (exerciseType) {
      case 'SAY_IT_BACK':
        await handleSayItBack({
          audioDataBase64,
          userAddress,
          segmentHash,
          lineId,
          lineIndex,
          expectedText,
          language,
          voxtralEncryptedKey,
          attemptId,
          metadataUri,
          testMode,
          txDebugStage,
          rpcUrlOverride,
          nonceOverride
        });
        break;

      case 'TRANSLATION_QUIZ':
      case 'TRIVIA_QUIZ':
        await handleMultipleChoice({
          questionId,
          userAddress,
          userAnswer,
          correctAnswer,
          attemptId,
          metadataUri,
          testMode,
          nonceOverride
        });
        break;

      default:
        throw new Error(`Unknown exercise type: ${exerciseType}`);
    }

  } catch (error) {
    success = false;
    errorType = error.message;

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: errorType,
        version: 'exercise-grader-v1',
        executionTime: Date.now() - startTime
      })
    });
  }
};

// ============================================================
// SAY IT BACK HANDLER
// ============================================================
async function handleSayItBack({
  audioDataBase64,
  userAddress,
  segmentHash,
  lineId,
  lineIndex,
  expectedText,
  language,
  voxtralEncryptedKey,
  attemptId,
  metadataUri,
  testMode,
  txDebugStage,
  rpcUrlOverride,
  nonceOverride
}) {
  const startTime = Date.now();
  let success = false;
  let transcript = '';
  let errorType = null;
  let calculatedScore = 0;
  let txHash = null;

  try {
    // Validate parameters
    if (!segmentHash) {
      throw new Error('Missing required parameter: segmentHash');
    }

    if (!audioDataBase64 && !testMode) {
      throw new Error('Missing audioDataBase64');
    }

    // CRITICAL: Validate lineId for line-level grading
    if (!lineId || lineId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('lineId is required and must be non-zero for line-level grading');
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
          version: 'exercise-grader-v1',
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

    // Try to submit to ExerciseEvents contract
    // But if it fails, still return the transcript and score
    try {
      txHash = await submitSayItBackAttempt({
        attemptId: attemptId || Date.now(),
        lineId,  // Already validated above
        segmentHash,
        lineIndex: lineIndex !== undefined ? lineIndex : 0,
        learner: userAddress,
        score: calculatedScore * 100, // Convert to basis points
        rating: scoreToRatingNumeric(calculatedScore),
        metadataUri: metadataUri || `grove://${generateRandomCID()}`,
        txDebugStage,
        rpcUrlOverride,
        nonceOverride
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
      attemptId: attemptId || Date.now(),
      txHash,
      errorType,
      executionTime: endTime - startTime,
      version: 'exercise-grader-v1'
    })
  });
}

// ============================================================
// MULTIPLE CHOICE HANDLER
// ============================================================
async function handleMultipleChoice({
  questionId,
  userAddress,
  userAnswer,
  correctAnswer,
  attemptId,
  metadataUri,
  testMode,
  nonceOverride
}) {
  const startTime = Date.now();
  let success = false;
  let errorType = null;
  let calculatedScore = 0;
  let txHash = null;

  try {
    // Validate parameters
    if (!questionId || questionId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('questionId is required and must be non-zero');
    }

    if (userAnswer === undefined || userAnswer === null) {
      throw new Error('Missing userAnswer');
    }

    if (correctAnswer === undefined || correctAnswer === null) {
      throw new Error('Missing correctAnswer');
    }

    // TEST MODE: Mock scoring
    if (testMode) {
      calculatedScore = userAnswer === correctAnswer ? 100 : 0;
      success = true;

      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          score: calculatedScore,
          rating: scoreToRating(calculatedScore),
          isCorrect: userAnswer === correctAnswer,
          version: 'exercise-grader-v1',
          executionTime: Date.now() - startTime,
          testMode: true
        })
      });
      return;
    }

    // Calculate score (100 for correct, 0 for incorrect)
    const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
    calculatedScore = isCorrect ? 100 : 0;

    // Try to submit to ExerciseEvents contract
    try {
      txHash = await submitMultipleChoiceAttempt({
        attemptId: attemptId || Date.now(),
        questionId,
        learner: userAddress,
        score: calculatedScore * 100, // Convert to basis points (10000 or 0)
        rating: scoreToRatingNumeric(calculatedScore),
        metadataUri: metadataUri || `grove://${generateRandomCID()}`,
        nonceOverride
      });
      success = true;
    } catch (txError) {
      // Even if contract submission fails, the grading was successful
      success = true;
      errorType = `Contract submission failed: ${txError.message}`;
      // txHash remains null
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
      isCorrect: calculatedScore === 100,
      attemptId: attemptId || Date.now(),
      txHash,
      errorType,
      executionTime: endTime - startTime,
      version: 'exercise-grader-v1'
    })
  });
}

// ============================================================
// CONTRACT SUBMISSIONS
// ============================================================

/**
 * Submit Say It Back attempt to ExerciseEvents contract
 * Function: gradeSayItBackAttempt(attemptId, lineId, segmentHash, lineIndex, learner, score, rating, metadataUri)
 */
async function submitSayItBackAttempt({ attemptId, lineId, segmentHash, lineIndex, learner, score, rating, metadataUri, txDebugStage, rpcUrlOverride, nonceOverride }) {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrlOverride || LENS_TESTNET_RPC);

  // Create contract instance
  const exerciseEventsABI = [
    'function gradeSayItBackAttempt(uint256 attemptId, bytes32 lineId, bytes32 segmentHash, uint16 lineIndex, address learner, uint16 score, uint8 rating, string metadataUri) external',
    'event SayItBackAttemptGraded(uint256 indexed attemptId, bytes32 indexed lineId, bytes32 indexed segmentHash, uint16 lineIndex, address learner, uint16 score, uint8 rating, string metadataUri, uint64 timestamp)'
  ];

  const contract = new ethers.Contract(
    EXERCISE_EVENTS_ADDRESS,
    exerciseEventsABI,
    provider
  );

  // Encode function call with proper type normalization
  const attemptIdBN = ethers.BigNumber.from(attemptId); // uint256
  const lineIdBytes32 = ethers.utils.hexZeroPad(lineId, 32); // bytes32
  const segmentHashBytes32 = ethers.utils.hexZeroPad(segmentHash, 32); // bytes32
  const lineIndexUint16 = ethers.BigNumber.from(lineIndex); // uint16
  const learnerAddress = ethers.utils.getAddress(learner); // address (checksummed)
  const scoreUint16 = ethers.BigNumber.from(score); // uint16
  const ratingUint8 = ethers.BigNumber.from(rating); // uint8

  const gradeTxData = contract.interface.encodeFunctionData('gradeSayItBackAttempt', [
    attemptIdBN,
    lineIdBytes32,
    segmentHashBytes32,
    lineIndexUint16,
    learnerAddress,
    scoreUint16,
    ratingUint8,
    metadataUri
  ]);

  // Submit via zkSync transaction
  return await submitZkSyncTransaction(gradeTxData, provider, txDebugStage, nonceOverride);
}

/**
 * Submit Multiple Choice attempt to ExerciseEvents contract
 * Function: gradeMultipleChoiceAttempt(attemptId, questionId, learner, score, rating, metadataUri)
 */
async function submitMultipleChoiceAttempt({ attemptId, questionId, learner, score, rating, metadataUri, txDebugStage, rpcUrlOverride, nonceOverride }) {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrlOverride || LENS_TESTNET_RPC);

  // Create contract instance
  const exerciseEventsABI = [
    'function gradeMultipleChoiceAttempt(uint256 attemptId, bytes32 questionId, address learner, uint16 score, uint8 rating, string metadataUri) external',
    'event MultipleChoiceAttemptGraded(uint256 indexed attemptId, bytes32 indexed questionId, address indexed learner, uint16 score, uint8 rating, string metadataUri, uint64 timestamp)'
  ];

  const contract = new ethers.Contract(
    EXERCISE_EVENTS_ADDRESS,
    exerciseEventsABI,
    provider
  );

  // Encode function call with proper type normalization
  const attemptIdBN = ethers.BigNumber.from(attemptId); // uint256
  const questionIdBytes32 = ethers.utils.hexZeroPad(questionId, 32); // bytes32
  const learnerAddress = ethers.utils.getAddress(learner); // address (checksummed)
  const scoreUint16 = ethers.BigNumber.from(score); // uint16
  const ratingUint8 = ethers.BigNumber.from(rating); // uint8

  const gradeTxData = contract.interface.encodeFunctionData('gradeMultipleChoiceAttempt', [
    attemptIdBN,
    questionIdBytes32,
    learnerAddress,
    scoreUint16,
    ratingUint8,
    metadataUri
  ]);

  // Submit via zkSync transaction
  return await submitZkSyncTransaction(gradeTxData, provider, txDebugStage, nonceOverride);
}

/**
 * Submit zkSync type 0x71 transaction (16-field RLP encoding)
 * CRITICAL: This is the working pattern from say-it-back-v1.js - DO NOT MODIFY
 */
async function submitZkSyncTransaction(txData, provider, txDebugStage, nonceOverride) {
  // Get PKP address
  const pkpEthAddress = ethers.utils.computeAddress(PKP_PUBLIC_KEY);

  // Simulate the call to catch revert reason BEFORE signing
  try {
    const simResult = await provider.call({
      from: pkpEthAddress,
      to: EXERCISE_EVENTS_ADDRESS,
      data: txData,
      gasLimit: ethers.utils.hexlify(2000000),
      value: '0x0',
    });
    console.log(' Simulation succeeded:', simResult);
  } catch (simError) {
    let simDetails = simError.reason || simError.message || simError;
    try {
      const extra = {
        code: simError.code,
        data: simError.data,
        body: simError.body,
        error: simError.error?.message || simError.error
      };
      simDetails = `${simDetails} | debug=${JSON.stringify(extra)}`;
    } catch (_) {
      // ignore JSON issues
    }
    console.error('L Simulation failed with reason:', simDetails);
    throw new Error(`Contract simulation failed: ${simDetails}`);
  }

  // Debug stage: return early after simulation
  if (txDebugStage === 'simulate') {
    return 'DEBUG_SIMULATION_OK';
  }

  // Use nonceOverride if provided to prevent race conditions in parallel submissions
  const nonce = typeof nonceOverride !== 'undefined' && nonceOverride !== null
    ? ethers.BigNumber.from(nonceOverride)
    : await provider.getTransactionCount(pkpEthAddress);
  const feeData = await provider.getFeeData();

  // Use fee data from provider
  const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.BigNumber.from("3705143562");
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.BigNumber.from(0);
  const gasLimit = 500000; // Conservative limit

  console.log('Building EIP-1559 transaction...');
  console.log('Nonce:', nonce);
  console.log('Gas price:', gasPrice.toString());

  // Normalize addresses (checksummed format for RLP encoding)
  const from = ethers.utils.getAddress(pkpEthAddress);
  const to = ethers.utils.getAddress(EXERCISE_EVENTS_ADDRESS);

  // Calculate EIP-712 domain separator for zkSync
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

  // Calculate EIP-712 struct hash for zkSync transaction
  const txTypeHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('Transaction(uint256 txType,uint256 from,uint256 to,uint256 gasLimit,uint256 gasPerPubdataByteLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 paymaster,uint256 nonce,uint256 value,bytes data,bytes32[] factoryDeps,bytes paymasterInput)')
  );

  const gasPerPubdataByteLimit = ethers.BigNumber.from(800);

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
      ethers.utils.keccak256(txData || '0x'),                        // data hash
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

  console.log('Signing EIP-712 transaction...');

  // Sign the EIP-712 hash with PKP
  const toSign = ethers.utils.arrayify(eip712Hash);

  const signature = await Lit.Actions.signAndCombineEcdsa({
    toSign: toSign,
    publicKey: PKP_PUBLIC_KEY,
    sigName: 'exerciseGraderTx'
  });

  // Parse signature
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
    v = v + 27;
  }

  // Verify signature recovery
  const recovered = ethers.utils.recoverAddress(eip712Hash, { r: rHex, s: sHex, v: v });
  if (recovered.toLowerCase() !== pkpEthAddress.toLowerCase()) {
    throw new Error(`Signature recovery failed: expected ${pkpEthAddress}, got ${recovered}`);
  }

  console.log(' Signature verified');

  // Convert v to yParity for zkSync RLP encoding (0 or 1, not 27/28)
  const yParity = v - 27;

  // Helper: converts number to minimal big-endian bytes
  const toBeArray = (value) => {
    if (!value || value === 0 || value === '0') {
      return new Uint8Array([]);
    }
    const hex = ethers.utils.hexlify(value);
    return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
  };

  // Build 16-field RLP structure for zkSync type 0x71 (WORKING PATTERN!)
  // CRITICAL: Fields 7-9 are yParity, r, s (signature components)
  const signedFields = [
    toBeArray(nonce),                          // 0. nonce
    toBeArray(maxPriorityFeePerGas),           // 1. maxPriorityFeePerGas
    toBeArray(gasPrice),                       // 2. maxFeePerGas
    toBeArray(gasLimit),                       // 3. gasLimit
    to || '0x',                                // 4. to (address)
    toBeArray(0),                              // 5. value
    txData || '0x',                            // 6. data
    toBeArray(yParity),                        // 7. yParity (0 or 1) - NOT v (27/28)!
    ethers.utils.arrayify(r),                  // 8. r (full 32 bytes)
    ethers.utils.arrayify(s),                  // 9. s (full 32 bytes)
    toBeArray(LENS_TESTNET_CHAIN_ID),          // 10. chainId
    from,                                      // 11. from (address)
    toBeArray(gasPerPubdataByteLimit),         // 12. gasPerPubdata
    [],                                        // 13. factoryDeps (empty array)
    '0x',                                      // 14. customSignature (empty for EOA)
    []                                         // 15. paymasterParams (empty array)
  ];

  // RLP encode signed fields
  const signedRlp = ethers.utils.RLP.encode(signedFields);

  // Prepend type 0x71
  const signedTxSerialized = '0x71' + signedRlp.slice(2);

  // Debug stage: return prepared tx without submitting
  if (txDebugStage === 'prepare') {
    return JSON.stringify({
      stage: 'prepare',
      nonce: nonce.toString(),
      gasPrice: gasPrice.toString(),
      signedTxSerialized
    });
  }

  console.log('Built zkSync type 0x71 transaction');

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
 * - Convert to lowercase (for Latin characters)
 * - Remove English punctuation only
 * - Preserve Chinese/Vietnamese/Indonesian characters
 * - Normalize whitespace
 * - Trim
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '') // Remove English punctuation only
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim();
}

/**
 * Normalize answer for multiple choice comparison
 */
function normalizeAnswer(answer) {
  if (typeof answer === 'string') {
    return normalizeText(answer);
  }
  return answer; // For numeric answers
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

/**
 * Convert score to FSRS rating numeric (for contract)
 * 0=Again, 1=Hard, 2=Good, 3=Easy
 */
function scoreToRatingNumeric(score) {
  if (score >= 90) return 3; // Easy
  if (score >= 75) return 2; // Good
  if (score >= 60) return 1; // Hard
  return 0; // Again
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
      version: 'exercise-grader-v1'
    })
  });
});
