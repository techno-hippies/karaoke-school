# Deployment Status

Current status of the Karaoke Scoreboard contract and PKP setup.

## ✅ Completed

### 1. Contract Development
- [x] Created `KaraokeScoreboardV1.sol` contract
- [x] High score tracking per clip per user
- [x] PKP-only write access (anti-cheat)
- [x] Sorted leaderboards (top 100)
- [x] Gas-optimized with packed structs
- [x] Deployment script created
- [x] ZKsync/Lens Chain configuration
- [x] Successfully builds with `FOUNDRY_PROFILE=zksync forge build --zksync`

### 2. PKP Infrastructure
- [x] Lit Protocol SDK installed (`@lit-protocol/lit-client`, `@lit-protocol/networks`, `@lit-protocol/auth`)
- [x] PKP minting script (`scripts/mint-pkp.ts`)
- [x] PKP funding script (`scripts/fund-pkp.ts`)
- [x] Test wallet generated: `0x5C3c78DA1a4A4622486b4470d2a70cdF43052990`
- [x] `.env` configuration created
- [x] Comprehensive documentation (PKP_SETUP.md)

### 3. Documentation
- [x] Main README with deployment guide
- [x] PKP_SETUP.md with step-by-step instructions
- [x] Troubleshooting guide
- [x] Architecture diagrams and explanations

---

## ⏳ Pending (Manual Steps Required)

### Step 1: Get Chronicle Yellowstone Tokens

**Address:** `0x5C3c78DA1a4A4622486b4470d2a70cdF43052990`

**Action Required:**
1. Visit: https://chronicle-yellowstone-faucet.getlit.dev/
2. Request tokens for address above
3. Wait for confirmation (~1 minute)

**Why:** Needed to pay gas fees for PKP minting on Lit's testnet

---

### Step 2: Mint PKP

**Command:**
```bash
cd contracts
bun run mint-pkp
```

**Prerequisites:**
- ✅ Script ready
- ⏳ Chronicle Yellowstone tokens (Step 1)

**What it does:**
- Connects to Lit Protocol (nagaDev)
- Mints PKP using test wallet
- Adds signing permissions
- Saves credentials to `output/pkp-credentials.json`
- Updates `.env` with `PKP_ADDRESS`

---

### Step 3: Get Lens Chain Testnet Tokens

**Addresses to fund:**
1. Deployer wallet: `0x5C3c78DA1a4A4622486b4470d2a70cdF43052990`
2. PKP address: (will be in `.env` after Step 2)

**Action Required:**
1. Visit: https://faucet.lens.xyz
2. Request tokens for both addresses
3. Suggested amounts:
   - Deployer: 0.2 ETH (for contract deployment)
   - PKP: 0.5 ETH (for ongoing score submissions)

**Why:**
- Deployer needs tokens to deploy contract
- PKP needs tokens to submit score transactions

---

### Step 4: Fund PKP

**Command:**
```bash
cd contracts
bun run fund-pkp --amount 0.5
```

**Prerequisites:**
- ✅ Script ready
- ⏳ PKP minted (Step 2)
- ⏳ Lens Chain tokens in deployer wallet (Step 3)

**What it does:**
- Sends 0.5 ETH from deployer wallet to PKP
- Verifies transaction
- Shows final PKP balance

---

### Step 5: Deploy Scoreboard Contract

**Command:**
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

**Prerequisites:**
- ✅ Contract code ready
- ⏳ PKP funded on Lens Chain (Step 4)

**After deployment:**
1. Save contract address to `.env`:
   ```bash
   SCOREBOARD_CONTRACT_ADDRESS="0x..."
   ```
2. Verify on explorer: https://explorer.testnet.lens.xyz

---

## 📝 Current Configuration

### Test Wallet
```
Address: 0x5C3c78DA1a4A4622486b4470d2a70cdF43052990
Private Key: (in .env)
```

**Balances:**
- Chronicle Yellowstone: ⏳ Needs tokens from faucet
- Lens Chain Testnet: ⏳ Needs tokens from faucet

### PKP
```
Status: ⏳ Not yet minted
Address: (will be set after minting)
```

### Contracts
```
KaraokeScoreboardV1: ⏳ Not yet deployed
ClipRegistryV1: ✅ Deployed (0xd058b56DF96EA34214D71E19Fb05379aCF445B79)
SongRegistryV3: ✅ Deployed (0x183f6Ac8eff12a642F996b67B404993c385F46Fb)
```

---

## 🔄 Integration Workflow

Once everything is deployed:

### 1. Update Lit Action

Modify `lit-actions/src/stt/free-v8.js` to include:
- PKP signing logic
- Transaction building for `updateScore()`
- Score calculation from transcript

See main README.md for full code example.

### 2. Upload Lit Action to IPFS

Upload your modified Lit Action and get the IPFS CID:
```
ipfs add lit-actions/src/stt/free-v8.js
# Returns: QmXXX... (IPFS CID)
```

### 3. Update PKP Permissions

Update PKP to allow your Lit Action CID:
```typescript
await pkpPermissionsManager.addPermittedAction({
  ipfsId: "QmYourActualLitActionCID",
  scopes: ["sign-anything"],
});
```

### 4. Test End-to-End

1. User sings karaoke
2. Frontend sends audio to Lit Action
3. Lit Action:
   - Transcribes audio (Voxstral API)
   - Computes score
   - Signs transaction with PKP
   - Submits to scoreboard contract
4. Frontend queries leaderboard

---

## 📚 Key Files

```
contracts/
├── src/
│   └── KaraokeScoreboardV1.sol       # Main contract
├── script/
│   └── DeployKaraokeScoreboardV1.s.sol  # Deployment script
├── scripts/
│   ├── mint-pkp.ts                   # PKP minting automation
│   └── fund-pkp.ts                   # PKP funding automation
├── .env                              # Environment variables
├── README.md                         # Main documentation
├── PKP_SETUP.md                      # PKP setup guide
└── DEPLOYMENT_STATUS.md              # This file
```

---

## 🔗 Important Links

**Faucets:**
- Chronicle Yellowstone: https://chronicle-yellowstone-faucet.getlit.dev/
- Lens Chain Testnet: https://faucet.lens.xyz

**Explorers:**
- Lens Chain Testnet: https://explorer.testnet.lens.xyz
- Chronicle Yellowstone: https://explorer.yellowstone.litprotocol.com/

**Documentation:**
- Lit Protocol: https://developer.litprotocol.com/
- Lens Chain: https://docs.lens.xyz/

---

## 🎯 Next Immediate Action

**Get Chronicle Yellowstone tokens to mint PKP:**

1. Go to: https://chronicle-yellowstone-faucet.getlit.dev/
2. Paste address: `0x5C3c78DA1a4A4622486b4470d2a70cdF43052990`
3. Complete CAPTCHA and request tokens
4. Wait for confirmation
5. Run `bun run mint-pkp` in contracts folder

---

Last Updated: 2025-10-01
