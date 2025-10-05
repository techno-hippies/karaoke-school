/**
 * Trivia Generator v1 - Multilingual Question Generation
 *
 * Generates high-quality trivia questions from Genius referents with annotations.
 * Optimized for Vietnamese and Mandarin Chinese learners.
 *
 * Flow:
 * 1. Fetch Genius referents with annotations
 * 2. Detect annotation language
 * 3. Generate questions using language-optimized LLM
 * 4. Return unencrypted questions for quality review
 *
 * Integration:
 * - Used by admin/content pipeline (NOT live user-facing)
 * - Questions reviewed before encryption and on-chain storage
 * - Supports: English (en), Mandarin (zh-CN), Vietnamese (vi)
 */

// Helper: SHA-256 hash for privacy-preserving analytics
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Detect language of text
function detectLanguage(text) {
  if (!text || text.length < 10) return 'unknown';

  // Chinese detection (CJK characters)
  const chineseRegex = /[\u4e00-\u9fff]/;
  if (chineseRegex.test(text)) return 'zh';

  // Vietnamese detection (Vietnamese diacritics)
  const vietnameseRegex = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
  if (vietnameseRegex.test(text)) return 'vi';

  // Default to English
  return 'en';
}

// Helper: Select best models for language
function getModelsForLanguage(language) {
  // Use only grok-4-fast for speed (fallback takes too long for Lit Action timeout)
  return [
    { name: 'x-ai/grok-4-fast', maxTokens: 2000 }
  ];
}

// Helper: Build culturally-aware prompt
function buildPrompt(referents, targetLang) {
  const langName = {
    'zh-CN': 'Simplified Chinese',
    'zh': 'Chinese',
    'vi': 'Vietnamese',
    'en': 'English'
  }[targetLang] || 'the target language';

  const culturalGuidance = {
    'zh-CN': 'Use Chinese cultural context. Explain idioms (成语) and cultural references familiar to Mainland Chinese speakers.',
    'vi': 'Use Vietnamese cultural context. Explain references familiar to Vietnamese speakers.',
    'en': 'Use clear explanations suitable for English learners.'
  }[targetLang] || 'Use clear, culturally appropriate explanations.';

  // Analyze annotations
  const withAnnotations = referents.filter(r => r.annotation && r.annotation.length > 20);
  const annotationLangs = withAnnotations.map(r => detectLanguage(r.annotation));

  const prompt = `Generate ${referents.length} trivia questions in ${langName} about these song lyrics.

${culturalGuidance}

LYRICS WITH CONTEXT:
${referents.map((r, i) => {
  let entry = `${i + 1}. Lyric: "${r.fragment}"`;

  if (r.annotation && r.annotation.length > 20) {
    const detectedLang = detectLanguage(r.annotation);
    const context = r.annotation.length > 500
      ? r.annotation.substring(0, 500) + '...'
      : r.annotation;

    entry += `\n   Context (${detectedLang}): ${context}`;

    // Add translation guidance if needed
    if (detectedLang !== targetLang && detectedLang !== 'unknown') {
      entry += `\n   NOTE: Translate context to ${langName} while preserving cultural meaning`;
    }
  } else {
    entry += `\n   Context: (Create general comprehension question about the lyric)`;
  }

  return entry;
}).join('\n\n')}

RESPONSE FORMAT (JSON array):
[{
  "referentId": number,           // From referent.id
  "fragment": string,             // The lyric fragment
  "questionType": "trivia",
  "question": string,             // Question in ${langName}
  "choices": {                    // 4 options in ${langName}
    "A": "option 1",
    "B": "option 2",
    "C": "option 3",
    "D": "option 4"
  },
  "correctAnswer": "A|B|C|D",
  "explanation": string,          // Why this is correct (in ${langName})
  "annotationLanguage": "en|zh|vi|unknown",  // Detected annotation language
  "usedAnnotation": boolean       // Whether annotation was used
}]

QUALITY REQUIREMENTS:
1. Questions must be in ${langName} (translate if annotation is in different language)
2. When annotation exists, create insightful questions about:
   - Cultural references and their meaning
   - Slang terms and colloquialisms
   - Metaphors and wordplay
   - Historical or biographical context
3. When NO annotation, create comprehension questions about the lyric's literal meaning
4. Wrong answers must be PLAUSIBLE (not obviously incorrect)
5. Keep answers concise (1-8 words ideal)
6. Reference answer CONTENT in explanations, not letters (A/B/C/D)
7. Preserve cultural nuance when translating context

EXAMPLE (Chinese with English annotation):
{
  "referentId": 123,
  "fragment": "我有一辆Ac' Integra",
  "questionType": "trivia",
  "question": "'Ac' Integra'是什么车？",
  "choices": {
    "A": "本田思域",
    "B": "讴歌Integra",
    "C": "奥迪A4",
    "D": "雅阁轿跑"
  },
  "correctAnswer": "B",
  "explanation": "'Ac' Integra'是'Acura Integra'的误读，这是一款受欢迎的运动型轿车。",
  "annotationLanguage": "en",
  "usedAnnotation": true
}

EXAMPLE (Vietnamese without annotation):
{
  "referentId": 456,
  "fragment": "Thời gian không bao giờ chữa lành",
  "questionType": "trivia",
  "question": "Thời gian không thể làm gì trong câu này?",
  "choices": {
    "A": "Chữa lành vết thương",
    "B": "Dừng lại",
    "C": "Quay ngược",
    "D": "Tăng tốc"
  },
  "correctAnswer": "A",
  "explanation": "Câu này nói rằng thời gian không thể chữa lành một số vết thương cảm xúc.",
  "annotationLanguage": "unknown",
  "usedAnnotation": false
}`;

  return prompt;
}

