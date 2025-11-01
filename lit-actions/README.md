# Lit Actions for Karaoke School v1

**Serverless, IPFS-hosted code that executes on the Lit Protocol network with blockchain-signing capabilities**

Lit Actions are decentralized, serverless functions that run on the Lit Protocol network. They enable secure, blockchain-connected computations while maintaining privacy and scalability. In Karaoke School v1, Lit Actions power the core karaoke scoring, language learning algorithms, and blockchain-integrated features.

## 🎯 What This Service Provides

This service contains a collection of Lit Actions that power various aspects of the Karaoke School learning system:

### Core Lit Actions

- **🎵 Karaoke Scorer (v4)** - Pronunciation scoring with complex blockchain signatures
- **📚 Study Scorer (v1)** - FSRS-4.5 spaced repetition algorithm + pronunciation scoring  
- **🎯 Karaoke Grader (v5)** - Unified karaoke grader with PerformanceGrader integration
- **🎶 Match & Segment (v10)** - Song metadata processing and segmentation
- **🎤 Audio Processor (v4)** - Audio processing orchestration
- **🌐 Translate Lyrics (v1)** - Multi-language lyrics translation

### STT (Speech-to-Text) Actions

Specialized actions for speech recognition and scoring integration.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Lit Protocol Network                      │
│   (Decentralized TEE for off-chain computation + PKP       │
│                    signing capabilities)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓ Executes
┌─────────────────────────────────────────────────────────────┐
│                     Lit Actions                              │
│            (IPFS-hosted code, blockchain-signed            │
│                         results)                            │
└─────────────────────────────────────────────────────────────┘
                            ↓ Sign
┌─────────────────────────────────────────────────────────────┐
│                  Lens Testnet Contracts                      │
│            (Chain ID: 37111, zkSync-based L2)               │
└─────────────────────────────────────────────────────────────┘
                            ↓ Index
┌─────────────────────────────────────────────────────────────┐
│                  The Graph Subgraph                          │
│         (Fast queries, leaderboards, analytics)             │
└─────────────────────────────────────────────────────────────┘
                            ↓ Display
┌─────────────────────────────────────────────────────────────┐
│                   Frontend App                               │
│                 (React/Next.js Web App)                      │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** and **Bun** installed
2. **Foundry** for contract deployment
3. **Lit Protocol account** and PKP (Programmable Key Pair)
4. **API Keys**: Voxstral STT, Gemini API, etc.

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd lit-actions

# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Add your API keys and PKP information to .env
```

### Environment Setup

```bash
# Required environment variables
VOXSTRAL_API_KEY=your_voxstral_key
GEMINI_API_KEY=your_gemini_key
PKP_PUBLIC_KEY=your_pkp_public_key
PKP_PRIVATE_KEY=your_pkp_private_key
LENS_TESTNET_RPC=https://rpc.testnet.lens.xyz
BASE_SEPOLIA_RPC=https://sepolia.base.org
```

### Test a Lit Action

```bash
# Test karaoke scorer
dotenvx run -- node src/test/test-karaoke-scorer-v4.mjs

# Test study scorer (FSRS algorithm)
dotenvx run -- node src/test/test-study-scorer-v1.mjs

# Test unified grader
dotenvx run -- node src/test/test-karaoke-grader-v5.mjs
```

### Deploy Lit Action to IPFS

```bash
# Upload a Lit Action to IPFS
node scripts/upload-lit-action.mjs --action=karaoke-scorer-v4

# Update PKP permissions
bun run scripts/update-pkp-permissions.ts
```

## 🎵 Using Lit Actions

### Karaoke Scoring

```javascript
import { LitClient } from '@lit-protocol/lit-node-client';

const litClient = new LitClient();

// Load the karaoke scorer Lit Action
const karaokeAction = await fetch('/lit-actions/karaoke-scorer-v4.js');
const actionCode = await karaokeAction.text();

// Execute the Lit Action
const result = await litClient.executeJs({
  code: actionCode,
  authContext: {
    chainId: 37111,
    rpc: 'https://rpc.testnet.lens.xyz'
  },
  jsParams: {
    audioDataBase64: userRecordingBase64,
    userAddress: userWalletAddress,
    songId: spotifyTrackId,
    segmentId: segmentHash,
    testMode: false
  }
});

// Result contains pronunciation scores and blockchain signatures
console.log('Score:', result.score);
console.log('Signature:', result.signature);
```

### Study with Spaced Repetition

```javascript
// Use the study scorer for language learning
const studyAction = await fetch('/lit-actions/study-scorer-v1.js');
const studyCode = await studyAction.text();

const studyResult = await litClient.executeJs({
  code: studyCode,
  authContext: authContext,
  jsParams: {
    audioDataBase64: practiceRecording,
    userAddress: userAddress,
    songId: songId,
    fsrsData: currentReviewData, // Previous review scores for FSRS algorithm
    language: 'zh', // Target language
    testMode: false
  }
});

// Get next review date based on FSRS algorithm
console.log('Next review:', studyResult.nextReviewDate);
console.log('Stability factor:', studyResult.stability);
```

### Unified Karaoke Grading

```javascript
// Use the latest unified grader
const graderAction = await fetch('/lit-actions/karaoke-grader-v5.js');
const graderCode = await graderAction.text();

