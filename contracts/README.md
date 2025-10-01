# Karaoke Game Contracts

Smart contracts for karaoke gameplay features (scores, leaderboards, etc.) deployed on Lens Chain.

## Contracts

### KaraokeScoreboardV1

On-chain high score registry for karaoke clips.

**Features:**
- ✅ High score tracking per clip per user
- ✅ Sorted leaderboards (top 100)
- ✅ PKP-only writes (prevents cheating via Lit Protocol)
- ✅ Public reads (anyone can query scores)
- ✅ Gas-optimized with packed structs
- ✅ Attempt counter per user per clip

**Architecture:**
- References clip IDs from `ClipRegistryV1` contract
- Trusted PKP address (from Lit Protocol) submits scores
- Lit Action computes score from speech-to-text → signs transaction → calls `updateScore()`
- Frontend queries scores for leaderboards

---

## Prerequisites

**Critical Requirements:**
- ✅ Foundry ZKsync fork v0.0.29 (installed)
- ✅ Solidity 0.8.19 (to avoid PUSH0 opcode issues on zkSync)
- ✅ NO OpenZeppelin dependencies (causes zkSync deployment failures)
- ✅ FOUNDRY_PROFILE=zksync (must use zksync profile)
- ✅ PKP minted via Lit Protocol (for trusted scorer)

**Verify installation:**
```bash
forge --version
# Should show: forge Version: 1.3.5-foundry-zksync-v0.0.29
```

---

## PKP Setup

Before deploying the scoreboard contract, you need to create a PKP (Programmable Key Pair) that will be the trusted scorer.

### Automated PKP Creation

We've created scripts to handle PKP creation automatically:

**Step 1: Get Test Tokens**

The test wallet address is: `0x5C3c78DA1a4A4622486b4470d2a70cdF43052990`

Get Chronicle Yellowstone testnet tokens from:
- https://chronicle-yellowstone-faucet.getlit.dev/

You'll need these tokens to mint the PKP (gas fees on Lit's testnet).

**Step 2: Mint PKP**

```bash
cd contracts
bun run mint-pkp
```

This script will:
- Connect to Lit Protocol (nagaDev network)
- Mint a PKP using your test wallet
- Add signing permissions to the PKP
- Save PKP credentials to `output/pkp-credentials.json`
- Update `.env` with `PKP_ADDRESS`

**Step 3: Fund PKP on Lens Chain**

After minting, fund the PKP with gas tokens on Lens Chain testnet:

```bash
# Using the script (requires Lens Chain testnet tokens in your wallet)
bun run fund-pkp

# Or manually with cast
cast send $PKP_ADDRESS --value 0.1ether \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

Get Lens Chain testnet tokens from: https://faucet.lens.xyz

**Step 4: Verify Setup**

```bash
# Check PKP balance on Lens Chain
cast balance $PKP_ADDRESS --rpc-url https://rpc.testnet.lens.xyz
```

---

## Deployment

### 1. Set Environment Variables

```bash
export PRIVATE_KEY="your_deployer_private_key"
export PKP_ADDRESS="your_pkp_public_address"
```

**Note:** If you used the automated PKP setup above, `PKP_ADDRESS` is already in `.env`

Or use `.env` file:
```bash
# .env
PRIVATE_KEY="0x..."
PKP_ADDRESS="0x..."
```

**Important:**
- `PRIVATE_KEY`: Your deployer wallet (needs gas tokens on Lens Chain)
- `PKP_ADDRESS`: The PKP address from Lit Protocol that will submit scores

### 2. Deploy Contract

**IMPORTANT:** Must use `FOUNDRY_PROFILE=zksync` and `--zksync` flag:

```bash
cd contracts

FOUNDRY_PROFILE=zksync forge create \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --constructor-args "$PKP_ADDRESS" \
  src/KaraokeScoreboardV1.sol:KaraokeScoreboardV1 \
  --zksync \
  --gas-limit 10000000 \
  --gas-price 300000000 \
  --broadcast
```

**Expected output:**
```
Deployer: 0x...
Deployed to: 0x... (contract address)
Transaction hash: 0x...
```

### 3. Fund PKP Address

The PKP needs gas tokens to submit score transactions:

```bash
# Send some testnet tokens to PKP address
# On Lens Testnet, get tokens from faucet:
# https://faucet.lens.xyz

# Or transfer from your wallet:
cast send $PKP_ADDRESS \
  --value 0.1ether \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

### 4. Verify Deployment

```bash
# Check owner
cast call <CONTRACT_ADDRESS> "owner()" --rpc-url https://rpc.testnet.lens.xyz

# Check trusted scorer
cast call <CONTRACT_ADDRESS> "trustedScorer()" --rpc-url https://rpc.testnet.lens.xyz

# Should match your PKP_ADDRESS
```

### 5. Update Lit Action Permissions

Permit your Lit Action to use the PKP for signing:

```bash
# Using Lit SDK (example - adjust to your setup)
# Add the Lit Action's IPFS CID as a permitted auth method
# with "sign-anything" capability
```

---

## Testing Deployed Contract

### Query Functions (Free)

