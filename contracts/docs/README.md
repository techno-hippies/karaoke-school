# Smart Contracts Documentation

**Solidity contracts for karaoke events and line-level FSRS**

## 🚀 Quick Start

```bash
cd contracts
forge install
forge build
forge test
```

## 📁 Contract Structure

```
contracts/src/events/
├── PerformanceGrader.sol    # Line-level FSRS grading
├── SongEvents.sol          # Song metadata events  
├── SegmentEvents.sol       # Karaoke segment events
├── TranslationEvents.sol   # Multi-language translation events
└── AccountEvents.sol       # User account management
```

## 🎯 Line-Level FSRS Contract

### PerformanceGrader.sol
**Purpose**: Grade individual lyric lines with FSRS scheduling

**Network**: Lens Testnet (37111)
**Address**: `0xdd231de1016F5BBe56cEB3B617Aa38A5B454610D`

**Key Event**:
```solidity
event LinePerformanceGraded(
    uint256 indexed performanceId,
    bytes32 indexed lineId,           // UUID from karaoke_lines
    bytes32 indexed segmentHash,
    uint16 lineIndex,
    address performer,
    uint16 score,                     // 0-10000 (75.43% = 7543)
    string metadataUri,               // Grove URI to recording
    uint64 timestamp
);
```

**Key Function**:
```solidity
function gradeLinePerformance(
    uint256 performanceId,
    bytes32 lineId,
    bytes32 segmentHash,
    uint16 lineIndex,
    address performer,
    uint16 score,
    string calldata metadataUri
) external onlyTrustedPKP whenNotPaused {
    // Anti-cheat: Only trusted PKP can grade
    // FSRS scheduling based on performance score
    emit LinePerformanceGraded(
        performanceId, lineId, segmentHash, 
        lineIndex, performer, score, metadataUri, 
        uint64(block.timestamp)
    );
}
```

## 🔗 Deployed Contracts (Lens Testnet)

```typescript
const CONTRACTS = {
  PerformanceGrader: "0xdd231de1016F5BBe56cEB3B617Aa38A5B454610D",
  SongEvents: "0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6", 
  SegmentEvents: "0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8",
  AccountEvents: "0x3709f41cdc9E7852140bc23A21adCe600434d4E8",
  TranslationEvents: "0x..."
};
```

## 🏗️ Event Architecture

### Event-Only Storage Design
- **No contract storage** - All data in events
- **Gas efficient** - ~35k gas per event
- **The Graph indexed** - Fast GraphQL queries
- **Upgradeable** - New events without storage changes

### Event Flow
```
Database → Grove Upload → Emit Events → Subgraph Index → App Query
```

## 📊 GRC-20 Integration

### Public Music Metadata Layer
**Space ID**: `78e6adba-6d19-49e8-8b12-9d1e72ecfd25`
**Network**: Geo Testnet

**Contract References**:
```solidity
// Reference GRC-20 public metadata
event LinePerformanceGraded(
    uint256 performanceId,
    bytes32 lineId,
    string grc20WorkId,        // Links to public work entity
    bytes32 segmentHash,
    uint16 lineIndex,
    address performer,
    uint16 score,
    string metadataUri
);
```

## 🚀 Deployment

### Compile Contracts
```bash
forge build
forge test
```

### Deploy to Lens Testnet
```bash
# Deploy single contract
forge script script/DeployPerformanceGrader.s.sol \
  --rpc-url https://rpc.testnet.lens.xyz \
  --broadcast

# Deploy all contracts
forge script script/DeployAll.s.sol \
  --rpc-url https://rpc.testnet.lens.xyz \
  --broadcast
```

### Verify on Block Explorer
```bash
forge verify-contract ADDRESS PerformanceGrader \
  --chain lens-testnet \
  --constructor-args 0x9456aec64179FE39a1d0a681de7613d5955E75D3
```

## 🧪 Testing

### Unit Tests
```bash
forge test
```

### Event Emission Tests
```typescript
// Test line-level grading
const tx = await performanceGrader.gradeLinePerformance(
  1,                    // performanceId
  lineId,              // UUID from database
  segmentHash,         // Generated hash
  0,                   // lineIndex
  performer,           // User address
  7500,                // 75.00% score
  metadataUri          // Grove recording URI
);

const receipt = await tx.wait();
// Verify LinePerformanceGraded event emitted
```

### Integration Testing
```bash
# Start local chain
anvil --fork-url https://rpc.testnet.lens.xyz

# Test event flow
forge test --fork-url http://localhost:8545
```

## 🔧 Configuration

### Foundry Configuration
```toml
# foundry.toml
[rpc_endpoints]
lens-testnet = "https://rpc.testnet.lens.xyz"

[etherscan]
lens-testnet = { key = "${BLOCK_EXPLORER_API_KEY}" }
```

### Environment Variables
```bash
# Required for deployment
RPC_URL=https://rpc.testnet.lens.xyz
PRIVATE_KEY=0x...
BLOCK_EXPLORER_API_KEY=...
```

## 🎯 Security Considerations

### Access Control
- **onlyTrustedPKP**: Only Lit Protocol PKPs can grade
- **whenNotPaused**: Emergency pause functionality
- **ReentrancyGuard**: Prevent reentrancy attacks

### Anti-Cheat Measures
- **Trusted Grading**: Only AI can score performances
- **Immutable Events**: Events cannot be modified
- **PKP Authentication**: WebAuthn-based identity

## 📚 Contract ABIs

**PerformanceGrader ABI**:
```typescript
const ABI = [
  "function gradeLinePerformance(uint256,bytes32,bytes32,uint16,address,uint16,string)",
  "event LinePerformanceGraded(uint256,bytes32,bytes32,uint16,address,uint16,string,uint64)",
  "function pause()",
  "function unpause()"
];
```

## 🔗 Integration Points

### Subgraph Integration
Events are automatically indexed by The Graph:
- `LinePerformanceGraded` → `LinePerformance` entity
- `LinePerformance` → Links to `LineCard` entity
- Fast GraphQL queries for FSRS scheduling

### Frontend Integration
```typescript
// React app contract interaction
import { createPublicClient, http } from 'viem';
import { lensTestnet } from './chains';

const client = createPublicClient({
  chain: lensTestnet,
  transport: http(process.env.RPC_URL)
});

// Listen for line-level grading events
client.watchContractEvent({
  address: CONTRACTS.PerformanceGrader,
  abi: PERFORMANCE_GRADER_ABI,
  eventName: 'LinePerformanceGraded',
  onLogs: (logs) => {
    // Update FSRS scheduling
    updateCardSchedule(logs[0].args);
  }
});
```

## 📊 Event Analytics

### Performance Metrics
- **Grading Volume**: Track LinePerformanceGraded events per day
- **Score Distribution**: Analyze user performance patterns  
- **FSRS Effectiveness**: Measure learning progression

### Event Log Queries
```sql
-- Query events from The Graph
SELECT * FROM line_performances 
WHERE graded_at > NOW() - INTERVAL '1 day'
ORDER BY graded_at DESC;

-- Calculate average scores
SELECT 
  line_index,
  AVG(score::numeric) / 100.0 as avg_score
FROM line_performances 
GROUP BY line_index;
```

## 📚 Additional Documentation

- **[GRC-20 Integration](./grc20.md)** - Public music metadata layer
- **[AGENTS.md](../../AGENTS.md)** - Service integration guide
- **[README.md](../../README.md)** - Project overview
