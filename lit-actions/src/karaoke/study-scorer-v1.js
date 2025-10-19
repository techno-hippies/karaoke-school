/**
 * Study Scorer v1: Audio Transcription + FSRS Spaced Repetition
 *
 * SECURITY: System PKP credentials hardcoded in IPFS code (can't be spoofed)
 *
 * Single Lit Action that:
 * 1. Transcribes user audio via Voxstral API
 * 2. Calculates pronunciation scores (Levenshtein distance)
 * 3. Runs FSRS-4.5 algorithm for spaced repetition
 * 4. Writes card states to FSRSTrackerV1 contract using SYSTEM PKP
 * 5. Returns structured JSON with scores + txHash
 *
 * Time: ~2-5s (transcription + tx)
 * Cost: ~$0.0001 (Voxstral API + gas on Base)
 */

// Hardcoded system PKP credentials (deployed as trustedPKP on FSRSTrackerV1)
const SYSTEM_PKP = {
  publicKey: '043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939',
  address: '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30',
  tokenId: '18495970405190900970517221272825216094387884724482470185691150662171839015831'
};

console.log('=== LIT ACTION study-scorer-v1 LOADED ===');
console.log('Lit Actions API available:', typeof Lit !== 'undefined');
console.log('ethers available:', typeof ethers !== 'undefined');

// ============================================================
// FSRS-4.5 ALGORITHM (Inlined)
// ============================================================

const CardState = { New: 0, Learning: 1, Review: 2, Relearning: 3 };
const Rating = { Again: 0, Hard: 1, Good: 2, Easy: 3 };

const FSRS_PARAMS = {
  requestRetention: 0.9,
  maximumInterval: 36500,
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]
};

const MIN_STABILITY = 0.01;
const DEFAULT_DIFFICULTY = 5.0;
const MIN_DIFFICULTY = 1.0;
const MAX_DIFFICULTY = 10.0;
const LEARNING_STEPS = [1, 10]; // minutes
const GRADUATING_INTERVAL = 1; // days
const EASY_INTERVAL = 4; // days
const RELEARNING_STEPS = [10]; // minutes
const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;

function initCard() {
  return {
    due: 0,
    stability: 0,
    difficulty: DEFAULT_DIFFICULTY,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: CardState.New,
    lastReview: 0
  };
}

function calculateRetrievability(elapsedDays, stability) {
  if (stability < MIN_STABILITY) stability = MIN_STABILITY;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
}

function calculateInterval(stability, desiredRetention = FSRS_PARAMS.requestRetention) {
  if (stability < MIN_STABILITY) stability = MIN_STABILITY;
  const interval = (stability / FACTOR) * (Math.pow(desiredRetention, 1 / DECAY) - 1);
  return Math.max(1, Math.min(FSRS_PARAMS.maximumInterval, Math.round(interval)));
}

function initialStability(rating) {
  return Math.max(MIN_STABILITY, FSRS_PARAMS.w[rating]);
}

function initialDifficulty(rating) {
  if (rating === Rating.Again) rating = Rating.Hard;
  const difficulty = FSRS_PARAMS.w[4] - FSRS_PARAMS.w[5] * (rating - 2);
  return Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, difficulty));
}

function updateDifficulty(currentDifficulty, rating) {
  const ratingScale = rating + 1;
  const difficultyChange = FSRS_PARAMS.w[6] * (ratingScale - 2.5);
  const newDifficulty = currentDifficulty - difficultyChange;
  return Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, newDifficulty));
}

function updateStabilityLearning(card, rating) {
  const { stability } = card;
  if (rating === Rating.Again) return initialStability(rating);
  const newStability = stability * Math.exp(FSRS_PARAMS.w[8] * (rating - 3 + FSRS_PARAMS.w[9]));
  return Math.max(MIN_STABILITY, newStability);
}

function updateStabilityReview(card, rating, retrievability) {
  const w = FSRS_PARAMS.w;
  const { stability, difficulty } = card;

  if (rating === Rating.Again) {
    const newStability = w[10] * Math.pow(difficulty, -w[11]) *
                        (Math.pow(stability + 1, w[12]) - 1) *
                        Math.exp(w[13] * (1 - retrievability));
    return Math.max(MIN_STABILITY, newStability);
  }

  const baseIncrease = stability * (1 + Math.exp(w[14]) *
                      (11 - difficulty) *
                      Math.pow(stability, -w[15]) *
                      (Math.exp((1 - retrievability) * w[16]) - 1));

  if (rating === Rating.Easy) {
    return Math.max(MIN_STABILITY, baseIncrease * 1.3); // 30% bonus for Easy
  }

  return Math.max(MIN_STABILITY, baseIncrease);
}

