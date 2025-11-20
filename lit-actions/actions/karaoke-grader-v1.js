let ethersLib = globalThis.ethers;
if (!ethersLib) {
  ethersLib = require("ethers");
}
const ethers = ethersLib;

const KARAOKE_EVENTS_ADDRESS = "0x51aA6987130AA7E4654218859E075D8e790f4409";
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC = "https://rpc.testnet.lens.xyz";
const PKP_PUBLIC_KEY = '0x047ae2744a82e4ca8bd9bb499ffb46b98c2f2aba81f41de1e521256300ba05d9e191ef116520daa845af42bcf58d868c60881b689f9cb4b5499565a18f9d69991e';

const DEFAULT_SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v0.0.2";
const DEFAULT_GEMINI_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_REFERER = "https://karaoke.school";
const OPENROUTER_APP_TITLE = "Karaoke School Grader";
const GEMINI_TIMEOUT_MS = 12_000; // Keep under Lit 30s wall-clock
const VOXTRAL_TIMEOUT_MS = 12_000;
const LENS_RPC_TIMEOUT_MS = 12_000;

const GRADE_BANDS = [
  { min: 9500, label: "Excellent" },
  { min: 8500, label: "Great" },
  { min: 7500, label: "Good" },
  { min: 6500, label: "OK" },
  { min: 0, label: "Needs work" },
];

const go = async () => {
  const startTime = Date.now();
  const metrics = { phases: [] };
  const markPhase = (phase) => {
    metrics.phase = phase;
    metrics.phases.push({ phase, ms: Date.now() - startTime });
  };

  try {
    const {
      performanceId,
      clipHash,
      spotifyTrackId,
      performer,
      audioDataBase64,
      voxtralEncryptedKey,
      openRouterEncryptedKey,
      performanceType = "CLIP",
      isFullSong = false,
      subgraphUrl,
      clipMetadataOverride,
      transcriptOverride,
      lyricsOverride,
      metadataUri,
      gradeOverride,
      nonceOverride, // Allow client to enforce deterministic nonce
      testMode = false,
      skipTx = false,
      txDebugStage = null,
      skipGemini = false,
      forceGeminiFallback = false,
    } = jsParams || {};

    markPhase("init");

    if (!performanceId) throw new Error("performanceId is required");
    if (!clipHash) throw new Error("clipHash is required");
    if (!performer) throw new Error("performer is required");

    if (!transcriptOverride && !testMode) {
      if (!audioDataBase64) {
        throw new Error("audioDataBase64 is required");
      }
      if (!voxtralEncryptedKey) {
        throw new Error("voxtralEncryptedKey is required");
      }
    }

    if (!openRouterEncryptedKey && !testMode) {
      throw new Error("openRouterEncryptedKey is required");
    }

    const clipHashBytes32 = ethers.utils.hexZeroPad(clipHash, 32);
    const resolvedSubgraphUrl = subgraphUrl || DEFAULT_SUBGRAPH_URL;

    let clipMetadata = clipMetadataOverride || null;
    if (!clipMetadata && resolvedSubgraphUrl) {
      clipMetadata = await fetchClipMetadata(
        resolvedSubgraphUrl,
        clipHashBytes32.toLowerCase()
      );
    }

    const resolvedSpotifyTrackId =
      spotifyTrackId || clipMetadata?.spotifyTrackId || null;
    if (!resolvedSpotifyTrackId) {
      throw new Error(
        "spotifyTrackId is required (pass directly or ensure clip exists in subgraph)"
      );
    }

    const lyricsLines = await resolveLyricsLines({
      clipMetadata,
      lyricsOverride,
    });
    if (!lyricsLines.length) {
      throw new Error("Unable to resolve lyric lines for scoring");
    }

    const transcriptStart = Date.now();
    markPhase("transcription-start");
    const transcript = transcriptOverride
      ? transcriptOverride
      : await transcribePerformance({
          audioDataBase64,
          voxtralEncryptedKey,
          testMode,
          metrics,
        });
    
    markPhase("transcription-done");
    let aggregateScoreBp = 0;
    let lineScores = [];

    if (skipGemini || forceGeminiFallback) {
      aggregateScoreBp = 9000;
      lineScores = lyricsLines.map((line) => ({
        lineIndex: line.index,
        expectedText: line.text,
        transcriptExcerpt: transcript.slice(0, 80),
        scoreBp: 9000,
        feedback: skipGemini ? "Skipped Gemini (debug)" : "Gemini forced fallback",
      }));
      metrics.skipGemini = true;
      if (forceGeminiFallback) metrics.geminiForcedFallback = true;
    } else {
      const geminiResult = await gradeWithGemini({
        transcript,
        lyricsLines,
        openRouterEncryptedKey,
        testMode,
        metrics,
      });
      aggregateScoreBp = geminiResult.aggregateScoreBp;
      lineScores = geminiResult.lineScores;
    }
    const aiResult = { transcript, aggregateScoreBp, lineScores };

    metrics.aiMs = Date.now() - transcriptStart; // Full AI time (transcription + scoring)

    const similarityScore = aggregateScoreBp;
    const qualitativeGrade = gradeOverride || scoreToGrade(similarityScore);
    const finalMetadataUri = metadataUri || clipMetadata?.metadataUri || "";

    let txHash = null;
    if (!testMode && !skipTx) {
      const txStart = Date.now();
      txHash = await submitKaraokeTx({
        performanceId,
        clipHash: clipHashBytes32,
        spotifyTrackId: resolvedSpotifyTrackId,
        performer,
        performanceType: isFullSong ? "FULL_SONG" : performanceType,
        similarityScore,
        lineCount: lineScores.length,
        grade: qualitativeGrade,
        metadataUri: finalMetadataUri,
        txDebugStage,
      });
      metrics.txMs = Date.now() - txStart;
    }

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        version: "karaoke-grader-v1",
        performanceId: performanceId.toString(),
        clipHash: clipHashBytes32,
        spotifyTrackId: resolvedSpotifyTrackId,
        performer,
        performanceType: isFullSong ? "FULL_SONG" : performanceType,
        similarityScore,
        grade: qualitativeGrade,
        lineCount: lineScores.length,
        metadataUri: finalMetadataUri,
        txHash,
        executionTime: Date.now() - startTime,
        testMode,
        metrics,
      }),
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        version: "karaoke-grader-v1",
        error: error.message,
        phase: metrics.phase,
        executionTime: Date.now() - startTime,
        metrics,
      }),
    });
  }
};

