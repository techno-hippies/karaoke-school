# Karaoke School V2 Contracts

Clean-slate contract architecture for the TikTok-based karaoke learning platform.

## Architecture

```
Core:
├── ArtistRegistry     → Artist profiles (PKP + Lens + Genius mapping)
├── SongRegistry       → Songs (linked to artists)
├── SegmentRegistry    → ~30s TikTok segments (linked to songs)
└── PerformanceRegistry → User karaoke performances (of full segments)

Student:
├── StudentProfile     → User profiles and stats
└── StudentAchievements → Achievement system

Leaderboard:
├── SongLeaderboard    → Per-song rankings
└── ArtistLeaderboard  → Per-artist rankings
```

## Data Model

**Hierarchy:**
```
Artist (Beyoncé)
  └── Song (CUFF IT)
      └── Segment (~30s TikTok portion at 0:45-1:15)
          ├── TikTok Videos (actual TikTok posts, may be shorter clips)
          └── User Performances (users karaoke the full 30s segment)
```

**Key Distinction:**
- **Segment** = The canonical ~30s audio portion from the song (what users practice)
- **TikTok Video** = Reference to TikTok posts (metadata only, not stored on-chain)
- **Performance** = User-generated karaoke recording of the full segment

## Deployment

### Setup

```bash
# Install dependencies
forge install

# Set environment variables
cp .env.example .env
# Edit .env with your keys
```

### Deploy to Lens Testnet (zkSync)

```bash
# Deploy all contracts
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:DeployAll \
  --rpc-url lens_testnet \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync \
  --verify

# Or deploy individually
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:DeployArtistRegistry \
  --rpc-url lens_testnet \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync
```

### Testing

```bash
# Run tests
forge test

# Run tests with gas reporting
forge test --gas-report

# Run specific test
forge test --match-test testRegisterArtist -vvv
```

## Contract Addresses

### Lens Testnet
- ArtistRegistry: `TBD`
- SongRegistry: `TBD`
- SegmentRegistry: `TBD`
- PerformanceRegistry: `TBD`
- StudentProfile: `TBD`
- SongLeaderboard: `TBD`
- ArtistLeaderboard: `TBD`

### Lens Mainnet
- TBD

## Development

```bash
# Build
forge build

# Format
forge fmt

# Coverage
forge coverage

# Local node (for testing)
anvil
```

## Versioning

All contracts follow semantic versioning via contract names:
- `ArtistRegistryV1.sol` → Initial version
- `ArtistRegistryV2.sol` → Breaking changes / major updates
- Internal versions tracked via contract comments

## License

MIT
