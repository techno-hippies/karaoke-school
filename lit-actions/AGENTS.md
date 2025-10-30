# Lit Actions Agents Documentation

## Overview

Lit Actions are serverless, IPFS-hosted code that execute on the Lit Protocol network with blockchain-signing capabilities. This document provides a comprehensive overview of all Lit Actions in the Karaoke School v1 architecture.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Lit Protocol Network                       │
│  (Decentralized TEE for off-chain computation + PKP signing)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Executes
┌─────────────────────────────────────────────────────────────────┐
│                         Lit Actions                             │
│         (IPFS-hosted code, blockchain-signed results)           │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Sign
┌─────────────────────────────────────────────────────────────────┐
│                    Lens Testnet Contracts                       │
│            (Chain ID: 37111, zkSync-based L2)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Index
┌─────────────────────────────────────────────────────────────────┐
│                       The Graph Subgraph                        │
│           (Fast queries, leaderboards, analytics)               │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Display
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend App                             │
│                  (React/Next.js Web App)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Lit Actions Inventory

### Core Karaoke Actions

#### 🎵 `karaoke-scorer-v4.js` ⭐ CRITICAL
- **Purpose**: Pronunciation scoring with complex Lens signature pattern
- **Network**: Lens Testnet (Chain ID: 37111)
- **Key Features**:
  - 16-field EIP-712 signature pattern for zkSync
  - Voxstral STT integration
  - SongCatalogV1 integration
  - Multi-source scoreboard support
- **Usage**: Production-grade scoring for karaoke performances
- **Critical Pattern**: The 16-field signature pattern MUST be replicated in all new Lens Lit Actions

#### 📚 `study-scorer-v1.js`
- **Purpose**: FSRS-4.5 spaced repetition algorithm + pronunciation scoring
- **Network**: Base Sepolia (Legacy - migrate to Lens)
- **Key Features**:
  - Complete FSRS-4.5 implementation (vanilla JS)
  - Levenshtein distance pronunciation scoring
  - Voxstral STT integration
  - Contract writes via PKP signing
- **Usage**: Language learning with spaced repetition optimization

#### 🎯 `karaoke-grader-v5.js` ⭐ NEW
- **Purpose**: Unified karaoke grader with PerformanceGrader integration
- **Network**: Lens Testnet (Chain ID: 37111)
- **Key Features**:
  - Combines best of karaoke-scorer-v4 + study-scorer-v1
  - PerformanceGrader contract integration
  - Event emission for leaderboard indexing
  - FSRS algorithm ready
  - Test mode support
- **Usage**: Next-generation unified karaoke grading

#### 🎶 `match-and-segment-v10.js`
- **Purpose**: Song metadata processing and segmentation
- **Network**: Base Sepolia (Legacy - migrate to Lens)
- **Key Features**:
  - Complex transaction signing pattern
  - Song matching and segmentation logic
  - Contract write operations
  - Audio metadata processing
- **Usage**: Back-end song processing pipeline

#### 🎤 `audio-processor-v4.js`
- **Purpose**: Audio processing orchestration
- **Network**: Base Sepolia
- **Key Features**:
  - Modal API integration
  - Spleeter + fal.ai + Grove pipeline
  - Simplified orchestration flow
- **Usage**: Heavy audio processing offload

#### 🌐 `translate-lyrics-v1.js`
- **Purpose**: Multi-language lyrics translation
- **Network**: Lens Testnet
- **Key Features**:
  - Gemini API integration
  - Translation scoring
  - Grove metadata upload
- **Usage**: Internationalization of song content

### STT (Speech-to-Text) Actions

#### 🗣️ `karaoke-scorer-v4.js` (moved to karaoke/)
- **Purpose**: Pronunciation scoring using Voxstral STT
- **Network**: Lens Testnet
- **Key Features**:
  - Multi-segment scoring
  - Complex signature patterns
  - Song metadata integration
- **Usage**: Primary scoring Lit Action

### Genius Actions

#### 🎵 `referents.js`
- **Purpose**: Genius metadata processing
- **Network**: Lens Testnet
- **Key Features**:
  - Genius API integration
  - Song metadata extraction
- **Usage**: Music database enrichment

### Quiz Actions

#### ❓ Various quiz-related actions
- **Purpose**: Educational quiz generation and scoring
- **Network**: Mixed (Base Sepolia/Lens)
- **Usage**: Language learning mini-games

### Study Actions

#### 📖 `study-session-recorder-v1.js`
- **Purpose**: Recording and analyzing study sessions
- **Network**: Lens Testnet
- **Key Features**:
  - Session tracking
  - Progress analytics
- **Usage**: Learning progress monitoring

### STT (Speech-to-Text) Actions

#### 🔊 Various STT actions
- **Purpose**: Speech recognition and processing
- **Network**: Mixed
- **Usage**: Audio transcription for multiple use cases

## Critical Architecture Patterns

### 1. Lens Network Signature Pattern

**CRITICAL**: All Lit Actions writing to Lens contracts MUST use this exact pattern.

```javascript
// 16-Field EIP-712 Signature Pattern for Lens (zkSync)
const signedFields = [
  0,  // nonce (minimal big-endian bytes)
  1,  // maxPriorityFeePerGas (0 for zkSync)
  2,  // maxFeePerGas
  3,  // gasLimit
  4,  // to (address or '0x')
  5,  // value (0 for contract calls)
  6,  // data (encoded function call)
  7,  // yParity (0 or 1) - NOT v (27/28)!
  8,  // r (full 32 bytes)
  9,  // s (full 32 bytes)
  10, // chainId
  11, // from (address)
  12, // gasPerPubdataByteLimit
  13, // factoryDeps (empty array [])
  14, // customSignature (empty string '0x')
  15  // paymasterParams (empty array [])
];
```

