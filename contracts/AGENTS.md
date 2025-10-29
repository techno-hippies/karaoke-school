# Contracts - Agent Guide

## Core Commands

• **Compile**: `forge build` (ZKSync foundry with dual compilation)
• **Test**: `forge test` (EVM → EraVM context switching)
• **Deploy**: `forge script script/DeployEvents.s.sol --zk --broadcast --rpc-url https://sepolia.era.zksync.dev`
• **Cast Call**: `cast call --zksync --private-key <KEY> <address> "number()" --rpc-url https://sepolia.era.zksync.dev --trace`
• **Verify**: `forge verify-contract --zksync <address> SegmentEvents --chain zksync-sepolia`

## Contract Architecture

**Purpose**: Event-only smart contracts for karaoke segment tracking and The Graph indexing (NO STORAGE)

**Core Dependencies**:
- **Foundry-ZKSync**: ZKSync-specific foundry with EraVM support
- **Solidity ^0.8.19**: Contract language with ZK extensions
- **Lens Chain (ZKSync Era)**: Deployment network (testnet/mainnet)
- **The Graph**: Event indexing for fast queries

## ZKSync-Specific Execution Context

**Dual Context Execution**:
```typescript
// Step 1: Aggregate (Dual Compilation)
// - EVM compilation for standard features
// - EraVM compilation for ZK-specific features

// Step 2: Intercept (CALL/CREATE Override)
// - EVM calls → EraVM execution
// - Maintains Ethereum tooling compatibility

// Step 3: Assimilate (One-shot zkEVM)
// - EraVM context for ZKSync-specific operations
// - Enhanced performance and lower fees
```

## Key Patterns

**Event-Only Design**:
```solidity
// NO STORAGE - All data in Grove/IPFS
// Events enable subgraph indexing
contract SegmentEvents {
    event SegmentRegistered(
        bytes32 indexed segmentHash,
        string indexed grc20WorkId,    // References public metadata layer
        string spotifyTrackId,
        string metadataUri             // Grove URI (permanent storage)
    );
    
    // Anyone can emit - no authorization needed
    function emitSegmentRegistered(...) external {
        emit SegmentRegistered(...);
    }
}
```

