# SongRegistryV1 Contract

On-chain registry for karaoke songs with Grove URIs, deployed on Lens Chain.

## Features

- **Immutable song entries** - Once added, songs cannot be modified
- **Owner-only writes** - Only the deployer can add songs
- **Public reads** - Anyone can query songs
- **Language support** - Supports single or multiple languages per song (e.g., "en", "en,ko")
- **Gas-efficient** - Optimized storage with packed types
- **Batch queries** - Efficient pagination support

## Development

```bash
# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test -vv

# Deploy locally to Anvil
anvil # in another terminal
forge script script/DeploySongRegistryV1.s.sol:DeploySongRegistryV1 --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
```

## Deployment

See README.md for full deployment instructions.