**See**: `docs/LENS_SIGNATURE_PATTERN.md` for complete documentation

### 2. FSRS-4.5 Algorithm Implementation

Implemented in `study-scorer-v1.js` and referenced in `karaoke-grader-v5.js`:

- Complete spaced repetition algorithm
- Card state management
- Rating conversion (0-3 scale)
- Difficulty and stability tracking

### 3. Voxstral STT Integration

Standard pattern across multiple Lit Actions:

```javascript
// Multipart form data for Voxstral API
const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
const audioData = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0));

// Call Mistral AI Voxstral endpoint
const response = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${voxstralKey}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  },
  body: bodyBytes
});
```

### 4. Encrypted API Key Management

Pattern for handling sensitive API keys:

```javascript
const voxstralKey = await Lit.Actions.decryptAndCombine({
  accessControlConditions,
  ciphertext,
  dataToEncryptHash,
  authSig: null,
  chain: 'ethereum'
});
```

## Network Configuration

### Lens Testnet (Primary)
```javascript
export const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz';
export const LENS_TESTNET_CHAIN_ID = 37111;
```

### Base Sepolia (Legacy)
```javascript
export const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
export const BASE_SEPOLIA_CHAIN_ID = 84532;
```

## Contract Integration

### PerformanceGrader.sol (Event-Only)
- **Address**: `0x0000000000000000000000000000000000000000` (to be deployed)
- **Purpose**: Emit performance grading events for leaderboards
- **Anti-Cheat**: Only trusted PKP can grade

### SongCatalogV1.sol
- **Address**: `0x88996135809cc745E6d8966e3a7A01389C774910`
- **Purpose**: Song metadata registry with Grove URIs

### KaraokeScoreboardV4.sol
- **Address**: `0x8301E4bbe0C244870a4BC44ccF0241A908293d36`
- **Purpose**: Multi-source scoreboard with ContentSource enum

## Development Workflow

### 1. Contract Deployment
```bash
cd contracts
forge script script/DeployEvents.s.sol --rpc-url lens-testnet --broadcast
```

### 2. Lit Action Development
1. Copy critical patterns from existing actions
2. Implement 16-field signature for Lens writes
3. Use test mode for development: `testMode: true`
4. Upload to IPFS: `node scripts/upload-lit-action.mjs`

### 3. Testing
```bash
# Test specific Lit Action
dotenvx run -- node src/test/test-[action-name].mjs

# Update PKP permissions
bun run scripts/update-pkp-permissions.ts
```

### 4. Frontend Integration
```javascript
const result = await litClient.executeJs({
  code: litActionCode,
  authContext: authContext,
  jsParams: {
    audioDataBase64,
    userAddress,
    songId,
    segmentId,
    // ... other params
  }
});
```

## Testing & Debugging

### Test Mode
All Lit Actions support test mode to bypass API calls:

```javascript
const testMode = true; // or pass via jsParams
// Uses simulated data instead of real API calls
```

### Error Handling
Common patterns:

```javascript
try {
  // Lit Action logic
  success = true;
} catch (error) {
  success = false;
  errorType = error.message;
}

Lit.Actions.setResponse({
  response: JSON.stringify({
    success,
    errorType,
    // ... other data
  })
});
```

## Security Considerations

### PKP Permissions
- Lit Actions execute with PKP credentials
- Signatures are verified on-chain
- Only trusted PKP addresses can call sensitive functions

### API Key Encryption
- All sensitive API keys encrypted via Lit Protocol
- Decrypted within TEE, never exposed to client
- Access control conditions prevent unauthorized access

### Contract Security
- PerformanceGrader: Only trusted PKP can grade
- Event-only contracts: No storage, immutable events
- Subgraph indexing: Public, verifiable leaderboards

## Monitoring & Analytics

### Execution Tracking
- All Lit Actions return execution time
- Error types logged for debugging
- Success/failure status tracked

### Blockchain Events
- PerformanceGraded events for leaderboards
- Transaction hashes for verification
- Subgraph queries for analytics

### Grove Metadata
- Immutable storage for performance data
- IPFS CIDs for verification
- CDN-backed access via Grove

## Future Roadmap

### Migration to Lens
- [ ] Migrate all Base Sepolia actions to Lens
- [ ] Deploy PerformanceGrader contract
- [ ] Update subgraph for new events

### Enhanced Features
- [ ] Real-time leaderboards
- [ ] Advanced FSRS integration
- [ ] Multi-language scoring
- [ ] Performance analytics

### Infrastructure
- [ ] Lit Action deployment automation
- [ ] Contract verification
- [ ] Monitoring dashboards

## Key Files Reference

### Documentation
- `docs/LENS_SIGNATURE_PATTERN.md` - Critical signature documentation
- `STUDY_SCORER_ANALYSIS.md` - FSRS algorithm analysis
- Various README files in `docs/`

### Configuration
- `src/karaoke/contracts.config.js` - Contract addresses
- `.env` and `.env.keys` - Environment variables

### Scripts
- `scripts/upload-lit-action.mjs` - IPFS upload
- `scripts/update-pkp-permissions.ts` - PKP management

### Testing
- `src/test/` - Test files for various actions
- `test-fixtures/` - Sample data for testing

## Quick Reference

### Deploy New Contract
```bash
forge script script/DeployEvents.s.sol --rpc-url lens-testnet --broadcast
```

### Upload Lit Action
```bash
node scripts/upload-lit-action.mjs
```

### Update PKP Permissions
```bash
bun run scripts/update-pkp-permissions.ts
```

### Test Lit Action
```bash
dotenvx run -- node src/test/test-[action].mjs
```

---

**This document should be kept up-to-date as the Lit Actions architecture evolves. All new actions must follow the established patterns documented here.**
