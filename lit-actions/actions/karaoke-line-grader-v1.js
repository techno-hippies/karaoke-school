/**
 * Karaoke Line Grader v1 - Session-based Single-Line Grading
 *
 * Grades individual karaoke lines within a session for real-time feedback.
 * Uses Levenshtein scoring (no Gemini) for speed and determinism.
 *
 * Contract: KaraokeEvents V3 on Lens Testnet
 * - Address: 0x8f97C17e599bb823e42d936309706628A93B33B8
 * - Trusted PKP: 0x5CF2f231D15F3e71f997AAE0f3037ec3fafa8379
 * - Network: Lens Testnet (Chain ID: 37111)
 *
 * Session Lifecycle:
 * 1. Client starts session: KaraokeSessionStarted event
 * 2. Each line graded: KaraokeLineGraded event (this action)
 * 3. Client ends session: KaraokeSessionEnded event
 *
 * Flow:
 * 1. Receive single line audio (~5-10s, well under 350KB limit)
 * 2. Transcribe via Voxtral STT
 * 3. Calculate score via Levenshtein distance
 * 4. Submit via gradeKaraokeLine() with sessionId
 * 5. Return score immediately for real-time feedback
 */

let ethersLib = globalThis.ethers;
if (!ethersLib) {
  ethersLib = require("ethers");
}
const ethers = ethersLib;

// ============================================================
// CONTRACT CONFIGURATION
// ============================================================
const KARAOKE_EVENTS_ADDRESS = "0x8f97C17e599bb823e42d936309706628A93B33B8";
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC = "https://rpc.testnet.lens.xyz";
const PKP_PUBLIC_KEY = '0x047037fa3f1ba0290880f20afb8a88a8af8a125804a9a3f593ff2a63bf7addd3e2d341e8e3d5a0ef02790ab7e92447e59adeef9915ce5d2c0ee90e0e9ed1b0c5f7';
const DEFAULT_SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v0.0.12";

const VOXTRAL_TIMEOUT_MS = 10000; // Keep short for real-time feedback
const LENS_RPC_TIMEOUT_MS = 10000;

