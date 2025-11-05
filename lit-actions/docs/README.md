# Lit Actions Documentation

**AI-powered performance grading for karaoke learning**

## 🚀 Quick Start

```bash
cd lit-actions
npm install
npm run build
npm run test
```

**Network**: Base Sepolia
**PKP**: 0x9456aec64179FE39a1d0a681de7613d5955E75D3

## 📁 Lit Actions Structure

```
lit-actions/
├── src/karaoke/
│   ├── karaoke-grader-v6-performance-grader.js  # Main grading logic
│   ├── keys/                                    # API keys
│   └── fsrs/                                   # Spaced repetition algorithm
├── systems/
│   ├── grading-system.js                       # Grading orchestration
│   └── audio-processor.js                      # Audio processing
├── study/
│   └── fsrs-scheduler.js                       # FSRS scheduling
└── tests/
    ├── test-karaoke-grader-v6.mjs             # Unit tests
    └── test-direct-grading.mjs                # Integration tests
```

## 🎯 Karaoke Grader v6

### Purpose
Grade user performances using AI (Voxstral) with line-level FSRS support

### Key Features
- **Voxstral AI Integration**: Pronunciation and timing analysis
- **Line-Level Grading**: Support for individual lyric lines
- **FSRS Scheduling**: Spaced repetition based on performance
- **Anti-Cheat**: Trusted PKP-only grading

### Performance Grader Contract
**Address**: `0xdd231de1016F5BBe56cEB3B617Aa38A5B454610D`
**Network**: Lens Testnet (37111)

### Line-Level Grading Function
```solidity
function gradeLinePerformance(
    uint256 performanceId,
    bytes32 lineId,           // UUID from karaoke_lines
    bytes32 segmentHash,
    uint16 lineIndex,         // Position within segment
    address performer,
    uint16 score,             // 0-10000 (75.43% = 7543)
    string metadataUri        // Grove recording URI
) external onlyTrustedPKP whenNotPaused
```

## 🤖 AI Grading Process

### Voxstral Integration
```javascript
// src/karaoke/karaoke-grader-v6-performance-grader.js
async function gradeWithVoxstral(userAudio, referenceAudio, exerciseText, lineId) {
  // 1. Preprocess audio
  const processedAudio = await preprocessAudio(userAudio);
  
  // 2. Get reference timing from alignment
  const alignment = await fetchReferenceAlignment(referenceAudio);
  const lineTiming = alignment.lines.find(line => line.lineId === lineId);
  
  // 3. Grade with Voxstral AI
  const voxstralResult = await voxstral.grade({
    audio: processedAudio,
    reference: referenceAudio,
    targetText: exerciseText,
    expectedTiming: lineTiming,
    language: 'en-US'
  });
  
  // 4. Calculate composite score
  const timingScore = calculateTimingScore(voxstralResult.timing);
  const pronunciationScore = calculatePronunciationScore(voxstralResult.pronunciation);
  const pitchScore = calculatePitchScore(voxstralResult.pitch);
  
  const compositeScore = (timingScore * 0.4 + pronunciationScore * 0.4 + pitchScore * 0.2);
  
  return {
    score: Math.round(compositeScore * 10000), // Convert to 0-10000 scale
    breakdown: {
      timing: timingScore,
      pronunciation: pronunciationScore,
      pitch: pitchScore
    },
    feedback: voxstralResult.feedback
  };
}
```

### Line-Level Analysis
```javascript
// Analyze specific lyric line
async function analyzeLinePerformance(audioBlob, lineData) {
  const audioBuffer = await audioBlob.arrayBuffer();
  
  // 1. Extract line segment from full audio
  const lineAudio = extractAudioSegment(
    audioBuffer,
    lineData.startMs / 1000,  // Convert to seconds
    lineData.endMs / 1000
  );
  
  // 2. Get reference timing for this specific line
  const referenceSegment = await fetchReferenceSegment(
    lineData.segmentHash,
    lineData.lineIndex
  );
  
  // 3. Grade the line
  const gradingResult = await gradeWithVoxstral(
    lineAudio,
    referenceSegment.instrumentalUri,
    lineData.originalText,
    lineData.lineId
  );
  
  return {
    lineId: lineData.lineId,
    lineIndex: lineData.lineIndex,
    score: gradingResult.score,
    feedback: gradingResult.feedback,
    performanceData: gradingResult.breakdown
  };
}
```

## 📊 FSRS Integration

