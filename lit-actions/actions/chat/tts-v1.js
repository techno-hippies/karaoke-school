/**
 * TTS v1 - Text-to-Speech with word timestamps
 *
 * Simple action that converts text to speech using DeepInfra Kokoro.
 * Called on-demand when user clicks "Play" on a chat message.
 *
 * Returns:
 * - audio: Base64 MP3
 * - words: Array of { id, start, end, text } for highlighting
 */

const DEEPINFRA_TTS_URL = 'https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M';

// Normalize text for TTS - strip emojis, fix quotes, clean punctuation spacing
function normalizeForTTS(text) {
  return text
    // Normalize curly quotes to straight quotes
    .replace(/[""„‟]/g, '"')              // Double quotes
    .replace(/[''‚‛]/g, "'")              // Single quotes
    .replace(/[«»‹›]/g, '"')              // Guillemets to double quotes
    // Strip emojis and unicode symbols
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc symbols & pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport & map symbols
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols extended
    .replace(/[\u{231A}-\u{231B}]/gu, '')   // Watch, hourglass
    .replace(/[\u{23E9}-\u{23F3}]/gu, '')   // Media controls
    .replace(/[\u{23F8}-\u{23FA}]/gu, '')   // Media controls
    .replace(/[\u{25AA}-\u{25AB}]/gu, '')   // Squares
    .replace(/[\u{25B6}]/gu, '')            // Play button
    .replace(/[\u{25C0}]/gu, '')            // Reverse button
    .replace(/[\u{25FB}-\u{25FE}]/gu, '')   // Squares
    .replace(/[\u{2614}-\u{2615}]/gu, '')   // Umbrella, hot beverage
    .replace(/[\u{2648}-\u{2653}]/gu, '')   // Zodiac
    .replace(/[\u{267F}]/gu, '')            // Wheelchair
    .replace(/[\u{2693}]/gu, '')            // Anchor
    .replace(/[\u{26A1}]/gu, '')            // High voltage
    .replace(/[\u{26AA}-\u{26AB}]/gu, '')   // Circles
    .replace(/[\u{26BD}-\u{26BE}]/gu, '')   // Soccer, baseball
    .replace(/[\u{26C4}-\u{26C5}]/gu, '')   // Snowman, sun
    .replace(/[\u{26CE}]/gu, '')            // Ophiuchus
    .replace(/[\u{26D4}]/gu, '')            // No entry
    .replace(/[\u{26EA}]/gu, '')            // Church
    .replace(/[\u{26F2}-\u{26F3}]/gu, '')   // Fountain, golf
    .replace(/[\u{26F5}]/gu, '')            // Sailboat
    .replace(/[\u{26FA}]/gu, '')            // Tent
    .replace(/[\u{26FD}]/gu, '')            // Fuel pump
    // Fix punctuation spacing
    .replace(/\s+([.,!?;:'")\]}])/g, '$1')  // Remove space before closing punct
    .replace(/(['"(\[{])\s+/g, '$1')        // Remove space after opening punct
    .replace(/\s+/g, ' ')                   // Collapse multiple spaces
    .trim();
}

const go = async () => {
  const startTime = Date.now();

  const {
    text,                   // Text to convert to speech
    voice,                  // Optional voice (default: af_heart)
    deepinfraEncryptedKey,  // Encrypted DeepInfra API key
    testMode                // Skip API calls for testing
  } = jsParams || {};

  try {
    // Validate
    if (!text) {
      throw new Error('Missing required parameter: text');
    }

    // TEST MODE
    if (testMode) {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          audio: 'dGVzdC1hdWRpby1iYXNlNjQ=', // mock base64
          words: [
            { id: 0, start: 0, end: 0.5, text: 'Test' },
            { id: 1, start: 0.5, end: 1, text: 'audio' }
          ],
          version: 'tts-v1',
          executionTime: Date.now() - startTime,
          testMode: true
        })
      });
      return;
    }

    if (!deepinfraEncryptedKey) {
      throw new Error('Missing deepinfraEncryptedKey');
    }

    // Decrypt DeepInfra API key
    const deepinfraApiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: deepinfraEncryptedKey.accessControlConditions,
      ciphertext: deepinfraEncryptedKey.ciphertext,
      dataToEncryptHash: deepinfraEncryptedKey.dataToEncryptHash,
      authSig: null,
      chain: 'ethereum'
    });

    // Strip emojis before TTS
    const cleanText = normalizeForTTS(text);

    // Call DeepInfra Kokoro TTS API
    const ttsResponse = await fetch(DEEPINFRA_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepinfraApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: cleanText,
        output_format: 'mp3',
        preset_voice: [voice || 'af_heart'],
        return_timestamps: true
      })
    });

    if (!ttsResponse.ok) {
      const errorBody = await ttsResponse.text();
      throw new Error(`TTS error: ${ttsResponse.status} - ${errorBody.substring(0, 200)}`);
    }

    const ttsData = await ttsResponse.json();

    if (!ttsData || !ttsData.audio) {
      throw new Error('TTS returned no audio');
    }

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        audio: ttsData.audio,
        words: ttsData.words || [],
        version: 'tts-v1',
        executionTime: Date.now() - startTime
      })
    });

  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        version: 'tts-v1',
        executionTime: Date.now() - startTime
      })
    });
  }
};

go();