// ============================================================
// MAIN EXECUTION
// ============================================================
const go = async () => {
  const startTime = Date.now();
  const metrics = { phases: [] };
  const markPhase = (phase) => {
    metrics.phase = phase;
    metrics.phases.push({ phase, ms: Date.now() - startTime });
  };

  try {
    const {
      // Session context
      sessionId,           // bytes32: keccak256(performer, clipHash, clientNonce)
      clipHash,            // bytes32: identifies the song clip
      performer,           // address: user's address

      // Line context
      lineIndex,           // uint16: position in song (0-based)

      // Session lifecycle
      expectedLineCount,   // uint16: required if startSession is true
      startSession = true, // boolean: emit KaraokeSessionStarted (default true for first line)
      endSession = false,  // boolean: emit KaraokeSessionEnded
      sessionCompleted = false, // boolean: whether session finished (for end event)

      // Audio data
      audioDataBase64,     // base64: user's recording (~5-10s)
      voxtralEncryptedKey, // encrypted Voxtral API key
      voxtralPlaintextKey, // string: optional dev override (non-production)

      // Metadata / lyrics resolution
      subgraphUrl,         // optional: override subgraph endpoint
      metadataUriOverride, // optional: bypass subgraph and use direct metadata URI
      lyricsOverride,      // optional: array of lines for testing only

      // Optional
      metadataUri,         // string: grove:// URI for metadata (line-level)
      transcriptOverride,  // string: skip STT for testing
      testMode = false,    // boolean: skip external calls
      skipTx = false,      // boolean: skip contract submission
      txDebugStage = null, // string: 'simulate' | 'prepare'
    } = jsParams || {};

    markPhase("init");

    // Validate required params
    if (!sessionId) throw new Error("sessionId is required");
    if (!clipHash) throw new Error("clipHash is required");
    if (!performer) throw new Error("performer is required");
    if (lineIndex === undefined || lineIndex === null) {
      throw new Error("lineIndex is required");
    }

    if (!transcriptOverride && !testMode) {
      if (!audioDataBase64) {
        throw new Error("audioDataBase64 is required");
      }
      if (!voxtralEncryptedKey) {
        throw new Error("voxtralEncryptedKey is required");
      }
    }

    const sessionIdBytes32 = ethers.utils.hexZeroPad(sessionId, 32);
    const clipHashBytes32 = ethers.utils.hexZeroPad(clipHash, 32);

    // Step 1: Resolve lyrics from subgraph/metadata (authoritative)
    markPhase("lyrics-resolve-start");
    const resolvedSubgraphUrl = subgraphUrl || DEFAULT_SUBGRAPH_URL;
    const lyricsLines = await resolveLyricsLines({
      clipHash: clipHashBytes32,
      metadataUriOverride,
      lyricsOverride,
      subgraphUrl: resolvedSubgraphUrl,
    });

    if (!lyricsLines.length) {
      throw new Error("Unable to resolve lyric lines for scoring");
    }
    if (lineIndex < 0 || lineIndex >= lyricsLines.length) {
      throw new Error(`lineIndex ${lineIndex} out of range (0-${lyricsLines.length - 1})`);
    }

    const resolvedExpectedText = lyricsLines[lineIndex]?.text || "";
    if (!resolvedExpectedText || resolvedExpectedText.trim().length === 0) {
      throw new Error("Resolved expectedText is empty for this line");
    }
    const resolvedExpectedLineCount = expectedLineCount || lyricsLines.length;
    markPhase("lyrics-resolve-done");

    // Step 2: Transcribe audio
    markPhase("transcription-start");
    const transcript = transcriptOverride
      ? transcriptOverride
      : await transcribeAudio({
          audioDataBase64,
          voxtralEncryptedKey,
          voxtralPlaintextKey,
          testMode,
          metrics,
        });
    markPhase("transcription-done");

    // Step 3: Calculate Levenshtein score
    markPhase("scoring");
    const scoreBp = calculateLevenshteinScore(transcript, resolvedExpectedText);
    const rating = scoreToRating(scoreBp);
    markPhase("scoring-done");

    // Step 4: Submit to contract
    let startTxHash = null;
    let lineTxHash = null;
    let endTxHash = null;

    if (!testMode && !skipTx) {
      // Optionally start session (idempotent in subgraph; contract just emits event)
      if (startSession) {
        markPhase("tx-start-session");
        startTxHash = await submitStartSessionTx({
          sessionId: sessionIdBytes32,
          clipHash: clipHashBytes32,
          performer,
          expectedLineCount: resolvedExpectedLineCount,
          txDebugStage,
        });
        markPhase("tx-start-session-done");
      }

      // Grade line
      markPhase("tx-line-start");
      lineTxHash = await submitKaraokeLineTx({
        sessionId: sessionIdBytes32,
        lineIndex,
        scoreBp,
        rating,
        metadataUri: metadataUri || "",
        txDebugStage,
      });
      markPhase("tx-line-done");

      // Optionally end session (explicit completion/abandon)
      if (endSession) {
        markPhase("tx-end-session");
        endTxHash = await submitEndSessionTx({
          sessionId: sessionIdBytes32,
          completed: !!sessionCompleted,
          txDebugStage,
        });
        markPhase("tx-end-session-done");
      }
    }

    // Return result
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        version: "karaoke-line-grader-v1",
        sessionId: sessionIdBytes32,
        clipHash: clipHashBytes32,
        performer,
        lineIndex,
        transcript,
        expectedText: resolvedExpectedText,
        scoreBp,
        rating,
        metadataUri: metadataUri || "",
        startTxHash,
        lineTxHash,
        endTxHash,
        executionTime: Date.now() - startTime,
        testMode,
        metrics,
      }),
    });

  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        version: "karaoke-line-grader-v1",
        error: error.message,
        phase: metrics.phase,
        executionTime: Date.now() - startTime,
        metrics,
      }),
    });
  }
};

// ============================================================
// LYRICS RESOLUTION
// ============================================================
async function resolveLyricsLines({ clipHash, metadataUriOverride, lyricsOverride, subgraphUrl }) {
  // Allow explicit overrides for testing
  const overrideLines = normalizeLyricLines(lyricsOverride);
  if (overrideLines.length) return overrideLines;

  let metadataUri = metadataUriOverride || null;

  // Fetch metadata URI from subgraph
  if (!metadataUri && subgraphUrl) {
    const clipId = clipHash.toLowerCase();
    const clip = await fetchClipMetadata(subgraphUrl, clipId);
    metadataUri = clip?.metadataUri || null;
  }

  if (!metadataUri) return [];

  const json = await fetchMetadataJson(metadataUri);
  const candidates =
    json?.full_karaoke_lines ||  // Prefer full lyrics for subscribers
    json?.karaoke_lines ||       // Fallback to clip-only lyrics
    json?.clip_lines ||
    json?.lines ||
    json?.lyrics;

  return normalizeLyricLines(candidates);
}