function nextCardState(card, rating, now) {
  const newCard = { ...card };
  const elapsedSeconds = card.lastReview > 0 ? now - card.lastReview : 0;
  const elapsedDays = elapsedSeconds / 86400;

  newCard.lastReview = now;
  newCard.reps = card.reps + 1;
  newCard.elapsedDays = elapsedDays;

  // Simplified state transitions for karaoke use case
  // We'll use a simpler model: New → Review (skip Learning state for speed)

  if (card.state === CardState.New) {
    // First review
    newCard.state = CardState.Review;
    newCard.stability = initialStability(rating);
    newCard.difficulty = initialDifficulty(rating);

    if (rating === Rating.Again) {
      newCard.lapses += 1;
      newCard.scheduledDays = 0.1; // 2.4 hours
      newCard.due = now + (0.1 * 86400);
    } else if (rating === Rating.Hard) {
      newCard.scheduledDays = 1;
      newCard.due = now + 86400; // 1 day
    } else if (rating === Rating.Good) {
      newCard.scheduledDays = 2;
      newCard.due = now + (2 * 86400); // 2 days
    } else { // Easy
      newCard.scheduledDays = EASY_INTERVAL;
      newCard.due = now + (EASY_INTERVAL * 86400);
    }
    return newCard;
  }

  // Review state
  const retrievability = calculateRetrievability(elapsedDays, card.stability);

  if (rating === Rating.Again) {
    newCard.lapses += 1;
    newCard.state = CardState.Relearning;
    newCard.stability = updateStabilityReview(card, rating, retrievability);
    newCard.difficulty = updateDifficulty(card.difficulty, rating);
    newCard.scheduledDays = 0.1; // Review again soon
    newCard.due = now + (0.1 * 86400);
    return newCard;
  }

  newCard.stability = updateStabilityReview(card, rating, retrievability);
  newCard.difficulty = updateDifficulty(card.difficulty, rating);
  const interval = calculateInterval(newCard.stability);
  newCard.scheduledDays = interval;
  newCard.due = now + (interval * 86400);
  newCard.state = CardState.Review;

  return newCard;
}

function encodeCardForContract(card) {
  return {
    due: Math.floor(card.due),
    stability: Math.floor(card.stability * 100),
    difficulty: Math.floor(card.difficulty * 10),
    elapsedDays: Math.floor(card.elapsedDays * 10),
    scheduledDays: Math.floor(card.scheduledDays * 10),
    reps: Math.min(255, card.reps),
    lapses: Math.min(255, card.lapses),
    state: card.state,
    lastReview: Math.floor(card.lastReview)
  };
}

// ============================================================
// PRONUNCIATION SCORING (Inlined)
// ============================================================

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

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
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function calculatePronunciationScore(expected, actual) {
  if (!expected || !actual) return 0;

  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);

  if (normalizedExpected.length === 0 || normalizedActual.length === 0) return 0;

  const distance = levenshteinDistance(normalizedExpected, normalizedActual);
  const maxLength = Math.max(normalizedExpected.length, normalizedActual.length);
  const similarity = 1 - (distance / maxLength);

  return Math.max(0, Math.min(100, Math.round(similarity * 100)));
}

function scoreToRating(score) {
  if (score >= 90) return Rating.Easy;
  if (score >= 75) return Rating.Good;
  if (score >= 60) return Rating.Hard;
  return Rating.Again;
}

// ============================================================
// MAIN LIT ACTION
// ============================================================

