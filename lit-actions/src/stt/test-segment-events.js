/**
 * Test SegmentEvents Contract Lit Action
 * 
 * Simple test to emit events to the SegmentEvents contract on Lens Chain
 * Demonstrates PKP signing for Lens Chain (ZKsync) compatibility
 * 
 * Expected params (via jsParams):
 * - pkpPublicKey: PKP public key for signing transactions
 * - userAddress: User's wallet address (optional, used as registeredBy)
 * - segmentHash: Unique segment hash (bytes32)
 * - grc20WorkId: GRC-20 work entity UUID (string)
 * - spotifyTrackId: Spotify track ID (string)
 * - segmentStartMs: Segment start time in milliseconds (uint32)
 * - segmentEndMs: Segment end time in milliseconds (uint32)
 * - metadataUri: Grove URI for metadata (string)
 */

// ============================================================
// CONFIGURATION - Public contract addresses (hardcoded)
// ============================================================
const SEGMENT_EVENTS_ADDRESS = '0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8'; // Deployed on Lens testnet
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC_URL = 'https://rpc.testnet.lens.xyz';

// ============================================================
// MAIN EXECUTION
// ============================================================
const go = async () => {
  let success = false;
  let txHash = null;
  let errorType = null;

  // Extract parameters from jsParams
  const {
    pkpPublicKey,
    userAddress,
    segmentHash,
    grc20WorkId,
    spotifyTrackId,
    segmentStartMs,
    segmentEndMs,
    metadataUri
  } = jsParams || {};

  try {
    // Validate required parameters
    if (!pkpPublicKey) {
      throw new Error('pkpPublicKey is required');
    }
    if (!segmentHash) {
      throw new Error('segmentHash is required');
    }
    if (!grc20WorkId) {
      throw new Error('grc20WorkId is required');
    }
    if (!spotifyTrackId) {
      throw new Error('spotifyTrackId is required');
    }
    if (!segmentStartMs) {
      throw new Error('segmentStartMs is required');
    }
    if (!segmentEndMs) {
      throw new Error('segmentEndMs is required');
    }
    if (!metadataUri) {
      throw new Error('metadataUri is required');
    }

    // Set up ethers provider for Lens testnet
    const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC_URL);

    // Define contract ABI for SegmentEvents
    const segmentEventsABI = [
      'function emitSegmentRegistered(bytes32 segmentHash, string grc20WorkId, string spotifyTrackId, uint32 segmentStartMs, uint32 segmentEndMs, string metadataUri) external',
      'function emitSegmentProcessed(bytes32 segmentHash, string instrumentalUri, string alignmentUri, uint8 translationCount, string metadataUri) external',
      'function emitSegmentToggled(bytes32 segmentHash, bool enabled) external'
    ];

    const segmentEventsContract = new ethers.Contract(
      SEGMENT_EVENTS_ADDRESS,
      segmentEventsABI,
      provider
    );

    // Normalize user address (if provided, use PKP address as fallback)
    const normalizedUserAddress = userAddress ? 
      ethers.utils.getAddress(userAddress.toLowerCase()) : 
      ethers.utils.computeAddress(`0x${pkpPublicKey}`);

    // Encode the transaction data for emitSegmentRegistered
    const emitSegmentRegisteredTxData = segmentEventsContract.interface.encodeFunctionData('emitSegmentRegistered', [
      segmentHash,
      grc20WorkId,
      spotifyTrackId,
      segmentStartMs,
      segmentEndMs,
      metadataUri
    ]);

    // Get PKP ETH address from public key
    const pkpEthAddress = ethers.utils.computeAddress(`0x${pkpPublicKey}`);

    // Get current nonce for PKP address
    const nonce = await provider.getTransactionCount(pkpEthAddress);

    // Get gas price (use as maxFeePerGas for zkSync EIP-1559 style)
    const gasPrice = await provider.getGasPrice();

    // For zkSync, set maxPriorityFeePerGas to 0 (fixed priority in L2)
    const maxPriorityFeePerGas = ethers.BigNumber.from(0);

    // zkSync gasPerPubdataByteLimit (typical value for L2 tx)
    const gasPerPubdataByteLimit = ethers.BigNumber.from(800);

    // zkSync uses EIP-712 typed data hashing
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

    // EIP-712 struct hash
    const txTypeHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes('Transaction(uint256 txType,uint256 from,uint256 to,uint256 gasLimit,uint256 gasPerPubdataByteLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 paymaster,uint256 nonce,uint256 value,bytes data,bytes32[] factoryDeps,bytes paymasterInput)')
    );

    // Encode struct fields
    const structHash = ethers.utils.keccak256(
      ethers.utils.concat([
        txTypeHash,
        ethers.utils.zeroPad(ethers.utils.hexlify(113), 32),           // txType: 113 (0x71)
        ethers.utils.zeroPad(pkpEthAddress, 32),                       // from
        ethers.utils.zeroPad(SEGMENT_EVENTS_ADDRESS, 32),             // to
        ethers.utils.zeroPad(ethers.utils.hexlify(500000), 32),       // gasLimit (500k for emit event)
        ethers.utils.zeroPad(ethers.utils.hexlify(gasPerPubdataByteLimit), 32), // gasPerPubdata
        ethers.utils.zeroPad(ethers.utils.hexlify(gasPrice), 32),      // maxFeePerGas
        ethers.utils.zeroPad(ethers.utils.hexlify(maxPriorityFeePerGas), 32), // maxPriorityFeePerGas
        ethers.utils.zeroPad('0x00', 32),                              // paymaster: 0
        ethers.utils.zeroPad(ethers.utils.hexlify(nonce), 32),         // nonce
        ethers.utils.zeroPad('0x00', 32),                              // value: 0
        ethers.utils.keccak256(emitSegmentRegisteredTxData),           // data
        ethers.utils.keccak256('0x'),                                  // factoryDeps: empty
        ethers.utils.keccak256('0x')                                   // paymasterInput: empty
      ])
    );

    // Calculate final EIP-712 hash
    const eip712Hash = ethers.utils.keccak256(
      ethers.utils.concat([
        ethers.utils.toUtf8Bytes('\x19\x01'),
        domainSeparator,
        structHash
      ])
    );

    const toSign = ethers.utils.arrayify(eip712Hash);

    // Sign the EIP-712 hash with PKP
    const signature = await Lit.Actions.signAndCombineEcdsa({
      toSign: toSign,
      publicKey: pkpPublicKey,
      sigName: 'segmentEventsTx'
    });

    // Parse signature
    const jsonSignature = JSON.parse(signature);
    const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
    const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

    // Keep r and s as full 32-byte arrays
    const r = ethers.utils.zeroPad(rHex, 32);
    const s = ethers.utils.zeroPad(sHex, 32);

    // Ensure v is in Ethereum format (27/28)
    let v = jsonSignature.v;
    if (v < 27) {
      v = v + 27;
    }

    // Verify signature recovery
    const recovered = ethers.utils.recoverAddress(eip712Hash, { r: rHex, s: sHex, v: v });
    if (recovered.toLowerCase() !== pkpEthAddress.toLowerCase()) {
      throw new Error(`Signature recovery failed: expected ${pkpEthAddress}, got ${recovered}`);
    }

    // Convert v to yParity for zkSync RLP encoding
    const yParity = v - 27;

    // Helper to convert number to minimal big-endian bytes
    const toBeArray = (value) => {
      if (!value || value === 0 || value === '0') {
        return new Uint8Array([]);
      }
      const hex = ethers.utils.hexlify(value);
      return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
    };

    // Build RLP fields for zkSync
    const signedFields = [
      toBeArray(nonce),                                     // 0. nonce
      toBeArray(maxPriorityFeePerGas),                      // 1. maxPriorityFeePerGas
      toBeArray(gasPrice),                                  // 2. maxFeePerGas
      toBeArray(500000),                                    // 3. gasLimit (500k for emit event)
      SEGMENT_EVENTS_ADDRESS,                               // 4. to
      toBeArray(0),                                         // 5. value
      emitSegmentRegisteredTxData,                          // 6. data
      toBeArray(yParity),                                   // 7. yParity (0 or 1)
      ethers.utils.arrayify(r),                             // 8. r (full 32 bytes)
      ethers.utils.arrayify(s),                             // 9. s (full 32 bytes)
      toBeArray(LENS_TESTNET_CHAIN_ID),                     // 10. chainId
      pkpEthAddress,                                        // 11. from
      toBeArray(gasPerPubdataByteLimit),                    // 12. gasPerPubdata
      [],                                                   // 13. factoryDeps (empty array)
      '0x',                                                 // 14. customSignature (empty string for EOA)
      []                                                    // 15. paymasterParams (empty array)
    ];

    // RLP encode signed fields
    const signedRlp = ethers.utils.RLP.encode(signedFields);

    // Prepend type 0x71
    const signedTxSerialized = '0x71' + signedRlp.slice(2);

    // Submit transaction using runOnce to avoid duplicates
    const response = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "segmentEventsTxSender" },
      async () => {
        try {
          txHash = await provider.send("eth_sendRawTransaction", [signedTxSerialized]);
          return txHash;
        } catch (error) {
          return `TX_SUBMIT_ERROR: ${error.message}`;
        }
      }
    );

    txHash = response; // If error, it will be the error string

    // Check if txHash is an error message
    if (txHash && txHash.startsWith('TX_SUBMIT_ERROR:')) {
      errorType = txHash;
      txHash = null;
    }

    success = true;

  } catch (error) {
    success = false;
    errorType = error.message || 'Unknown error';
    console.error('Segment events test error:', error);
  }

  // Return results
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success,
      txHash,
      errorType,
      segmentHash,
      grc20WorkId,
      spotifyTrackId,
      segmentStartMs,
      segmentEndMs,
      metadataUri,
      contractAddress: SEGMENT_EVENTS_ADDRESS,
      version: 'test-segment-events-v1',
      timestamp: new Date().toISOString()
    })
  });
};

// Execute
go().catch(error => {
  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: false,
      error: error.message || 'Fatal error',
      version: 'test-segment-events-v1'
    })
  });
});
