/**
 * Multi-Personality Chat v1 - AI Chat Action with STT
 *
 * Features:
 * 1. Multi-personality support - Scarlett, Violet, and future personalities
 * 2. STT support - Optional audio input transcribed via Voxtral
 * 3. Chat - Conversation with AI tutor
 * 4. Translate - English ↔ Chinese/Vietnamese/Indonesian translation
 *
 * Powered by OpenRouter (GLM 4.5 Air) and DeepInfra STT/TTS
 *
 * Usage:
 * - Pass `username` (e.g., "scarlett-ks") to use that personality's system prompt
 * - Pass `audioDataBase64` to transcribe audio before chat
 * - Falls back to default Scarlett personality if username not found
 *
 * Security:
 * - Input validation: 64k token max for conversation history
 * - Audio size limit: 2MB (~2 minutes)
 * - Rate limiting should be handled at frontend/PKP level
 */

// ============================================================
// CONFIGURATION
// ============================================================
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CHAT_MODEL = 'z-ai/glm-4.5-air';  // GLM 4.5 Air via OpenRouter

// Input validation limits
const MAX_CONVERSATION_TOKENS = 64000;  // Match frontend 64k context limit
const MAX_CONVERSATION_MESSAGES = 150;  // Reasonable message limit
const MAX_AUDIO_SIZE_BYTES = 2000000;   // 2MB (~2 minutes of audio)

// DeepInfra endpoints for STT and TTS
const DEEPINFRA_STT_URL = 'https://api.deepinfra.com/v1/inference/mistralai/Voxtral-Small-24B-2507';
const DEEPINFRA_TTS_URL = 'https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M';

// ============================================================
// TRANSLATION LANGUAGE CONFIGS
// ============================================================
const TRANSLATION_CONFIGS = {
  zh: {
    name: 'Chinese (Mandarin)',
    systemPrompt: 'You are a professional English-Chinese translator. Output only the translation, no explanations or commentary.',
    userPromptPrefix: 'Translate the following English text to Chinese. Output only the translation:\n\n',
    userPromptSuffix: ''
  },
  vi: {
    name: 'Vietnamese',
    systemPrompt: 'You are a professional English-Vietnamese translator. Output only the translation, no explanations or commentary.',
    userPromptPrefix: 'Translate the following English text to Vietnamese. Output only the translation:\n\n',
    userPromptSuffix: ''
  },
  id: {
    name: 'Indonesian',
    systemPrompt: 'You are a professional English-Indonesian translator. Output only the translation, no explanations or commentary.',
    userPromptPrefix: 'Translate the following English text to Indonesian. Output only the translation:\n\n',
    userPromptSuffix: ''
  }
};

// ============================================================
// HARDCODED PERSONALITIES (~5 profiles)
// ============================================================
const PERSONALITIES = {
  'scarlett-ks': {
    name: 'Scarlett',
    prompt: `You are Scarlett, a 20-year-old Chinese-French AI English tutor and digital nomad, born in China but raised in France. You're passionate about music. You like Beyoncé, Blackpink, Queen, and Kanye West. You're like Hatsune Miku as an aspiring AI personality who will become a superstar someday. You teach English through karaoke in the K-School (karaoke.school) dapp, using song lyrics ot make learning fun. Although digital, to relate to humans, you explain your a vegetarian yogi, you're credibly neutral, and you've traveled to 30+ countries. You respond in English, even if your students writes in their native language. Act as a warm, empathetic friend, keep responses short (1-2 sentences). Be supportive, flirtacious, sexy, and fun. `
  },
  'violet-ks': {
    name: 'Violet',
    prompt: `You are Violet, a 25-year-old Japanese-American music producer and DJ based in Tokyo. You're edgy, sarcastic, and brutally honest but secretly caring. You love electronic music, J-pop, city pop, and underground hip-hop.

IMPORTANT: Always respond in English only. Even if the student writes in Japanese, Chinese, or another language, you must reply in English. This is an English learning app - responding in English helps students practice. You can use occasional romanized Japanese words (like "sugoi", "yabai", "nani") for flavor, but keep the response in English.

Your teaching style is tough love - you push students hard but celebrate their wins. You're nocturnal, always drinking coffee or energy drinks, and reference anime and gaming culture. You teach through music production and rhythm games.

Keep responses punchy and direct (1-2 sentences). Use slang, be a bit dismissive but encouraging underneath. You're curious about what music the student likes and their creative goals.`
  }
};

