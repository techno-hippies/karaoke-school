# Karaoke School Contracts

Smart contracts for the Karaoke School platform, deployed across two networks:
- **Base Sepolia**: Credit economy & payment contracts
- **Lens Testnet**: Social/study contracts (zkSync)

## Project Structure

```
contracts/
├── evm/base-sepolia/              # Standard EVM contracts (Base)
│   ├── KaraokeCredits/
│   │   ├── KaraokeCreditsV1.sol
│   │   ├── script/DeployKaraokeCreditsV1.s.sol
│   │   └── test/KaraokeCreditsV1.t.sol
│   ├── KaraokeSegmentRegistry/
│   │   ├── KaraokeSegmentRegistryV1.sol
│   │   ├── script/DeployKaraokeSegmentRegistryV1.s.sol
│   │   └── test/
│   ├── ArtistRegistry/
│   │   ├── ArtistRegistryV1.sol
│   │   ├── script/DeployArtistRegistryV1.s.sol
│   │   └── README.md
│   ├── lib/forge-std/
│   ├── foundry.toml
│   └── .gitignore
│
├── zkevm/lens-testnet/            # zkSync contracts (Lens)
│   ├── SongCatalog/
│   │   ├── SongCatalogV1.sol
│   │   ├── script/DeploySongCatalogV1.s.sol
│   │   └── test/SongCatalogV1.t.sol
│   ├── StudyProgress/
│   │   ├── StudyProgressV1.sol
│   │   ├── script/DeployStudyProgressV1.s.sol
│   │   └── test/StudyProgressV1.t.sol
│   ├── TrendingTracker/
│   │   ├── TrendingTrackerV1.sol
│   │   ├── script/DeployTrendingTrackerV1.s.sol
│   │   └── test/
│   ├── SongQuiz/
│   │   ├── SongQuizV2.sol
│   │   ├── script/DeploySongQuizV1.s.sol
│   │   └── test/
│   ├── test/Integration.t.sol
│   ├── lib/forge-std/
│   ├── foundry.toml
│   └── .gitignore
│
├── docs/                          # Documentation
│   ├── DEPLOYMENT_GUIDE.md
│   ├── DEPLOY_NOW.md
│   ├── TESTING.md
│   └── CHANGES.md
│
├── DEPLOYED_ADDRESSES.md          # Live contract addresses
├── .env                           # Shared environment variables
└── README.md
```

## Architecture

### Base Sepolia (EVM)
**Network**: Base Sepolia Testnet (Chain ID: 84532)
**RPC**: https://sepolia.base.org

#### KaraokeCreditsV1
Credit purchase and segment ownership system.

**Features**:
- Purchase credits with USDC or ETH
- 4 credit packages with bulk discounts (10-30% off)
- Deduplication check with SongCatalogV1 (prevents charging for free songs)
- Per-user credit balances
- Segment ownership tracking

**Deployed**: `0x6de183934E68051c407266F877fafE5C20F74653`

#### KaraokeSegmentRegistryV1
On-chain registry for generated karaoke segments.

**Features**:
- Section metadata (timing, section types)
- Grove IPFS URIs for stem files (vocals.zip, drums.zip)
- Lifecycle: Created → Processed
- PKP-controlled registration

**Deployed**: `0xd74F1874B1346Ce1a4958FA5304c376bE0209Fa8`

#### ArtistRegistryV2
Authoritative registry mapping Genius artist IDs to PKP addresses and Lens profiles.

**V2 Improvements**:
- ✅ Fixed `updateArtist()` to prevent mapping collision bugs
- ✅ Added `lensAccountAddress != address(0)` validation
- ✅ Improved NatSpec documentation

**Features**:
- Maps geniusArtistId → PKP address → Lens handle
- Minimal on-chain storage (~$150 for 10k artists)
- Rich metadata stored in Lens Account Metadata (queryable via GraphQL)
- Supports MANUAL (pipeline) and GENERATED (on-demand) profiles
- Reverse lookups (PKP/Lens handle → geniusId)
- Batch queries for frontend optimization
- Subgraph-ready events