### Spaced Repetition Scheduling
```javascript
// study/fsrs-scheduler.js
function calculateNextReview(score: number, previousStability: number): Date {
  // FSRS algorithm for spaced repetition
  const quality = scoreToQuality(score); // Convert 0-10000 to 0-5 scale
  
  let stability = previousStability;
  let difficulty = calculateDifficulty(quality);
  
  // Update parameters based on performance
  if (quality >= 4) {
    stability = stability * (1 + difficulty * 0.1);
  } else if (quality <= 2) {
    stability = stability * 0.5;
    difficulty = Math.min(difficulty + 0.15, 1.0);
  }
  
  // Calculate next review interval
  const interval = Math.pow(2, stability);
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  
  return nextReview;
}

function scoreToQuality(score: number): number {
  // Convert 0-10000 to FSRS quality scale (0-5)
  if (score >= 9000) return 5;  // Perfect
  if (score >= 8000) return 4;  // Good
  if (score >= 7000) return 3;  // Average
  if (score >= 6000) return 2;  // Poor
  if (score >= 5000) return 1;  // Bad
  return 0;                     // Complete failure
}
```

### Line-Level FSRS Data
```javascript
// Track performance per line
const lineFSRSData = {
  lineId: "uuid-here",
  lineIndex: 5,
  totalPractices: 0,
  averageScore: 0,
  currentStability: 1.0,
  currentDifficulty: 0.3,
  lastPracticedAt: null,
  nextReviewAt: null,
  streak: 0,
  bestScore: 0
};

function updateFSRSData(lineData: LineFSRSData, newScore: number): LineFSRSData {
  const quality = scoreToQuality(newScore);
  
  // Update statistics
  const totalPractices = lineData.totalPractices + 1;
  const averageScore = ((lineData.averageScore * lineData.totalPractices) + newScore) / totalPractices;
  
  // Update FSRS parameters
  const nextReview = calculateNextReview(newScore, lineData.currentStability);
  
  return {
    ...lineData,
    totalPractices,
    averageScore,
    currentStability: calculateStability(quality, lineData.currentStability),
    currentDifficulty: calculateDifficulty(quality, lineData.currentDifficulty),
    lastPracticedAt: new Date(),
    nextReviewAt: nextReview,
    streak: quality >= 4 ? lineData.streak + 1 : 0,
    bestScore: Math.max(lineData.bestScore, newScore)
  };
}
```

## 🔧 API Keys Configuration

### Required API Keys
```javascript
// lit-actions/src/karaoke/keys/
{
  "voxstral_api_key_grader_v6": "voxstral_...",
  "elevenlabs_api_key_v11": "elevenlabs_...",
  "openrouter_api_key_v20": "openrouter_...",
  "genius_api_key_contract_v1": "genius_..."
}
```

### Environment Setup
```bash
# Store API keys in encrypted format
lit-action encrypt --input keys/voxstral_api_key_grader_v6.json --output keys/encrypted/
lit-action encrypt --input keys/elevenlabs_api_key_v11.json --output keys/encrypted/
```

## 🚀 Deployment

### Deploy Lit Action
```bash
# Deploy to Lit Protocol
lit-action deploy \
  --action-src src/karaoke/karaoke-grader-v6-performance-grader.js \
  --action-name karaoke-grader-v6 \
  --network base-sepolia

# Get action CID
# 0x... (Store in contracts)
```

### Update Trusted PKP
```solidity
// In PerformanceGrader.sol
contract PerformanceGrader {
    address public constant TRUSTED_PKP = 0x9456aec64179FE39a1d0a681de7613d5955E75D3;
    
    modifier onlyTrustedPKP() {
        require(msg.sender == TRUSTED_PKP, "Only trusted PKP");
        _;
    }
}
```

## 🧪 Testing

### Unit Tests
```bash
# Test grading logic
npm run test-karaoke-grader

# Test FSRS scheduling  
npm run test-fsrs

# Test line-level integration
npm run test-line-level
```

### Integration Tests
```javascript
// test/test-direct-grading.mjs
import { gradePerformance } from '../src/karaoke/karaoke-grader-v6-performance-grader.js';

describe('Direct Grading Tests', () => {
  test('should grade line-level performance', async () => {
    const mockAudio = createMockAudioBuffer();
    const mockLineData = {
      lineId: 'test-line-uuid',
      lineIndex: 5,
      originalText: "I've been watching you for some time",
      startMs: 25000,
      endMs: 30000
    };
    
    const result = await gradePerformance(mockAudio, mockLineData);
    
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10000);
    expect(result.feedback).toBeDefined();
  });
});
```

### Manual Testing
```javascript
// Test with real audio
const testAudio = await fetchAudioRecording();
const testLine = await fetchLineData('uuid-here');

const result = await gradeLinePerformance(testAudio, testLine);

console.log('Grading Result:', {
  score: result.score,
  feedback: result.feedback,
  breakdown: result.performanceData
});
```

## 📊 Performance Metrics

