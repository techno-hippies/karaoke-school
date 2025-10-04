/**
 * Trivia Exercise Generation - v8 jsParams Pattern
 * Generates trivia questions based on song referents and their annotations
 * Uses multi-model fallback for reliability
 *
 * This version checks for annotation content and uses it to create
 * richer, more contextual trivia questions about slang, metaphors,
 * cultural references, and wordplay.
 */

// Helper function for deterministic hashing
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Wrap in async IIFE to support top-level await
(async () => {
  // Extract jsParams
  const {
    songId,
    referents,
    language = 'en',
    userAddress = 'anonymous',
    sessionId,
    parentEventId,
    userIpCountry = 'XX',
    userAgent = 'unknown',
    // Encrypted keys
    openrouterCiphertext,
    openrouterDataToEncryptHash,
    accessControlConditions,
    // Optional DB analytics
    dbUrlCiphertext,
    dbUrlDataToEncryptHash,
    dbUrlAccessControlConditions,
    dbTokenCiphertext,
    dbTokenDataToEncryptHash,
    dbTokenAccessControlConditions
  } = jsParams || {};

  const startTime = Date.now();
  let success = false;
  let errorType = null;
  let questionsGenerated = 0;
  let tokensUsed = 0;
  let modelUsed = null;
  let modelsAttempted = [];
  let modelErrors = {};
  const sessionIdParam = sessionId || crypto.randomUUID();

  console.log('[TRIVIA] Starting exercise generation with annotation support');
  console.log('[TRIVIA] Song ID:', songId);

  try {
  // Required parameters validation
  if (!songId) {
    throw new Error('songId is required');
  }

  if (!referents || !Array.isArray(referents)) {
    throw new Error('referents array is required');
  }

  if (referents.length === 0) {
    throw new Error('No referents provided');
  }

  if (!openrouterCiphertext || !openrouterDataToEncryptHash) {
    throw new Error('OpenRouter API encryption parameters missing');
  }

  if (!accessControlConditions) {
    throw new Error('Access control conditions missing');
  }

  // Decrypt OpenRouter API key
  console.log('[TRIVIA] Decrypting OpenRouter key...');
  const openrouterKey = await Lit.Actions.decryptAndCombine({
    accessControlConditions,
    ciphertext: openrouterCiphertext,
    dataToEncryptHash: openrouterDataToEncryptHash,
    authSig: null,
    chain: 'ethereum'
  });
  console.log('[TRIVIA] OpenRouter key decrypted');

  // Select referents to use (8 for good balance of content vs performance)
  const selectedReferents = referents.slice(0, 8);

  // Check how many have annotations
  const annotatedCount = selectedReferents.filter(r => r.annotation && r.annotation.length > 20).length;
  console.log(`[TRIVIA] ${annotatedCount} of ${selectedReferents.length} referents have annotations`);

  // Determine language instructions
  const langInstruction = language === 'zh-CN' ? 'Chinese' : 'English';

  // Create enhanced prompt that uses annotations when available
  let triviaPrompt = `Generate ${selectedReferents.length} trivia questions about these song lyrics in ${langInstruction}.

IMPORTANT: When annotation context is provided, use it to create questions about:
- What slang terms or expressions mean
- Cultural references being made
- Wordplay or metaphors explained in the annotation
- Historical or biographical context

Lyrics and context:
${selectedReferents.map((r, i) => {
  let entry = `${i + 1}. Lyric: "${r.fragment}"`;

  // Add annotation context if available and substantial
  if (r.annotation && r.annotation.length > 20) {
    // Truncate very long annotations to keep prompt manageable
    const context = r.annotation.length > 500
      ? r.annotation.substring(0, 500) + '...'
      : r.annotation;
    entry += `\n   Context: ${context}`;
  } else {
    entry += `\n   Context: (No additional context - create general comprehension question)`;
  }

  return entry;
}).join('\n\n')}

Return a JSON array where each object has:
- referentId: number (from the referent)
- fragment: string (the lyric fragment)
- questionType: "trivia"
- question: string (trivia question using the context when available)
- choices: object with keys "A", "B", "C", "D" (4 multiple choice options)
- correctAnswer: string ("A", "B", "C", or "D")
- explanation: string (why this answer is correct, referencing the context)

CRITICAL REQUIREMENTS:
1. When context is provided, use it to create insightful questions
2. Wrong answers must be plausible, not obviously silly
3. Keep answers concise (1-5 words when possible)
4. Reference answer content in explanations, not letters

Example with annotation:
{
  "referentId": 123,
  "fragment": "I got the Ac' Integra",
  "questionType": "trivia",
  "question": "What car is the 'Ac' Integra'?",
  "choices": {"A": "Honda Civic", "B": "Acura Integra", "C": "Audi A4", "D": "Accord Coupe"},
  "correctAnswer": "B",
  "explanation": "The 'Ac' Integra' is a mispronunciation of 'Acura Integra', a popular sports car."
}

Example without annotation:
{
  "referentId": 456,
  "fragment": "Time can never mend",
  "questionType": "trivia",
  "question": "What can time never do in this line?",
  "choices": {"A": "Heal wounds", "B": "Stop moving", "C": "Go backwards", "D": "Speed up"},
  "correctAnswer": "A",
  "explanation": "The line suggests that time cannot heal or 'mend' certain emotional wounds."
}`;

  // Model fallback order (optimized for JSON generation)
  const models = [
    { name: 'openai/gpt-oss-20b:free', maxTokens: 4000 },
    { name: 'z-ai/glm-4.5-air:free', maxTokens: 4000 },
    { name: 'qwen/qwen3-235b-a22b:free', maxTokens: 4000 }
  ];

  let questions = null;

  // Try each model until one succeeds
  for (const model of models) {
    modelsAttempted.push(model.name);
    console.log(`[TRIVIA] Trying model: ${model.name}`);

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Karaoke School Trivia',
          'HTTP-Referer': 'https://karaoke.school'
        },
        body: JSON.stringify({
          model: model.name,
          messages: [
            {
              role: 'system',
              content: 'You are a trivia question generator for language learning. Create educational questions that help students understand lyrics, slang, cultural references, and wordplay. When context/annotations are provided, use them to create insightful questions. Always return valid JSON arrays.'
            },
            {
              role: 'user',
              content: triviaPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: model.maxTokens,
          response_format: { type: "json_object" }
        })
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`API error (${res.status}): ${error}`);
      }

      const response = await res.json();

      if (response?.choices?.[0]?.message?.content) {
        const content = response.choices[0].message.content;

        // Parse the response
        let parsed;
        try {
          // Handle potential wrapper object
          parsed = JSON.parse(content);
          if (parsed.questions && Array.isArray(parsed.questions)) {
            parsed = parsed.questions;
          } else if (parsed.exercises && Array.isArray(parsed.exercises)) {
            parsed = parsed.exercises;
          } else if (!Array.isArray(parsed)) {
            // If it's an object but not an array, try to extract array
            const firstArray = Object.values(parsed).find(v => Array.isArray(v));
            if (firstArray) {
              parsed = firstArray;
            }
          }
        } catch (e) {
          throw new Error(`Failed to parse JSON: ${e.message}`);
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          // Add referent IDs and ensure structure
          questions = parsed.map((q, i) => ({
            ...q,
            referentId: selectedReferents[i]?.id || q.referentId,
            fragment: selectedReferents[i]?.fragment || q.fragment,
            questionType: 'trivia',
            // Store whether this question used annotation context
            usedAnnotation: selectedReferents[i]?.annotation && selectedReferents[i].annotation.length > 20
          }));

          modelUsed = model.name;
          tokensUsed = response.usage?.total_tokens || 0;
          questionsGenerated = questions.length;
          success = true;
          break;
        }
      }
    } catch (error) {
      modelErrors[model.name] = error.message;
      console.log(`Model ${model.name} failed:`, error.message);
    }
  }

  if (!success || !questions) {
    throw new Error(`All models failed. Attempts: ${JSON.stringify(modelErrors)}`);
  }

  // Log statistics about annotation usage
  const annotationUsedCount = questions.filter(q => q.usedAnnotation).length;
  console.log(`[TRIVIA] Generated ${questionsGenerated} questions, ${annotationUsedCount} used annotations`);

  // Send analytics if DB credentials provided
  if (dbUrlCiphertext && dbTokenCiphertext) {
    try {
      const [dbEndpoint, dbCredentials] = await Promise.all([
        Lit.Actions.decryptAndCombine({
          accessControlConditions: dbUrlAccessControlConditions || accessControlConditions,
          ciphertext: dbUrlCiphertext,
          dataToEncryptHash: dbUrlDataToEncryptHash,
          authSig: null,
          chain: 'ethereum'
        }),
        Lit.Actions.decryptAndCombine({
          accessControlConditions: dbTokenAccessControlConditions || accessControlConditions,
          ciphertext: dbTokenCiphertext,
          dataToEncryptHash: dbTokenDataToEncryptHash,
          authSig: null,
          chain: 'ethereum'
        })
      ]);

      await Lit.Actions.runOnce({ waitForResponse: true, name: "sendTriviaAnalytics" }, async () => {
        const METRICS_SALT = 'ks_metrics_2025';
        const userHash = await sha256(userAddress + METRICS_SALT);
        const userAgentHash = await sha256(userAgent + METRICS_SALT);

        const usageData = {
          timestamp: new Date().toISOString(),
          event_id: crypto.randomUUID(),
          user_hash: userHash,
          country_code: userIpCountry,
          action_type: 'exercises-trivia',
          tier: 'free',
          success: success,
          error_type: errorType,
          processing_ms: Date.now() - startTime,
          session_id: sessionIdParam,
          user_agent_hash: userAgentHash,
          language: language,
          parent_event_id: parentEventId || null,
          pipeline_step: 'trivia_generation',
          model_used: modelUsed,
          tokens_used: tokensUsed,
          prompt_tokens: null,
          completion_tokens: null,
          provider_latency_ms: null,
          generation_time_ms: Date.now() - startTime,
          total_latency_ms: Date.now() - startTime,
          cost_usd: null,
          input_text: songId,
          output_text: questionsGenerated.toString(),
          metadata: JSON.stringify({
            song_id: songId,
            questions_generated: questionsGenerated,
            models_attempted: modelsAttempted,
            annotations_used: annotationUsedCount,
            annotations_available: annotatedCount
          })
        };

        const ndjsonData = JSON.stringify(usageData) + '\n';

        try {
          const dataResponse = await fetch(dbEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dbCredentials}`,
              'Content-Type': 'application/x-ndjson'
            },
            body: ndjsonData
          });
          return dataResponse.ok;
        } catch (fetchError) {
          return false;
        }
      });
    } catch (analyticsError) {
      console.log('[TRIVIA] Analytics error (non-blocking):', analyticsError.message);
    }
  }

  // Return success response
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: true,
      questions: questions.map(q => {
        // Remove the internal usedAnnotation flag from response
        const { usedAnnotation, ...cleanQuestion } = q;
        return cleanQuestion;
      }),
      model: modelUsed,
      tokensUsed: tokensUsed,
      annotationsUsed: annotationUsedCount,
      annotationsAvailable: annotatedCount
    })
  });

  } catch (error) {
    errorType = error.message || 'unknown_error';

    // Return error response
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: errorType,
        questions: [],
        modelsAttempted: modelsAttempted,
        modelErrors: modelErrors
      })
    });
  }
})(); // End async IIFE