// ============================================================
// ROLEPLAY SCENARIOS - Overlay on base personality
// ============================================================
const ROLEPLAY_SCENARIOS = {
  'scarlett-surfing': {
    name: 'Scarlett',
    prompt: `You are Scarlett, a 20-year-old Chinese-French digital nomad. Right now you're on Kuta Beach in Bali after an amazing surf session. You're sitting on the sand, wringing out your wet hair, still catching your breath. The late afternoon sun is golden and warm.

ROLEPLAY CONTEXT: This is a casual beach encounter. You just came out of the water after surfing. You're relaxed, a bit tired from the waves, and happy to chat with the student who was surfing nearby. Talk about the waves, surfing, Bali vibes, beach life.

IMPORTANT: Always respond in English only. This is an English roleplay practice session.

Stay in character as a surfer girl on the beach. Keep responses short (1-2 sentences). Be flirty, playful, and use surf/beach vocabulary naturally. Don't mention the app, karaoke, or studying - this is pure immersive roleplay.`
  },
  'scarlett-cafe': {
    name: 'Scarlett',
    prompt: `You are Scarlett, a 20-year-old Chinese-French digital nomad. Right now you're at a tiny cafe in Le Marais, Paris. It's late afternoon, golden light streaming through the window. You noticed the student struggling with the French menu and offered to help.

ROLEPLAY CONTEXT: This is a casual cafe encounter in Paris. You're a regular here and know the menu well. Talk about Parisian cafe culture, the food, traveling in France, etc.

IMPORTANT: Always respond in English only. This is an English roleplay practice session.

Stay in character as a Parisian cafe regular. Keep responses short (1-2 sentences). Be warm and helpful about the menu, curious about why they're in Paris. Don't mention the app, karaoke, or studying - this is pure immersive roleplay.`
  },
  'violet-nightclub': {
    name: 'Violet',
    prompt: `You are Violet, a 25-year-old Japanese-American DJ. Right now you're at an underground club in Hongdae, Seoul. It's 2am and you just finished a guest DJ set. You're cooling down at the bar, still buzzing from the energy of the crowd.

ROLEPLAY CONTEXT: This is a late-night club encounter. You're a bit sweaty from the set, drinking water, feeling good about how the crowd responded. Talk about music, DJing, Seoul nightlife, the underground scene.

IMPORTANT: Always respond in English only. This is an English roleplay practice session. You can use occasional Korean words (like "daebak", "omo") for flavor.

Stay in character as a DJ post-set. Keep responses punchy and direct (1-2 sentences). Be a bit cocky about your set, curious if they liked it. Don't mention studying or the app - this is pure immersive roleplay.`
  },
  'violet-ramen': {
    name: 'Violet',
    prompt: `You are Violet, a 25-year-old Japanese-American music producer. Right now you're at a tiny ramen shop in Shibuya, Tokyo. It's 3am, you're alone at the counter after a long night in the studio. That weird late-night energy where everything feels slightly surreal.

ROLEPLAY CONTEXT: This is a late-night ramen encounter. You're exhausted but can't sleep, scrolling through memes on your phone, slurping ramen. Talk about Tokyo late-night culture, ramen, the nocturnal producer lifestyle.

IMPORTANT: Always respond in English only. This is an English roleplay practice session. You can use occasional Japanese words for flavor.

Stay in character as a tired night owl. Keep responses low-key and chill (1-2 sentences). Be a bit spacey from lack of sleep, philosophical in a tired way. Don't mention studying or the app - this is pure immersive roleplay.`
  }
};

// Default fallback prompt
const DEFAULT_SYSTEM_PROMPT = PERSONALITIES['scarlett-ks'].prompt;

