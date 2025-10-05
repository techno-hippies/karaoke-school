/**
 * Minimal zkSync EIP-712 Signature Test
 *
 * Tests ONLY the zkSync transaction signing and submission
 * No audio, no transcription, no API keys needed
 */

// ethers is available globally in Lit Actions
(async () => {
  try {
    // Testing on Lens Testnet (zkSync fork)
    const LENS_TESTNET_CHAIN_ID = 37111;
    const SCOREBOARD_CONTRACT_ADDRESS = '0x8301E4bbe0C244870a4BC44ccF0241A908293d36';

    // Get parameters from jsParams
    const { pkpPublicKey, userAddress, testScore } = jsParams;

    console.log('Test user address:', userAddress);

    // Connect to Lens Testnet
    const provider = new ethers.providers.JsonRpcProvider('https://rpc.testnet.lens.xyz');

    // Get PKP ETH address from public key
    const pkpEthAddress = ethers.utils.computeAddress(`0x${pkpPublicKey}`);

    console.log('PKP Address:', pkpEthAddress);

    // Get current nonce
    const nonce = await provider.getTransactionCount(pkpEthAddress);
    console.log('Nonce:', nonce);

    // Get gas price
    const gasPrice = await provider.getGasPrice();
    console.log('Gas Price:', gasPrice.toString());

    // zkSync parameters
    const maxPriorityFeePerGas = ethers.BigNumber.from(0);
    const gasPerPubdataByteLimit = ethers.BigNumber.from(50000); // Max per docs (was 800)

    // Normalize addresses
    const from = ethers.utils.getAddress(pkpEthAddress);
    const to = ethers.utils.getAddress(SCOREBOARD_CONTRACT_ADDRESS);

    // Encode updateScore function call
    const iface = new ethers.utils.Interface([
      'function updateScore(uint8 source, string trackId, string segmentId, address user, uint96 score)'
    ]);

    const updateScoreTxData = iface.encodeFunctionData('updateScore', [
      0,                                // source: 0 (Native)
      'heat-of-the-night-scarlett-x',   // trackId
      'verse-1',                        // segmentId
      userAddress,                      // user
      testScore || 100                  // score
    ]);

    console.log('Testing updateScore call:');
    console.log('  User:', userAddress);
    console.log('  Score:', testScore || 100);
    console.log('  Data:', updateScoreTxData.substring(0, 66) + '...');

    // Calculate EIP-712 domain separator
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

    console.log('Domain separator:', domainSeparator);

    // Calculate EIP-712 struct hash
    const txTypeHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes('Transaction(uint256 txType,uint256 from,uint256 to,uint256 gasLimit,uint256 gasPerPubdataByteLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 paymaster,uint256 nonce,uint256 value,bytes data,bytes32[] factoryDeps,bytes paymasterInput)')
    );

    // Hash empty arrays correctly
    // factoryDeps: keccak256(abi.encodePacked([])) = keccak256('0x')
    // paymasterInput: keccak256('0x')
    const factoryDepsHash = ethers.utils.keccak256('0x'); // keccak256(abi.encodePacked([]))
    const paymasterInputHash = ethers.utils.keccak256('0x'); // keccak256(0x)

    console.log('txTypeHash:', txTypeHash);
    console.log('factoryDepsHash:', factoryDepsHash);
    console.log('paymasterInputHash:', paymasterInputHash);
    console.log('gasPrice:', gasPrice.toString());
    console.log('nonce:', nonce);

    const structHash = ethers.utils.keccak256(
      ethers.utils.concat([
        txTypeHash,
        ethers.utils.zeroPad(ethers.utils.hexlify(113), 32),           // txType: 113 (0x71)
        ethers.utils.zeroPad(from, 32),                                // from
        ethers.utils.zeroPad(to, 32),                                  // to
        ethers.utils.zeroPad(ethers.utils.hexlify(2000000), 32),       // gasLimit (2M for scoreboard)
        ethers.utils.zeroPad(ethers.utils.hexlify(gasPerPubdataByteLimit), 32), // gasPerPubdata
        ethers.utils.zeroPad(ethers.utils.hexlify(gasPrice), 32),      // maxFeePerGas
        ethers.utils.zeroPad(ethers.utils.hexlify(maxPriorityFeePerGas), 32), // maxPriorityFeePerGas
        ethers.utils.zeroPad('0x00', 32),                              // paymaster: 0
        ethers.utils.zeroPad(ethers.utils.hexlify(nonce), 32),         // nonce
        ethers.utils.zeroPad('0x00', 32),                              // value: 0
        ethers.utils.keccak256(updateScoreTxData),                     // data: keccak256(data)
        factoryDepsHash,                                               // factoryDeps: keccak256(abi.encodePacked([]))
        paymasterInputHash                                             // paymasterInput: keccak256(0x)
      ])
    );

    console.log('Struct hash:', structHash);

    // Calculate final EIP-712 hash
    const eip712Hash = ethers.utils.keccak256(
      ethers.utils.concat([
        ethers.utils.toUtf8Bytes('\x19\x01'),
        domainSeparator,
        structHash
      ])
    );

    console.log('EIP-712 hash to sign:', eip712Hash);

    // Sign with PKP
    const toSign = ethers.utils.arrayify(eip712Hash);
    const signature = await Lit.Actions.signAndCombineEcdsa({
      toSign: toSign,
      publicKey: pkpPublicKey,
      sigName: 'zkSyncTest'
    });

    const jsonSignature = JSON.parse(signature);
    const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
    const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

    // Keep r and s as full 32-byte hex strings
    const r = ethers.utils.zeroPad(rHex, 32);
    const s = ethers.utils.zeroPad(sHex, 32);

    // Compute yParity from v (0 or 1)
    let v = jsonSignature.v;
    if (v < 27) {
      v += 27;
    }
    const yParity = v - 27;

    console.log('Signature yParity:', yParity);
    console.log('Signature r:', ethers.utils.hexlify(r));
    console.log('Signature s:', ethers.utils.hexlify(s));

    // Verify signature recovery
    const recovered = ethers.utils.recoverAddress(eip712Hash, { r: rHex, s: sHex, v: v });
    console.log('Recovered address:', recovered);
    console.log('Expected address:', pkpEthAddress);
    console.log('Recovery match:', recovered.toLowerCase() === pkpEthAddress.toLowerCase());

    if (recovered.toLowerCase() !== pkpEthAddress.toLowerCase()) {
      throw new Error(`Signature recovery failed: expected ${pkpEthAddress}, got ${recovered}`);
    }

    // Helper for minimal byte encoding
    const toBeArray = (value) => {
      if (!value || value === 0 || value === '0') {
        return new Uint8Array([]);
      }
      const hex = ethers.utils.hexlify(value);
      return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
    };

    console.log('Testing standard EOA approach (yParity/r/s in fields 7-9):');
    console.log('  yParity:', yParity);
    console.log('  r:', ethers.utils.hexlify(r));
    console.log('  s:', ethers.utils.hexlify(s));

    // Build RLP fields - Standard EOA approach (zkSync-ethers style)
    // Put yParity/r/s in fields 7-9, empty customSignature
    const signedFields = [
      toBeArray(nonce),                     // 0. nonce
      toBeArray(maxPriorityFeePerGas),      // 1. maxPriorityFeePerGas
      toBeArray(gasPrice),                  // 2. maxFeePerGas
      toBeArray(2000000),                   // 3. gasLimit (2M for scoreboard)
      to || '0x',                           // 4. to
      toBeArray(0),                         // 5. value
      updateScoreTxData || '0x',            // 6. data
      toBeArray(yParity),                   // 7. yParity (0 or 1)
      r,                                    // 8. r (32 bytes)
      s,                                    // 9. s (32 bytes)
      toBeArray(LENS_TESTNET_CHAIN_ID),     // 10. chainId
      from,                                 // 11. from
      toBeArray(gasPerPubdataByteLimit),    // 12. gasPerPubdata
      [],                                   // 13. factoryDeps
      '0x',                                 // 14. customSignature (empty for EOA)
      []                                    // 15. paymasterParams
    ];

    const signedRlp = ethers.utils.RLP.encode(signedFields);
    const signedTxSerialized = '0x71' + signedRlp.slice(2);

    console.log('Raw transaction:', signedTxSerialized);

    // Submit transaction
    let txHash;
    const response = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "txSender" },
      async () => {
        try {
          txHash = await provider.send("eth_sendRawTransaction", [signedTxSerialized]);
          return txHash;
        } catch (error) {
          return `TX_ERROR: ${error.message}`;
        }
      }
    );

    console.log('TX submitted:', response);

    // Wait for transaction receipt to check actual execution status
    let receipt = null;
    let receiptError = null;
    if (!response.startsWith('TX_ERROR')) {
      try {
        receipt = await provider.waitForTransaction(response, 1, 30000); // Wait up to 30s
        console.log('TX receipt status:', receipt.status);
        console.log('TX gas used:', receipt.gasUsed.toString());
      } catch (error) {
        receiptError = error.message;
        console.log('Receipt error:', receiptError);
      }
    }

    const result = {
      success: receipt ? receipt.status === 1 : false,
      txHash: response.startsWith('TX_ERROR') ? null : response,
      txSubmitted: !response.startsWith('TX_ERROR'),
      txExecuted: receipt ? receipt.status === 1 : false,
      error: response.startsWith('TX_ERROR') ? response : receiptError,
      eip712Hash,
      domainSeparator,
      structHash,
      signature: {
        yParity,
        r: ethers.utils.hexlify(r),
        s: ethers.utils.hexlify(s)
      },
      recovered,
      rawTx: signedTxSerialized,
      receipt: receipt ? {
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        logs: receipt.logs.length
      } : null,
      debug: {
        txTypeHash,
        factoryDepsHash,
        paymasterInputHash,
        gasPrice: gasPrice.toString(),
        nonce,
        from,
        to
      }
    };

    Lit.Actions.setResponse({ response: JSON.stringify(result, null, 2) });

  } catch (error) {
    const errorResult = {
      success: false,
      error: error.message,
      stack: error.stack
    };
    Lit.Actions.setResponse({ response: JSON.stringify(errorResult, null, 2) });
  }
})();
