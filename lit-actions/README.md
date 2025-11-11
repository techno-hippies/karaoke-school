# Lit Actions v2 - Organized Structure

This folder contains the **active ExerciseEvents lit action** plus archived material from the legacy PerformanceGrader flow.

> **Heads up:** `study/exercise-grader-v1.js` is the production scorer that targets
> `ExerciseEvents`. The previous PerformanceGrader-based scripts now live in
> `archived/performance-grader/` and are kept only for historical reference.

## 📁 Directory Structure

```
lit-actions-v2/
├── study/              # 2 lit actions (both study-focused)
│   ├── sat-it-back-v1.js   # Main karaoke grader (PerformanceGrader v6)
│   └── study-scorer-v1.js  # FSRS-based study scorer
├── scripts/            # Utility scripts for IPFS/PKPs management
│   ├── upload-lit-action.mjs    # Upload lit actions to IPFS via Pinata
│   ├── mint-pkp.ts             # Mint PKP on Lit Protocol
│   ├── add-pkp-permission.mjs  # Add permissions to PKP
│   ├── get-pkp-pubkey.mjs      # Get PKP public key
│   ├── setup-test-credits.sh   # Setup test credits
│   ├── test-structured-output.sh # Test structured output
│   ├── deploy-lit-action.sh     # Deploy lit action (upload + permissions)
│   └── README-TEST-SETUP.md     # Test setup documentation
├── config/             # Configuration files
│   └── contracts.config.js      # Contract addresses & network config
├── systems/            # Shared systems & algorithms
│   └── fsrs/                  # FSRS-4.5 spaced repetition system
│       ├── algorithm.js        # Core FSRS algorithm
│       ├── scoring.js          # Pronunciation scoring (Levenshtein)
│       └── constants.js        # FSRS constants & parameters
├── keys/               # API keys & secrets
│   ├── voxtral_api_key.json       # Voxtral STT API key
│   ├── voxtral_api_key_v4.json    # Voxtral API key v4
│   ├── db_endpoint_url.json        # Database endpoint
│   ├── db_auth_token.json          # Database auth token
│   ├── contract_address.json       # Contract addresses
│   └── clip_registry_address.json  # Clip registry address
├── tests/              # Future test files
└── karaoke/            # Empty (reserved for future use)
```

## 🚀 Quick Start

### Deploy a Lit Action

1. **Upload to IPFS**:
   ```bash
   node scripts/upload-lit-action.mjs study/sat-it-back-v1.js "Sat It Back v1"
   ```

2. **Add PKP Permissions** (if needed):
   ```bash
   node scripts/add-pkp-permission.mjs <IPFS_CID>
   ```

3. **Deploy Complete** (upload + permissions + config):
   ```bash
   ./scripts/deploy-lit-action.sh study/sat-it-back-v1.js "Sat It Back v1" VITE_LIT_ACTION_SAT_IT_BACK
   ```

### Mint a New PKP

```bash
bun run scripts/mint-pkp.ts
```

This will:
- Mint a new PKP on Chronicle Yellowstone testnet
- Add signing permissions
- Save credentials to `output/pkp-credentials.json`
- Update `.env` with `PKP_ADDRESS`

## 📋 Lit Actions

### 1. `study/sat-it-back-v1.js` - Main Karaoke Grader

**Purpose**: PerformanceGrader v6 integration for karaoke learning
- Transcribes user audio via Voxstral STT
- Calculates pronunciation scores
- Submits scores to PerformanceGrader contract
- Emits PerformanceGraded events for leaderboard

**Network**: Lens Testnet (Chain ID: 37111)
**Contract**: 0xab92c2708d44fab58c3c12aaa574700e80033b7d
**PKP**: 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30

### 2. `study/study-scorer-v1.js` - FSRS Study Scorer

**Purpose**: Spaced repetition learning with FSRS-4.5
- Transcribes user audio via Voxstral STT
- Calculates pronunciation scores (Levenshtein distance)
- Runs FSRS-4.5 algorithm for spaced repetition
- Writes card states to FSRSTrackerV1 contract