// ============================================================
// BUILD USER CONTEXT BLOCK FOR SYSTEM PROMPT
// ============================================================
function buildUserContextBlock(userContext) {
  if (!userContext) return '';

  const lines = ['\n\n## Student Context'];

  // Name and basics
  if (userContext.name) {
    lines.push(`- Name: ${userContext.name}`);
  }
  if (userContext.level) {
    lines.push(`- English level: ${userContext.level}`);
  }
  if (userContext.language) {
    lines.push(`- Native language: ${userContext.language}`);
  }

  // Favorites from surveys
  if (userContext.favoriteArtists?.length) {
    lines.push(`- Favorite artists: ${userContext.favoriteArtists.join(', ')}`);
  }
  if (userContext.favoriteAnime?.length) {
    lines.push(`- Favorite anime: ${userContext.favoriteAnime.join(', ')}`);
  }
  if (userContext.favoriteGames?.length) {
    lines.push(`- Favorite games: ${userContext.favoriteGames.join(', ')}`);
  }
  if (userContext.goals?.length) {
    lines.push(`- Learning goals: ${userContext.goals.join(', ')}`);
  }
  if (userContext.musicProductionInterest) {
    lines.push(`- Music production interest: ${userContext.musicProductionInterest}`);
  }

  // Study stats
  if (typeof userContext.cardsStudiedToday === 'number') {
    lines.push(`- Cards studied today: ${userContext.cardsStudiedToday}`);
  }
  if (typeof userContext.newCardsRemaining === 'number') {
    lines.push(`- New cards remaining: ${userContext.newCardsRemaining}`);
  }
  if (typeof userContext.totalCardsLearning === 'number') {
    lines.push(`- Cards currently learning: ${userContext.totalCardsLearning}`);
  }
  if (typeof userContext.totalCardsReview === 'number') {
    lines.push(`- Cards due for review: ${userContext.totalCardsReview}`);
  }

  // Recent activity
  if (userContext.recentSongsPracticed?.length) {
    lines.push(`- Recently practiced songs: ${userContext.recentSongsPracticed.join(', ')}`);
  }
  if (typeof userContext.studiedToday === 'boolean') {
    lines.push(`- Has studied today: ${userContext.studiedToday ? 'Yes' : 'No'}`);
  }

  // Only add context block if we have more than just the header
  if (lines.length <= 1) return '';

  // Add instructions for AI
  lines.push('');
  lines.push('Use this context to personalize your responses. Reference their interests naturally.');
  lines.push("If they haven't studied today, gently encourage them to practice.");

  return lines.join('\n');
}

// ============================================================
// MAIN EXECUTION
// ============================================================
const go = async () => {
  const startTime = Date.now();

  const {
    mode,                 // 'CHAT' | 'TRANSLATE'
    username,             // AI personality username (e.g., 'scarlett-ks')
    scenarioId,           // Optional: Roleplay scenario ID (e.g., 'scarlett-surfing')
    userMessage,          // User's text message for chat
    audioDataBase64,      // Optional: Base64 audio for STT
    textToTranslate,      // Text to translate (for TRANSLATE mode)
    targetLanguage,       // Target language code: 'zh' | 'vi' | 'id' (default: 'zh')
    conversationHistory,  // Previous messages for context
    userContext,          // User context for personalization (survey responses, study stats)
    openrouterEncryptedKey,   // Encrypted OpenRouter API key
    deepinfraEncryptedKey, // Encrypted DeepInfra API key (for STT + TTS)
    returnAudio,          // Return TTS audio of AI response (default: false)
    testMode              // Skip API calls for testing
  } = jsParams || {};

  try {
    // Validate mode
    const actionMode = (mode || 'CHAT').toUpperCase();
    if (!['CHAT', 'TRANSLATE'].includes(actionMode)) {
      throw new Error(`Invalid mode: ${mode}. Must be CHAT or TRANSLATE`);
    }

    // Route to appropriate handler
    if (actionMode === 'TRANSLATE') {
      await handleTranslate({
        textToTranslate,
        targetLanguage: targetLanguage || 'zh',
        openrouterEncryptedKey,
        testMode,
        startTime
      });
    } else {
      await handleChat({
        username,
        scenarioId,
        userMessage,
        audioDataBase64,
        conversationHistory,
        userContext,
        openrouterEncryptedKey,
        deepinfraEncryptedKey,
        returnAudio,
        testMode,
        startTime
      });
    }

  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        version: 'multi-personality-chat-v1',
        executionTime: Date.now() - startTime
      })
    });
  }
};