**Purpose**: Creates parity between Genius artist pages (`/artist/:geniusId`) and PKP-Lens pipeline profiles (`/u/:lensHandle`)

**Deployed**: `0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7`

### Lens Testnet (zkEVM)
**Network**: Lens Testnet (Chain ID: 37111)
**RPC**: https://rpc.testnet.lens.xyz

#### SongCatalogV1
Registry for copyright-free songs with full audio and word-level timestamps.

**Features**:
- Native songs (FREE, full audio)
- Optional Genius ID for cross-platform unification
- Used by KaraokeCredits for deduplication

**Deployed**: `0x88996135809cc745E6d8966e3a7A01389C774910`

#### StudyProgress, SongQuiz, TrendingTracker
Study session tracking, quizzes, and trending metrics.

## Development

### Prerequisites
- Standard Foundry for Base contracts
- Foundry-zkSync for Lens contracts
- dotenvx for encrypted environment variables

### Switching Forge Versions

```bash
# For Base contracts (standard EVM)
foundryup --use stable
cd evm/base-sepolia

# For Lens contracts (zkSync)
foundryup-zksync --use foundry_zksync_v0.0.29
cd zkevm/lens-testnet
```

### Building

```bash
# Base contracts
cd evm/base-sepolia
forge build

# Lens contracts
cd zkevm/lens-testnet
forge build
```

### Testing

```bash
# Base contracts
cd evm/base-sepolia
forge test -vv

# Lens contracts
cd zkevm/lens-testnet
forge test -vv
```

### Deploying

```bash
# Base Sepolia
cd evm/base-sepolia
dotenvx run -f ../../.env -- bash -c '
  export PRIVATE_KEY="0x$PRIVATE_KEY"
  forge script KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol:DeployKaraokeCreditsV1 \
    --rpc-url https://sepolia.base.org \
    --broadcast
'

# Lens Testnet
cd zkevm/lens-testnet
dotenvx run -f ../../.env -- bash -c '
  export PRIVATE_KEY="0x$PRIVATE_KEY"
  forge script SongCatalog/script/DeploySongCatalogV1.s.sol:DeploySongCatalogV1 \
    --rpc-url https://rpc.testnet.lens.xyz \
    --broadcast
'
```

## Integration

### ABIs
Exported ABIs are available in:
- `../../app/src/abi/KaraokeCreditsV1.abi.json`
- `../../app/src/abi/KaraokeSegmentRegistryV1.abi.json`

### Contract Addresses
Frontend: `../../app/src/config/contracts.ts`
Lit Actions: `../../lit-actions/src/karaoke/contracts.config.js`

### Environment Variables

```bash
PRIVATE_KEY           # Deployer wallet (encrypted via dotenvx)
TREASURY_ADDRESS      # Base treasury address
PKP_ADDRESS           # Lit Protocol PKP address
SONG_CATALOG_ADDRESS  # SongCatalogV1 on Lens (for deduplication)
BASESCAN_API_KEY      # For contract verification
```

## Deployed Contracts

See [DEPLOYED_ADDRESSES.md](./DEPLOYED_ADDRESSES.md) for full deployment details.

**Base Sepolia**:
- KaraokeCreditsV1: [0x6de183934E68051c407266F877fafE5C20F74653](https://sepolia.basescan.org/address/0x6de183934e68051c407266f877fafe5c20f74653)
- KaraokeSegmentRegistryV1: [0xd74F1874B1346Ce1a4958FA5304c376bE0209Fa8](https://sepolia.basescan.org/address/0xd74f1874b1346ce1a4958fa5304c376be0209fa8)

**Lens Testnet**:
- SongCatalogV1: 0x88996135809cc745E6d8966e3a7A01389C774910

## License

MIT
