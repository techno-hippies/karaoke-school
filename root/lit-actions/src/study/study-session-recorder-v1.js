/**
 * Study Session Recorder v1
 *
 * Records completed study sessions to StudyProgressV1 contract with optional FSRS encryption
 *
 * Flow:
 * 1. Validate user-provided parameters (userAddress, contentId, performance metrics)
 * 2. (Optional) Encrypt FSRS data using Lit.Actions.encrypt() for privacy
 * 3. Submit recordStudySession() transaction to StudyProgressV1
 * 4. (Optional) Submit storeEncryptedFSRS() if FSRS data provided
 *
 * Expected params (via jsParams):
 * - userAddress: User's wallet address (REQUIRED)
 * - source: ContentSource enum (0=Native, 1=Genius) (REQUIRED)
 * - contentId: Song/segment identifier (REQUIRED)
 * - itemsReviewed: Number of items in session (REQUIRED, uint16)
 * - averageScore: Average score 0-100 (REQUIRED, uint8)
 * - pkpPublicKey: PKP public key for signing transactions (REQUIRED)
 *
 * Optional FSRS params:
 * - fsrsData: JSON object with FSRS state (difficulty, stability, etc.)
 * - fsrsAccessControlConditions: Access control for encrypted FSRS
 *
 * Optional analytics params:
 * - sessionId, userLanguage, userIpCountry, userAgent
 * - dbUrlCiphertext, dbUrlDataToEncryptHash, dbUrlAccessControlConditions
 * - dbTokenCiphertext, dbTokenDataToEncryptHash, dbTokenAccessControlConditions
 */

// ============================================================
// CONFIGURATION - Public contract addresses (hardcoded)
// ============================================================

const STUDY_PROGRESS_ADDRESS = '0x784Ff3655B8FDb37b5CFB831C531482A606365f1';
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC_URL = 'https://rpc.testnet.lens.xyz';

// ============================================================
// MAIN EXECUTION
// ============================================================