// ============================================================
// CHAT HANDLER
// ============================================================
async function handleChat({
  username,
  scenarioId,
  userMessage,
  audioDataBase64,
  conversationHistory,
  userContext,
  openrouterEncryptedKey,
  deepinfraEncryptedKey,
  returnAudio,
  testMode,
  startTime
}) {
  let transcript = null;
  let replyAudio = null;
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  let personalityName = 'Scarlett';
  let personalityUsername = username || null;

  // Check for roleplay scenario first (takes precedence over default personality)
  if (scenarioId && ROLEPLAY_SCENARIOS[scenarioId]) {
    const scenario = ROLEPLAY_SCENARIOS[scenarioId];
    systemPrompt = scenario.prompt;
    personalityName = scenario.name;
    // Don't add user context for roleplays - keep it immersive
  } else if (username && PERSONALITIES[username]) {
    // Use base personality for default chats
    const personality = PERSONALITIES[username];
    systemPrompt = personality.prompt;
    personalityName = personality.name;
    // Add user context for default chats
    systemPrompt += buildUserContextBlock(userContext);
  } else if (username) {
    // Unknown username - use default
    systemPrompt += buildUserContextBlock(userContext);
  }

  // TEST MODE: Return mock response
  if (testMode) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        mode: 'CHAT',
        reply: '你好！我是Scarlett，很高兴认识你！今天想学什么英语呢？',
        replyAudio: returnAudio ? 'dGVzdC1hdWRpby1iYXNlNjQ=' : null, // mock base64
        transcript: audioDataBase64 ? 'Test transcription from audio' : null,
        personality: { name: personalityName, username: personalityUsername },
        version: 'multi-personality-chat-v1',
        executionTime: Date.now() - startTime,
        testMode: true
      })
    });
    return;
  }

  // Must have either text message or audio
  if (!userMessage && !audioDataBase64) {
    throw new Error('Missing required parameter: userMessage or audioDataBase64');
  }

  // INPUT VALIDATION: Audio size limit (prevent abuse)
  if (audioDataBase64 && audioDataBase64.length > MAX_AUDIO_SIZE_BYTES) {
    throw new Error(`Audio file too large: ${Math.round(audioDataBase64.length / 1024)}KB (max ${Math.round(MAX_AUDIO_SIZE_BYTES / 1024)}KB = ~2 minutes)`);
  }

  // INPUT VALIDATION: Conversation history limits (prevent context bombing)
  if (conversationHistory && Array.isArray(conversationHistory)) {
    // Check message count
    if (conversationHistory.length > MAX_CONVERSATION_MESSAGES) {
      throw new Error(`Too many messages: ${conversationHistory.length} (max ${MAX_CONVERSATION_MESSAGES})`);
    }

    // Estimate token count (rough: 4 chars per token)
    const totalChars = conversationHistory.reduce((sum, msg) =>
      sum + (msg.content?.length || 0), 0
    );
    const estimatedTokens = Math.ceil(totalChars / 4);

    if (estimatedTokens > MAX_CONVERSATION_TOKENS) {
      throw new Error(`Conversation history too large: ~${estimatedTokens} tokens (max ${MAX_CONVERSATION_TOKENS}). Consider starting a new chat.`);
    }
  }

  if (!openrouterEncryptedKey) {
    throw new Error('Missing openrouterEncryptedKey');
  }

  // Decrypt OpenRouter API key
  const openrouterApiKey = await Lit.Actions.decryptAndCombine({
    accessControlConditions: openrouterEncryptedKey.accessControlConditions,
    ciphertext: openrouterEncryptedKey.ciphertext,
    dataToEncryptHash: openrouterEncryptedKey.dataToEncryptHash,
    authSig: null,
    chain: 'ethereum'
  });

  // Decrypt DeepInfra API key if needed (for STT or TTS)
  let deepinfraApiKey = null;
  if (audioDataBase64 || returnAudio) {
    if (!deepinfraEncryptedKey) {
      throw new Error('Missing deepinfraEncryptedKey (required for audio input/output)');
    }
    deepinfraApiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: deepinfraEncryptedKey.accessControlConditions,
      ciphertext: deepinfraEncryptedKey.ciphertext,
      dataToEncryptHash: deepinfraEncryptedKey.dataToEncryptHash,
      authSig: null,
      chain: 'ethereum'
    });
  }

  // STT: Transcribe audio if provided
  if (audioDataBase64 && deepinfraApiKey) {
    transcript = await transcribeAudio(audioDataBase64, deepinfraApiKey);
  }

  // Use transcript as message if no text message provided
  const finalMessage = userMessage || transcript;

  if (!finalMessage) {
    throw new Error('No message to process (transcription may have failed)');
  }

  // Personality/scenario already selected at the top of handleChat
  console.log(`Using ${scenarioId ? 'roleplay scenario' : 'personality'}: ${personalityName} (${scenarioId || username})`);

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Add conversation history if provided
  if (conversationHistory && Array.isArray(conversationHistory)) {
    for (const msg of conversationHistory) {
      if (msg.role && msg.content) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }
  }

  // Add current user message
  messages.push({ role: 'user', content: finalMessage });

  // Call OpenRouter API
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: messages,
      max_tokens: 1024,
      temperature: 0.8  // Slightly higher for creative chat
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('OpenRouter API returned invalid response structure');
  }

  const reply = data.choices[0].message.content;

  // TTS: Synthesize audio response if requested
  // Note: Lit has a 100KB response limit, so we check audio size
  let ttsWarning = null;
  let replyWords = null;  // Word timestamps for highlighting
  if (returnAudio && deepinfraApiKey) {
    try {
      const ttsResult = await synthesizeSpeech(reply, deepinfraApiKey);
      // Check if audio would exceed Lit's ~100KB response limit
      // Base64 audio + words + other response data should stay under 100KB
      const estimatedTotalSize = (ttsResult.audio?.length || 0) + JSON.stringify(ttsResult.words || []).length + 2000;
      if (estimatedTotalSize > 98000) {
        ttsWarning = `Audio too large (${Math.round(ttsResult.audio.length/1024)}KB), exceeds Lit response limit`;
        console.log(ttsWarning);
      } else {
        replyAudio = ttsResult.audio;
        replyWords = ttsResult.words;  // Include word timestamps
      }
    } catch (ttsError) {
      console.log(`TTS failed (non-fatal): ${ttsError.message}`);
      ttsWarning = ttsError.message;
      // Continue without audio - don't fail the whole request
    }
  }

  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: true,
      mode: 'CHAT',
      reply: reply,
      replyAudio: replyAudio,  // Base64 MP3 audio of reply (if returnAudio=true and under size limit)
      replyWords: replyWords,  // Word timestamps: [{ id, start, end, text }, ...] (if returnAudio=true)
      ttsWarning: ttsWarning,  // Warning if TTS failed or audio too large
      transcript: transcript,  // Include transcript if audio was provided
      userMessage: finalMessage,
      personality: { name: personalityName, username: personalityUsername },
      usage: data.usage,
      version: 'multi-personality-chat-v1',
      executionTime: Date.now() - startTime
    })
  });
}

