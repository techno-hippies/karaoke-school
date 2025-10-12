# Quiz System Architecture

Complete guide to the SongQuizV1 integration with Lit Actions for multilingual trivia generation.

## Overview

The quiz system consists of 3 Lit Actions working with the SongQuizV1 contract:

1. **trivia-generator-v1.js** - Generate questions from Genius referents (admin/offline)
2. **question-encryptor-v1.js** - Encrypt & store questions on-chain (admin via PKP)
3. **quiz-validator-v1.js** - Validate answers & record results (live/user-facing via PKP)

## Contract: SongQuizV1

**Address**: TBD (to be deployed)
**Purpose**: Daily song quiz challenges with anti-cheat mechanisms

**Key Features**:
- **Per-song quizzes**: 1 quiz/day/song (fair - questions match what user studied)
- **Encrypted questions**: Stored on-chain, decrypted by PKP
- **15-second time limit**: Prevents AI/lookup cheating (~12s thinking + 3s network)
- **Study gating**: Must complete SayItBack first (TTS barrier against bots)
- **Sequential unlock**: Must complete Q1 before Q2

**Anti-Cheat Stack**:
1. Study gating → Requires TTS (expensive for bots)
2. Time limit → Prevents Genius/ChatGPT lookup
3. Daily limit → Forces genuine engagement
4. PKP validation → Can't forge results
5. Question encryption → Can't see ahead

## Lit Actions

### 1. trivia-generator-v1.js

**Purpose**: Generate high-quality multilingual questions from Genius referents

**Supports**: English (en), Mandarin (zh-CN), Vietnamese (vi)

**Key Features**:
- Language-optimized model selection
- Annotation language detection
- Cultural context preservation
- Plausible distractor generation

**Model Selection**:
```javascript
// Chinese-optimized
zh-CN: [qwen/qwen3-235b-a22b, z-ai/glm-4.5-air, openai/gpt-oss-20b]

// Vietnamese-optimized
vi: [openai/gpt-oss-20b, qwen/qwen3-235b-a22b, z-ai/glm-4.5-air]

// English
en: [openai/gpt-oss-20b, z-ai/glm-4.5-air, qwen/qwen3-235b-a22b]
```

**Flow**:
```
1. Fetch Genius referents with annotations
2. Detect annotation language (en/zh/vi/unknown)
3. Build culturally-aware prompt
4. Call OpenRouter with language-optimized model
5. Return unencrypted questions for review
```

**Usage**:
```bash
# Test Vietnamese question generation
bun run test:trivia-gen -- --song-id 123456 --language vi

# Test Mandarin question generation
bun run test:trivia-gen -- --song-id 789012 --language zh-CN

# Review generated questions
cat output/questions-123456-vi.json
```

**Response Format**:
```json
{
  "success": true,
  "questions": [
    {
      "referentId": 123,
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
      "annotationLanguage": "en",
      "usedAnnotation": true
    }
  ],
  "metadata": {
    "songId": "123456",
    "targetLanguage": "vi",
    "questionsGenerated": 3,
    "annotationsUsed": 2,
    "annotationsAvailable": 3,
    "modelUsed": "openai/gpt-oss-20b:free",
    "tokensUsed": 1200
  }
}
```

### 2. question-encryptor-v1.js (TODO)

**Purpose**: Encrypt reviewed questions and store on-chain

**Flow**:
```
1. Load reviewed questions from file
2. For each question:
   a. Encrypt via Lit.Actions.encrypt()
   b. Generate dataToEncryptHash
3. Call songQuiz.addQuestions() via PKP signature
4. Return transaction hashes
```

**Usage**:
```bash
# Encrypt and store questions on-chain
bun run encrypt-questions -- --file output/questions-123456-vi.json
```

### 3. quiz-validator-v1.js (TODO)

**Purpose**: Live quiz validation for users

**Flow**:

**Part A: Get Next Question**
```
1. Query songQuiz.getUserProgress(geniusId, user) → nextQuestionIndex
2. Query songQuiz.getQuestion(geniusId, nextQuestionIndex) → encrypted question
3. Decrypt question via Lit.Actions.decrypt()
4. Record questionShownAt timestamp
5. Return decrypted question to user
```

**Part B: Validate Answer**
```
1. User submits answer + submittedAt timestamp
2. Check time limit: submittedAt - questionShownAt <= 15 seconds
3. Compare user answer to correct answer
4. Call songQuiz.recordQuizCompletion() via PKP signature:
   - geniusId, user, questionIndex
   - correct (bool), submittedAt, questionShownAt
5. Return result + updated progress
```

**Usage** (frontend):
```javascript
// Request next question
const { question, questionShownAt } = await litClient.executeJs({
  ipfsId: QUIZ_VALIDATOR_V1_CID,
  jsParams: {
    action: 'getNextQuestion',
    geniusId: 123456,
    userAddress: '0x...'
  }
});

// Submit answer
const result = await litClient.executeJs({
  ipfsId: QUIZ_VALIDATOR_V1_CID,
  jsParams: {
    action: 'validateAnswer',
    geniusId: 123456,
    userAddress: '0x...',
    answer: 'B',
    submittedAt: Date.now(),
    questionShownAt: questionShownAt
  }
});
```

