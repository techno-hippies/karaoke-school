/**
 * Karaoke Line Grader - Tempo Edition
 *
 * Grades individual karaoke lines with PARALLEL NONCES for concurrent execution.
 * Uses Tempo's 0x76 transaction format with 2D nonces (nonce_key, nonce).
 *
 * Contract: KaraokeEvents on Tempo Testnet
 * - Address: 0xde5128281D0A12808346ba4866D952EDB487BEcC
 * - Trusted PKP: 0x5CF2f231D15F3e71f997AAE0f3037ec3fafa8379
 * - Network: Tempo Testnet (Chain ID: 42429)
 *
 * Key Innovation: Each line uses its own nonce_key, eliminating race conditions.
 * - Line 0 → nonce_key = 1
 * - Line 1 → nonce_key = 2
 * - etc.
 *
 * Session operations (start/end) use protocol nonce (key 0) for sequential ordering.
 */

let ethersLib = globalThis.ethers;
if (!ethersLib) {
  ethersLib = require("ethers");
}
const ethers = ethersLib;

// ============================================================
// CONTRACT CONFIGURATION
// ============================================================
const KARAOKE_EVENTS_ADDRESS = "0xde5128281D0A12808346ba4866D952EDB487BEcC";
const TEMPO_CHAIN_ID = 42429;
const TEMPO_RPC = "https://rpc.testnet.tempo.xyz";
const PKP_PUBLIC_KEY = '0x047037fa3f1ba0290880f20afb8a88a8af8a125804a9a3f593ff2a63bf7addd3e2d341e8e3d5a0ef02790ab7e92447e59adeef9915ce5d2c0ee90e0e9ed1b0c5f7';
const DEFAULT_SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v6-json-localizations";

const VOXTRAL_TIMEOUT_MS = 15000;
const TEMPO_RPC_TIMEOUT_MS = 10000;

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
      sessionId,
      clipHash,
      performer,

      // Line context
      lineIndex,

      // Session lifecycle
      expectedLineCount,
      startSession = true,
      endSession = false,
      sessionCompleted = false,

      // Audio data
      audioDataBase64,
      voxtralEncryptedKey,
      voxtralPlaintextKey,

      // Metadata / lyrics resolution
      subgraphUrl,
      metadataUriOverride,
      lyricsOverride,

      // Optional
      metadataUri,
      transcriptOverride,
      testMode = false,
      skipTx = false,
      txDebugStage = null,
      endOnly = false,
    } = jsParams || {};

    markPhase("init");

    // Validate required params
    if (!sessionId) throw new Error("sessionId is required");
    if (!clipHash) throw new Error("clipHash is required");
    if (!performer) throw new Error("performer is required");

    const sessionIdBytes32 = ethers.utils.hexZeroPad(sessionId, 32);
    const clipHashBytes32 = ethers.utils.hexZeroPad(clipHash, 32);

    // Handle end-only mode
    if (endOnly) {
      markPhase("end-only");
      let endTxHash = null;

      if (!testMode && !skipTx && endSession) {
        markPhase("tx-end-session");
        endTxHash = await submitEndSessionTx({
          sessionId: sessionIdBytes32,
          completed: !!sessionCompleted,
          txDebugStage,
        });
        markPhase("tx-end-session-done");
      }

      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          version: "karaoke-line-grader-tempo",
          sessionId: sessionIdBytes32,
          endOnly: true,
          endTxHash,
          executionTime: Date.now() - startTime,
          metrics,
        }),
      });
      return;
    }

    if (lineIndex === undefined || lineIndex === null) {
      throw new Error("lineIndex is required");
    }

    if (!transcriptOverride && !testMode) {
      if (!audioDataBase64) throw new Error("audioDataBase64 is required");
      if (!voxtralEncryptedKey) throw new Error("voxtralEncryptedKey is required");
    }

    // Step 1: Resolve lyrics
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
    if (!resolvedExpectedText.trim()) {
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

    // Step 3: Calculate score
    markPhase("scoring");
    const scoreBp = calculateLevenshteinScore(transcript, resolvedExpectedText);
    const rating = scoreToRating(scoreBp);
    markPhase("scoring-done");

    // Step 4: Submit transactions
    let startTxHash = null;
    let lineTxHash = null;
    let endTxHash = null;

    if (!testMode && !skipTx) {
      // Start session (uses protocol nonce - key 0)
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

      // Grade line (uses parallel nonce - key = lineIndex + 1)
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

      // End session (uses protocol nonce - key 0)
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

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        version: "karaoke-line-grader-tempo",
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
        version: "karaoke-line-grader-tempo",
        error: error.message,
        phase: metrics.phase,
        executionTime: Date.now() - startTime,
        metrics,
      }),
    });
  }
};