### Grading Statistics
```javascript
// Track grading performance
const gradingMetrics = {
  totalGraded: 0,
  averageScore: 0,
  scoreDistribution: {
    excellent: 0,    // 9000-10000
    good: 0,         // 8000-8999
    average: 0,      // 7000-7999
    poor: 0,         // 6000-6999
    bad: 0,          // 0-5999
  },
  lineDifficulty: {},      // Track which lines are hardest
  userProgress: {},        // Track user improvement over time
  fsrsAccuracy: 0          // How well FSRS predicts success
};

function trackGradingResult(result) {
  gradingMetrics.totalGraded++;
  
  // Update score distribution
  if (result.score >= 9000) gradingMetrics.scoreDistribution.excellent++;
  else if (result.score >= 8000) gradingMetrics.scoreDistribution.good++;
  else if (result.score >= 7000) gradingMetrics.scoreDistribution.average++;
  else if (result.score >= 6000) gradingMetrics.scoreDistribution.poor++;
  else gradingMetrics.scoreDistribution.bad++;
  
  // Update line difficulty
  const lineId = result.lineId;
  if (!gradingMetrics.lineDifficulty[lineId]) {
    gradingMetrics.lineDifficulty[lineId] = { total: 0, average: 0 };
  }
  const lineStats = gradingMetrics.lineDifficulty[lineId];
  lineStats.total++;
  lineStats.average = ((lineStats.average * (lineStats.total - 1)) + result.score) / lineStats.total;
}
```

## 🔒 Security

### Anti-Cheat Measures
1. **Trusted PKP Only**: Only Lit Protocol PKP can grade performances
2. **Immutable Grading**: Once scored, cannot be changed
3. **Random Challenges**: Occasional re-grading to verify consistency
4. **Audio Fingerprinting**: Detect cloned or fake recordings

### Privacy Protection
- **No Audio Storage**: Grade and discard, only keep scores
- **Encrypted Communication**: All API calls use encrypted channels
- **User Anonymity**: Store only PKP addresses, not personal data

## 📱 Frontend Integration

### React Hook
```javascript
// app/src/hooks/useLitActionGrader.js
import { gradeLinePerformance } from '@karaoke/lit-actions';

export function useLitActionGrader() {
  const gradePerformance = async (audioBlob, lineData) => {
    try {
      // Convert audio to base64
      const audioBase64 = await blobToBase64(audioBlob);
      
      // Grade via Lit Action
      const result = await gradeLinePerformance({
        audioDataBase64: audioBase64,
        lineId: lineData.lineId,
        lineIndex: lineData.lineIndex,
        exerciseText: lineData.originalText,
        segmentHash: lineData.segmentHash,
        referenceAudio: lineData.segment.instrumentalUri
      });
      
      return result;
    } catch (error) {
      console.error('Grading failed:', error);
      throw new Error('Failed to grade performance');
    }
  };
  
  return { gradePerformance };
}
```

### Usage in Component
```jsx
// StudySessionPage.jsx
function StudySession() {
  const { gradePerformance } = useLitActionGrader();
  
  const handlePracticeComplete = async (recordingBlob, currentCard) => {
    try {
      setGrading(true);
      
      const result = await gradePerformance(recordingBlob, currentCard);
      
      // Emit performance event
      await emitLinePerformanceGraded({
        lineId: currentCard.lineId,
        score: result.score,
        feedback: result.feedback,
        metadataUri: recordingBlob.groveUri
      });
      
      // Move to next card
      nextCard();
      
    } catch (error) {
      console.error('Practice grading failed:', error);
      // Show error to user
    } finally {
      setGrading(false);
    }
  };
  
  return (
    <div>
      {/* Karaoke player component */}
      <KaraokePlayer
        audio={currentCard.segment.instrumentalUri}
        words={currentCard.alignment.words}
        onRecordingComplete={handlePracticeComplete}
      />
    </div>
  );
}
```

## 📈 Analytics

### Learning Progress Tracking
```javascript
// Track user learning over time
const userAnalytics = {
  userId: 'pkp-address',
  totalPractices: 0,
  averageScore: 0,
  streak: 0,
  strongestAreas: [],      // Lyric types user excels at
  weakestAreas: [],        // Areas needing improvement
  improvementRate: 0,      // How fast user is improving
  timeSpent: 0,           // Total practice time
  favoriteSongs: [],      // Most practiced songs
  dailyGoalProgress: 0,   // Progress towards daily goals
};

function updateUserAnalytics(userId, result) {
  // Update user progress metrics
  userAnalytics.totalPractices++;
  
  // Calculate improvement rate
  const recentScores = getRecentScores(userId, 10);
  const oldScores = getOlderScores(userId, 10);
  
  const recentAvg = recentScores.reduce((a, b) => a + b) / recentScores.length;
  const oldAvg = oldScores.reduce((a, b) => a + b) / oldScores.length;
  
  userAnalytics.improvementRate = recentAvg - oldAvg;
  
  // Update streak
  if (result.score >= 7000) {
    userAnalytics.streak++;
  } else {
    userAnalytics.streak = 0;
  }
}
```

## 📚 Additional Documentation

- **[Voxstral Integration](./voxtral-integration.md)** - AI model configuration
- **[AGENTS.md](../../AGENTS.md)** - Service integration guide
- **[README.md](../../README.md)** - Project overview