const gradeResult = await litClient.executeJs({
  code: graderCode,
  authContext: authContext,
  jsParams: {
    audioDataBase64: performanceRecording,
    userAddress: userAddress,
    spotifyTrackId: trackId,
    segmentId: segmentHash,
    gradingAlgorithm: 'pronunciation-timing-pitch',
    testMode: false
  }
});

// Grade and emit event for leaderboard
console.log('Final grade:', gradeResult.grade);
console.log('Event emitted:', gradeResult.eventSignature);
```

## 🔧 Development

### Adding a New Lit Action

1. **Copy existing pattern**: Start from `karaoke-scorer-v4.js` (has critical signature patterns)
2. **Implement 16-field signature** for Lens writes (see `docs/LENS_SIGNATURE_PATTERN.md`)
3. **Use test mode** during development: `testMode: true`
4. **Add API key handling** using encrypted API key management
5. **Write tests** in `src/test/`
6. **Upload to IPFS** using the upload script

### Critical Signature Pattern

All new Lens Lit Actions must implement this 16-field EIP-712 pattern:

```javascript
const domain = {
  name: 'KaraokeSchool',
  version: '1',
  chainId: 37111,
  verifyingContract: '0x0000000000000000000000000000000000000000'
};

const types = {
  PerformanceGrading: [
    { name: 'user', type: 'address' },
    { name: 'segmentHash', type: 'bytes32' },
    { name: 'score', type: 'uint16' },
    // ... 13 more fields
  ]
};
```

### Network Configuration

**Lens Testnet (Primary)**
```javascript
RPC: https://rpc.testnet.lens.xyz
Chain ID: 37111
Used for: All new Lit Actions
```

**Base Sepolia (Legacy)**
```javascript
RPC: https://sepolia.base.org  
Chain ID: 84532
Used for: Legacy actions (migrating to Lens)
```

### API Key Management

Lit Actions can securely access API keys using encrypted storage:

```javascript
const voxstralKey = await Lit.Actions.decryptAndCombine({
  accessControlConditions: accessControlConditions,
  ciphertext: ciphertext,
  dataToEncryptHash: dataToEncryptHash,
  authSig: null,
  chain: 'ethereum'
});
```

## 📊 Available Lit Actions

### 🎵 Karaoke Scorer v4
- **File**: `karaoke-scorer-v4.js`
- **Purpose**: Pronunciation scoring with blockchain signatures
- **Features**: 16-field signature pattern, Voxstral STT, multi-source scoring
- **Status**: ⭐ CRITICAL (production ready)

### 📚 Study Scorer v1
- **File**: `study-scorer-v1.js`
- **Purpose**: FSRS-4.5 spaced repetition + pronunciation scoring
- **Features**: Complete FSRS implementation, Levenshtein distance scoring
- **Network**: Base Sepolia (migrating to Lens)

### 🎯 Karaoke Grader v5
- **File**: `karaoke-grader-v5.js`
- **Purpose**: Unified karaoke grader with PerformanceGrader integration
- **Features**: Combines best of v4 + v1, event emission, test mode
- **Status**: ⭐ NEW (recommended for new development)

### 🎶 Match & Segment v10
- **File**: `match-and-segment-v10.js`
- **Purpose**: Song metadata processing and segmentation
- **Features**: Complex transaction signing, audio metadata processing
- **Network**: Base Sepolia (legacy)

### 🎤 Audio Processor v4
- **File**: `audio-processor-v4.js`
- **Purpose**: Audio processing orchestration
- **Features**: Modal API, Spleeter + fal.ai + Grove pipeline
- **Usage**: Heavy audio processing offload

### 🌐 Translate Lyrics v1
- **File**: `translate-lyrics-v1.js`
- **Purpose**: Multi-language lyrics translation
- **Features**: Gemini API integration, translation scoring
- **Network**: Lens Testnet

## 🧪 Testing

### Test Mode
All Lit Actions support test mode to bypass API calls and use simulated data:

```javascript
// Enable test mode for development
const result = await litClient.executeJs({
  code: actionCode,
  jsParams: {
    testMode: true, // Uses simulated data
    // ... other params
  }
});
```

### Test Commands

```bash
# Test specific actions
dotenvx run -- node src/test/test-karaoke-scorer-v4.mjs
dotenvx run -- node src/test/test-study-scorer-v1.mjs
dotenvx run -- node src/test/test-karaoke-grader-v5.mjs

# Test with debug output
DEBUG=lit-protocol dotenvx run -- node src/test/test-action.mjs
```

### Test Fixtures

Sample data for testing is available in `test-fixtures/`:
- Audio samples for different languages
- Expected scoring results
- Mock API responses

## 🔗 Integration Examples

### Frontend Integration (React)

```tsx
import { useLitProtocol } from '@/hooks/useLitProtocol';

