# Base Sepolia Contracts

All contracts deployed to Base Sepolia testnet.

## Deployment Flow

All deployments **automatically verify** on BaseScan when using the `--verify` flag.

### Prerequisites

1. **Environment Setup**: Ensure `contracts/.env` contains:
   - `PRIVATE_KEY` (encrypted with dotenvx)
   - `PKP_ADDRESS` (Lit Protocol PKP)
   - `TREASURY_ADDRESS` (for payments)
   - `BASESCAN_API_KEY` (for verification)

2. **Decryption Key**: Set `DOTENV_PRIVATE_KEY` in your shell or pass it inline

### Standard Deployment Command

```bash
DOTENV_PRIVATE_KEY=<your-key> dotenvx run -f /path/to/contracts/.env -- \
  forge script <ContractPath>/script/Deploy<ContractName>.s.sol:Deploy<ContractName> \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
```

**Important**: Always include `--verify` flag for automatic BaseScan verification.

## Deployed Contracts

### KaraokeCatalogV1
**Address**: `0x0843DDB2F2ceCAB0644Ece0523328af2C7882032`
**Purpose**: Unified registry for songs and karaoke segments
**Explorer**: https://sepolia.basescan.org/address/0x0843ddb2f2cecab0644ece0523328af2c7882032

**Deploy**:
```bash
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
  dotenvx run -f /media/t42/th42/Code/karaoke-school-v1/contracts/.env -- \
  forge script KaraokeCatalog/script/DeployKaraokeCatalogV1.s.sol:DeployKaraokeCatalogV1 \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
```

### KaraokeCreditsV1
**Purpose**: Credit purchasing and ownership tracking
**Dependencies**: KaraokeCatalogV1, USDC token

**Deploy**:
```bash
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
  dotenvx run -f /media/t42/th42/Code/karaoke-school-v1/contracts/.env -- \
  forge script KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol:DeployKaraokeCreditsV1 \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
```

### KaraokeSegmentRegistryV1 (Deprecated)
**Status**: Replaced by KaraokeCatalogV1
**Note**: Use KaraokeCatalogV1 for new deployments

## Network Info

- **Chain ID**: 84532
- **RPC**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org
- **USDC Mock**: 0x036CbD53842c5426634e7929541eC2318f3dCF7e

## Verification

Verification happens automatically during deployment when using `--verify`. You can also manually verify:

```bash
forge verify-contract <CONTRACT_ADDRESS> \
  <CONTRACT_PATH>:<CONTRACT_NAME> \
  --chain-id 84532 \
  --constructor-args $(cast abi-encode "constructor(...)" <ARGS>) \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
```
