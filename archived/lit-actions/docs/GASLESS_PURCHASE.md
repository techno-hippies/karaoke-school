# Gasless Credit Purchase (V1)

Enables users to purchase credits with USDC **without needing ETH for gas fees**.

## 🎯 Problem Solved

Users with PKP wallets have USDC but no ETH → **can't pay gas fees** → can't spend their USDC.

## ✨ Solution: EIP-2612 Permit + Relayer Pattern

```
┌─────────────────────────────────────────────────────────────┐
│  USER'S PKP (has USDC, no ETH)                              │
│    ↓                                                         │
│    Signs EIP-2612 permit message                            │
│    ✅ No gas needed (pure signature)                        │
│    ✅ No transaction submitted                              │
├─────────────────────────────────────────────────────────────┤
│  RELAYER PKP (has ETH)                                      │
│    0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30              │
│    ↓                                                         │
│    Submits purchaseCreditsWithPermit(user permit)           │
│    ✅ Pays gas fees                                         │
│    ✅ User's USDC spent via permit                          │
├─────────────────────────────────────────────────────────────┤
│  RESULT                                                      │
│    ✅ User receives credits                                 │
│    ✅ User never needed ETH                                 │
│    ✅ Relayer paid gas on behalf of user                    │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Files

- **Lit Action**: `src/karaoke/purchase-credits-gasless-v1.js`
- **Test**: `src/test/test-purchase-credits-gasless-v1.mjs`
- **Contract**: `0x6de183934E68051c407266F877fafE5C20F74653` (KaraokeCreditsV1)

## 🧪 Testing

### Prerequisites

1. **User PKP**: Must have USDC on Base Sepolia (can have 0 ETH)
2. **Relayer PKP**: Already funded with ETH (~0.0033 ETH)
   - Address: `0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30`
   - Public Key: `0x043a5f87717...` (in contracts.config.js)

### Run Test

```bash
# Test with user's PKP (from .env)
DOTENV_PRIVATE_KEY=xxx dotenvx run -- node src/test/test-purchase-credits-gasless-v1.mjs

# Test with specific package (0 = 1 credit, 1 = 5 credits, 2 = 20 credits)
DOTENV_PRIVATE_KEY=xxx dotenvx run -- node src/test/test-purchase-credits-gasless-v1.mjs 0
```

### What the Test Does

1. ✅ Checks user has USDC (and preferably 0 ETH to prove gasless)
2. ✅ Checks relayer has ETH
3. ✅ Records user's credit balance before purchase
4. ✅ Executes Lit Action with both PKPs
5. ✅ Verifies transaction succeeded
6. ✅ Checks user's credit balance increased

### Expected Output

```
🧪 Testing Purchase Credits Gasless V1
================================================================================
👤 User PKP (signs permit, has USDC): 0x3498350068a57D87124AA813715B1df34EE05F5B
🤖 Relayer PKP (pays gas, has ETH): 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30
📦 Package ID: 0
================================================================================

💰 Checking balances...
  User USDC: 10.0 USDC
  User ETH: 0.0 ETH ✅ (gasless ready)
  Relayer ETH: 0.00328788 ETH ✅
  User credits (before): 0

🔗 Connecting to Lit Network...
✅ Connected to Lit Network

🚀 Executing Lit Action...

================================================================================
📊 EXECUTION RESULT
================================================================================
⏱️  Execution time: 4.23 seconds

📦 Parsed Response:
{
  "success": true,
  "txHash": "0xabc123...",
  "packageId": 0,
  "creditsEarned": 1,
  "packagePrice": "0.5",
  "userAddress": "0x3498350068a57D87124AA813715B1df34EE05F5B",
  "relayerAddress": "0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30"
}

🎉 PURCHASE SUCCESSFUL!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Transaction Hash: 0xabc123...
  Credits Earned: 1
  Package Price: $0.5 USDC
  User Address: 0x3498350068a57D87124AA813715B1df34EE05F5B
  Relayer Address: 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 View on BaseScan: https://sepolia.basescan.org/tx/0xabc123...

💳 Credits balance:
  Before: 0
  After: 1
  Gained: +1

✅ TEST COMPLETED
```

## 🚀 Deployment

### 1. Upload to IPFS

```bash
DOTENV_PRIVATE_KEY=xxx dotenvx run -- node scripts/upload-lit-action.mjs \
  src/karaoke/purchase-credits-gasless-v1.js \
  "Purchase Credits Gasless V1"
```

This will output:
```
📦 CID: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 2. Grant Relayer PKP Permission

```bash
DOTENV_PRIVATE_KEY=xxx dotenvx run -- bun run scripts/add-pkp-permission.mjs <CID>
```

This adds the new IPFS CID to the relayer PKP's permitted actions.

### 3. Update Frontend

In `app/src/features/post-flow/hooks/useCredits.ts`:

```typescript
// Replace lines 85-121 (approve + purchaseCreditsUSDC)
const purchaseCredits = async (packageId: number): Promise<boolean> => {
  if (!pkpWalletClient) {
    setError('Wallet not connected')
    return false
  }

  setIsPurchasing(true)
  setError(null)

  try {
    const { LitNodeClient } = await import('@lit-protocol/lit-node-client')
    const { LitNetwork } = await import('@lit-protocol/constants')

    // Initialize Lit client
    const litClient = new LitNodeClient({
      litNetwork: LitNetwork.DatilDev,
      debug: false,
    })
    await litClient.connect()

    // Execute gasless purchase Lit Action
    const result = await litClient.executeJs({
      ipfsId: 'QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // From step 1
      sessionSigs: {},
      jsParams: {
        userPkpAddress: pkpAddress,
        userPkpPublicKey: pkpPublicKey, // Get from auth context
        relayerPkpAddress: '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30',
        relayerPkpPublicKey: '0x043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939',
        packageId,
        creditsContract: '0x6de183934E68051c407266F877fafE5C20F74653',
        usdcContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      },
    })

    const parsedResult = JSON.parse(result.response)
    if (parsedResult.success) {
      console.log('[Credits] Purchase successful:', parsedResult.txHash)
      return true
    } else {
      setError(parsedResult.error)
      return false
    }
  } catch (err) {
    console.error('[Credits] Gasless purchase failed:', err)
    setError(err instanceof Error ? err.message : 'Purchase failed')
    return false
  } finally {
    setIsPurchasing(false)
  }
}
```

## 🔧 Technical Details

### EIP-2612 Permit

The user's PKP signs a typed data message (EIP-712) that approves the contract to spend USDC:

```javascript
{
  owner: userPkpAddress,
  spender: creditsContract,
  value: packagePrice,
  nonce: currentNonce,
  deadline: timestamp + 3600
}
```

This signature is **not** a transaction - it's just a cryptographic proof.

### Transaction Submission

The relayer PKP then calls:

```solidity
purchaseCreditsWithPermit(
  packageId,
  deadline,
  v, r, s // User's permit signature
)
```

The contract:
1. ✅ Verifies the permit signature is valid
2. ✅ Approves itself to spend user's USDC
3. ✅ Transfers USDC from user to treasury
4. ✅ Mints credits to user

The `msg.sender` is the relayer, but the USDC comes from the user's wallet (via permit).

### Gas Costs

- Typical transaction: ~150,000 gas
- At 0.001 gwei gas price: ~$0.0001
- Relayer can execute ~33,000 purchases with 0.0033 ETH

## 🔒 Security

### User Safety

- ✅ User only signs permit (can't steal funds beyond package price)
- ✅ Permit has 1 hour expiration (deadline)
- ✅ Permit is for exact package price (not max uint256)
- ✅ Permit is single-use (nonce invalidated after use)

### Relayer Safety

- ✅ Relayer can't steal user's USDC (permit signature required)
- ✅ Relayer only pays gas (no USDC spent)
- ✅ Lit Action is immutable (IPFS CID)
- ✅ PKP permissions restrict which actions can sign

### Contract Safety

- ✅ `purchaseCreditsWithPermit` validates all signatures
- ✅ Credits minted to user, not relayer
- ✅ No arbitrary permit amount (must match package price)

## 🐛 Troubleshooting

### Error: "Insufficient USDC"

User doesn't have enough USDC for the package. Send USDC to their PKP address.

### Error: "Relayer has insufficient ETH"

Relayer PKP needs more ETH. Send ETH to `0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30`.

### Error: "Permit call failed"

Possible causes:
- USDC contract doesn't support EIP-2612 (Base Sepolia USDC does)
- Signature invalid (check publicKey matches address)
- Deadline expired (increase deadline duration)
- Nonce mismatch (permit already used)

### Transaction Submitted but Credits Not Received

1. Check transaction on BaseScan: https://sepolia.basescan.org/tx/[hash]
2. Verify it succeeded (green checkmark)
3. Check if permit or transferFrom reverted
4. Wait 5-10 seconds for blockchain confirmation

## 📊 Comparison

### Before (Direct Purchase)

```
User needs: ✅ USDC + ❌ ETH for gas
Steps: 2 transactions (approve + purchase)
UX: ❌ Bad (user must get ETH first)
```

### After (Gasless Purchase)

```
User needs: ✅ USDC only
Steps: 1 Lit Action call (permit + submit)
UX: ✅ Seamless (no ETH needed)
```

## 🔮 Future Enhancements

### V2 Considerations

- [ ] Relayer fee (charge user extra to cover gas + profit)
- [ ] Multiple relayer PKPs (load balancing)
- [ ] Relayer health monitoring (auto-refill ETH)
- [ ] Support other tokens (DAI, USDT) with permit
- [ ] Batch purchases (multiple users in one tx)
- [ ] Signature aggregation (reduce Lit Action calls)

### Alternative Approaches

1. **Paymaster (EIP-4337)**: Use account abstraction for native gasless txs
2. **Cross-Chain**: Accept USDC on any chain, bridge to Base Sepolia
3. **Credit Card**: Fiat → USDC → Credits (fully abstracted)
4. **Subscription**: Pre-fund relayer, deduct from prepaid balance

## 📚 References

- [EIP-2612: Permit Extension for ERC-20](https://eips.ethereum.org/EIPS/eip-2612)
- [Lit Protocol Docs](https://developer.litprotocol.com/)
- [Base Sepolia Explorer](https://sepolia.basescan.org)
- [KaraokeCreditsV1 Contract](https://sepolia.basescan.org/address/0x6de183934E68051c407266F877fafE5C20F74653)