**Gas Optimization**:
- **~35k gas per event** (minimal footprint)
- **No storage writes** (all data in Grove)
- **Events only** (indexed by The Graph)
- **External calls** (data integrity via grove:// URIs)

## Development Patterns

**Environment Setup**:
```bash
# Install Foundry-ZKSync
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Configure ZKSync RPC endpoints
export ZKSYNC_SEPOLIA_RPC="https://sepolia.era.zksync.dev"
export ZKSYNC_MAINNET_RPC="https://mainnet.era.zksync.dev"
export LENS_TESTNET_RPC="https://testnet.lens.dev"

# ZKSync-specific test execution
forge test --zksync  # Switches to EraVM context during test
```

**ZKSync Testing Flow**:
1. **EVM Context**: Start in EVM for Foundry compatibility
2. **Context Switch**: Switch to EraVM for ZK-specific features
3. **Dual Compilation**: Contracts compile for both EVM and EraVM
4. **EraVM Execution**: All calls execute in ZKsync environment

## Critical Files

**Event Contracts**:
- `src/events/SegmentEvents.sol` - Karaoke segment registration/processing
- `src/events/TranslationEvents.sol` - Multi-language translation tracking
- `src/events/PerformanceGrader.sol` - User performance scoring

**Deployment Scripts**:
- `script/DeployEvents.s.sol` - Multi-contract deployment
- `script/DeployEvents.t.sol` - Test deployment script

## Deployed Contracts (Lens Testnet)

> **Chain ID**: 37111 | **RPC**: https://rpc.testnet.lens.xyz

- **PerformanceGrader**: `0x788A245B9AAB4E29D0152424b72bcB8Ac7c1E260` ✅
  - PKP-verified grading (~48k gas)
  - Trusted PKP: `0x3345Cb3A0CfEcb47bC3D638e338D26c870FA2b23`
  - Event: `PerformanceGraded(uint256,bytes32,address,uint16,string,uint64)`

- **SongEvents**: `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6` ✅
  - Song registration events (~28k gas)
  - Events: `SongRegistered`, `SongProcessed`

- **SegmentEvents**: `0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8` ✅
  - Segment processing events (~30k gas)
  - Events: `SegmentRegistered`, `SegmentProcessed`

- **AccountEvents**: `0x3709f41cdc9E7852140bc23A21adCe600434d4E8` ✅
  - Account tracking (optional, ~25k gas)
  - Events: `AccountCreated`, `AccountUpdated`

## Contract Overview

### PerformanceGrader.sol
**Purpose**: PKP-verified performance grading with anti-cheat protection

**Key Function**:
```solidity
function gradePerformance(
    uint256 performanceId,
    bytes32 segmentHash,
    address performer,
    uint16 score,             // 0-10000 (percentage basis points)
    string calldata metadataUri
) external onlyTrustedPKP
```

**Event**: `PerformanceGraded(uint256 indexed performanceId, bytes32 indexed segmentHash, address indexed performer, uint16 score, string metadataUri, uint64 timestamp)`

**Usage**: Lit Actions sign with PKP → submit scores → immutable leaderboard events

### SongEvents.sol
**Purpose**: Track karaoke songs from registration to processing

**Events**: `SongRegistered(string songId, string grc20WorkId, string spotifyTrackId, string metadataUri)`

### SegmentEvents.sol
**Purpose**: Track karaoke segment pipeline from registration to processing

**Events**:
```solidity
SegmentRegistered(
    bytes32 segmentHash,
    string grc20WorkId,       // GRC-20 public metadata UUID
    string spotifyTrackId,
    uint32 segmentStartMs,    // Fal.ai timing
    uint32 segmentEndMs,
    string metadataUri
)

SegmentProcessed(
    bytes32 segmentHash,
    string instrumentalUri,   // Grove: enhanced audio (fal.ai)
    string alignmentUri,      // Grove: ElevenLabs word timing
    uint8 translationCount,
    string metadataUri
)
```

### AccountEvents.sol
**Purpose**: Track user account creation and updates for leaderboard integration

## Deployment

**Foundry-ZKSync Configuration** (`foundry.toml`):
```toml
[rpc_endpoints]
zksync-sepolia = "https://sepolia.era.zksync.dev"
zksync-mainnet = "https://mainnet.era.zksync.dev"
lens-testnet = "https://testnet.lens.dev"

[etherscan]
zksync-sepolia = { key = "${BLOCKSCOUT_API_KEY}" }
zksync-mainnet = { key = "${BLOCKSCOUT_API_KEY}" }
lens-testnet = { key = "${BLOCKSCOUT_API_KEY}" }

[zksync]
era_vm_version = "1.5.0"  # ZKSync Era VM version
```

**ZKSync Deployment Script**:
```solidity
// script/DeployEvents.s.sol
import "forge-std/Script.sol";

contract DeployEvents is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Deploy to ZKSync Sepolia
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy event contracts
        SegmentEvents segmentEvents = new SegmentEvents();
        TranslationEvents translationEvents = new TranslationEvents();
        PerformanceGrader performanceGrader = new PerformanceGrader();
        
        console.log("SegmentEvents:", address(segmentEvents));
        console.log("TranslationEvents:", address(translationEvents));
        console.log("PerformanceGrader:", address(performanceGrader));
        
        vm.stopBroadcast();
    }
}
```

**Deploy Commands**:
```bash
# ZKSync Sepolia deployment (with --zk flag)
forge script script/DeployEvents.s.sol \
  --zk \
  --rpc-url https://sepolia.era.zksync.dev \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# ZKSync-specific verification (with --zksync flag)
forge verify-contract --zksync 0x... SegmentEvents --chain zksync-sepolia
forge verify-contract --zksync 0x... TranslationEvents --chain zksync-sepolia
forge verify-contract --zksync 0x... PerformanceGrader --chain zksync-sepolia

# Cast calls with ZKSync (requires --zksync flag)
cast call --zksync --private-key $PRIVATE_KEY 0xContractAddress \
  "number()" --rpc-url https://sepolia.era.zksync.dev --trace

# For tracing events
cast call --zksync --private-key $PRIVATE_KEY 0xContractAddress \
  "emitSegmentRegistered(bytes32,string,string,uint32,uint32,string)" \
  0x123... "uuid" "spotify:track:123" 45000 235000 "grove://..." \
  --rpc-url https://sepolia.era.zksync.dev
```

## Integration Patterns

**Pipeline Integration**:
```typescript
// Karaoke pipeline calls contract functions
const segmentHash = await generateSegmentHash(spotifyTrackId, startMs);
const tx = await segmentEvents.emitSegmentRegistered(
  segmentHash,
  grc20WorkId,           // From GRC-20 layer
  spotifyTrackId,
  startMs,
  endMs,
  metadataUri            // Grove JSON
);

// After processing audio pipeline
await segmentEvents.emitSegmentProcessed(
  segmentHash,
  instrumentalUri,       // Grove: enhanced audio
  alignmentUri,          // Grove: word timing
  translationCount,
  updatedMetadataUri
);

// For each translation
await translationEvents.emitTranslationAdded(
  segmentHash,
  "es",                  // Language code
  translationUri,        // Grove: Spanish translation
  "gemini-flash-2.5",
  9200,                  // 92% confidence
  false                  // Not validated yet
);
```

**Subgraph Integration**:
```graphql
# Subgraph listens to contract events
type Segment @entity {
  id: Bytes!                    # segmentHash
  grc20WorkId: String!          # From SegmentRegistered event
  spotifyTrackId: String!       # For audio matching
  instrumentalUri: String       # From SegmentProcessed event
  alignmentUri: String          # From SegmentProcessed event
  translations: [Translation!]! @derivedFrom(field: "segment")
  registeredAt: BigInt!         # From event timestamp
}

type Translation @entity {
  id: ID!                        # segmentHash-languageCode
  segment: Segment!              # Links to parent segment
  languageCode: String!          # "es", "zh", "ja", "ko"
  translationUri: String!        # Grove JSON URI
  confidenceScore: BigInt!       # 0-10000
  validated: Boolean!            # Human verification
  addedAt: BigInt!               # Event timestamp
}
```

## Testing

**Test Structure**:
```solidity
// test/SegmentEvents.t.sol
import "forge-std/Test.sol";
import "../src/events/SegmentEvents.sol";

contract SegmentEventsTest is Test {
    SegmentEvents public segmentEvents;
    
    function setUp() public {
        segmentEvents = new SegmentEvents();
    }
    
    function testEmitSegmentRegistered() public {
        bytes32 segmentHash = keccak256("test-segment");
        string memory grc20WorkId = "f1d7f4c7-ca47-4ba3-9875-a91720459ab4";
        string memory metadataUri = "grove://abc123...";
        
        vm.expectEmit(true, true, false, true);
        emit SegmentRegistered(
            segmentHash,
            grc20WorkId,
            "spotify:track:123",
            45000,
            235000,
            metadataUri,
            address(this),
            block.timestamp
        );
        
        segmentEvents.emitSegmentRegistered(
            segmentHash,
            grc20WorkId,
            "spotify:track:123",
            45000,
            235000,
            metadataUri
        );
    }
}
```

**Test Commands**:
```bash
# Run all tests
forge test

# Run specific test
forge test --match-test testEmitSegmentRegistered

# Verbose output
forge test -vvvv

# Coverage report
forge coverage
```

## Gas Optimization

**Event-Only Benefits**:
- **No storage**: Save ~20k gas per write
- **No SSTORE**: Events cost ~36k vs 200k for storage
- **Indexable**: Events automatically indexed by The Graph
- **Permanent**: Grove IPFS storage for actual data

**Event Gas Costs**:
```
SegmentRegistered: ~35k gas
SegmentProcessed: ~42k gas
TranslationAdded: ~25k gas
PerformanceGraded: ~30k gas
```

**Storage Alternatives**:
```solidity
// Expensive: Store data on-chain
contract ExpensiveContract {
    struct Segment {
        string metadata;
        string instrumentalUri;
        uint256 createdAt;
    }
    mapping(bytes32 => Segment) public segments;  // ~200k gas per write
}

// Cheap: Events only
contract CheapContract {
    event SegmentRegistered(bytes32 hash, string metadata);  // ~35k gas
}
```

## Security Considerations

**No Access Control**:
```solidity
// Events are public - anyone can emit
// This is INTENTIONAL:
// 1. Decentralized - no central authority
// 2. Open data - anyone can contribute segments/translations
// 3. Spam prevention via The Graph queries + reputation
```

**Data Integrity**:
```solidity
// Integrity via grove:// URIs (content-addressed)
function emitSegmentRegistered(
    bytes32 segmentHash,
    string calldata grc20WorkId,
    string calldata metadataUri  // grove:// = verifiable content
) external {
    // Grove hash prevents tampering
    emit SegmentRegistered(...);
}
```

**Replay Protection**:
```solidity
// Segment hash uniqueness prevents replay
bytes32 segmentHash = keccak256(abi.encodePacked(
    spotifyTrackId,
    segmentStartMs
));

// Same segment can't be registered twice
require(segmentHashes[segmentHash] == false, "Already registered");
```

## The Graph Integration

**Event Indexing**:
```typescript
// subgraph/src/mappings.ts
export function handleSegmentRegistered(event: SegmentRegisteredEvent): void {
  const segment = new Segment(event.params.segmentHash);
  segment.grc20WorkId = event.params.grc20WorkId;
  segment.spotifyTrackId = event.params.spotifyTrackId;
  segment.metadataUri = event.params.metadataUri;
  segment.registeredAt = event.block.timestamp;
  segment.save();
}

export function handleSegmentProcessed(event: SegmentProcessedEvent): void {
  const segment = Segment.load(event.params.segmentHash);
  if (segment) {
    segment.instrumentalUri = event.params.instrumentalUri;
    segment.alignmentUri = event.params.alignmentUri;
    segment.translationCount = event.params.translationCount;
    segment.save();
  }
}
```

**Query Examples**:
```graphql
# Get all segments for a track
query GetTrackSegments($spotifyId: String!) {
  segments(where: { spotifyTrackId: $spotifyId }) {
    id
    grc20WorkId
    instrumentalUri
    translations {
      languageCode
      translationUri
    }
  }
}

# Get segments by language
query GetSpanishSegments {
  translations(where: { languageCode: "es" }) {
    segment {
      spotifyTrackId
      instrumentalUri
    }
    translationUri
  }
}
```

## Troubleshooting

**Event Not Indexing**:
```bash
# Check contract deployment
forge verify-contract 0x... SegmentEvents --chain lens-testnet

# Check subgraph logs
graph deploy --studio karaoke-school-v1
curl -X POST -d '{"query":"{ _meta { block { number } } }"}' http://localhost:8000/subgraphs/name/karaoke-school

# Verify event signatures
cast sig "SegmentRegistered(bytes32,string,string,uint32,uint32,string,address,uint64)"
```

**Gas Estimation Issues**:
```bash
# Estimate gas for event emission
cast estimate --rpc-url lens-testnet \
  0xContractAddress \
  "emitSegmentRegistered(bytes32,string,string,uint32,uint32,string)" \
  0x123... "uuid" "spotify:track:123" 45000 235000 "grove://..."
```

**Contract Verification**:
```bash
# Manual verification
forge verify-contract \
  0xContractAddress \
  SegmentEvents \
  --chain lens-testnet \
  --constructor-args $(cast abi-encode "constructor()" )
```

## Future Enhancements

**Upgradable Events**:
```solidity
// Event interface for future contracts
interface ISegmentEvents {
    event SegmentRegistered(...);
    function emitSegmentRegistered(...) external;
}
```

**Batch Emission**:
```solidity
// Optimize gas with batch events
function emitBatchRegistration(
    bytes32[] calldata segmentHashes,
    string[] calldata grc20WorkIds
) external {
    for (uint i = 0; i < segmentHashes.length; i++) {
        emit SegmentRegistered(...);
    }
}
```

**Cross-Chain Events**:
```solidity
// Bridge events from other chains
event CrossChainSegmentRegistered(
    bytes32 indexed segmentHash,
    string indexed sourceChain,
    bytes32 indexed sourceEventHash
);
```
