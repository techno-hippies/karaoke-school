# Lens Network Lit Action Signature Pattern

## CRITICAL: Complex 16-Field EIP-712 Signature for zkSync/Lens

**This signature pattern is essential for ALL Lens network Lit Actions. Any transaction signing MUST use this exact 16-field pattern.**

## Why This Pattern Exists

Lens testnet runs on zkSync (Chain ID: 37111), which uses **EIP-712 typed data signatures** instead of Ethereum's simple keccak256(RLP) hashing. This requires:

1. EIP-712 domain separator calculation
2. EIP-712 struct hash calculation  
3. Specific field ordering and padding
4. yParity (0/1) instead of v (27/28) in RLP encoding
5. 16-field signed transaction structure

## The 16-Field Pattern

```javascript
// Step 1: Calculate EIP-712 domain separator
const domainTypeHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId)')
);
const nameHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('zkSync'));
const versionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('2'));

const domainSeparator = ethers.utils.keccak256(
  ethers.utils.concat([
    domainTypeHash,
    nameHash,
    versionHash,
    ethers.utils.zeroPad(ethers.utils.hexlify(LENS_TESTNET_CHAIN_ID), 32)
  ])
);

// Step 2: Calculate EIP-712 struct hash
const txTypeHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('Transaction(uint256 txType,uint256 from,uint256 to,uint256 gasLimit,uint256 gasPerPubdataByteLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 paymaster,uint256 nonce,uint256 value,bytes data,bytes32[] factoryDeps,bytes paymasterInput)')
);

const structHash = ethers.utils.keccak256(
  ethers.utils.concat([
    txTypeHash,
    ethers.utils.zeroPad(ethers.utils.hexlify(113), 32),           // txType: 113 (0x71)
    ethers.utils.zeroPad(from, 32),                                // from: address as uint256
    ethers.utils.zeroPad(to, 32),                                  // to: address as uint256
    ethers.utils.zeroPad(ethers.utils.hexlify(2000000), 32),       // gasLimit
    ethers.utils.zeroPad(ethers.utils.hexlify(gasPerPubdataByteLimit), 32),
    ethers.utils.zeroPad(ethers.utils.hexlify(gasPrice), 32),
    ethers.utils.zeroPad(ethers.utils.hexlify(maxPriorityFeePerGas), 32),
    ethers.utils.zeroPad('0x00', 32),                              // paymaster: 0
    ethers.utils.zeroPad(ethers.utils.hexlify(nonce), 32),
    ethers.utils.zeroPad('0x00', 32),                              // value: 0
    ethers.utils.keccak256(updateScoreTxData || '0x'),             // data: keccak256(data)
    ethers.utils.keccak256('0x'),                                  // factoryDeps
    ethers.utils.keccak256('0x')                                   // paymasterInput
  ])
);

// Step 3: Calculate final EIP-712 hash
const eip712Hash = ethers.utils.keccak256(
  ethers.utils.concat([
    ethers.utils.toUtf8Bytes('\x19\x01'),
    domainSeparator,
    structHash
  ])
);
```

## The 16 Signed Fields

```javascript
// CRITICAL: All 16 fields MUST be present in exact order
const signedFields = [
  0,  // nonce (minimal big-endian bytes)
  1,  // maxPriorityFeePerGas
  2,  // maxFeePerGas  
  3,  // gasLimit
  4,  // to (address or '0x')
  5,  // value (0 for our contracts)
  6,  // data (encoded function call)
  7,  // yParity (0 or 1) - NOT v (27/28)!
  8,  // r (full 32 bytes, don't strip zeros)
  9,  // s (full 32 bytes, don't strip zeros)
  10, // chainId
  11, // from (address)
  12, // gasPerPubdataByteLimit
  13, // factoryDeps (empty array [])
  14, // customSignature (empty string '0x')
  15  // paymasterParams (empty array [])
];
```

## Key Differences from Ethereum

| Aspect | Ethereum | Lens (zkSync) |
|--------|----------|---------------|
| **Hash Method** | keccak256(RLP) | EIP-712 typed data |
| **v Parameter** | 27/28 | Convert to yParity (0/1) |
| **r/s Padding** | Strip leading zeros | Keep full 32 bytes |
| **Signature Format** | Standard RLP | Custom 16-field RLP |
| **Type Byte** | None | 0x71 prefix |

## Critical Implementation Details

### 1. yParity Conversion
```javascript
// WRONG - will fail on Lens
const v = 27; // Ethereum style
const yParity = v - 27; // 0

// CORRECT - converts v to yParity
let v = signature.v;
if (v < 27) v = v + 27; // Convert 0/1 to 27/28
const yParity = v - 27; // yParity for RLP
```

