# Auto-Purchase Credits System

> **Automated credit purchasing via Lit Actions + ERC-2612 Permit**
>
> Users fund their PKP wallet with USDC → Backend webhook detects transfer → Lit Action auto-purchases credits in **1 transaction**

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Contract Changes](#contract-changes)
- [Lit Action Implementation](#lit-action-implementation)
- [Deployment Guide](#deployment-guide)
- [Webhook Setup](#webhook-setup)
- [Testing](#testing)
- [FAQ](#faq)

---

## Overview

### Problem
Users need credits to unlock karaoke segments, but the traditional flow requires:
1. User funds PKP wallet with USDC (1 TX from external wallet)
2. User approves USDC spending (1 TX from PKP)
3. User purchases credits (1 TX from PKP)

**Total: 3 transactions, requires user interaction**

### Solution
Using **ERC-2612 Permit + Lit Actions**, we automate steps 2-3:
1. User funds PKP wallet with USDC (1 TX from external wallet)
2. **Backend webhook detects funding**
3. **Lit Action auto-purchases credits in 1 TX** (approve + purchase combined via permit)

**Total: 1 user transaction + 1 automated transaction**

### Benefits
- ✅ **Zero-signature automation** (Lit Action uses PKP auth context)
- ✅ **Single transaction** (ERC-2612 permit combines approve + purchase)
- ✅ **Optimal package selection** (maximizes credits, minimizes leftover USDC)
- ✅ **Idempotent** (checks credit balance before purchasing)
- ✅ **Transparent** (logs all steps, returns transaction hash)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER FLOW                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  1. User funds PKP wallet       │
            │     with USDC (any amount)      │
            │     via external wallet         │
            └─────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATED FLOW                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  2. Backend webhook detects     │
            │     USDC Transfer event         │
            │     (event: Transfer(from,      │
            │     to=PKP, value))             │
            └─────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  3. Webhook triggers Lit Action │
            │     executeJs({                 │
            │       code: autoPurchaseCode,   │
            │       jsParams: { pkpAddress }  │
            │     })                          │
            └─────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              LIT ACTION EXECUTION FLOW                           │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
   ┌─────────────────┐              ┌────────────────────┐
   │ Check current   │              │ Check USDC balance │
   │ credit balance  │              │ on Base Sepolia    │
   │                 │              │                    │
   │ If >= threshold │              │ If < $0.50         │
   │ → SKIP          │              │ → SKIP             │
   └─────────────────┘              └────────────────────┘
            │                                   │
            │ credits < threshold               │ balance >= $0.50
            │                                   │
            └─────────────────┬─────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  Query optimal package from     │
            │  KaraokeCreditsV1.sol:          │
            │  getOptimalPackage(usdcBalance) │
            │                                 │
            │  Returns:                       │
            │  - packageId (0-2)              │
            │  - packagePrice                 │
            │  - creditsEarned                │
            └─────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  Sign EIP-2612 Permit           │
            │  (off-chain signature)          │
            │                                 │
            │  TypedData:                     │
            │  - owner: PKP address           │
            │  - spender: Credits contract    │
            │  - value: packagePrice          │
            │  - nonce: from USDC.nonces()    │
            │  - deadline: now + 1 hour       │
            │                                 │
            │  PKP signs via signAndCombineEcdsa│
            └─────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  Build & sign transaction       │
            │  to: Credits contract           │
            │  data: purchaseCreditsWithPermit│
            │        (packageId, deadline,    │
            │         v, r, s)                │
            │                                 │
            │  PKP signs TX via signAndCombineEcdsa│
            └─────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  Submit transaction via runOnce │
            │  (ensures single submission)    │
            │                                 │
            │  provider.sendTransaction(      │
            │    signedTx                     │
            │  )                              │
            └─────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  ✅ Credits purchased!          │
            │                                 │
            │  Returns:                       │
            │  - txHash                       │
            │  - creditsEarned                │
            │  - packagePrice                 │
            │  - usdcBalance (remaining)      │
            └─────────────────────────────────┘
```

---

## Contract Changes

### Added Functions

#### 1. `purchaseCreditsWithPermit`

```solidity
function purchaseCreditsWithPermit(
    uint8 packageId,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external whenNotPaused
```

**Purpose:** Purchase credits using ERC-2612 permit (single transaction)

**Flow:**
1. Calls `USDC.permit(owner, spender, value, deadline, v, r, s)` to approve spending
2. Transfers USDC from user to treasury
3. Mints credits to user
4. Emits `CreditsPurchased` event with `paymentMethod="USDC-Permit"`

**Benefits:**
- Combines approval + purchase in 1 TX
- Ideal for PKP automation (no separate approve TX needed)
- Gas-efficient

#### 2. `getOptimalPackage`

```solidity
function getOptimalPackage(uint256 usdcBalance)
    external
    view
    returns (uint8 packageId, uint256 packagePrice, uint16 creditsEarned)
```

**Purpose:** Calculate the best package to purchase based on user's USDC balance

**Logic:**
- Iterates packages from largest to smallest (package 2 → 1 → 0)
- Returns first affordable package
- If no package affordable, returns `(type(uint8).max, 0, 0)`

**Examples:**
```
Balance: 10.00 USDC → Package 2 (20 credits for $10.00)
Balance: 5.00 USDC  → Package 1 (5 credits for $2.50), $2.50 left
Balance: 0.75 USDC  → Package 0 (1 credit for $0.50), $0.25 left
Balance: 0.25 USDC  → No package (insufficient balance)
```

### Current Packages

| Package ID | Credits | Price (USDC) | Per-Credit Cost |
|------------|---------|--------------|-----------------|
| 0          | 1       | $0.50        | $0.50           |
| 1          | 5       | $2.50        | $0.50           |
| 2          | 20      | $10.00       | $0.50           |

> **Note:** All packages have the same per-credit cost ($0.50). Consider adding bulk discounts for larger packages.

---

## Lit Action Implementation

### File: `lit-actions/src/karaoke/auto-purchase-credits.js`

**Key Features:**
- ✅ Checks current credit balance (skips if >= threshold)
- ✅ Queries optimal package from contract
- ✅ Signs EIP-2612 permit with PKP
- ✅ Constructs and signs transaction
- ✅ Submits via `runOnce()` (prevents duplicates)
- ✅ Returns transaction hash + purchase details

**Parameters (jsParams):**
```javascript
{
  pkpAddress: string,        // PKP wallet address
  publicKey: string,         // PKP public key
  creditsContract: string,   // KaraokeCreditsV1 address
  usdcContract: string,      // USDC token address
  minCreditThreshold: number // Only purchase if credits < threshold (default: 5)
}
```

**Return Value:**
```javascript
{
  success: boolean,
  action: "purchased" | "none",
  txHash?: string,
  packageId?: number,
  creditsEarned?: number,
  packagePrice?: string,
  usdcBalance: string,
  currentCredits: number,
  message?: string,
  error?: string
}
```

### EIP-2612 Permit Flow

1. **Construct TypedData:**
```javascript
const domain = {
  name: "USD Coin",
  version: "2",
  chainId: 84532,
  verifyingContract: usdcContract
};

const types = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

const value = {
  owner: pkpAddress,
  spender: creditsContract,
  value: packagePrice,
  nonce: await USDC.nonces(pkpAddress),
  deadline: Math.floor(Date.now() / 1000) + 3600
};
```

2. **Compute EIP-712 Hash:**
```javascript
const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain(domain);
const structHash = ethers.utils._TypedDataEncoder.hashStruct("Permit", types, value);
const digest = ethers.utils.keccak256(
  ethers.utils.concat([
    ethers.utils.toUtf8Bytes("\x19\x01"),
    domainSeparator,
    structHash
  ])
);
```

3. **Sign with PKP:**
```javascript
const sigShare = await Lit.Actions.signAndCombineEcdsa({
  toSign: ethers.utils.arrayify(digest),
  publicKey: pkpPublicKey,
  sigName: "permitSignature"
});

const { v, r, s } = JSON.parse(sigShare);
```

4. **Submit Transaction:**
```javascript
const txData = creditsInterface.encodeFunctionData("purchaseCreditsWithPermit", [
  packageId, deadline, v, r, s
]);

// Sign TX with PKP
const signedTx = await signTransaction(unsignedTx, pkpPublicKey);

// Submit via runOnce (prevents duplicates)
const tx = await provider.sendTransaction(signedTx);
```

---

## Deployment Guide

### 1. Deploy Updated Contract

```bash
cd contracts
DOTENV_PRIVATE_KEY=xxx dotenvx run -- forge script \
  evm/base-sepolia/KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol:DeployKaraokeCreditsV1 \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
```

**Deployment checklist:**
- ✅ USDC token address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia)
- ✅ Treasury address: Your treasury wallet
- ✅ Trusted PKP address: PKP that can grant free credits
- ✅ Verify on BaseScan

### 2. Upload Lit Action to IPFS

```bash
cd lit-actions
DOTENV_PRIVATE_KEY=xxx dotenvx run -- \
  node scripts/upload-lit-action.mjs \
  src/karaoke/auto-purchase-credits.js \
  "Auto-Purchase Credits - ERC-2612 Permit"
```

**Save the CID** (e.g., `QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

### 3. Grant PKP Permission

```bash
cd lit-actions
DOTENV_PRIVATE_KEY=xxx dotenvx run -- \
  bun run scripts/add-pkp-permission.mjs <LIT_ACTION_CID>
```

**This grants the Lit Action:**
- ✅ Permission to sign with the PKP
- ✅ `sign-anything` capability (required for permit + transaction signing)

### 4. Set Up Webhook Server

#### Option A: Use webhook-server (Recommended)

```bash
cd webhook-server
npm install

# Configure .env
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
CREDITS_CONTRACT=0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6
PKP_ADDRESS=<YOUR_PKP_ADDRESS>
PKP_PUBLIC_KEY=<YOUR_PKP_PUBLIC_KEY>
LIT_ACTION_CID=<AUTO_PURCHASE_CID>
BASE_RPC_URL=https://sepolia.base.org

# Run server
npm start
```

**The webhook:**
1. Listens for USDC Transfer events on Base Sepolia
2. Filters transfers where `to === PKP_ADDRESS`
3. Triggers Lit Action when PKP receives USDC
4. Logs all execution results

#### Option B: Manual Backend Integration

Add this to your existing backend:

```typescript
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LitNetwork } from "@lit-protocol/constants";

// Initialize Lit client
const litClient = new LitNodeClient({
  litNetwork: LitNetwork.DatilDev,
  debug: false,
});
await litClient.connect();

// Listen for USDC transfers to PKP
usdcContract.on("Transfer", async (from, to, value) => {
  if (to.toLowerCase() === PKP_ADDRESS.toLowerCase()) {
    console.log(`💰 PKP received ${ethers.utils.formatUnits(value, 6)} USDC`);

    // Trigger Lit Action
    const result = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      sessionSigs: {}, // Zero-sig execution
      jsParams: {
        pkpAddress: PKP_ADDRESS,
        publicKey: PKP_PUBLIC_KEY,
        creditsContract: CREDITS_CONTRACT,
        usdcContract: USDC_CONTRACT,
        minCreditThreshold: 5
      }
    });

    console.log("Auto-purchase result:", result.response);
  }
});
```

---

## Webhook Setup

### Railway Deployment (Recommended)

1. **Push to GitHub:**
```bash
cd webhook-server
git init
git add .
git commit -m "Initial commit: Auto-purchase webhook"
git push origin main
```

2. **Deploy to Railway:**
```bash
railway login
railway init
railway link <PROJECT_NAME>
railway up
```

3. **Set environment variables:**
```bash
railway variables set \
  USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  CREDITS_CONTRACT=0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6 \
  PKP_ADDRESS=<YOUR_PKP> \
  PKP_PUBLIC_KEY=<YOUR_KEY> \
  LIT_ACTION_CID=<CID> \
  BASE_RPC_URL=https://sepolia.base.org
```

4. **Monitor logs:**
```bash
railway logs
```

### Alternative: Run Locally

```bash
cd webhook-server
npm install
npm start
```

**Keep the server running 24/7** to listen for USDC deposits.

---

## Testing

### 1. Test Lit Action Directly

```bash
cd lit-actions
DOTENV_PRIVATE_KEY=xxx dotenvx run -- \
  node src/test/test-auto-purchase-credits.mjs
```

**Expected output:**
```
🧪 Testing Auto-Purchase Credits Lit Action
✅ Connected to Lit Network
🚀 Executing Lit Action...

📊 EXECUTION RESULT
================================================================================
✅ Credits purchased successfully!
  - Transaction: 0xABCDEF...
  - Credits earned: 5
  - Package price: $2.50
  - USDC balance: 2.75 USDC

🔗 View on BaseScan: https://sepolia.basescan.org/tx/0xABCDEF...
```

### 2. Test Webhook (Manual Trigger)

Send USDC to your PKP wallet:
```bash
# From your external wallet
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "transfer(address,uint256)" \
  <PKP_ADDRESS> \
  1000000 \  # 1 USDC (6 decimals)
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY
```

**Watch webhook logs** for auto-purchase execution.

### 3. Test End-to-End Flow

1. **Check initial state:**
```bash
cast call 0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6 \
  "getCredits(address)" <PKP_ADDRESS> \
  --rpc-url https://sepolia.base.org
```

2. **Send $2.50 USDC to PKP:**
```bash
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "transfer(address,uint256)" \
  <PKP_ADDRESS> \
  2500000 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY
```

3. **Wait 10-30 seconds for webhook + Lit Action**

4. **Verify credits increased:**
```bash
cast call 0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6 \
  "getCredits(address)" <PKP_ADDRESS> \
  --rpc-url https://sepolia.base.org
```

**Expected:** Credits increased by 5

---

## FAQ

### Q: What happens if the user sends more than $10 worth of USDC?

**A:** The Lit Action will purchase the largest package (20 credits for $10), and the **excess USDC remains in the PKP wallet**. When the user sends more USDC later, the webhook triggers again and purchases more credits.

**Example:**
- User sends $15 USDC
- Lit Action purchases 20 credits for $10
- $5 USDC remains in wallet
- User can top up anytime

### Q: Can we add bulk discounts for larger packages?

**A:** Yes! Update the contract with better pricing for larger packages:

```solidity
// Package 0: 1 credit = $0.50
packages[0] = CreditPackage({
    credits: 1,
    priceUSDC: 500000,  // $0.50
    priceETH: 0.0002 ether,
    enabled: true
});

// Package 1: 5 credits = $2.25 (10% discount)
packages[1] = CreditPackage({
    credits: 5,
    priceUSDC: 2250000,  // $2.25 (was $2.50)
    priceETH: 0.0009 ether,
    enabled: true
});

// Package 2: 20 credits = $8.00 (20% discount)
packages[2] = CreditPackage({
    credits: 20,
    priceUSDC: 8000000,  // $8.00 (was $10.00)
    priceETH: 0.0032 ether,
    enabled: true
});
```

### Q: How do we prevent duplicate purchases if the webhook triggers twice?

**A:** The Lit Action is **idempotent**:
1. Checks if `credits[user] >= minCreditThreshold` (default: 5)
2. If user already has sufficient credits, skips purchase
3. Uses `runOnce()` to prevent duplicate transaction submissions

### Q: Can users disable auto-purchase?

**A:** Currently, auto-purchase triggers whenever PKP receives USDC. To add user control:
1. Add `autoPurchaseEnabled` mapping to contract
2. Add `setAutoPurchase(bool enabled)` function
3. Update Lit Action to check this flag before purchasing

### Q: How much does the Lit Action execution cost?

**A:**
- **Lit Action execution:** Free (runs on Lit nodes)
- **Transaction gas:** ~100k gas (~$0.01 on Base Sepolia)
- **Total cost:** Just the transaction gas (paid from PKP's ETH balance)

### Q: What if PKP runs out of ETH for gas?

**A:** The Lit Action will fail with an insufficient funds error. Solutions:
1. **User tops up PKP with ETH** (via external wallet)
2. **Add ETH buffer check** to Lit Action (skip if ETH balance < threshold)
3. **Use paymaster** (sponsor gas for users)

### Q: Can we use Multicall instead of ERC-2612 permit?

**A:** Yes, but ERC-2612 is **preferred** because:
- ✅ Simpler code (no Multicall contract needed)
- ✅ Better gas efficiency
- ✅ Standard USDC feature (widely supported)
- ✅ Cleaner transaction logs

---

## Summary

**✅ Added to contract:**
- `purchaseCreditsWithPermit()` - ERC-2612 permit-based purchasing
- `getOptimalPackage()` - Smart package selection

**✅ Lit Action created:**
- `auto-purchase-credits.js` - Automated credit purchasing
- Checks balance → Selects optimal package → Signs permit → Submits TX

**✅ UX improvements:**
1. User sends USDC to PKP (1 TX from external wallet)
2. Backend auto-detects + auto-purchases (1 automated TX)
3. User can immediately use credits

**Next steps:**
1. Deploy updated contract to Base Sepolia
2. Upload Lit Action to IPFS
3. Grant PKP permission
4. Deploy webhook server
5. Test end-to-end flow