```bash
# Get user's score for a clip
cast call <CONTRACT_ADDRESS> \
  "getScore(string,address)" "scarlett-verse-1" "0xUserAddress" \
  --rpc-url https://rpc.testnet.lens.xyz

# Get top 10 scores for a clip
cast call <CONTRACT_ADDRESS> \
  "getTopScores(string,uint256)" "scarlett-verse-1" 10 \
  --rpc-url https://rpc.testnet.lens.xyz

# Get leaderboard size
cast call <CONTRACT_ADDRESS> \
  "getLeaderboardSize(string)" "scarlett-verse-1" \
  --rpc-url https://rpc.testnet.lens.xyz
```

### Write Functions (PKP Only)

**Note:** These should be called by your Lit Action, not manually:

```bash
# Update score (only PKP can call this)
cast send <CONTRACT_ADDRESS> \
  "updateScore(string,address,uint96)" "scarlett-verse-1" "0xUserAddress" 85 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PKP_PRIVATE_KEY
```

---

## Integration with Lit Actions

### 1. Update Lit Action Code

Modify `lit-actions/src/stt/free-v8.js` to include score submission:

```javascript
// After computing score from transcript (around line 187)
if (jsParams.updateHighScore && jsParams.scoreboardContract && jsParams.pkpPublicKey) {
  const rpcUrl = await Lit.Actions.getRpcUrl({ chain: jsParams.chain || 'baseSepolia' });
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  // Build transaction to updateScore()
  const abi = ["function updateScore(string,address,uint96)"];
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData("updateScore", [
    jsParams.clipId,
    userAddress,
    score
  ]);

  // Sign with PKP and broadcast (see Lit Actions docs for full code)
  // ...
}
```

### 2. Call Lit Action from Frontend

```javascript
const result = await litClient.executeJs({
  ipfsId: "your-lit-action-cid",
  authContext: authContext,
  jsParams: {
    audioDataBase64: base64Audio,
    expectedLyrics: "lyrics here",

    // Encryption params for Voxstral API key
    accessControlConditions: voxstralAccConditions,
    ciphertext: voxstralCiphertext,
    dataToEncryptHash: voxstralHash,

    // NEW: Scoreboard params
    updateHighScore: true,
    scoreboardContract: "0xYourScoreboardAddress",
    pkpPublicKey: "0xYourPKPPublicKey",
    clipId: "scarlett-verse-1",
    chain: "lens-testnet",

    // Analytics
    userAddress: userWalletAddress,
    sessionId: sessionId,
  },
});

console.log('Transcript:', result.response.transcript);
console.log('Score:', result.response.score);
```

---

## Common Issues & Solutions

### Issue 1: PUSH0 Opcode Error
**Error:** `Transaction reverted: invalid opcode PUSH0`

**Solution:** Use Solidity 0.8.19 (not 0.8.20+)
```toml
# foundry.toml
[profile.zksync]
solc_version = "0.8.19"
```

### Issue 2: "Not trusted scorer" Error
**Error:** Contract reverts with "Not trusted scorer"

**Solution:**
- Ensure the PKP address is correct in deployment
- Verify Lit Action is signing transactions with the correct PKP
- Check PKP has gas tokens

### Issue 3: Forgot --zksync Flag
**Error:** Contract deploys but doesn't work on Lens Chain

**Solution:** Always use `FOUNDRY_PROFILE=zksync` and `--zksync` flag:
```bash
FOUNDRY_PROFILE=zksync forge create --zksync ...
```

### Issue 4: Gas Estimation Failed
**Error:** `Gas estimation failed`

**Solution:** Manually set gas parameters:
```bash
--gas-limit 10000000 --gas-price 300000000
```

---

## Contract ABI Export

After deployment, export ABI for frontend:

```bash
cd contracts

# Generate ABI (use zksync profile)
FOUNDRY_PROFILE=zksync forge build --zksync

# Copy ABI to frontend (adjust path as needed)
# zkSync builds go to zkout/ directory
cp zkout/KaraokeScoreboardV1.sol/KaraokeScoreboardV1.json ../site/src/abi/
```

---

## Development

```bash
# Install dependencies
forge install

# Build contracts (zkSync)
FOUNDRY_PROFILE=zksync forge build --zksync

# Build contracts (regular)
forge build

# Run tests
forge test -vv

# Format code
forge fmt
```

---

## Deployment Checklist

- [ ] Foundry ZKsync v0.0.29 installed
- [ ] Using Solidity 0.8.19 in zksync profile
- [ ] No OpenZeppelin dependencies
- [ ] PKP minted via Lit Protocol
- [ ] PKP_ADDRESS set in environment
- [ ] PRIVATE_KEY set in environment
- [ ] Deployer wallet funded with gas tokens
- [ ] FOUNDRY_PROFILE=zksync in deploy command
- [ ] --zksync flag included
- [ ] Gas parameters set (10M limit, 300M price)
- [ ] Contract deployed successfully
- [ ] PKP address funded with gas tokens
- [ ] Lit Action permitted to use PKP
- [ ] Lit Action updated with scoreboard integration
- [ ] ABI exported to frontend
- [ ] Explorer verified: https://explorer.testnet.lens.xyz/address/<CONTRACT_ADDRESS>

---

## Network Information

**Lens Chain Testnet:**
- RPC URL: `https://rpc.testnet.lens.xyz`
- Chain ID: 37111
- Explorer: https://explorer.testnet.lens.xyz
- Faucet: https://faucet.lens.xyz

**Lens Chain Mainnet:**
- RPC URL: `https://rpc.lens.xyz`
- Chain ID: 37111
- Explorer: https://explorer.lens.xyz
