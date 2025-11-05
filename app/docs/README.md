# React Frontend Documentation

**AI-powered karaoke learning interface**

## 🚀 Quick Start

```bash
cd app
bun install
bun run dev
```

**Access**: http://localhost:5173

## 📁 Key Files

- `src/pages/StudySessionPage.tsx` - Main karaoke learning interface
- `src/hooks/useStudyCards.ts` - Line-level FSRS card loading
- `src/hooks/useLitActionGrader.ts` - AI performance grading
- `src/lib/graphql/client.ts` - Subgraph GraphQL client
- `src/components/feed/VideoPost.tsx` - Social feed components

## 🎯 Line-Level FSRS Integration

### StudySessionPage Updates
- **Before**: Shows 1 card per song (segment-level)
- **After**: Shows 15+ cards per song (line-level)

### useStudyCards Hook
```typescript
// Query lineCards instead of segments
const GET_LINE_CARDS = gql`
  query GetLineCards($grc20WorkId: String!) {
    lineCards(where: { segment_: { grc20WorkId: $grc20WorkId } }) {
      id
      lineId
      lineIndex
      segmentHash
      segment {
        instrumentalUri
        alignmentUri
        translations { languageCode, translationUri }
      }
      performances(where: { performer: $performer }) {
        score
        gradedAt
      }
    }
  }
`
```

## 🔧 Environment Configuration

```bash
# Local development
VITE_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/subgraph-0/
VITE_LENS_ENVIRONMENT=testnet

# Production
VITE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../karaoke-school-v1
VITE_LENS_ENVIRONMENT=testnet
```

## 🎵 Karaoke Player Integration

### Word-Level Timing (ElevenLabs)
```typescript
// Fetch alignment data
const alignment = await fetch(segment.alignmentUri);
const words = alignment.words; // [{text: "Hello", start: 0.1, end: 0.5}]

// Display word highlighting
<KaraokePlayer
  audio={instrumental}
  words={words}
  currentTime={audio.currentTime}
  onComplete={recordPerformance}
/>
```

### Line-Level Progression
```typescript
// Use lineIndex for progressive learning
const exerciseText = translationData.lines[currentCard.lineIndex].originalText;
const startTime = translationData.lines[currentCard.lineIndex].start;
const endTime = translationData.lines[currentCard.lineIndex].end;
```

## 🤖 Lit Actions Integration

### Performance Grading
```typescript
// Grade individual lines
async function gradeLinePerformance(audioBlob: Blob, lineData: StudyCard) {
  const audioBase64 = await blobToBase64(audioBlob);
  
  const result = await executeLitAction('karaoke-scorer-v4', {
    audioDataBase64: audioBase64,
    referenceAudio: lineData.segment.instrumentalUri,
    exerciseText: lineData.exerciseText,
    lineId: lineData.lineId,
    lineIndex: lineData.lineIndex,
    segmentHash: lineData.segmentHash,
    userAddress: user.pkpAddress,
  });
  
  return result;
}
```

## 📊 State Management

### Study Session State
```typescript
interface StudyCard {
  id: string;
  lineId: string;
  lineIndex: number;
  segmentHash: string;
  segment: Segment;
  exerciseText: string;
  fsrs: FSRSState;
}

interface FSRSState {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
}
```

## 🎯 Key Routes

- `/` - For You Feed
- `/song/{grc20WorkId}` - Song details
- `/song/{grc20WorkId}/study` - Study session (line-level)
- `/class/{classId}` - Class-based learning

## 🔗 Dependencies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **GraphQL Request** - Subgraph queries
- **Wagmi** - Blockchain integration
- **Lit Protocol SDK** - PKP authentication

## 🧪 Testing Line-Level FSRS

1. Start app: `bun run dev`
2. Visit: `/song/{grc20WorkId}/study`
3. Verify multiple cards load (line-level)
4. Practice one line → Check LinePerformanceGraded event
5. Visit again → Verify card progression

## 📚 Additional Documentation

- **[Line-Level FSRS Implementation](../line-level-fsrs.md)** - Detailed FSRS integration
- **[AGENTS.md](../../AGENTS.md)** - Service integration guide
- **[README.md](../../README.md)** - Project overview
