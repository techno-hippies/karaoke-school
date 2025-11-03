/**
 * Karaoke Grader v6 - PerformanceGrader Integration
 *
 * Deployed PerformanceGrader on Lens Testnet:
 * - Contract: 0xbc831cfc35C543892B14cDe6E40ED9026eF32678
 * - Trusted PKP: 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30
 * - Network: Lens Testnet (Chain ID: 37111)
 *
 * Flow:
 * 1. Transcribe user audio via Voxstral STT
 * 2. Calculate pronunciation score
 * 3. Submit score to PerformanceGrader via PKP signing
 * 4. Emit PerformanceGraded event for leaderboard indexing
 */

// ============================================================
// CONTRACT CONFIGURATION
// ============================================================
const PERFORMANCE_GRADER_ADDRESS = '0xbc831cfc35C543892B14cDe6E40ED9026eF32678';
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
    language,
    accessControlConditions,
    ciphertext,
    dataToEncryptHash,
    testMode
  } = jsParams || {};

  try {
    // Validate parameters
    if (!userAddress || !segmentHash) {
      throw new Error('Missing required parameters');
    }

    // TEST MODE: Skip audio processing and submit test score
    if (testMode) {
      transcript = 'TEST_MODE_TRANSCRIPT';
      calculatedScore = 85; // 85% test score

      txHash = await submitToPerformanceGrader({
        performanceId: performanceId || Date.now(),
        segmentHash,
        performer: userAddress,
        score: 8500, // 85.00% in basis points
        metadataUri: metadataUri || `grove://test-${Date.now()}`
      });

      success = true;
    } else {
      // NORMAL MODE: Process audio
      if (!audioDataBase64) {
        throw new Error('Missing audioDataBase64');
      }

      // Decrypt Voxstral API key
      const voxstralApiKey = await Lit.Actions.decryptAndCombine({
        accessControlConditions,
        ciphertext,
        dataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      });

      // Transcribe audio via Voxstral
      const audioData = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0));

      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n`;
      const bodyBytes = new Uint8Array(body.length + audioData.length + 2);
      bodyBytes.set(new TextEncoder().encode(body), 0);
      bodyBytes.set(audioData, body.length);
      bodyBytes.set(new TextEncoder().encode(`\r\n--${boundary}--\r\n`), body.length + audioData.length);

      const transcriptionResponse = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${voxstralApiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: bodyBytes
      });

      const transcriptionData = await transcriptionResponse.json();
      transcript = transcriptionData.text || '';

      // Calculate score (simplified version - you can enhance with FSRS)
      const expectedLyrics = "sample lyrics here"; // Get from metadataUri
      calculatedScore = calculatePronunciationScore(transcript, expectedLyrics);

      // Submit to PerformanceGrader contract
      txHash = await submitToPerformanceGrader({
        performanceId: performanceId || Date.now(),
        segmentHash,
        performer: userAddress,
        score: calculatedScore * 100, // Convert to basis points
        metadataUri: metadataUri || `grove://${generateRandomCID()}`
      });

      success = true;
    } // end else

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
      transcript,
      txHash,
      errorType,
      executionTime: endTime - startTime,
      version: 'v6-performance-grader'
    })
  });
};

// ============================================================
// PERFORMANCEGRADER INTEGRATION (16-field zkSync signature)
// ============================================================
async function submitToPerformanceGrader({ performanceId, segmentHash, performer, score, metadataUri }) {
  const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);

  // Create contract instance
  const performanceGraderABI = [
    'function gradePerformance(uint256 performanceId, bytes32 segmentHash, address performer, uint16 score, string metadataUri) external',
    'event PerformanceGraded(uint256 indexed performanceId, bytes32 indexed segmentHash, address indexed performer, uint16 score, string metadataUri, uint64 timestamp)'
  ];

  const contract = new ethers.Contract(
    PERFORMANCE_GRADER_ADDRESS,
    performanceGraderABI,
    provider
  );

  // Encode function call
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
  const gasLimit = 2000000;

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

  // Build 16-field RLP structure
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

// Helper function: mimics ethers v6 toBeArray() - converts number to minimal big-endian bytes
const toBeArray = (value) => {
  if (!value || value === 0 || value === '0') {
    return new Uint8Array([]);
  }
  const hex = ethers.utils.hexlify(value);
  return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function calculatePronunciationScore(transcript, expectedLyrics) {
  // Simplified scoring - enhance as needed
  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const transcriptWords = normalize(transcript);
  const expectedWords = normalize(expectedLyrics);
  
  if (expectedWords.length === 0) return 0;
  
  let matches = 0;
  const minLength = Math.min(transcriptWords.length, expectedWords.length);
  
  for (let i = 0; i < minLength; i++) {
    if (transcriptWords[i] === expectedWords[i]) {
      matches++;
    }
  }
  
  return Math.min(100, Math.round((matches / expectedWords.length) * 100));
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
      version: 'v6-performance-grader'
    })
  });
});