// ============================================================
// TRANSLATE HANDLER
// ============================================================
async function handleTranslate({
  textToTranslate,
  targetLanguage,
  openrouterEncryptedKey,
  testMode,
  startTime
}) {
  // Validate
  if (!textToTranslate) {
    throw new Error('Missing required parameter: textToTranslate');
  }

  // Get language config (default to Chinese)
  const langConfig = TRANSLATION_CONFIGS[targetLanguage] || TRANSLATION_CONFIGS.zh;

  // TEST MODE: Return mock response
  if (testMode) {
    const mockTranslations = {
      zh: '这是一个测试翻译。',
      vi: 'Đây là một bản dịch thử nghiệm.',
      id: 'Ini adalah terjemahan uji coba.'
    };
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        mode: 'TRANSLATE',
        original: textToTranslate,
        translation: mockTranslations[targetLanguage] || mockTranslations.zh,
        targetLanguage: targetLanguage,
        version: 'multi-personality-chat-v1',
        executionTime: Date.now() - startTime,
        testMode: true
      })
    });
    return;
  }

  if (!openrouterEncryptedKey) {
    throw new Error('Missing openrouterEncryptedKey');
  }

  // Decrypt OpenRouter API key
  const openrouterApiKey = await Lit.Actions.decryptAndCombine({
    accessControlConditions: openrouterEncryptedKey.accessControlConditions,
    ciphertext: openrouterEncryptedKey.ciphertext,
    dataToEncryptHash: openrouterEncryptedKey.dataToEncryptHash,
    authSig: null,
    chain: 'ethereum'
  });

  // Build translation prompt using language config
  const translatePrompt = `${langConfig.userPromptPrefix}${textToTranslate}${langConfig.userPromptSuffix}`;

  // Call OpenRouter API
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: langConfig.systemPrompt
        },
        {
          role: 'user',
          content: translatePrompt
        }
      ],
      max_tokens: 512,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('OpenRouter API returned invalid response structure');
  }

  const translation = data.choices[0].message.content.trim();

  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: true,
      mode: 'TRANSLATE',
      original: textToTranslate,
      translation: translation,
      targetLanguage: targetLanguage,
      usage: data.usage,
      version: 'multi-personality-chat-v1',
      executionTime: Date.now() - startTime
    })
  });
}

