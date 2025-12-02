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
# Lens Protocol
VITE_LENS_ENVIRONMENT=testnet
VITE_LENS_APP_ADDRESS=0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0
VITE_LENS_CUSTOM_NAMESPACE=0xa304467aD0C296C2bb11079Bc2748223568D463e

# Subgraph Mode (optional)
# Defaults to The Graph Studio (production)
# Set to "local" to use local GND on port 8000
# VITE_SUBGRAPH_MODE=local

# Lit Payments (naga-test)
# Payer that sponsors PKP mint + Lit Actions
VITE_LIT_PAYER_ADDRESS=0x9456aec64179FE39a1d0a681de7613d5955E75D3
```

**Subgraph Endpoints:**
- **Production** (default): `https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v0.0.12`
- **Local GND**: `http://localhost:8000/subgraphs/name/subgraph-0/` (requires `VITE_SUBGRAPH_MODE=local`)

### Lit Payments (naga-test)
- **Payer address**: `0x9456aec64179FE39a1d0a681de7613d5955E75D3`
- **PKP signer (Lit Actions/contracts)**: `0x3e89ABa33562d4C45E62A97Aa11443F738983bFf` (keep ≥0.02 GRASS)
- Keep the payer’s Lit Payment Manager balance > 0 on naga-test. Top up with tstLPX from the Yellowstone faucet, then deposit from a secure script (do not ship the key to the browser):

```ts
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaTest } from '@lit-protocol/networks'
import { privateKeyToAccount } from 'viem/accounts'

const litClient = await createLitClient({ network: nagaTest })
const account = privateKeyToAccount(process.env.PAYER_PRIVATE_KEY!)
const pm = await litClient.getPaymentManager({ account })

await pm.deposit({ amountInEth: '1' })            // sponsor everyone from payer
// or
await pm.depositForUser({ userAddress: account.address, amountInEth: '1' })

console.log(await pm.getBalance({ userAddress: account.address }))
```

Add only the payer **address** to `.env.local` (`VITE_LIT_PAYER_ADDRESS`); run deposits from a server-side helper or local script with the private key.

**Sponsoring PKP mints in the frontend**:
- Use the same payer above. After a new PKP is minted, delegate payments to that PKP address server-side:
  ```ts
  await pm.delegatePaymentsBatch({
    userAddresses: [newPkpEthAddress],
    totalMaxPrice: '20000000000000000', // optional guardrails
    requestsPerPeriod: '100',
    periodSeconds: '3600',
  })
  ```
- Alternatively, `depositForUser({ userAddress: newPkpEthAddress, amountInEth: '0.1' })` to sponsor that user directly.
- Keep these operations off the client; reuse the single payer and update balances periodically.

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