async function fetchClipMetadata(endpoint, clipId) {
  if (!endpoint) {
    return null;
  }

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

async function resolveLyricsLines({ clipMetadata, lyricsOverride }) {
  const normalizedOverride = normalizeLyricLines(lyricsOverride);
  if (normalizedOverride.length) {
    return normalizedOverride;
  }

  const metadataUri = clipMetadata?.metadataUri;
  if (!metadataUri) {
    return [];
  }

  const json = await fetchMetadataJson(metadataUri);
  const candidates =
    json?.clip_lines || json?.karaoke_lines || json?.lines || json?.lyrics;
  return normalizeLyricLines(candidates);
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
      index: idx,
    }))
    .filter((line) => line.text && line.text.trim().length > 0);
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
  if (uri.startsWith("http")) {
    return uri;
  }
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`;
  }
  if (uri.startsWith("grove://")) {
    return `https://api.grove.storage/${uri.replace("grove://", "")}`;
  }
  return uri;
}

async function transcribePerformance({
  audioDataBase64,
  voxtralEncryptedKey,
  testMode,
  metrics,
}) {
  if (testMode) {
    return "Test transcript for karaoke grading.";
  }

  if (metrics) {
    metrics.voxtralRequested = true;
  }
  const started = Date.now();

  const voxtralKey = await decryptGenericKey(voxtralEncryptedKey);
  const audioBytes = Uint8Array.from(atob(audioDataBase64), (c) =>
    c.charCodeAt(0)
  );
  const boundary =
    "----LitBoundary" + Math.random().toString(36).substring(2, 10);

  const modelPart = `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nvoxtral-mini-latest\r\n`;
  const filePart = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const encoder = new TextEncoder();
  const body = concatUint8Arrays([
    encoder.encode(modelPart),
    encoder.encode(filePart),
    audioBytes,
    encoder.encode(footer),
  ]);

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
      `Voxtral transcription failed: ${response.status} ${errorText.substring(
        0,
        200
      )}`
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

async function gradeWithGemini({
  transcript,
  lyricsLines,
  openRouterEncryptedKey,
  testMode,
  metrics,
}) {
  if (testMode) {
    return {
      aggregateScoreBp: 9800,
      lineScores: lyricsLines.map((line) => ({
        lineIndex: line.index,
        expectedText: line.text,
        transcriptExcerpt: transcript.slice(0, 80),
        scoreBp: 9800,
        feedback: "Test grade",
      })),
    };
  }

  const apiKey = await decryptGenericKey(openRouterEncryptedKey);
  if (metrics) {
    metrics.geminiRequested = true;
  }
  const started = Date.now();

  const requestPromise = fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": OPENROUTER_APP_TITLE,
    },
    body: JSON.stringify({
      model: DEFAULT_GEMINI_MODEL,
      response_format: buildStructuredSchema(),
      messages: buildGeminiMessages({ transcript, lyricsLines }),
    }),
  });

  let response;
  try {
    response = await withTimeout(
      requestPromise,
      GEMINI_TIMEOUT_MS,
      "Gemini scoring request"
    );
  } catch (err) {
    // Fallback: return deterministic scores if Gemini is unavailable
    if (metrics) {
      metrics.geminiTimeout = true;
      metrics.geminiMs = Date.now() - started;
      metrics.geminiError = err?.message || "unknown";
    }
    return {
      aggregateScoreBp: 8000,
      lineScores: lyricsLines.map((line) => ({
        lineIndex: line.index,
        expectedText: line.text,
        transcriptExcerpt: transcript.slice(0, 80),
        scoreBp: 8000,
        feedback: "Gemini fallback (timeout)",
      })),
    };
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Gemini scoring failed: ${response.status} ${errorBody.substring(0, 200)}`
    );
  }

  const json = await response.json();
  const structuredText = extractGeminiText(json);
  if (!structuredText) {
    throw new Error("Gemini response missing structured payload");
  }

  const parsed = parseStructuredGeminiJson(structuredText);
  if (!parsed) {
    throw new Error("Gemini response is not valid JSON");
  }

  if (typeof parsed.aggregateScoreBp !== "number" || !parsed.lines) {
    throw new Error("Gemini response missing aggregateScoreBp or lines");
  }
  if (metrics) {
    metrics.geminiMs = Date.now() - started;
  }

  return {
    aggregateScoreBp: parsed.aggregateScoreBp,
    lineScores: parsed.lines,
  };
}

function extractGeminiText(responseJson) {
  if (!responseJson) return null;
  const choice = responseJson.choices?.[0];
  if (!choice) return null;

  const probe = (value) => {
    if (!value) return null;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      for (const part of value) {
        const found =
          probe(part?.text) ||
          probe(part?.output_text) ||
          probe(part?.content) ||
          (typeof part === "string" ? part : null);
        if (found) return found;
      }
    }
    if (typeof value === "object") {
      return (
        probe(value.content) ||
        probe(value.parts) ||
        (typeof value.text === "string" ? value.text : null)
      );
    }
    return null;
  };

  return (
    probe(choice.message?.content) ||
    probe(choice.message?.parts) ||
    probe(choice.message) ||
    probe(choice.content) ||
    probe(choice.parts) ||
    null
  );
}

function parseStructuredGeminiJson(rawText) {
  if (!rawText) return null;
  let sanitized = rawText.trim();
  if (sanitized.startsWith("```")) {
    sanitized = sanitized.replace(/^```(?:json)?/i, "").replace(/```$/i, "");
  }
  sanitized = sanitized.trim();
  const tryParse = (text) => {
    try {
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  };

  let parsed = tryParse(sanitized);
  if (parsed) {
    return parsed;
  }

  const firstBrace = sanitized.indexOf("{");
  const lastBrace = sanitized.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const sliced = sanitized.slice(firstBrace, lastBrace + 1);
    parsed = tryParse(sliced);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function buildStructuredSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: "karaoke_grade",
      schema: {
        type: "object",
        properties: {
          aggregateScoreBp: { type: "integer", minimum: 0, maximum: 10000 },
          lines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                lineIndex: { type: "integer" },
                expectedText: { type: "string" },
                transcriptExcerpt: { type: "string" },
                scoreBp: { type: "integer", minimum: 0, maximum: 10000 },
                feedback: { type: "string" },
              },
              required: [
                "lineIndex",
                "expectedText",
                "transcriptExcerpt",
                "scoreBp",
                "feedback",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["aggregateScoreBp", "lines"],
        additionalProperties: false,
      },
    },
  };
}