async function fetchClipMetadata(endpoint, clipId) {
  const query = `
    query ClipById($clipId: ID!) {
      clip(id: $clipId) {
        clipHash
        spotifyTrackId
        metadataUri
      }
    }
  `;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { clipId } }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph fetch failed: ${response.status}`);
  }

  const json = await response.json();
  return json?.data?.clip || null;
}

async function fetchMetadataJson(uri) {
  const resolved = resolveUri(uri);
  const response = await fetch(resolved);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata URI: ${response.status}`);
  }
  return await response.json();
}

function resolveUri(uri) {
  if (!uri) return "";
  if (uri.startsWith("http")) return uri;
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`;
  }
  if (uri.startsWith("grove://")) {
    return `https://api.grove.storage/${uri.replace("grove://", "")}`;
  }
  return uri;
}

function normalizeLyricLines(lines) {
  if (!Array.isArray(lines)) {
    return [];
  }
  return lines
    .map((entry, idx) => ({
      text: entry?.text || entry?.original_text || "",
      startMs: Number(entry?.startMs ?? entry?.start_ms ?? 0),
      endMs: Number(entry?.endMs ?? entry?.end_ms ?? 0),
      index: typeof entry?.index === "number" ? entry.index : idx,
    }))
    .filter((line) => line.text && line.text.trim().length > 0);
}

