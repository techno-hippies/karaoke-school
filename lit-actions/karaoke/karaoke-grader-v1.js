let ethersLib = globalThis.ethers;
if (!ethersLib) {
  ethersLib = require("ethers");
}
const ethers = ethersLib;

const KARAOKE_EVENTS_ADDRESS = "0x51aA6987130AA7E4654218859E075D8e790f4409";
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC = "https://rpc.testnet.lens.xyz";
const PKP_PUBLIC_KEY =
  "0x04d44ae02465fdb3feeb2644080afd2323c880e38b858fcb5f8e5551d8e640f58dfb0b056f1bee9c05e08b654c97a439c6e980321a9be78528da979c4f5de91940";

const DEFAULT_SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v0.0.1";
const DEFAULT_GEMINI_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025";

const GRADE_BANDS = [
  { min: 9500, label: "Excellent" },
  { min: 8500, label: "Great" },
  { min: 7500, label: "Good" },
  { min: 6500, label: "OK" },
  { min: 0, label: "Needs work" },
];

const go = async () => {
  const startTime = Date.now();

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
      testMode = false,
    } = jsParams || {};

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

    const transcript = transcriptOverride
      ? transcriptOverride
      : await transcribePerformance({
          audioDataBase64,
          voxtralEncryptedKey,
          testMode,
        });

    const { aggregateScoreBp, lineScores } = await gradeWithGemini({
      transcript,
      lyricsLines,
      openRouterEncryptedKey,
      testMode,
    });

    const similarityScore = aggregateScoreBp;
    const qualitativeGrade = gradeOverride || scoreToGrade(similarityScore);
    const finalMetadataUri = metadataUri || clipMetadata?.metadataUri || "";

    let txHash = null;
    if (!testMode) {
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
      });
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
      }),
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        version: "karaoke-grader-v1",
        error: error.message,
        executionTime: Date.now() - startTime,
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
}) {
  if (testMode) {
    return "Test transcript for karaoke grading.";
  }

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

  const response = await fetch(
    "https://api.mistral.ai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${voxtralKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }
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
  return transcript;
}

async function gradeWithGemini({
  transcript,
  lyricsLines,
  openRouterEncryptedKey,
  testMode,
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
  const body = {
    model: DEFAULT_GEMINI_MODEL,
    response_format: buildStructuredSchema(),
    messages: buildGeminiMessages({ transcript, lyricsLines }),
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

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
      content:
        "You are a karaoke pronunciation grader. Score each lyric line from 0-10000 based on pronunciation accuracy, timing, and clarity. Return structured JSON using the provided schema.",
    },
    {
      role: "user",
      content: `Transcript:\n${transcript}\n\nExpected Lines:\n${expected}`,
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

function scoreToGrade(scoreBp) {
  for (const band of GRADE_BANDS) {
    if (scoreBp >= band.min) {
      return band.label;
    }
  }
  return "Needs work";
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
}) {
  const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);

  const abi = [
    "function gradeKaraokePerformance(uint256 performanceId, bytes32 clipHash, string spotifyTrackId, address performer, string performanceType, uint16 similarityScore, uint16 lineCount, string grade, string metadataUri) external",
  ];

  const contractAddress = ethers.utils.getAddress(KARAOKE_EVENTS_ADDRESS);
  const contract = new ethers.Contract(contractAddress, abi, provider);

  const txData = contract.interface.encodeFunctionData(
    "gradeKaraokePerformance",
    [
      ethers.BigNumber.from(performanceId),
      ethers.utils.hexZeroPad(clipHash, 32),
      spotifyTrackId,
      ethers.utils.getAddress(performer),
      performanceType,
      ethers.BigNumber.from(similarityScore),
      ethers.BigNumber.from(lineCount),
      grade,
      metadataUri || "",
    ]
  );

  return submitZkSyncTransaction(txData, provider);
}

async function submitZkSyncTransaction(txData, provider) {
  const pkpAddress = ethers.utils.getAddress(
    ethers.utils.computeAddress(PKP_PUBLIC_KEY)
  );
  const contractAddress = ethers.utils.getAddress(KARAOKE_EVENTS_ADDRESS);

  try {
    await provider.call({
      from: pkpAddress,
      to: contractAddress,
      data: txData,
      gasLimit: ethers.utils.hexlify(2000000),
      value: "0x0",
    });
    console.log("[karaoke-grader] Contract simulation succeeded");
  } catch (error) {
    throw new Error(
      `Contract simulation failed: ${error.reason || error.message}`
    );
  }

  const nonce = await provider.getTransactionCount(pkpAddress);
  const feeData = await provider.getFeeData();
  const gasPrice =
    feeData.gasPrice ||
    feeData.maxFeePerGas ||
    ethers.BigNumber.from("3705143562");
  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas || ethers.BigNumber.from(0);
  const gasLimit = 500000;
  const gasPerPubdataByteLimit = ethers.BigNumber.from(800);

  const domainSeparator = buildDomainSeparator();
  const structHash = buildStructHash({
    txType: 113,
    from: pkpAddress,
    to: contractAddress,
    gasLimit,
    gasPerPubdataByteLimit,
    maxFeePerGas: gasPrice,
    maxPriorityFeePerGas,
    nonce,
    data: txData,
  });

  console.log("[karaoke-grader] Nonce", nonce);
  console.log("[karaoke-grader] Gas price", gasPrice.toString());
  console.log("[karaoke-grader] Max priority fee", maxPriorityFeePerGas.toString());

  const eip712Hash = ethers.utils.keccak256(
    ethers.utils.concat([
      ethers.utils.toUtf8Bytes("\x19\x01"),
      domainSeparator,
      structHash,
    ])
  );

  const signature = await Lit.Actions.signAndCombineEcdsa({
    toSign: ethers.utils.arrayify(eip712Hash),
    publicKey: PKP_PUBLIC_KEY,
    sigName: "karaokeGraderTx",
  });

  const parsedSignature = JSON.parse(signature);
  const rHex = parsedSignature.r.startsWith("0x")
    ? parsedSignature.r
    : `0x${parsedSignature.r}`;
  const sHex = parsedSignature.s.startsWith("0x")
    ? parsedSignature.s
    : `0x${parsedSignature.s}`;

  // Keep r and s as full 32-byte arrays (DO NOT strip zeros - zkSync requires full length!)
  const r = ethers.utils.zeroPad(rHex, 32);
  const s = ethers.utils.zeroPad(sHex, 32);

  let v = parsedSignature.v < 27 ? parsedSignature.v + 27 : parsedSignature.v;

  const recovered = ethers.utils.recoverAddress(eip712Hash, {
    r: rHex,
    s: sHex,
    v,
  });
  if (recovered.toLowerCase() !== pkpAddress.toLowerCase()) {
    throw new Error("Signature recovery failed");
  }
  console.log("[karaoke-grader] Signature verified for", pkpAddress);

  const yParity = v - 27;

  // Helper: converts number to minimal big-endian bytes
  const toBeArray = (value) => {
    if (!value || value === 0 || value === "0") {
      return new Uint8Array([]);
    }
    const hex = ethers.utils.hexlify(value);
    return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
  };

  const signedFields = [
    toBeArray(nonce),
    toBeArray(maxPriorityFeePerGas),
    toBeArray(gasPrice),
    toBeArray(gasLimit),
    contractAddress,
    toBeArray(0),
    txData || "0x",
    toBeArray(yParity),
    ethers.utils.arrayify(r),
    ethers.utils.arrayify(s),
    toBeArray(LENS_TESTNET_CHAIN_ID),
    pkpAddress,
    toBeArray(gasPerPubdataByteLimit),
    [],
    "0x",
    [],
  ];

  const signedRlp = ethers.utils.RLP.encode(signedFields);
  const serialized = "0x71" + signedRlp.slice(2);
  console.log("[karaoke-grader] Built zkSync type 0x71 transaction");

  const response = await Lit.Actions.runOnce(
    { waitForResponse: true, name: "karaokeTxSender" },
    async () => {
      try {
        return await provider.send("eth_sendRawTransaction", [serialized]);
      } catch (error) {
        return `TX_ERROR:${error.message}`;
      }
    }
  );
  console.log("[karaoke-grader] runOnce/eth_sendRawTransaction finished");

  if (response && response.startsWith("TX_ERROR:")) {
    throw new Error(response.substring("TX_ERROR:".length));
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