## Multilingual Quality

### Language Detection

Automatic detection of annotation language:
- **Chinese**: CJK characters (`[\u4e00-\u9fff]`)
- **Vietnamese**: Vietnamese diacritics (`àáảãạ...`)
- **English**: Default

### Cultural Context Preservation

**Chinese (zh-CN)**:
- Uses Chinese cultural context
- Explains idioms (成语) familiar to Mainland speakers
- Preserves traditional imagery (moon = beauty/longing)

**Vietnamese (vi)**:
- Uses Vietnamese cultural context
- Explains references familiar to Vietnamese speakers
- Preserves poetic metaphors (waves = recurring emotions)

### Translation Strategy

When annotation language differs from target:
```javascript
// Example: English annotation → Chinese question
Annotation (en): "The 'Ac' Integra' is slang for Acura Integra, a sports car"
Question (zh): "'Ac' Integra'是什么车？"
Explanation (zh): "'Ac' Integra'是'Acura Integra'的误读，这是一款运动型轿车。"
```

## Testing Workflow

### Step 1: Generate Questions
```bash
# Vietnamese song
bun run test:trivia-gen -- --song-id 123456 --language vi

# Mandarin song
bun run test:trivia-gen -- --song-id 789012 --language zh-CN
```

### Step 2: Review Quality
```bash
# Check generated questions
cat output/questions-123456-vi.json

# Quality checklist:
# ✓ Questions in target language
# ✓ Cultural context preserved
# ✓ Plausible distractors
# ✓ Concise answers
# ✓ Explanations reference content (not letters)
```

### Step 3: Encrypt & Store (after approval)
```bash
bun run encrypt-questions -- --file output/questions-123456-vi.json
```

### Step 4: Test Live Quiz
```bash
bun run test:quiz-validator -- --song-id 123456 --user 0x...
```

## File Structure

```
src/quiz/
├── trivia-generator-v1.js        # ✅ Generate questions
├── question-encryptor-v1.js      # TODO: Encrypt & store
├── quiz-validator-v1.js          # TODO: Validate answers
└── keys/
    └── openrouter_api_key.json   # Encrypted OpenRouter key

src/test/
├── test-trivia-generator-v1.mjs  # ✅ Quality testing
├── test-question-encryptor.mjs   # TODO
└── test-quiz-validator.mjs       # TODO

output/
└── questions-{songId}-{lang}.json  # Generated questions for review
```

## Deployment Checklist

### 1. Deploy SongQuizV1 Contract
```bash
FOUNDRY_PROFILE=zksync forge script SongQuiz/script/DeploySongQuizV1.s.sol \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync
```

### 2. Upload Lit Actions to IPFS
```bash
# trivia-generator-v1
node scripts/upload-lit-action.mjs src/quiz/trivia-generator-v1.js "Trivia Generator v1"

# question-encryptor-v1
node scripts/upload-lit-action.mjs src/quiz/question-encryptor-v1.js "Question Encryptor v1"

# quiz-validator-v1
node scripts/upload-lit-action.mjs src/quiz/quiz-validator-v1.js "Quiz Validator v1"
```

### 3. Encrypt OpenRouter Key
```bash
OPENROUTER_API_KEY=your-key node scripts/encrypt-keys-v8.mjs \
  --cid QmTrivia... \
  --key openrouter_api_key \
  --output src/quiz/keys/openrouter_api_key.json
```

### 4. Update PKP Permissions
```bash
PRIVATE_KEY=your-key timeout 90 bun run scripts/update-pkp-permissions.ts QmTrivia...
```

### 5. Update Frontend Config
```typescript
// site/src/config/lit-actions.ts
export const LIT_ACTIONS = {
  quiz: {
    generator: { cid: 'QmTrivia...', version: 'v1' },
    encryptor: { cid: 'QmEncrypt...', version: 'v1' },
    validator: { cid: 'QmValidate...', version: 'v1' }
  }
}
```

## Common Issues

### Issue: Poor translation quality
**Solution**: Ensure annotation language matches target, or model can translate while preserving cultural context

### Issue: Distractor answers too obvious
**Solution**: Review and regenerate with better examples in prompt

### Issue: Questions too long/complex
**Solution**: Adjust prompt to emphasize conciseness

### Issue: Time limit failures
**Solution**: Check network latency, may need to adjust 15s limit

## Next Steps

1. ✅ Create trivia-generator-v1.js
2. ✅ Test multilingual quality
3. ⏳ Create question-encryptor-v1.js
4. ⏳ Create quiz-validator-v1.js
5. ⏳ Deploy SongQuizV1 contract
6. ⏳ Upload all Lit Actions to IPFS
7. ⏳ Integrate with frontend

## References

- [SongQuizV1 Contract](../../contracts/SongQuiz/SongQuizV1.sol)
- [Lit Protocol Docs](https://developer.litprotocol.com/)
- [OpenRouter API](https://openrouter.ai/)