// ============================================================
// LYRICS RESOLUTION (unchanged from v1)
// ============================================================
async function resolveLyricsLines({ clipHash, metadataUriOverride, lyricsOverride, subgraphUrl }) {
  const overrideLines = normalizeLyricLines(lyricsOverride);
  if (overrideLines.length) return overrideLines;

  let metadataUri = metadataUriOverride || null;

  if (!metadataUri && subgraphUrl) {
    const clipId = clipHash.toLowerCase();
    const clip = await fetchClipMetadata(subgraphUrl, clipId);
    metadataUri = clip?.metadataUri || null;
  }

  if (!metadataUri) return [];

  const json = await fetchMetadataJson(metadataUri);
  const candidates =
    json?.full_karaoke_lines ||
    json?.karaoke_lines ||
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
  if (!Array.isArray(lines)) return [];
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
// TRANSCRIPTION (unchanged from v1)
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

  if (metrics) metrics.voxtralRequested = true;
  const started = Date.now();

  const voxtralKey = voxtralPlaintextKey || await Lit.Actions.decryptAndCombine({
    accessControlConditions: voxtralEncryptedKey.accessControlConditions,
    ciphertext: voxtralEncryptedKey.ciphertext,
    dataToEncryptHash: voxtralEncryptedKey.dataToEncryptHash,
    authSig: null,
    chain: "ethereum",
  });

  const audioBytes = Uint8Array.from(atob(audioDataBase64), (c) => c.charCodeAt(0));

  const isWav = audioBytes.length >= 12 &&
    audioBytes[0] === 0x52 && audioBytes[1] === 0x49 &&
    audioBytes[2] === 0x46 && audioBytes[3] === 0x46 &&
    audioBytes[8] === 0x57 && audioBytes[9] === 0x41 &&
    audioBytes[10] === 0x56 && audioBytes[11] === 0x45;

  const audioFilename = isWav ? "audio.wav" : "audio.webm";
  const audioContentType = isWav ? "audio/wav" : "audio/webm";

  const boundary = "----LitBoundary" + Math.random().toString(36).substring(2, 10);

  const audioPart = `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="${audioFilename}"\r\nContent-Type: ${audioContentType}\r\n\r\n`;
  const languagePart = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nen\r\n`;
  const footer = `--${boundary}--\r\n`;

  const encoder = new TextEncoder();
  const body = concatUint8Arrays([
    encoder.encode(audioPart),
    audioBytes,
    encoder.encode(languagePart),
    encoder.encode(footer),
  ]);

  const response = await withTimeout(
    fetch("https://api.deepinfra.com/v1/inference/mistralai/Voxtral-Small-24B-2507", {
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
    throw new Error(`Voxtral transcription failed: ${response.status} ${errorText.substring(0, 200)}`);
  }

  const json = await response.json();
  const transcript = json?.text || json?.transcript || "";
  if (!transcript) {
    throw new Error("Voxtral returned empty transcript");
  }

  if (metrics) metrics.transcriptionMs = Date.now() - started;
  return transcript;
}

// ============================================================
// SCORING (unchanged from v1)
// ============================================================
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

function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateLevenshteinScore(transcript, expectedText) {
  const normalizedExpected = normalizeText(expectedText);
  const normalizedActual = normalizeText(transcript);

  if (normalizedExpected.length === 0 && normalizedActual.length === 0) {
    return 10000;
  }

  if (normalizedExpected.length === 0 || normalizedActual.length === 0) {
    return 0;
  }

  if (normalizedActual.includes(normalizedExpected)) {
    return 10000;
  }

  const expectedWords = normalizedExpected.split(' ');
  const actualWords = normalizedActual.split(' ');

  if (actualWords.length >= expectedWords.length) {
    let bestScore = 0;
    for (let i = 0; i <= actualWords.length - expectedWords.length; i++) {
      const window = actualWords.slice(i, i + expectedWords.length).join(' ');
      const distance = levenshteinDistance(normalizedExpected, window);
      const similarity = 1 - (distance / Math.max(normalizedExpected.length, window.length));
      const score = Math.round(similarity * 10000);
      if (score > bestScore) {
        bestScore = score;
      }
    }
    if (bestScore > 7000) {
      return Math.min(bestScore, 9800);
    }
  }

  const distance = levenshteinDistance(normalizedExpected, normalizedActual);
  const maxLength = Math.max(normalizedExpected.length, normalizedActual.length);
  const similarity = 1 - (distance / maxLength);

  return Math.max(0, Math.min(10000, Math.round(similarity * 10000)));
}

function scoreToRating(scoreBp) {
  if (scoreBp >= 9000) return 3;
  if (scoreBp >= 7500) return 2;
  if (scoreBp >= 6000) return 1;
  return 0;
}

// ============================================================
// TEMPO TRANSACTION SUBMISSION
// ============================================================

/**
 * Submit line grading with PARALLEL NONCE (key = lineIndex + 1)
 */
async function submitKaraokeLineTx({
  sessionId,
  lineIndex,
  scoreBp,
  rating,
  metadataUri,
  txDebugStage,
}) {
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

  // PARALLEL NONCE: Each line gets its own nonce key!
  const nonceKey = lineIndex + 1;
  const nonce = 0; // First tx in this key's sequence

  const sigName = `tempoLineTx_${lineIndex}`;
  return submitTempoTransaction(txData, nonceKey, nonce, sigName, txDebugStage);
}

/**
 * Submit start session with PROTOCOL NONCE (key = 0)
 */
async function submitStartSessionTx({
  sessionId,
  clipHash,
  performer,
  expectedLineCount,
  txDebugStage,
}) {
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

  // PROTOCOL NONCE: Sequential for session operations
  const nonceKey = 0;
  const nonce = await fetchProtocolNonce();

  const sigName = `tempoStartSession_${sessionId.slice(0, 10)}`;
  return submitTempoTransaction(txData, nonceKey, nonce, sigName, txDebugStage);
}

/**
 * Submit end session with PROTOCOL NONCE (key = 0)
 */
async function submitEndSessionTx({ sessionId, completed, txDebugStage }) {
  const abi = [
    "function endKaraokeSession(bytes32 sessionId, bool completed) external"
  ];

  const iface = new ethers.utils.Interface(abi);

  const txData = iface.encodeFunctionData("endKaraokeSession", [
    sessionId,
    completed,
  ]);

  // PROTOCOL NONCE: Sequential for session operations
  const nonceKey = 0;
  const nonce = await fetchProtocolNonce();

  const sigName = `tempoEndSession_${sessionId.slice(0, 10)}`;
  return submitTempoTransaction(txData, nonceKey, nonce, sigName, txDebugStage);
}

/**
 * Fetch protocol nonce (key 0) from chain
 */
async function fetchProtocolNonce() {
  const provider = new ethers.providers.JsonRpcProvider(TEMPO_RPC);
  const pkpAddress = ethers.utils.computeAddress(PKP_PUBLIC_KEY);
  return await provider.getTransactionCount(pkpAddress, 'pending');
}

/**
 * Build and submit Tempo 0x76 transaction
 */
async function submitTempoTransaction(txData, nonceKey, nonce, sigName, txDebugStage) {
  const provider = new ethers.providers.JsonRpcProvider(TEMPO_RPC);
  const pkpAddress = ethers.utils.computeAddress(PKP_PUBLIC_KEY);

  // Simulate first
  try {
    await provider.call({
      from: pkpAddress,
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

  // Get fee data
  const feeData = await provider.getFeeData();
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.BigNumber.from(1_000_000_000);
  const maxFeePerGas = feeData.maxFeePerGas || ethers.BigNumber.from(10_000_000_000);
  const gasLimit = 500000;

  // Build unsigned transaction fields
  const unsignedFields = [
    toBeArray(TEMPO_CHAIN_ID),                    // chain_id
    toBeArray(maxPriorityFeePerGas),              // max_priority_fee_per_gas
    toBeArray(maxFeePerGas),                      // max_fee_per_gas
    toBeArray(gasLimit),                          // gas_limit
    [[KARAOKE_EVENTS_ADDRESS, toBeArray(0), txData]], // calls: [[to, value, data]]
    [],                                           // access_list
    toBeArray(nonceKey),                          // nonce_key (parallel!)
    toBeArray(nonce),                             // nonce
    new Uint8Array([]),                           // valid_before (none)
    new Uint8Array([]),                           // valid_after (none)
    new Uint8Array([]),                           // fee_token (none)
    new Uint8Array([]),                           // fee_payer_signature (none)
    [],                                           // aa_authorization_list
  ];

  // Compute signing hash: keccak256(0x76 || rlp(unsigned))
  const unsignedRlp = ethers.utils.RLP.encode(unsignedFields);
  const signingPayload = ethers.utils.concat(['0x76', unsignedRlp]);
  const signingHash = ethers.utils.keccak256(signingPayload);

  if (txDebugStage === 'prepare') {
    return JSON.stringify({ stage: 'prepare', nonceKey, nonce, signingHash });
  }

  // Sign with PKP
  const toSign = ethers.utils.arrayify(signingHash);
  const signature = await Lit.Actions.signAndCombineEcdsa({
    toSign,
    publicKey: PKP_PUBLIC_KEY,
    sigName: sigName || 'tempoTx',
  });

  const jsonSignature = JSON.parse(signature);
  const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
  const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

  // Verify signature
  const recovered = ethers.utils.recoverAddress(signingHash, { r: rHex, s: sHex, v: jsonSignature.v });
  if (recovered.toLowerCase() !== pkpAddress.toLowerCase()) {
    throw new Error(`Signature recovery failed: expected ${pkpAddress}, got ${recovered}`);
  }

  // Build 65-byte signature: r(32) + s(32) + v(1)
  // v is recovery id: 0 or 1 (not 27 or 28)
  const recoveryId = jsonSignature.v >= 27 ? jsonSignature.v - 27 : jsonSignature.v;
  const sig65 = ethers.utils.concat([
    ethers.utils.zeroPad(rHex, 32),
    ethers.utils.zeroPad(sHex, 32),
    [recoveryId],
  ]);

  // Build signed transaction
  const signedFields = [...unsignedFields, sig65];
  const signedRlp = ethers.utils.RLP.encode(signedFields);
  const signedTx = '0x76' + signedRlp.slice(2);

  // Submit
  const txHash = await Lit.Actions.runOnce(
    { waitForResponse: true, name: "txSender" },
    async () => {
      try {
        return await provider.send("eth_sendRawTransaction", [signedTx]);
      } catch (error) {
        return `TX_SUBMIT_ERROR: ${error.message}`;
      }
    }
  );

  if (txHash && txHash.startsWith('TX_SUBMIT_ERROR:')) {
    throw new Error(txHash);
  }

  return txHash;
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
      version: "karaoke-line-grader-tempo",
      error: error.message,
    }),
  });
});