### 2. Full 32-Byte r/s
```javascript
// WRONG - strips zeros, causes invalid signature
const rShort = jsonSignature.r; // May have leading zeros stripped

// CORRECT - ensure full 32 bytes
const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
const r = ethers.utils.zeroPad(rHex, 32);
const s = ethers.utils.zeroPad(sHex, 32);
```

### 3. Field 7 is yParity, NOT v
```javascript
const signedFields = [
  nonce,
  maxPriorityFeePerGas,
  gasPrice,
  gasLimit,
  to,
  0, // value
  updateScoreTxData,
  yParity,        // ← This is 0 or 1, NOT v (27/28)
  ethers.utils.arrayify(r),
  ethers.utils.arrayify(s),
  LENS_TESTNET_CHAIN_ID,
  from,
  gasPerPubdataByteLimit,
  [],
  '0x',
  []
];
```

### 4. toBeArray Helper
```javascript
const toBeArray = (value) => {
  if (!value || value === 0 || value === '0') {
    return new Uint8Array([]); // Empty for zero
  }
  const hex = ethers.utils.hexlify(value);
  return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
};
```

## Complete Transaction Flow

```javascript
const go = async () => {
  const provider = new ethers.providers.JsonRpcProvider('https://rpc.testnet.lens.xyz');
  
  // 1. Build transaction data
  const updateScoreTxData = scoreboardContract.interface.encodeFunctionData('updateScore', [
    CONTENT_SOURCE_NATIVE,
    songId,
    segmentId,
    userAddress,
    calculatedScore
  ]);

  // 2. Get addresses and nonce
  const pkpEthAddress = ethers.utils.computeAddress(`0x${pkpPublicKey}`);
  const nonce = await provider.getTransactionCount(pkpEthAddress);
  const gasPrice = await provider.getGasPrice();

  // 3. Calculate EIP-712 hash (see above pattern)

  // 4. Sign with PKP
  const signature = await Lit.Actions.signAndCombineEcdsa({
    toSign: ethers.utils.arrayify(eip712Hash),
    publicKey: pkpPublicKey,
    sigName: 'lensTx'
  });

  // 5. Parse signature and convert to yParity
  const jsonSignature = JSON.parse(signature);
  let v = jsonSignature.v;
  if (v < 27) v = v + 27;
  const yParity = v - 27;

  // 6. Build 16-field RLP structure
  const signedFields = [
    toBeArray(nonce),
    toBeArray(0), // maxPriorityFeePerGas = 0 for zkSync
    toBeArray(gasPrice),
    toBeArray(2000000),
    SCOREBOARD_CONTRACT_ADDRESS,
    toBeArray(0),
    updateScoreTxData,
    toBeArray(yParity),
    ethers.utils.arrayify(ethers.utils.zeroPad(jsonSignature.r, 32)),
    ethers.utils.arrayify(ethers.utils.zeroPad(jsonSignature.s, 32)),
    toBeArray(37111), // LENS_TESTNET_CHAIN_ID
    pkpEthAddress,
    toBeArray(800), // gasPerPubdataByteLimit
    [],
    '0x',
    []
  ];

  // 7. RLP encode with 0x71 prefix
  const signedRlp = ethers.utils.RLP.encode(signedFields);
  const signedTxSerialized = '0x71' + signedRlp.slice(2);

  // 8. Submit using runOnce
  const response = await Lit.Actions.runOnce(
    { waitForResponse: true, name: "lensTxSender" },
    async () => {
      return await provider.send("eth_sendRawTransaction", [signedTxSerialized]);
    }
  );

  return response; // Transaction hash or error
};
```

## Common Mistakes That Break

1. **Using Ethereum keccak256(RLP)** instead of EIP-712
2. **Using v (27/28)** instead of yParity (0/1) in field 7
3. **Stripping leading zeros** from r/s (keep full 32 bytes)
4. **Wrong field order** in the 16-field structure
5. **Missing fields** in the signed transaction
6. **Wrong domain separator** (must match Lens zkSync version)

## Testing Your Signature

```javascript
// Verify signature recovers to correct address
const recovered = ethers.utils.recoverAddress(eip712Hash, {
  r: jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`,
  s: jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`,
  v: v // Use original v for recovery check
});

console.log('Expected:', pkpEthAddress);
console.log('Recovered:', recovered);
// Must match!
```

## Usage in Karaoke Lit Actions

This pattern is used in:
- `karaoke-scorer-v4.js` - Current working version
- `study-scorer-v1.js` - FSRS spaced repetition
- `match-and-segment-v10.js` - Song metadata processing

**Every new Lit Action that writes to Lens contracts MUST use this exact pattern.**