const go = async () => {
  const startTime = Date.now();
  let success = false;
  let errorType = null;
  let sessionTxHash = null;
  let fsrsTxHash = null;

  // Extract parameters from jsParams
  const {
    userAddress,
    source,
    contentId,
    itemsReviewed,
    averageScore,
    pkpPublicKey,
    fsrsData,
    fsrsAccessControlConditions,
    userLanguage,
    userIpCountry,
    userAgent,
    sessionId,
    dbUrlCiphertext,
    dbUrlDataToEncryptHash,
    dbUrlAccessControlConditions,
    dbTokenCiphertext,
    dbTokenDataToEncryptHash,
    dbTokenAccessControlConditions
  } = jsParams || {};

  // Analytics variables
  let walletAddr = 'anonymous';
  let sessionIdParam = sessionId || crypto.randomUUID();
  let userAgentParam = userAgent || 'unknown';
  let languageParam = userLanguage || null;
  let userIpCountryParam = userIpCountry || 'XX';
  let dbEndpoint = null;
  let dbCredentials = null;

  try {
    // ============================================================
    // 1. VALIDATE PARAMETERS
    // ============================================================

    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      throw new Error('INVALID_USER_ADDRESS');
    }

    if (source === undefined || source === null || source < 0 || source > 1) {
      throw new Error('INVALID_SOURCE');
    }

    if (!contentId || typeof contentId !== 'string' || contentId.trim() === '') {
      throw new Error('INVALID_CONTENT_ID');
    }

    if (!itemsReviewed || itemsReviewed < 1 || itemsReviewed > 65535) {
      throw new Error('INVALID_ITEMS_REVIEWED');
    }

    if (averageScore === undefined || averageScore < 0 || averageScore > 100) {
      throw new Error('INVALID_AVERAGE_SCORE');
    }

    if (!pkpPublicKey) {
      throw new Error('MISSING_PKP_PUBLIC_KEY');
    }

    walletAddr = userAddress;

    // ============================================================
    // 2. SETUP WEB3 PROVIDER (ethers v5)
    // ============================================================

    const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC_URL);

    const StudyProgressABI = [
      'function recordStudySession(address user, uint8 source, string calldata contentId, uint16 itemsReviewed, uint8 averageScore) external',
      'function storeEncryptedFSRS(address user, uint8 source, string calldata contentId, string calldata ciphertext, string calldata dataToEncryptHash) external'
    ];

    // ============================================================
    // 3. RECORD STUDY SESSION
    // ============================================================

    const iface = new ethers.utils.Interface(StudyProgressABI);
    const sessionCallData = iface.encodeFunctionData('recordStudySession', [
      userAddress,
      source,
      contentId,
      itemsReviewed,
      averageScore
    ]);

    const pkpPublicKeyFormatted = pkpPublicKey.startsWith('0x') ? pkpPublicKey : '0x' + pkpPublicKey;
    const pkpEthAddress = ethers.utils.computeAddress(pkpPublicKeyFormatted);
    const nonce = await provider.getTransactionCount(pkpEthAddress);

    const unsignedSessionTx = {
      to: STUDY_PROGRESS_ADDRESS,
      from: pkpEthAddress,
      data: sessionCallData,
      chainId: LENS_TESTNET_CHAIN_ID,
      gasLimit: ethers.BigNumber.from('300000'),
      gasPrice: ethers.utils.parseUnits('300', 'gwei'),
      nonce: nonce,
      type: 2,
      maxFeePerGas: ethers.utils.parseUnits('300', 'gwei'),
      maxPriorityFeePerGas: ethers.utils.parseUnits('1', 'gwei')
    };

    const serializedSessionTx = ethers.utils.serializeTransaction(unsignedSessionTx);
    const sessionTxHashToSign = ethers.utils.keccak256(serializedSessionTx);

    // Sign with PKP
    const sessionSignature = await Lit.Actions.signAndCombineEcdsa({
      toSign: ethers.utils.arrayify(sessionTxHashToSign),
      publicKey: pkpPublicKey,
      sigName: "studySessionSig",
    });

    // Parse v8 signature format
    const jsonSessionSignature = JSON.parse(sessionSignature);
    jsonSessionSignature.r = jsonSessionSignature.r.startsWith('0x') ? jsonSessionSignature.r : '0x' + jsonSessionSignature.r;
    jsonSessionSignature.s = jsonSessionSignature.s.startsWith('0x') ? jsonSessionSignature.s : '0x' + jsonSessionSignature.s;
    const hexSessionSignature = ethers.utils.joinSignature(jsonSessionSignature);

    const signedSessionTx = ethers.utils.serializeTransaction(unsignedSessionTx, hexSessionSignature);

    // Submit transaction (fire-and-forget to avoid timeout)
    sessionTxHash = await Lit.Actions.runOnce(
      { waitForResponse: false, name: `submitStudySession_${userAddress}_${contentId}_${Date.now()}` },
      async () => {
        try {
          const tx = await provider.sendTransaction(signedSessionTx);
          return tx.hash;
        } catch (error) {
          return `ERROR: ${error.message}`;
        }
      }
    );

    // ============================================================
    // 4. (OPTIONAL) STORE PRE-ENCRYPTED FSRS DATA
    // ============================================================

    if (fsrsData) {
      // fsrsData should contain: { ciphertext, dataToEncryptHash }
      // Encryption must be done client-side before calling this Lit Action
      const { ciphertext, dataToEncryptHash } = fsrsData;

      if (!ciphertext || !dataToEncryptHash) {
        throw new Error('INVALID_FSRS_DATA: Missing ciphertext or dataToEncryptHash');
      }

      const fsrsCallData = iface.encodeFunctionData('storeEncryptedFSRS', [
        userAddress,
        source,
        contentId,
        ciphertext,
        dataToEncryptHash
      ]);

      const fsrsNonce = await provider.getTransactionCount(pkpEthAddress);

      const unsignedFsrsTx = {
        to: STUDY_PROGRESS_ADDRESS,
        from: pkpEthAddress,
        data: fsrsCallData,
        chainId: LENS_TESTNET_CHAIN_ID,
        gasLimit: ethers.BigNumber.from('300000'),
        gasPrice: ethers.utils.parseUnits('300', 'gwei'),
        nonce: fsrsNonce,
        type: 2,
        maxFeePerGas: ethers.utils.parseUnits('300', 'gwei'),
        maxPriorityFeePerGas: ethers.utils.parseUnits('1', 'gwei')
      };

      const serializedFsrsTx = ethers.utils.serializeTransaction(unsignedFsrsTx);
      const fsrsTxHashToSign = ethers.utils.keccak256(serializedFsrsTx);

      const fsrsSignature = await Lit.Actions.signAndCombineEcdsa({
        toSign: ethers.utils.arrayify(fsrsTxHashToSign),
        publicKey: pkpPublicKey,
        sigName: "fsrsSig",
      });

      const jsonFsrsSignature = JSON.parse(fsrsSignature);
      jsonFsrsSignature.r = jsonFsrsSignature.r.startsWith('0x') ? jsonFsrsSignature.r : '0x' + jsonFsrsSignature.r;
      jsonFsrsSignature.s = jsonFsrsSignature.s.startsWith('0x') ? jsonFsrsSignature.s : '0x' + jsonFsrsSignature.s;
      const hexFsrsSignature = ethers.utils.joinSignature(jsonFsrsSignature);

      const signedFsrsTx = ethers.utils.serializeTransaction(unsignedFsrsTx, hexFsrsSignature);

      fsrsTxHash = await Lit.Actions.runOnce(
        { waitForResponse: false, name: `submitFSRS_${userAddress}_${contentId}_${Date.now()}` },
        async () => {
          try {
            const tx = await provider.sendTransaction(signedFsrsTx);
            return tx.hash;
          } catch (error) {
            return `ERROR: ${error.message}`;
          }
        }
      );
    }

    success = true;

    // ============================================================
    // 5. ANALYTICS (if credentials provided)
    // ============================================================

    if (dbUrlCiphertext && dbTokenCiphertext) {
      try {
        dbEndpoint = await Lit.Actions.decryptAndCombine({
          accessControlConditions: dbUrlAccessControlConditions,
          ciphertext: dbUrlCiphertext,
          dataToEncryptHash: dbUrlDataToEncryptHash,
          authSig: null,
          chain: 'ethereum'
        });

        dbCredentials = await Lit.Actions.decryptAndCombine({
          accessControlConditions: dbTokenAccessControlConditions,
          ciphertext: dbTokenCiphertext,
          dataToEncryptHash: dbTokenDataToEncryptHash,
          authSig: null,
          chain: 'ethereum'
        });

        const analyticsData = {
          timestamp: new Date().toISOString(),
          action: 'study_session_recorded',
          version: 'study_session_recorder_v1',
          success,
          walletAddrHash: walletAddr ? await sha256(walletAddr) : 'anonymous',
          sessionId: sessionIdParam,
          source,
          contentId,
          itemsReviewed,
          averageScore,
          hasFsrs: !!fsrsData,
          sessionTxHash,
          fsrsTxHash,
          executionTimeMs: Date.now() - startTime,
          userAgent: userAgentParam,
          language: languageParam,
          country: userIpCountryParam
        };

        await fetch(dbEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dbCredentials}`,
            'Content-Type': 'application/x-ndjson'
          },
          body: JSON.stringify(analyticsData)
        });
      } catch (analyticsError) {
        console.warn('Analytics failed:', analyticsError.message);
      }
    }

  } catch (error) {
    success = false;
    errorType = error.message || 'UNKNOWN_ERROR';
    console.error('Study session recording failed:', errorType);

    // Log error analytics if possible
    if (dbEndpoint && dbCredentials) {
      try {
        const errorData = {
          timestamp: new Date().toISOString(),
          action: 'study_session_recorded',
          version: 'study_session_recorder_v1',
          success: false,
          error: errorType,
          walletAddrHash: walletAddr ? await sha256(walletAddr) : 'anonymous',
          sessionId: sessionIdParam,
          executionTimeMs: Date.now() - startTime,
          userAgent: userAgentParam,
          language: languageParam,
          country: userIpCountryParam
        };

        await fetch(dbEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dbCredentials}`,
            'Content-Type': 'application/x-ndjson'
          },
          body: JSON.stringify(errorData)
        });
      } catch (analyticsError) {
        console.warn('Error analytics failed:', analyticsError.message);
      }
    }
  }

  // ============================================================
  // 6. RETURN RESPONSE
  // ============================================================

  Lit.Actions.setResponse({
    response: JSON.stringify({
      success,
      version: 'study_session_recorder_v1',
      sessionTxHash,
      fsrsTxHash,
      error: errorType,
      executionTimeMs: Date.now() - startTime
    })
  });
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================
// EXECUTE
// ============================================================

go();