// ============================================================
// TRANSCRIPTION
// ============================================================
async function transcribeAudio({
  audioDataBase64,
  voxtralEncryptedKey,
  voxtralPlaintextKey,
  testMode,
  metrics,
}) {
  if (testMode) {
    return "Test transcript for line grading.";
  }

  if (metrics) {
    metrics.voxtralRequested = true;
  }
  const started = Date.now();

  // Decrypt API key
  const voxtralKey = voxtralPlaintextKey || await Lit.Actions.decryptAndCombine({
    accessControlConditions: voxtralEncryptedKey.accessControlConditions,
    ciphertext: voxtralEncryptedKey.ciphertext,
    dataToEncryptHash: voxtralEncryptedKey.dataToEncryptHash,
    authSig: null,
    chain: "ethereum",
  });

  // Build multipart form
  const audioBytes = Uint8Array.from(atob(audioDataBase64), (c) =>
    c.charCodeAt(0)
  );

  // Detect audio format from magic bytes
  // WAV: "RIFF" at 0-3 and "WAVE" at 8-11
  // WebM: 0x1A45DFA3 (EBML header)
  const isWav = audioBytes.length >= 12 &&
    audioBytes[0] === 0x52 && audioBytes[1] === 0x49 && // "RI"
    audioBytes[2] === 0x46 && audioBytes[3] === 0x46 && // "FF"
    audioBytes[8] === 0x57 && audioBytes[9] === 0x41 && // "WA"
    audioBytes[10] === 0x56 && audioBytes[11] === 0x45;  // "VE"

  const audioFilename = isWav ? "audio.wav" : "audio.webm";
  const audioContentType = isWav ? "audio/wav" : "audio/webm";

  const boundary = "----LitBoundary" + Math.random().toString(36).substring(2, 10);

  const modelPart = `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nvoxtral-mini-latest\r\n`;
  const filePart = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${audioFilename}"\r\nContent-Type: ${audioContentType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const encoder = new TextEncoder();
  const body = concatUint8Arrays([
    encoder.encode(modelPart),
    encoder.encode(filePart),
    audioBytes,
    encoder.encode(footer),
  ]);

  // Make request with timeout
  const response = await withTimeout(
    fetch("https://api.mistral.ai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${voxtralKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }),
    VOXTRAL_TIMEOUT_MS,
    "Voxtral transcription"
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Voxtral transcription failed: ${response.status} ${errorText.substring(0, 200)}`
    );
  }

  const json = await response.json();
  const transcript = json?.text || json?.transcript || "";
  if (!transcript) {
    throw new Error("Voxtral returned empty transcript");
  }

  if (metrics) {
    metrics.transcriptionMs = Date.now() - started;
  }
  return transcript;
}

// ============================================================
// SCORING
// ============================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate score in basis points (0-10000)
 */
function calculateLevenshteinScore(transcript, expectedText) {
  const normalizedExpected = normalizeText(expectedText);
  const normalizedActual = normalizeText(transcript);

  if (normalizedExpected.length === 0 && normalizedActual.length === 0) {
    return 10000;
  }

  if (normalizedExpected.length === 0 || normalizedActual.length === 0) {
    return 0;
  }

  const distance = levenshteinDistance(normalizedExpected, normalizedActual);
  const maxLength = Math.max(normalizedExpected.length, normalizedActual.length);
  const similarity = 1 - (distance / maxLength);

  return Math.max(0, Math.min(10000, Math.round(similarity * 10000)));
}

/**
 * Convert score to FSRS rating (0-3)
 * 0=Again, 1=Hard, 2=Good, 3=Easy
 */
function scoreToRating(scoreBp) {
  if (scoreBp >= 9000) return 3; // Easy - Excellent
  if (scoreBp >= 7500) return 2; // Good
  if (scoreBp >= 6000) return 1; // Hard
  return 0; // Again - Needs practice
}

// ============================================================
// CONTRACT SUBMISSION
// ============================================================

/**
 * Submit KaraokeLineGraded event to contract
 *
 * Expected contract function:
 * function gradeKaraokeLine(
 *   bytes32 sessionId,
 *   uint16 lineIndex,
 *   uint16 score,
 *   uint8 rating,
 *   string metadataUri
 * ) external;
 */
async function submitKaraokeLineTx({
  sessionId,
  lineIndex,
  scoreBp,
  rating,
  metadataUri,
  txDebugStage,
}) {
  const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);

  // ABI for the line grading function
  const abi = [
    "function gradeKaraokeLine(bytes32 sessionId, uint16 lineIndex, uint16 score, uint8 rating, string metadataUri) external"
  ];

  const iface = new ethers.utils.Interface(abi);

  const txData = iface.encodeFunctionData("gradeKaraokeLine", [
    sessionId,
    ethers.BigNumber.from(lineIndex),
    ethers.BigNumber.from(scoreBp),
    ethers.BigNumber.from(rating),
    String(metadataUri || ""),
  ]);

  const dynamicSigName = `karaokeLineGraderTx_${lineIndex}`;
  return submitZkSyncTransaction(txData, provider, dynamicSigName, txDebugStage);
}

/**
 * Submit start session transaction
 */
async function submitStartSessionTx({
  sessionId,
  clipHash,
  performer,
  expectedLineCount,
  txDebugStage,
}) {
  const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);
  const abi = [
    "function startKaraokeSession(bytes32 sessionId, bytes32 clipHash, address performer, uint16 expectedLineCount) external"
  ];

  const iface = new ethers.utils.Interface(abi);

  const txData = iface.encodeFunctionData("startKaraokeSession", [
    sessionId,
    clipHash,
    ethers.utils.getAddress(performer),
    ethers.BigNumber.from(expectedLineCount),
  ]);

  const dynamicSigName = `karaokeStartSession_${sessionId.slice(0, 10)}`;
  return submitZkSyncTransaction(txData, provider, dynamicSigName, txDebugStage);
}

/**
 * Submit end session transaction
 */
async function submitEndSessionTx({ sessionId, completed, txDebugStage }) {
  const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);
  const abi = [
    "function endKaraokeSession(bytes32 sessionId, bool completed) external"
  ];

  const iface = new ethers.utils.Interface(abi);

  const txData = iface.encodeFunctionData("endKaraokeSession", [
    sessionId,
    completed,
  ]);

  const dynamicSigName = `karaokeEndSession_${sessionId.slice(0, 10)}`;
  return submitZkSyncTransaction(txData, provider, dynamicSigName, txDebugStage);
}

/**
 * Submit zkSync type 0x71 transaction
 */
async function submitZkSyncTransaction(txData, provider, sigName, txDebugStage) {
  const pkpEthAddress = ethers.utils.computeAddress(PKP_PUBLIC_KEY);

  // Simulate first
  try {
    await provider.call({
      from: pkpEthAddress,
      to: KARAOKE_EVENTS_ADDRESS,
      data: txData,
      gasLimit: ethers.utils.hexlify(500000),
      value: '0x0',
    });
  } catch (simError) {
    throw new Error(`Contract simulation failed: ${simError.reason || simError.message}`);
  }

  if (txDebugStage === 'simulate') {
    return 'DEBUG_SIMULATION_OK';
  }

  const nonce = await provider.getTransactionCount(pkpEthAddress, 'pending');
  const feeData = await provider.getFeeData();

  const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.BigNumber.from("3705143562");
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.BigNumber.from(0);
  const gasLimit = 500000;

  const from = ethers.utils.getAddress(pkpEthAddress);
  const to = ethers.utils.getAddress(KARAOKE_EVENTS_ADDRESS);

  // Build EIP-712 hash
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

  const txTypeHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('Transaction(uint256 txType,uint256 from,uint256 to,uint256 gasLimit,uint256 gasPerPubdataByteLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 paymaster,uint256 nonce,uint256 value,bytes data,bytes32[] factoryDeps,bytes paymasterInput)')
  );

  const gasPerPubdataByteLimit = ethers.BigNumber.from(800);

  const structHash = ethers.utils.keccak256(
    ethers.utils.concat([
      txTypeHash,
      ethers.utils.zeroPad(ethers.utils.hexlify(113), 32),
      ethers.utils.zeroPad(from, 32),
      ethers.utils.zeroPad(to, 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(gasLimit), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(gasPerPubdataByteLimit), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(gasPrice), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(maxPriorityFeePerGas), 32),
      ethers.utils.zeroPad('0x00', 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(nonce), 32),
      ethers.utils.zeroPad('0x00', 32),
      ethers.utils.keccak256(txData || '0x'),
      ethers.utils.keccak256('0x'),
      ethers.utils.keccak256('0x')
    ])
  );

  const eip712Hash = ethers.utils.keccak256(
    ethers.utils.concat([
      ethers.utils.toUtf8Bytes('\x19\x01'),
      domainSeparator,
      structHash
    ])
  );

  // Sign
  const toSign = ethers.utils.arrayify(eip712Hash);
  const signature = await Lit.Actions.signAndCombineEcdsa({
    toSign,
    publicKey: PKP_PUBLIC_KEY,
    sigName: sigName || 'karaokeLineGraderTx'
  });

  const jsonSignature = JSON.parse(signature);
  const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
  const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;
  const r = ethers.utils.zeroPad(rHex, 32);
  const s = ethers.utils.zeroPad(sHex, 32);

  let v = jsonSignature.v;
  if (v < 27) v = v + 27;

  // Verify
  const recovered = ethers.utils.recoverAddress(eip712Hash, { r: rHex, s: sHex, v });
  if (recovered.toLowerCase() !== pkpEthAddress.toLowerCase()) {
    throw new Error(`Signature recovery failed: expected ${pkpEthAddress}, got ${recovered}`);
  }

  const yParity = v - 27;

  // Build RLP
  const signedFields = [
    toBeArray(nonce),
    toBeArray(maxPriorityFeePerGas),
    toBeArray(gasPrice),
    toBeArray(gasLimit),
    to || '0x',
    toBeArray(0),
    txData || '0x',
    toBeArray(yParity),
    ethers.utils.arrayify(r),
    ethers.utils.arrayify(s),
    toBeArray(LENS_TESTNET_CHAIN_ID),
    from,
    toBeArray(gasPerPubdataByteLimit),
    [],
    '0x',
    []
  ];

  const signedRlp = ethers.utils.RLP.encode(signedFields);
  const signedTxSerialized = '0x71' + signedRlp.slice(2);

  if (txDebugStage === 'prepare') {
    return JSON.stringify({ stage: 'prepare', nonce: nonce.toString() });
  }

  // Submit
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

  if (response && response.startsWith('TX_SUBMIT_ERROR:')) {
    throw new Error(response);
  }

  return response;
}

// ============================================================
// UTILITIES
// ============================================================

function concatUint8Arrays(chunks) {
  const total = chunks.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function toBeArray(value) {
  if (!value || value === "0" || value === 0) {
    return new Uint8Array([]);
  }
  const hex = ethers.utils.hexlify(value);
  return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
}

// Execute
go().catch((error) => {
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: false,
      version: "karaoke-line-grader-v1",
      error: error.message,
    }),
  });
});