function buildGeminiMessages({ transcript, lyricsLines }) {
  const expected = lyricsLines
    .map((line, idx) => `${idx + 1}. ${line.text}`)
    .join("\n");

  return [
    {
      role: "system",
      content: [
        {
          type: "text",
          text:
            "You are a karaoke pronunciation grader. Score each lyric line from 0-10000 based on pronunciation accuracy, timing, and clarity. Return structured JSON using the provided schema.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Transcript:\n${transcript}\n\nExpected Lines:\n${expected}`,
        },
      ],
    },
  ];
}

async function decryptGenericKey(encrypted) {
  if (!encrypted || !encrypted.ciphertext) {
    throw new Error("Encrypted key payload missing ciphertext");
  }
  return await Lit.Actions.decryptAndCombine({
    accessControlConditions: encrypted.accessControlConditions,
    ciphertext: encrypted.ciphertext,
    dataToEncryptHash: encrypted.dataToEncryptHash,
    authSig: null,
    chain: "ethereum",
  });
}

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

async function jsonRpcRequest(method, params, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LENS_RPC_TIMEOUT_MS);
  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  };

  try {
    const response = await fetch(LENS_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `${label} HTTP ${response.status}: ${text.slice(0, 200)}`
      );
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(
        `${label} RPC error: ${json.error.message || json.error.code}`
      );
    }

    return json.result;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${label} timed out after ${LENS_RPC_TIMEOUT_MS}ms`);
    }
    throw new Error(`${label} failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function scoreToGrade(scoreBp) {
  for (const band of GRADE_BANDS) {
    if (scoreBp >= band.min) {
      return band.label;
    }
  }
  return "Needs work";
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${ms}ms`));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function submitKaraokeTx({
  performanceId,
  clipHash,
  spotifyTrackId,
  performer,
  performanceType,
  similarityScore,
  lineCount,
  grade,
  metadataUri,
  txDebugStage,
  nonceOverride,
}) {
  const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);
  const abi = [
    "function gradeKaraokePerformance(uint256 performanceId, bytes32 clipHash, string spotifyTrackId, address performer, string performanceType, uint16 similarityScore, uint16 lineCount, string grade, string metadataUri) external",
  ];

  const contractAddress = ethers.utils.getAddress(KARAOKE_EVENTS_ADDRESS);
  const iface = new ethers.utils.Interface(abi);

  const txData = iface.encodeFunctionData(
    "gradeKaraokePerformance",
    [
      ethers.BigNumber.from(performanceId),
      ethers.utils.hexZeroPad(clipHash, 32),
      String(spotifyTrackId), // Restore real ID
      ethers.utils.getAddress(performer),
      String(performanceType),
      ethers.BigNumber.from(similarityScore),
      ethers.BigNumber.from(lineCount),
      String(grade),
      String(metadataUri || ""),
    ]
  );

  // Use dynamic sigName to avoid any potential caching/nonce issues
  const dynamicSigName = `karaokeGraderTx_${performanceId}`;
  return submitZkSyncTransaction(txData, provider, dynamicSigName, nonceOverride);
}

/**
 * Submit zkSync type 0x71 transaction (16-field RLP encoding)
 * CRITICAL: This is the working pattern from say-it-back-v1.js - DO NOT MODIFY
 */
async function submitZkSyncTransaction(txData, provider, sigName, nonceOverride) {
  // Get PKP address
  const pkpEthAddress = ethers.utils.computeAddress(PKP_PUBLIC_KEY);

  // Simulate the call to catch revert reason BEFORE signing
  try {
    const simResult = await provider.call({
      from: pkpEthAddress,
      to: KARAOKE_EVENTS_ADDRESS,
      data: txData,
      gasLimit: ethers.utils.hexlify(2000000),
      value: '0x0',
    });
    console.log(' Simulation succeeded:', simResult);
  } catch (simError) {
    console.error('L Simulation failed with reason:', simError.reason || simError.message || simError);
    throw new Error(`Contract simulation failed: ${simError.reason || simError.message}`);
  }

  const nonce = typeof nonceOverride !== 'undefined' && nonceOverride !== null
    ? ethers.BigNumber.from(nonceOverride)
    : await provider.getTransactionCount(pkpEthAddress);
  const feeData = await provider.getFeeData();

  // Use fee data from provider
  const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.BigNumber.from("3705143562");
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.BigNumber.from(0);
  const gasLimit = 2000000; // Conservative limit

  console.log('Building EIP-1559 transaction...');
  console.log('Nonce:', nonce.toString());
  console.log('Gas price:', gasPrice.toString());

  // Normalize addresses (checksummed format for RLP encoding)
  const from = ethers.utils.getAddress(pkpEthAddress);
  const to = ethers.utils.getAddress(KARAOKE_EVENTS_ADDRESS);

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
    sigName: sigName || 'karaokeGraderTx_v1'
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

function buildDomainSeparator() {
  const domainTypeHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(
      "EIP712Domain(string name,string version,uint256 chainId)"
    )
  );
  const nameHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("zkSync"));
  const versionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("2"));

  return ethers.utils.keccak256(
    ethers.utils.concat([
      domainTypeHash,
      nameHash,
      versionHash,
      ethers.utils.zeroPad(ethers.utils.hexlify(LENS_TESTNET_CHAIN_ID), 32),
    ])
  );
}

function buildStructHash({
  txType,
  from,
  to,
  gasLimit,
  gasPerPubdataByteLimit,
  maxFeePerGas,
  maxPriorityFeePerGas,
  nonce,
  data,
}) {
  const txTypeHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(
      "Transaction(uint256 txType,uint256 from,uint256 to,uint256 gasLimit,uint256 gasPerPubdataByteLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 paymaster,uint256 nonce,uint256 value,bytes data,bytes32[] factoryDeps,bytes paymasterInput)"
    )
  );

  return ethers.utils.keccak256(
    ethers.utils.concat([
      txTypeHash,
      ethers.utils.zeroPad(ethers.utils.hexlify(txType), 32),
      ethers.utils.zeroPad(ethers.utils.getAddress(from), 32),
      ethers.utils.zeroPad(ethers.utils.getAddress(to), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(gasLimit), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(gasPerPubdataByteLimit), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(maxFeePerGas), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(maxPriorityFeePerGas), 32),
      ethers.utils.zeroPad("0x00", 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(nonce), 32),
      ethers.utils.zeroPad("0x00", 32),
      ethers.utils.keccak256(data || "0x"),
      ethers.utils.keccak256("0x"),
      ethers.utils.keccak256("0x"),
    ])
  );
}

function toBeArray(value) {
  if (!value || value === "0" || value === 0) {
    return new Uint8Array([]);
  }
  const hex = ethers.utils.hexlify(value);
  return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
}


go().catch((error) => {
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: false,
      version: "karaoke-grader-v1",
      error: error.message,
    }),
  });
});
