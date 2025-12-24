# Tempo Karaoke Line Grader - Implementation Plan

## Overview

Replace the zkSync EIP-712 (0x71) transaction signing with Tempo's native 0x76 format, leveraging **parallel nonces** to eliminate race conditions between concurrent line grading invocations.

## Problem Statement

Current architecture on Lens Testnet:
```
Lit Action 1 (Line 0)    Lit Action 2 (Line 1)    Lit Action 3 (Line 2)
─────────────────────    ─────────────────────    ─────────────────────
Fetch nonce: 5           Fetch nonce: 5           Fetch nonce: 5
Sign tx (nonce=5)        Sign tx (nonce=5)        Sign tx (nonce=5)
Submit...                Submit...                Submit...
     │                        │                        │
     ▼                        ▼                        ▼
✓ Accepted               ✗ NONCE CONFLICT          ✗ NONCE CONFLICT
```

Each Lit Action invocation is stateless - they can't coordinate nonces.

## Solution: Tempo Parallel Nonces

Tempo's 2D nonce system: `(nonce_key, nonce)`
- `nonce_key = 0`: Protocol nonce (sequential, like Ethereum)
- `nonce_key = 1..N`: User nonces (independent sequences)

```
Lit Action 1 (Line 0)    Lit Action 2 (Line 1)    Lit Action 3 (Line 2)
─────────────────────    ─────────────────────    ─────────────────────
nonce_key = 1            nonce_key = 2            nonce_key = 3
nonce = 0                nonce = 0                nonce = 0
Sign & submit            Sign & submit            Sign & submit
     │                        │                        │
     ▼                        ▼                        ▼
✓ Accepted               ✓ Accepted               ✓ Accepted
```

Each line uses its own nonce_key, so all can execute in parallel!

---

## Tempo 0x76 Transaction Format

### Structure (RLP encoded)

```
0x76 || rlp([
  chain_id,                 // 42429 (Tempo Testnet)
  max_priority_fee_per_gas, // e.g., 1 gwei
  max_fee_per_gas,          // e.g., 10 gwei
  gas_limit,                // 500000
  calls,                    // [[to, value, data]] - batched calls
  access_list,              // [] empty
  nonce_key,                // lineIndex + 1 (parallel!)
  nonce,                    // 0 for first use of key
  valid_before,             // 0x80 (none)
  valid_after,              // 0x80 (none)
  fee_token,                // 0x80 (none) or token address
  fee_payer_signature,      // 0x80 (none)
  aa_authorization_list,    // [] empty
  sender_signature          // 65 bytes: r(32) + s(32) + v(1)
])
```

### Signing

```javascript
// 1. Build unsigned tx (all fields except sender_signature)
const unsignedFields = [
  chainId,
  maxPriorityFeePerGas,
  maxFeePerGas,
  gasLimit,
  [[to, value, data]],  // calls array
  [],                   // access_list
  nonceKey,
  nonce,
  '0x80', '0x80',       // valid_before, valid_after
  '0x80',               // fee_token
  '0x80',               // fee_payer_signature
  [],                   // aa_authorization_list
];

// 2. Compute signing hash
const unsignedRlp = rlp.encode(unsignedFields);
const signingHash = keccak256(concat(['0x76', unsignedRlp]));

// 3. Sign with PKP (secp256k1)
const { r, s, v } = await Lit.Actions.signAndCombineEcdsa({
  toSign: arrayify(signingHash),
  publicKey: PKP_PUBLIC_KEY,
  sigName: 'tempoTx'
});

// 4. Append signature (65 bytes: r + s + v)
const signature = concat([r, s, [v < 27 ? v : v - 27]]);

// 5. Build signed tx
const signedFields = [...unsignedFields, signature];
const signedTx = '0x76' + rlp.encode(signedFields).slice(2);
```

### Key Simplifications vs zkSync EIP-712

| Aspect | zkSync (0x71) | Tempo (0x76) |
|--------|---------------|--------------|
| Domain separator | Complex keccak256 | None |
| Struct hash | 13+ fields hashed | None |
| Signing payload | EIP-712 typed data | Simple: `keccak256(0x76 \|\| rlp(unsigned))` |
| Nonce | Sequential only | 2D: key + value |
| Gas per pubdata | Required field | Not needed |

---

## File Structure

```
lit-actions/
├── actions/
│   ├── karaoke-line-grader-v1.js      # Current (Lens/zkSync)
│   └── karaoke-line-grader-tempo.js   # New (Tempo/parallel nonces)
├── tests/
│   ├── test-line-grader.ts            # Current tests
│   └── test-line-grader-tempo.ts      # New tests
└── TEMPO-GRADER-PLAN.md               # This file
```

---

## Implementation Modules

### 1. Constants

```javascript
const TEMPO_CHAIN_ID = 42429;
const TEMPO_RPC = 'https://rpc.testnet.tempo.xyz';
const KARAOKE_EVENTS_ADDRESS = '0xde5128281D0A12808346ba4866D952EDB487BEcC';
const PKP_PUBLIC_KEY = '0x04...'; // Same PKP, secp256k1
```

### 2. Nonce Key Strategy