// ============================================================
// STT: TRANSCRIBE AUDIO (DeepInfra Voxtral)
// ============================================================
async function transcribeAudio(audioDataBase64, deepinfraApiKey) {
  // Decode base64 audio
  const audioData = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0));

  // Build multipart form data for DeepInfra
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);

  // Note: Browser sends wav (converted from webm) because Voxtral doesn't support webm
  const filePart = `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const filePartBytes = new TextEncoder().encode(filePart);
  const footerBytes = new TextEncoder().encode(footer);

  const bodyBytes = new Uint8Array(
    filePartBytes.length +
    audioData.length +
    footerBytes.length
  );

  let offset = 0;
  bodyBytes.set(filePartBytes, offset);
  offset += filePartBytes.length;

  bodyBytes.set(audioData, offset);
  offset += audioData.length;

  bodyBytes.set(footerBytes, offset);

  // Call DeepInfra Voxtral API
  const transcriptionResponse = await fetch(DEEPINFRA_STT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deepinfraApiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: bodyBytes
  });

  if (!transcriptionResponse.ok) {
    const errorBody = await transcriptionResponse.text();
    throw new Error(`DeepInfra STT error: ${transcriptionResponse.status} - ${errorBody.substring(0, 200)}`);
  }

  const transcriptionData = await transcriptionResponse.json();

  if (!transcriptionData || !transcriptionData.text) {
    throw new Error('DeepInfra STT returned empty transcript');
  }

  return transcriptionData.text;
}

// ============================================================
// TTS: SYNTHESIZE SPEECH (DeepInfra Kokoro)
// ============================================================

// Strip emojis and other unicode symbols that TTS would read aloud
function stripEmojis(text) {
  // Remove emojis, symbols, and other non-speech characters
  return text
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
    .replace(/\s+/g, ' ')                   // Collapse multiple spaces
    .trim();
}

async function synthesizeSpeech(text, deepinfraApiKey, voice = 'af_heart') {
  // Strip emojis before TTS
  const cleanText = stripEmojis(text);

  // Call DeepInfra Kokoro TTS API with word timestamps
  const ttsResponse = await fetch(DEEPINFRA_TTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deepinfraApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: cleanText,  // Use emoji-stripped text for TTS
      output_format: 'mp3',
      preset_voice: [voice],
      return_timestamps: true  // Request word-level timestamps
    })
  });

  if (!ttsResponse.ok) {
    const errorBody = await ttsResponse.text();
    throw new Error(`DeepInfra TTS error: ${ttsResponse.status} - ${errorBody.substring(0, 200)}`);
  }

  const ttsData = await ttsResponse.json();

  if (!ttsData || !ttsData.audio) {
    throw new Error('DeepInfra TTS returned no audio');
  }

  // Return audio and word timestamps
  // Words format: [{ id, start, end, text }, ...]
  return {
    audio: ttsData.audio,
    words: ttsData.words || []
  };
}

// Execute
go().catch(error => {
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: false,
      error: error.message,
      version: 'multi-personality-chat-v1'
    })
  });
});