**Network**: Base Sepolia (legacy) / Lens Testnet
**Features**: Full FSRS implementation with pronunciation scoring

## 🔧 Utility Scripts

### IPFS/Pinata Management
- `upload-lit-action.mjs` - Upload lit action to IPFS via Pinata
- `deploy-lit-action.sh` - Complete deployment workflow

### PKP Management
- `mint-pkp.ts` - Mint new PKP with permissions
- `add-pkp-permission.mjs` - Add permitted actions to existing PKP
- `get-pkp-pubkey.mjs` - Get PKP public key information

### Testing & Setup
- `setup-test-credits.sh` - Setup test credits for development
- `test-structured-output.sh` - Test lit action structured output
- `README-TEST-SETUP.md` - Comprehensive test setup guide

## ⚙️ Configuration

### Contract Configuration (`config/contracts.config.js`)
Contains deployed contract addresses for:
- **Performance Grading**: PerformanceGrader, Scoreboard
- **Event Emission**: SegmentEvents, SongEvents, AccountEvents
- **Network Config**: RPC endpoints, chain IDs

### API Keys (`keys/`)
Contains encrypted API keys for:
- **Voxstral STT**: Audio transcription
- **Database**: Endpoint and authentication
- **Contracts**: Deployment addresses

## 🧠 FSRS System (`systems/fsrs/`)

### Core Components
- `algorithm.js` - Complete FSRS-4.5 algorithm implementation
- `scoring.js` - Pronunciation scoring using Levenshtein distance
- `constants.js` - FSRS parameters and learning steps

### Features
- Spaced repetition scheduling
- Memory decay modeling
- Difficulty adjustment
- Pronunciation similarity scoring
- Card state management

## 🔐 Security & Credentials

### PKP Management
- PKP credentials are managed via `scripts/mint-pkp.ts`
- Permissions are added via `scripts/add-pkp-permission.mjs`
- All PKP operations use Chronicle Yellowstone testnet

### API Keys
- All API keys are stored in `keys/` directory
- Keys are loaded at runtime in lit actions
- No hardcoded credentials in lit action code

## 🌐 Networks

### Primary: Lens Testnet
- **Chain ID**: 37111
- **RPC**: https://rpc.testnet.lens.xyz
- **Explorer**: https://block-explorer.testnet.lens.xyz
- **Purpose**: Production karaoke features

### Secondary: Chronicle Yellowstone
- **Chain ID**: 175188  
- **RPC**: https://yellowstone-rpc.litprotocol.com
- **Explorer**: https://yellowstone-explorer.litprotocol.com
- **Purpose**: PKP minting and management

## 🔄 Migration History

This organized structure was created from the messy `lit-actions` folder:

### ✅ What was moved:
- **2 lit actions**: From archive → study/ directory
- **Utility scripts**: From scripts/ → scripts/ (cleaned up examples)
- **Configuration**: From src/karaoke/ → config/
- **FSRS system**: From src/karaoke/fsrs/ → systems/fsrs/
- **API keys**: From src/stt/keys/ → keys/

### ❌ What was left behind (for archiving):
- **Old versions**: All files in `src/karaoke/archive/` 
- **Test experiments**: Various test files
- **Deprecated contracts**: Old Base Sepolia contracts

## 🚦 Development Workflow

1. **Initialize**: Run `bun run scripts/mint-pkp.ts` to setup PKP
2. **Develop**: Create/edit lit actions in `study/` directory
3. **Test**: Use `scripts/upload-lit-action.mjs` for quick testing
4. **Deploy**: Use `scripts/deploy-lit-action.sh` for production
5. **Monitor**: Check contract events on Lens testnet explorer

## 📞 Support

For issues with:
- **PKP minting**: Check Chronicle Yellowstone faucet and testnet tokens
- **IPFS uploads**: Verify Pinata JWT in environment
- **Contract calls**: Check network configuration in `config/contracts.config.js`
- **Audio transcription**: Verify Voxstral API keys in `keys/` directory

---

**Status**: ✅ **Organized & Ready for Development**

This structure provides a clean, maintainable codebase with 2 production-ready lit actions and comprehensive utility systems for IPFS/PKP management.