```javascript
function getNonceKey(context) {
  // Session operations use protocol nonce (key 0) - rare, sequential
  if (context.type === 'startSession') return 0;
  if (context.type === 'endSession') return 0;

  // Line grading uses parallel nonces (key 1+)
  // Key = lineIndex + 1 (so line 0 uses key 1, etc.)
  return context.lineIndex + 1;
}
```

### 3. Transaction Builder

```javascript
async function buildTempoTransaction({
  to,
  data,
  nonceKey,
  nonce = 0,
  gasLimit = 500000,
  feeToken = null,
}) {
  const feeData = await provider.getFeeData();

  return {
    chainId: TEMPO_CHAIN_ID,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 1_000_000_000n,
    maxFeePerGas: feeData.maxFeePerGas || 10_000_000_000n,
    gasLimit,
    calls: [[to, 0n, data]],  // Single call, no value
    accessList: [],
    nonceKey,
    nonce,
    validBefore: null,
    validAfter: null,
    feeToken,
    feePayerSignature: null,
    aaAuthorizationList: [],
  };
}
```

### 4. RLP Encoder

```javascript
function encodeTempoTx(tx, signature = null) {
  const fields = [
    toBeArray(tx.chainId),
    toBeArray(tx.maxPriorityFeePerGas),
    toBeArray(tx.maxFeePerGas),
    toBeArray(tx.gasLimit),
    tx.calls.map(([to, value, data]) => [to, toBeArray(value), data]),
    tx.accessList,
    toBeArray(tx.nonceKey),
    toBeArray(tx.nonce),
    tx.validBefore ? toBeArray(tx.validBefore) : '0x80',
    tx.validAfter ? toBeArray(tx.validAfter) : '0x80',
    tx.feeToken || '0x80',
    tx.feePayerSignature || '0x80',
    tx.aaAuthorizationList,
  ];

  if (signature) {
    fields.push(signature);
  }

  return '0x76' + ethers.utils.RLP.encode(fields).slice(2);
}
```

### 5. Signing Flow

```javascript
async function signAndSubmitTempoTx(tx) {
  const pkpAddress = ethers.utils.computeAddress(PKP_PUBLIC_KEY);

  // 1. Simulate first
  await provider.call({
    from: pkpAddress,
    to: tx.calls[0][0],
    data: tx.calls[0][2],
  });

  // 2. Compute signing hash
  const unsignedTx = encodeTempoTx(tx, null);
  const signingHash = ethers.utils.keccak256(unsignedTx);

  // 3. Sign with PKP
  const sig = await Lit.Actions.signAndCombineEcdsa({
    toSign: ethers.utils.arrayify(signingHash),
    publicKey: PKP_PUBLIC_KEY,
    sigName: `tempoTx_${tx.nonceKey}_${tx.nonce}`,
  });

  // 4. Build signature bytes (65 bytes)
  const { r, s, v } = JSON.parse(sig);
  const signature = ethers.utils.concat([
    ethers.utils.zeroPad(r, 32),
    ethers.utils.zeroPad(s, 32),
    [v < 27 ? v : v - 27],  // Recovery ID: 0 or 1
  ]);

  // 5. Build signed tx and submit
  const signedTx = encodeTempoTx(tx, signature);
  return await provider.send('eth_sendRawTransaction', [signedTx]);
}
```

---

## Gas Considerations

| Scenario | Additional Gas |
|----------|----------------|
| Protocol nonce (key 0) | +0 |
| Existing user key (nonce > 0) | +5,000 |
| New user key (nonce = 0) | +22,100 |

First grading of each line: ~522k gas
Retry of same line: ~505k gas

---

## Test Plan

### Unit Tests (test-line-grader-tempo.ts)

1. **RLP Encoding**
   - Verify unsigned tx encoding matches expected format
   - Verify signed tx includes 65-byte signature

2. **Nonce Key Assignment**
   - Line 0 → key 1
   - Line 49 → key 50
   - startSession → key 0
   - endSession → key 0

3. **Signing Hash**
   - Compute hash, recover signer, verify matches PKP

4. **Transaction Simulation**
   - Mock provider, verify call simulation before submit

### Integration Tests

1. **Single Line Grading**
   - Grade line 0, verify tx accepted on Tempo

2. **Parallel Line Grading**
   - Grade lines 0, 1, 2 concurrently
   - Verify all 3 txs accepted (no nonce conflicts!)

3. **Session Lifecycle**
   - Start session (key 0, nonce N)
   - Grade 3 lines in parallel (keys 1, 2, 3)
   - End session (key 0, nonce N+1)

---

## Migration Checklist

- [x] Deploy KaraokeEvents to Tempo Testnet
- [ ] Create karaoke-line-grader-tempo.js
- [ ] Create test-line-grader-tempo.ts
- [ ] Test single line grading
- [ ] Test parallel line grading
- [ ] Update subgraph for Tempo
- [ ] Update frontend to use Tempo RPC
- [ ] Deprecate Lens grader after validation

---

## Contract Address

```
Tempo Testnet (Chain ID: 42429)
KaraokeEvents: 0xde5128281D0A12808346ba4866D952EDB487BEcC
Trusted PKP:   0x5CF2f231D15F3e71f997AAE0f3037ec3fafa8379
```