// Helper: Scramble answer choices (CRITICAL: prevents all answers being "A")
function scrambleAnswers(questions) {
  return questions.map(q => {
    const choices = Object.entries(q.choices); // [["A", "answer1"], ["B", "answer2"], ...]
    const correctText = q.choices[q.correctAnswer]; // Get the actual correct answer text

    // Shuffle choices using Fisher-Yates algorithm
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }

    // Rebuild choices object with scrambled order
    const newChoices = {};
    const letters = ['A', 'B', 'C', 'D'];
    let newCorrectAnswer = '';

    choices.forEach(([oldKey, value], index) => {
      newChoices[letters[index]] = value;
      if (value === correctText) {
        newCorrectAnswer = letters[index];
      }
    });

    return {
      ...q,
      choices: newChoices,
      correctAnswer: newCorrectAnswer
    };
  });
}

const go = async () => {
  const startTime = Date.now();
  let success = false;
  let errorType = null;
  let questionsGenerated = 0;
  let tokensUsed = 0;
  let modelUsed = null;
  let modelsAttempted = [];
  let modelErrors = {};

  console.log('[TRIVIA-GEN-V1] Starting multilingual question generation');
  console.log('[TRIVIA-GEN-V1] Song ID:', jsParams.songId);
  console.log('[TRIVIA-GEN-V1] Target Language:', jsParams.language || 'zh-CN');

  try {
    // Required parameters
    if (!jsParams.songId) {
      throw new Error('songId is required');
    }

    if (!jsParams.referents || !Array.isArray(jsParams.referents)) {
      throw new Error('referents array is required');
    }

    if (jsParams.referents.length === 0) {
      throw new Error('No referents provided');
    }

    // Set defaults
    const targetLang = jsParams.language || 'zh-CN';
    const walletAddress = jsParams.userAddress || 'anonymous';
    const userIpCountryParam = jsParams.userIpCountry || 'XX';
    const userAgentParam = jsParams.userAgent || 'unknown';

    // Get OpenRouter API key (encrypted or plaintext for testing)
    let openrouterKey;
    if (jsParams.openrouterKey) {
      // Plaintext key for local testing
      console.log('[TRIVIA-GEN-V1] Using plaintext OpenRouter key (local testing)');
      openrouterKey = jsParams.openrouterKey;
    } else if (jsParams.openrouterCiphertext && jsParams.openrouterDataToEncryptHash && jsParams.accessControlConditions) {
      // Encrypted key for production
      console.log('[TRIVIA-GEN-V1] Decrypting OpenRouter key...');
      openrouterKey = await Lit.Actions.decryptAndCombine({
        accessControlConditions: jsParams.accessControlConditions,
        ciphertext: jsParams.openrouterCiphertext,
        dataToEncryptHash: jsParams.openrouterDataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      });
      console.log('[TRIVIA-GEN-V1] OpenRouter key decrypted');
    } else {
      throw new Error('OpenRouter API key is required (plaintext or encrypted)');
    }

    // Select referents (3 max for faster execution in Lit Action timeout)
    const selectedReferents = jsParams.referents.slice(0, 3);

    // Analyze annotation availability and languages
    const withAnnotations = selectedReferents.filter(r => r.annotation && r.annotation.length > 20);
    const annotationLangs = withAnnotations.map(r => detectLanguage(r.annotation));
    const langCounts = annotationLangs.reduce((acc, lang) => {
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});

    console.log(`[TRIVIA-GEN-V1] ${withAnnotations.length}/${selectedReferents.length} referents have annotations`);
    console.log(`[TRIVIA-GEN-V1] Annotation languages:`, langCounts);

    // Build culturally-aware prompt
    const prompt = buildPrompt(selectedReferents, targetLang);

    // Select models optimized for target language
    const models = getModelsForLanguage(targetLang);
    console.log(`[TRIVIA-GEN-V1] Using ${models.length} models optimized for ${targetLang}`);

    let questions = null;

    // Try each model until one succeeds
    for (const model of models) {
      modelsAttempted.push(model.name);
      console.log(`[TRIVIA-GEN-V1] Trying model: ${model.name}`);

      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Karaoke School Trivia Generator',
            'HTTP-Referer': 'https://karaoke.school'
          },
          body: JSON.stringify({
            model: model.name,
            messages: [
              {
                role: 'system',
                content: `You are an expert trivia question generator for language learning. Create culturally appropriate, educational questions that help students understand lyrics, cultural references, slang, and wordplay. CRITICAL: Return ONLY a valid JSON array, no markdown, no explanation, just the array. Target language: ${targetLang}`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: model.maxTokens
          })
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`API error (${res.status}): ${error}`);
        }

        const response = await res.json();

        if (response?.choices?.[0]?.message?.content) {
          let content = response.choices[0].message.content;

          // Strip markdown code blocks if present
          const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
          if (jsonMatch) {
            content = jsonMatch[1];
          }

          console.log('[TRIVIA-GEN-V1] Cleaned content (first 300 chars):', content.substring(0, 300));

          // Parse the response
          let parsed;
          try {
            parsed = JSON.parse(content);
            console.log('[TRIVIA-GEN-V1] Parsed type:', Array.isArray(parsed) ? 'array' : typeof parsed);
            console.log('[TRIVIA-GEN-V1] Parsed keys:', Object.keys(parsed || {}).join(', '));

            // Extract array from various possible wrapper formats
            if (parsed.questions && Array.isArray(parsed.questions)) {
              parsed = parsed.questions;
            } else if (parsed.exercises && Array.isArray(parsed.exercises)) {
              parsed = parsed.exercises;
            } else if (parsed.data && Array.isArray(parsed.data)) {
              parsed = parsed.data;
            } else if (parsed.items && Array.isArray(parsed.items)) {
              parsed = parsed.items;
            } else if (!Array.isArray(parsed)) {
              const firstArray = Object.values(parsed).find(v => Array.isArray(v));
              if (firstArray) {
                parsed = firstArray;
              } else {
                throw new Error(`Response is not an array and contains no arrays. Keys: ${Object.keys(parsed).join(', ')}`);
              }
            }
          } catch (e) {
            throw new Error(`Failed to parse JSON: ${e.message}`);
          }

          if (Array.isArray(parsed) && parsed.length > 0) {
            // Enrich questions with metadata
            const enrichedQuestions = parsed.map((q, i) => {
              const referent = selectedReferents[i];
              const annotationLang = referent?.annotation
                ? detectLanguage(referent.annotation)
                : 'unknown';

              return {
                ...q,
                referentId: referent?.id || q.referentId,
                fragment: referent?.fragment || q.fragment,
                questionType: 'trivia',
                annotationLanguage: q.annotationLanguage || annotationLang,
                usedAnnotation: q.usedAnnotation !== undefined
                  ? q.usedAnnotation
                  : (referent?.annotation && referent.annotation.length > 20)
              };
            });

            // CRITICAL: Scramble answers (prevents all correct answers being "A")
            questions = scrambleAnswers(enrichedQuestions);

            modelUsed = model.name;
            tokensUsed = response.usage?.total_tokens || 0;
            questionsGenerated = questions.length;
            success = true;
            break;
          } else {
            throw new Error('Parsed result is empty or not an array');
          }
        } else {
          throw new Error('No content in response');
        }
      } catch (error) {
        modelErrors[model.name] = error.message;
        console.log(`[TRIVIA-GEN-V1] Model ${model.name} failed:`, error.message);
      }
    }

    if (!success || !questions) {
      throw new Error(`All models failed. Errors: ${JSON.stringify(modelErrors)}`);
    }

    // Calculate statistics
    const annotationUsedCount = questions.filter(q => q.usedAnnotation).length;
    const langDistribution = questions.reduce((acc, q) => {
      const lang = q.annotationLanguage || 'unknown';
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});

    console.log(`[TRIVIA-GEN-V1] SUCCESS: Generated ${questionsGenerated} questions`);
    console.log(`[TRIVIA-GEN-V1] Annotation usage: ${annotationUsedCount}/${questionsGenerated}`);
    console.log(`[TRIVIA-GEN-V1] Language distribution:`, langDistribution);

    // Return success response
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        questions: questions,
        metadata: {
          songId: jsParams.songId,
          targetLanguage: targetLang,
          questionsGenerated: questionsGenerated,
          annotationsUsed: annotationUsedCount,
          annotationsAvailable: withAnnotations.length,
          annotationLanguages: langCounts,
          questionLanguages: langDistribution,
          modelUsed: modelUsed,
          tokensUsed: tokensUsed,
          modelsAttempted: modelsAttempted,
          executionTimeMs: Date.now() - startTime
        }
      })
    });

  } catch (error) {
    errorType = error.message || 'unknown_error';
    console.log(`[TRIVIA-GEN-V1] ERROR:`, errorType);

    // Return error response
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: errorType,
        questions: [],
        metadata: {
          modelsAttempted: modelsAttempted,
          modelErrors: modelErrors,
          executionTimeMs: Date.now() - startTime
        }
      })
    });
  }
};

go();