export function KaraokePlayer() {
  const { executeLitAction, isLoading } = useLitProtocol();
  
  const [score, setScore] = useState(null);
  
  const submitRecording = async (audioBlob: Blob) => {
    const audioBase64 = await blobToBase64(audioBlob);
    
    const result = await executeLitAction('karaoke-scorer-v4', {
      audioDataBase64: audioBase64,
      songId: spotifyTrackId,
      segmentId: segmentHash
    });
    
    setScore(result.score);
  };
  
  return (
    <div>
      <RecordButton onRecord={submitRecording} />
      {score && <ScoreDisplay score={score} />}
    </div>
  );
}
```

### Backend Integration (Node.js)

```javascript
import { LitNodeClient } from '@lit-protocol/lit-node-client';

const litClient = new LitNodeClient();

async function gradeKaraokePerformance(audioBlob, userAddress, songId) {
  const audioBase64 = await blobToBase64(audioBlob);
  
  const actionCode = await fetch('/lit-actions/karaoke-grader-v5.js')
    .then(res => res.text());
  
  const result = await litClient.executeJs({
    code: actionCode,
    authContext: getAuthContext(),
    jsParams: {
      audioDataBase64: audioBase64,
      userAddress,
      songId,
      gradingAlgorithm: 'pronunciation-timing-pitch'
    }
  });
  
  // Emit event for leaderboard
  await emitPerformanceEvent(result);
  
  return result;
}
```

## 🔐 Contract Integration

### PerformanceGrader.sol (Event-Only)
- **Address**: `0x0000000000000000000000000000000000000000` (to be deployed)
- **Purpose**: Emit performance grading events for leaderboards
- **Security**: Only trusted PKP can grade performances

### SongCatalogV1.sol
- **Address**: `0x88996135809cc745E6d8966e3a7A01389C774910`
- **Purpose**: Song metadata registry with Grove URIs

### KaraokeScoreboardV4.sol
- **Address**: `0x8301E4bbe0C244870a4BC44ccF0241A908293d36`
- **Purpose**: Multi-source scoreboard with ContentSource enum

## 🔧 Common Patterns

### Error Handling

```javascript
try {
  const result = await litClient.executeJs({
    code: actionCode,
    jsParams: params
  });
  
  return result;
} catch (error) {
  console.error('Lit Action execution failed:', error);
  
  // Handle specific error types
  if (error.message.includes('Insufficient gas')) {
    throw new Error('Insufficient gas for execution');
  } else if (error.message.includes('PKP not authorized')) {
    throw new Error('PKP permissions not configured');
  } else {
    throw new Error('Lit Action execution failed');
  }
}
```

### Retry Logic

```javascript
async function executeWithRetry(actionCode, params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await litClient.executeJs({
        code: actionCode,
        jsParams: params
      });
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}
```

### Batch Processing

```javascript
async function batchGradePerformances(performances) {
  const results = [];
  
  for (const performance of performances) {
    const result = await executeLitAction('karaoke-grader-v5', {
      audioDataBase64: performance.audioBase64,
      userAddress: performance.userAddress,
      songId: performance.songId
    });
    
    results.push(result);
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}
```

## 🐛 Troubleshooting

### "PKP not authorized"
- Ensure PKP permissions are updated: `bun run scripts/update-pkp-permissions.ts`
- Check PKP public key configuration in `.env`

### "Insufficient gas for execution"
- Increase gas limit in Lit Protocol settings
- Optimize Lit Action code to reduce computation

### "API key not found"
- Verify API keys are properly encrypted and accessible
- Check access control conditions for key decryption

### "Chain ID mismatch"
- Ensure correct RPC endpoint and chain ID in authContext
- Verify contract addresses for the target network

### Test Mode Issues
- Always test with `testMode: true` first
- Ensure test fixtures are properly configured
- Check debug output for detailed error information

## 📈 Performance Optimization

### Reduce Execution Time
- Minimize external API calls
- Cache frequently used data
- Use test mode for development

### Optimize Gas Usage
- Efficient data structures
- Minimize contract write operations
- Batch operations when possible

### Memory Management
- Avoid large data structures in Lit Actions
- Use streaming for large audio files
- Clear temporary data after processing

## 🛡️ Security Best Practices

### API Key Security
- Always use encrypted storage for API keys
- Implement proper access control conditions
- Rotate keys regularly

### Input Validation
- Validate all input parameters
- Sanitize user-provided data
- Implement rate limiting

### Signature Verification
- Always verify blockchain signatures
- Use the correct signature patterns
- Validate contract interactions

## 📝 Contributing

### Development Workflow

1. **Setup environment** with all required API keys
2. **Copy critical patterns** from existing Lit Actions
3. **Implement 16-field signature** for Lens interactions
4. **Write comprehensive tests** with test mode
5. **Deploy to IPFS** using the upload script
6. **Update documentation** in README.md and AGENTS.md

### Code Style
- Use ES2022+ features
- Follow existing patterns and naming conventions
- Add comprehensive comments for complex logic
- Include JSDoc for function documentation

### Testing Requirements
- Test with real audio samples
- Verify blockchain signature generation
- Test error handling and edge cases
- Performance testing for production use

---

**Built with ❤️ using Lit Protocol for decentralized, blockchain-connected computation**
