/**
 * Translate v1 - Simple Translation Action
 *
 * Translates text between English and Chinese (Mandarin)
 * using Venice AI (qwen3-4b model)
 *
 * Modes:
 * - EN_TO_ZH: English to Chinese (default)
 * - ZH_TO_EN: Chinese to English
 */

// ============================================================
// CONFIGURATION
// ============================================================
const VENICE_API_URL = 'https://api.venice.ai/api/v1/chat/completions';
const VENICE_MODEL = 'qwen3-4b';

// ============================================================
// MAIN EXECUTION
// ============================================================
const go = async () => {
  const startTime = Date.now();

  const {
    text,              // Text to translate
    direction,         // 'EN_TO_ZH' | 'ZH_TO_EN' (default: EN_TO_ZH)
    veniceEncryptedKey, // Encrypted Venice API key
    testMode           // Skip API calls for testing
  } = jsParams || {};

  try {
    // Validate
    if (!text) {
      throw new Error('Missing required parameter: text');
    }

    const translateDirection = (direction || 'EN_TO_ZH').toUpperCase();
    if (!['EN_TO_ZH', 'ZH_TO_EN'].includes(translateDirection)) {
      throw new Error(`Invalid direction: ${direction}. Must be EN_TO_ZH or ZH_TO_EN`);
    }

    // TEST MODE
    if (testMode) {
      const mockTranslation = translateDirection === 'EN_TO_ZH'
        ? '这是测试翻译结果。'
        : 'This is a test translation result.';

      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          original: text,
          translation: mockTranslation,
          direction: translateDirection,
          version: 'translate-v1',
          executionTime: Date.now() - startTime,
          testMode: true
        })
      });
      return;
    }

    if (!veniceEncryptedKey) {
      throw new Error('Missing veniceEncryptedKey');
    }

    // Decrypt Venice API key
    const veniceApiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: veniceEncryptedKey.accessControlConditions,
      ciphertext: veniceEncryptedKey.ciphertext,
      dataToEncryptHash: veniceEncryptedKey.dataToEncryptHash,
      authSig: null,
      chain: 'ethereum'
    });

    // Build prompts based on direction
    const isEnToZh = translateDirection === 'EN_TO_ZH';

    const systemPrompt = isEnToZh
      ? '你是一个专业的英中翻译。将英文准确翻译成自然流畅的中文。只输出翻译结果，不要添加任何解释。'
      : 'You are a professional Chinese-English translator. Translate Chinese text into natural, fluent English. Only output the translation, no explanations.';

    const userPrompt = isEnToZh
      ? `请将以下英文翻译成中文：\n\n${text}`
      : `Please translate the following Chinese to English:\n\n${text}`;

    // Call Venice API
    const response = await fetch(VENICE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${veniceApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: VENICE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1024,
        temperature: 0.3,
        venice_parameters: {
          include_venice_system_prompt: false,
          strip_thinking_response: true,
          disable_thinking: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Venice API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Venice API returned invalid response structure');
    }

    const translation = data.choices[0].message.content.trim();

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        original: text,
        translation: translation,
        direction: translateDirection,
        usage: data.usage,
        version: 'translate-v1',
        executionTime: Date.now() - startTime
      })
    });

  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        version: 'translate-v1',
        executionTime: Date.now() - startTime
      })
    });
  }
};

// Execute
go().catch(error => {
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: false,
      error: error.message,
      version: 'translate-v1'
    })
  });
});