const go = async () => {
  console.log('=== STARTING EXECUTION ===');
  const {
    userAddress,
    songId,
    segmentId,
    expectedLyrics, // Array of { lineIndex, text, startTime }
    audioBlob, // base64 or arraybuffer
    voxstralKeyAccessControlConditions,
    voxstralKeyCiphertext,
    voxstralKeyDataToEncryptHash,
    contractAddress,
    writeToBlockchain = true,
    previousCards // Optional: existing card states for updates
  } = jsParams || {};

  console.log('jsParams received');
  console.log('User:', userAddress);
  console.log('Song:', songId);
  console.log('Segment:', segmentId);
  console.log('Lines:', expectedLyrics?.length || 0);
  console.log('Using system PKP:', SYSTEM_PKP.address);

  try {
    // Step 1: Decrypt Voxstral API key (skip in test mode)
    let voxstralKey = null;
    const testMode = audioBlob === 'base64_audio_data_here' || jsParams.testMode === true;

    if (!testMode) {
      console.log('[1/5] Decrypting Voxstral API key...');
      voxstralKey = await Lit.Actions.decryptAndCombine({
        accessControlConditions: voxstralKeyAccessControlConditions,
        ciphertext: voxstralKeyCiphertext,
        dataToEncryptHash: voxstralKeyDataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      });
      console.log('Voxstral key decrypted');
    } else {
      console.log('[1/5] TEST MODE - Skipping Voxstral key decryption');
    }

    // Step 2: Transcribe audio via Voxstral API
    console.log('[2/5] Transcribing audio...');

    let fullTranscript = '';

    if (testMode) {
      // TEST MODE: Use expected lyrics as transcript (perfect score)
      console.log('TEST MODE - Using simulated perfect transcription');
      fullTranscript = expectedLyrics.map(line => line.text).join('\n');
    } else {
      // PRODUCTION MODE: Real Voxstral transcription
      // Decode audio data from base64
      const audioData = Uint8Array.from(atob(audioBlob), c => c.charCodeAt(0));
      console.log(`Audio data: ${audioData.length} bytes`);

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
    parts.push(encoder.encode('voxtral-mini-latest\r\n'));

    // Language field (default: English)
    parts.push(encoder.encode('--' + boundary + '\r\n'));
    parts.push(encoder.encode('Content-Disposition: form-data; name="language"\r\n\r\n'));
    parts.push(encoder.encode('en\r\n'));

    // End boundary
    parts.push(encoder.encode('--' + boundary + '--\r\n'));

    // Combine all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const bodyBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      bodyBytes.set(part, offset);
      offset += part.length;
    }

    console.log(`Multipart body: ${bodyBytes.length} bytes`);

    // Call Voxstral STT API
    const transcriptionResponse = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${voxstralKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBytes
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      throw new Error(`Voxstral API error: ${transcriptionResponse.status} - ${errorText}`);
    }

      const transcriptionResult = await transcriptionResponse.json();
      fullTranscript = transcriptionResult.text || '';

      if (!fullTranscript) {
        throw new Error('Empty transcription result from Voxstral');
      }

      console.log(`Transcription complete: "${fullTranscript.substring(0, 100)}..."`);
    }

    // Parse transcript into lines
    // For now, split by newlines or use full transcript for each line
    // TODO: Improve line-level parsing with timing alignment
    const transcriptLines = fullTranscript.split(/[\n.!?]+/).filter(l => l.trim().length > 0);
    console.log(`Parsed into ${transcriptLines.length} lines`);

    // Step 3: Calculate scores per line
    console.log('[3/5] Calculating pronunciation scores...');
    const scores = [];
    const ratings = [];

    for (let i = 0; i < expectedLyrics.length; i++) {
      const expected = expectedLyrics[i].text;

      // Match transcript line to expected line
      // If we have fewer transcript lines, use empty string (silence/missed line)
      const actual = transcriptLines[i] || '';

      const score = calculatePronunciationScore(expected, actual);
      const rating = scoreToRating(score);

      scores.push(score);
      ratings.push(rating);

      console.log(`Line ${i}: expected="${expected.substring(0, 30)}..." actual="${actual.substring(0, 30)}..." score=${score} rating=${['Again','Hard','Good','Easy'][rating]}`);
    }

    // Step 4: Run FSRS algorithm
    console.log('[4/5] Running FSRS algorithm...');
    const now = Math.floor(Date.now() / 1000);
    const newCards = [];

    for (let i = 0; i < expectedLyrics.length; i++) {
      const lineIndex = expectedLyrics[i].lineIndex;
      const rating = ratings[i];

      // Get previous card state or init new
      const previousCard = previousCards && previousCards[i] ? previousCards[i] : initCard();

      // Calculate next state
      const nextCard = nextCardState(previousCard, rating, now);
      newCards.push(encodeCardForContract(nextCard));

      console.log(`Line ${lineIndex}: S=${nextCard.stability.toFixed(2)}d, D=${nextCard.difficulty.toFixed(1)}, next=${nextCard.scheduledDays.toFixed(1)}d`);
    }

    // Step 5: Sign and submit transaction
    let txHash = null;
    let contractError = null;

    if (writeToBlockchain && contractAddress) {
      try {
        console.log('[5/5] Signing and submitting transaction...');

        // Prepare arrays for batch update
        const lineIndices = expectedLyrics.map(l => l.lineIndex);

        // ABI for updateCardsBatch
        const abi = [{
          type: 'function',
          name: 'updateCardsBatch',
          inputs: [
            { name: 'user', type: 'address' },
            { name: 'songId', type: 'string' },
            { name: 'segmentId', type: 'string' },
            { name: 'lineIndices', type: 'uint8[]' },
            { name: 'ratings', type: 'uint8[]' },
            { name: 'scores', type: 'uint8[]' },
            {
              name: 'newCards',
              type: 'tuple[]',
              components: [
                { name: 'due', type: 'uint40' },
                { name: 'stability', type: 'uint16' },
                { name: 'difficulty', type: 'uint8' },
                { name: 'elapsedDays', type: 'uint16' },
                { name: 'scheduledDays', type: 'uint16' },
                { name: 'reps', type: 'uint8' },
                { name: 'lapses', type: 'uint8' },
                { name: 'state', type: 'uint8' },
                { name: 'lastReview', type: 'uint40' }
              ]
            }
          ],
          outputs: [],
          stateMutability: 'nonpayable'
        }];

        const iface = new ethers.utils.Interface(abi);
        const data = iface.encodeFunctionData('updateCardsBatch', [
          userAddress,
          songId,
          segmentId,
          lineIndices,
          ratings,
          scores,
          newCards
        ]);

        const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
        const provider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC);

        const [nonce, gasPrice] = await Promise.all([
          provider.getTransactionCount(SYSTEM_PKP.address),
          provider.getGasPrice()
        ]);

        // Gas: ~60k base + 30k per line (conservative estimate)
        const gasLimit = 60000 + (lineIndices.length * 30000);

        const unsignedTx = {
          to: contractAddress,
          nonce: nonce,
          gasLimit: gasLimit,
          gasPrice: gasPrice,
          data: data,
          chainId: 84532
        };

        const transactionHash = ethers.utils.keccak256(ethers.utils.serializeTransaction(unsignedTx));
        const toSign = ethers.utils.arrayify(transactionHash);

        let publicKeyForSigning = SYSTEM_PKP.publicKey;
        if (publicKeyForSigning.startsWith('0x')) {
          publicKeyForSigning = publicKeyForSigning.substring(2);
        }

        const signature = await Lit.Actions.signAndCombineEcdsa({
          toSign: toSign,
          publicKey: publicKeyForSigning,
          sigName: 'studyScorerTx'
        });

        const jsonSignature = JSON.parse(signature);
        const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
        const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

        let recid = 0;
        if (jsonSignature.recid !== undefined) {
          recid = jsonSignature.recid;
        } else if (jsonSignature.v !== undefined) {
          recid = jsonSignature.v >= 27 ? jsonSignature.v - 27 : jsonSignature.v;
        }

        const v = 84532 * 2 + 35 + recid;
        const sigObject = { r: rHex, s: sHex, v: v };
        const signedTx = ethers.utils.serializeTransaction(unsignedTx, sigObject);

        console.log('✅ Transaction signed');

        const txHashResult = await Lit.Actions.runOnce(
          { waitForResponse: true, name: "studyScorerTx" },
          async () => {
            try {
              const hash = await provider.send("eth_sendRawTransaction", [signedTx]);
              return hash;
            } catch (error) {
              return `TX_SUBMIT_ERROR: ${error.message}`;
            }
          }
        );

        txHash = txHashResult;

        if (txHash && txHash.startsWith('TX_SUBMIT_ERROR:')) {
          console.log('Transaction submission failed:', txHash);
          contractError = txHash;
          txHash = null;
        } else {
          console.log('✅ Transaction submitted:', txHash);
        }
      } catch (error) {
        console.error('Contract write failed:', error.message);
        contractError = error.message;
      }
    } else {
      console.log('[5/5] Blockchain write disabled');
    }

    console.log('=== PREPARING FINAL RESPONSE ===');
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        userAddress,
        songId,
        segmentId,
        linesProcessed: expectedLyrics.length,
        scores,
        ratings,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        txHash,
        contractError,
        contractAddress
      })
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    });
  }
};

go().catch(error => {
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: false,
      error: error.message || 'Fatal error',
      stack: error.stack
    })
  });
});
