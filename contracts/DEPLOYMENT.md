# Contract Deployment Guide

**CRITICAL: Follow these exact steps every time to avoid issues.**

## Prerequisites

1. `.env` file exists in `contracts/` folder with:
   ```bash
   PRIVATE_KEY=0x...
   TRUSTED_PKP_ADDRESS=0x...
   LENS_CHAIN_RPC_URL=https://rpc.testnet.lens.xyz
   ```

2. Forge installed (via Foundry)
3. Node.js with `npx tsx` available

## Deployment Workflow

### Step 1: Compile Contract (REQUIRED)

**CRITICAL: You MUST compile with `--via-ir` flag to avoid "stack too deep" errors.**

```bash
# Compile for deployment (generates artifacts for ethers)
forge build --via-ir --force

# This creates: out/<ContractName>.sol/<ContractName>.json
```

**Why `--via-ir`?**
- Default solc compiler hits "stack too deep" errors on complex contracts
- The `--via-ir` flag uses Yul intermediate representation which avoids this
- This is REQUIRED for contracts with many functions/parameters

### Step 2: Deploy with Ethers Script

**CRITICAL: Use explicit env vars, NOT `source .env` (it doesn't export to child processes).**

```bash
# Template for deploying any contract
PRIVATE_KEY=0x... TRUSTED_PKP_ADDRESS=0x... npx tsx scripts/deploy-<contract-name>.ts

# Example: Deploy KaraokeEvents
PRIVATE_KEY=0x7ad3639f0de041ea9cf7bbcd865180383eb85a65fd333a955e9d9d0ab0184235 \
TRUSTED_PKP_ADDRESS=0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7 \
npx tsx scripts/deploy-karaoke-events.ts
```

**Why explicit env vars?**
- `source .env` sets variables in current shell but npx runs in a subprocess
- Subprocess doesn't inherit sourced variables
- Explicit `VAR=value npx` syntax passes vars to subprocess

### Step 3: Verify Deployment

Script output should show:
```
✅ <ContractName> deployed at: 0x...
✅ ABI saved to: ../subgraph/abis/<ContractName>.json
```

### Step 4: Update Subgraph (if applicable)

1. Update `subgraph/subgraph.yaml` with new contract address
2. Run `bun run codegen` in subgraph folder
3. Run `bun run build` in subgraph folder
4. Restart GND if running locally

## Common Issues & Solutions

### Error: "Stack too deep"

**Symptom:**
```
Error: Compiler error: Stack too deep. Try compiling with `--via-ir`
```

**Solution:**
```bash
forge build --via-ir --force
```

**Why it happens:**
- Solidity compiler has stack depth limits (16 slots)
- Complex contracts exceed this
- `--via-ir` uses Yul IR which optimizes stack usage

### Error: "PRIVATE_KEY must be set"

**Symptom:**
```
Error: PRIVATE_KEY must be set
```

**Solution:**
DO NOT use `source .env`. Use explicit vars:
```bash
PRIVATE_KEY=0x... npx tsx scripts/deploy-script.ts
```

**Why it happens:**
- `source .env` only sets vars in current shell
- `npx` spawns subprocess that doesn't inherit them
- Must pass vars explicitly to subprocess

### Error: "ENOENT: no such file or directory, open 'out/...'""

**Symptom:**
```
Error: ENOENT: no such file or directory, open '.../out/ContractName.sol/ContractName.json'
```

**Solution:**
You forgot to compile first:
```bash
forge build --via-ir --force
```

**Why it happens:**
- Ethers deployment script reads compiled artifacts from `out/` folder
- Must compile before deploying
- `--via-ir` flag is REQUIRED (see "Stack too deep" above)

### Error: "network not supported"

**Symptom:**
```
Error: network not supported
```

**Solution:**
Check RPC URL in script matches actual network:
```typescript
const provider = new ethers.JsonRpcProvider('https://rpc.testnet.lens.xyz');
```

## Deployment Script Template

When creating a new deployment script, follow this pattern:

```typescript
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Load ABI and bytecode from forge artifacts
const artifactPath = path.join(__dirname, 'out', 'ContractName.sol', 'ContractName.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function main() {
    // Get env vars
    const privateKey = process.env.PRIVATE_KEY;
    const trustedPKP = process.env.TRUSTED_PKP_ADDRESS; // If needed

    if (!privateKey) throw new Error('PRIVATE_KEY must be set');
    if (!trustedPKP) throw new Error('TRUSTED_PKP_ADDRESS must be set');

    // Connect to network
    const provider = new ethers.JsonRpcProvider('https://rpc.testnet.lens.xyz');
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('Deployer:', wallet.address);
    console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'ETH');

    // Deploy contract
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
    const contract = await factory.deploy(trustedPKP); // Pass constructor args

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log('✅ Contract deployed at:', address);

    // Save ABI for subgraph (CRITICAL for indexing)
    const abiPath = path.join(__dirname, '../subgraph/abis/ContractName.json');
    fs.writeFileSync(abiPath, JSON.stringify({ abi: artifact.abi }, null, 2));
    console.log('✅ ABI saved to:', abiPath);
}

main()
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
```

## ZKsync Deployment (Advanced)

For ZKsync-specific deployments (not recommended for testing):

```bash
# Compile for ZKsync
forge build --zksync --force

# Deploy with Forge (not ethers)
forge script script/DeployEvents.s.sol:DeployEvents \
  --rpc-url lens-testnet \
  --broadcast \
  --zksync \
  -vvvv
```

**Note:** We prefer ethers deployment scripts because:
1. Easier to save ABIs for subgraph
2. Better error messages
3. More control over deployment flow
4. Can verify contract state immediately

## Quick Reference

```bash
# Standard deployment flow (copy-paste this)
forge build --via-ir --force && \
PRIVATE_KEY=0x7ad3639f0de041ea9cf7bbcd865180383eb85a65fd333a955e9d9d0ab0184235 \
TRUSTED_PKP_ADDRESS=0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7 \
npx tsx scripts/deploy-karaoke-events.ts
```

## After Deployment

1. **Copy contract address** from output
2. **Update subgraph/subgraph.yaml** with new address
3. **Run `bun run codegen && bun run build`** in subgraph folder
4. **Restart GND** if running locally
5. **Update app config** if contract addresses are hardcoded
6. **Commit** deployment address to git

## Contract Addresses (Lens Testnet)

Update this list after each deployment:

- **KaraokeEvents**: `0x1eF06255c8e60684F79C9792bd4A66d05B38ed76` (clip lifecycle + grading)
- **ExerciseEvents**: `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832` (FSRS study cards)
- **TranslationEvents**: `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6` (translations)
- **AccountEvents**: `0x3709f41cdc9E7852140bc23A21adCe600434d4E8` (accounts)

---

**REMEMBER: Compile with `--via-ir`, deploy with explicit env vars, update subgraph.**
