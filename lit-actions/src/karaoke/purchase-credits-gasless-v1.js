/**
 * Purchase Credits Gasless V1
 *
 * Enables users to purchase credits with USDC without needing ETH for gas.
 * Uses ERC-2612 permit (PRE-SIGNED by user) + relayer pattern for gasless transactions.
 *
 * Architecture:
 * 1. Frontend: User's PKP signs EIP-2612 permit message (NO GAS NEEDED)
 * 2. Frontend: Calls this Lit Action with permit signature (v, r, s)
 * 3. Lit Action: Relayer PKP submits purchaseCreditsWithPermit transaction (PAYS GAS)
 * 4. Result: User receives credits, relayer paid gas fees
 *
 * Flow:
 * 1. Verify user has sufficient USDC
 * 2. Receive pre-signed permit from frontend (v, r, s, deadline)
 * 3. Sign transaction with relayer PKP (funded with ETH)
 * 4. Submit transaction via runOnce() to avoid duplicates
 *
 * @param {string} userPkpAddress - User's PKP address (must have USDC)
 * @param {string} relayerPkpPublicKey - Relayer's PKP public key (signs tx, pays gas)
 * @param {string} relayerPkpAddress - Relayer's PKP address (must have ETH)
 * @param {number} packageId - Credit package to purchase (0-2)
 * @param {number} permitDeadline - Permit expiration timestamp
 * @param {number} permitV - Permit signature v value
 * @param {string} permitR - Permit signature r value (0x...)
 * @param {string} permitS - Permit signature s value (0x...)
 * @param {string} creditsContract - KaraokeCreditsV1 address
 * @param {string} usdcContract - USDC token address
 */

(async () => {
  try {
    console.log("💳 Purchase Credits Gasless V1");
    console.log("User PKP:", jsParams.userPkpAddress);
    console.log("Relayer PKP:", jsParams.relayerPkpAddress);
    console.log("Package ID:", jsParams.packageId);

    // ============================================================================
    // Configuration
    // ============================================================================

    const BASE_SEPOLIA_CHAIN_ID = 84532;
    const userPkpAddress = jsParams.userPkpAddress;
    const relayerPkpAddress = jsParams.relayerPkpAddress;
    const relayerPkpPublicKey = jsParams.relayerPkpPublicKey;
    const packageId = jsParams.packageId;
    const creditsContract = jsParams.creditsContract || "0x6de183934E68051c407266F877fafE5C20F74653";
    const usdcContract = jsParams.usdcContract || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

    // Pre-signed permit parameters (signed by user in frontend)
    const permitDeadline = jsParams.permitDeadline;
    const permitV = jsParams.permitV;
    const permitR = jsParams.permitR;
    const permitS = jsParams.permitS;

    // Validate inputs
    if (!userPkpAddress) {
      throw new Error("Missing userPkpAddress");
    }
    if (!relayerPkpAddress || !relayerPkpPublicKey) {
      throw new Error("Missing relayerPkpAddress or relayerPkpPublicKey");
    }
    if (packageId === undefined || packageId < 0 || packageId > 2) {
      throw new Error("Invalid packageId (must be 0, 1, or 2)");
    }
    if (!permitDeadline || !permitV || !permitR || !permitS) {
      throw new Error("Missing permit signature parameters (permitDeadline, permitV, permitR, permitS)");
    }

    // Get RPC for Base Sepolia
    const rpcUrl = await Lit.Actions.getRpcUrl({ chain: "baseSepolia" });
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // ============================================================================
    // Step 1: Get Package Details
    // ============================================================================

    console.log("📦 Fetching package details...");

    const getPackageAbi = [{
      name: "getPackage",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "packageId", type: "uint8" }],
      outputs: [
        { name: "credits", type: "uint16" },
        { name: "priceUSDC", type: "uint256" },
        { name: "priceETH", type: "uint256" },
        { name: "enabled", type: "bool" }
      ]
    }];

    const packageInterface = new ethers.utils.Interface(getPackageAbi);
    const packageData = packageInterface.encodeFunctionData("getPackage", [packageId]);

    const packageResult = await provider.call({
      to: creditsContract,
      data: packageData
    });

    const [credits, priceUSDC, priceETH, enabled] = ethers.utils.defaultAbiCoder.decode(
      ["uint16", "uint256", "uint256", "bool"],
      packageResult
    );

    if (!enabled) {
      throw new Error(`Package ${packageId} is disabled`);
    }

    const priceFormatted = ethers.utils.formatUnits(priceUSDC, 6);
    console.log(`Package ${packageId}: ${credits} credits for $${priceFormatted} USDC`);

    // ============================================================================
    // Step 2: Verify User's USDC Balance
    // ============================================================================

    console.log("💰 Checking user's USDC balance...");

    const balanceOfAbi = [{
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }]
    }];

    const usdcInterface = new ethers.utils.Interface(balanceOfAbi);
    const balanceOfData = usdcInterface.encodeFunctionData("balanceOf", [userPkpAddress]);

    const balanceResult = await provider.call({
      to: usdcContract,
      data: balanceOfData
    });

    const usdcBalance = ethers.BigNumber.from(balanceResult);
    const usdcBalanceFormatted = ethers.utils.formatUnits(usdcBalance, 6);
    console.log(`User USDC balance: ${usdcBalanceFormatted} USDC`);

    if (usdcBalance.lt(priceUSDC)) {
      throw new Error(`Insufficient USDC: have ${usdcBalanceFormatted}, need ${priceFormatted}`);
    }

    // ============================================================================
    // Step 3: Verify Relayer's ETH Balance
    // ============================================================================

    console.log("⛽ Checking relayer's ETH balance...");

    const relayerEthBalance = await provider.getBalance(relayerPkpAddress);
    const relayerEthFormatted = ethers.utils.formatEther(relayerEthBalance);
    console.log(`Relayer ETH balance: ${relayerEthFormatted} ETH`);

    const minRelayerBalance = ethers.utils.parseEther("0.0001"); // Min 0.0001 ETH
    if (relayerEthBalance.lt(minRelayerBalance)) {
      throw new Error(`Relayer has insufficient ETH: ${relayerEthFormatted} ETH`);
    }

    // ============================================================================
    // Step 4: Build Transaction with Pre-Signed Permit
    // ============================================================================

    console.log("📝 Building transaction with user's permit signature...");
    console.log(`  Permit deadline: ${permitDeadline}`);
    console.log(`  Permit v: ${permitV}`);
    console.log(`  Permit r: ${permitR.substring(0, 10)}...`);
    console.log(`  Permit s: ${permitS.substring(0, 10)}...`);

    const purchaseAbi = [{
      name: "purchaseCreditsWithPermit",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "packageId", type: "uint8" },
        { name: "deadline", type: "uint256" },
        { name: "v", type: "uint8" },
        { name: "r", type: "bytes32" },
        { name: "s", type: "bytes32" }
      ]
    }];

    const purchaseInterface = new ethers.utils.Interface(purchaseAbi);

    // Build transaction data
    // IMPORTANT: The permit signature identifies the user (userPkpAddress)
    // But the transaction is submitted by relayerPkpAddress (who pays gas)
    const txData = purchaseInterface.encodeFunctionData("purchaseCreditsWithPermit", [
      packageId,
      permitDeadline,
      permitV,
      permitR,
      permitS
    ]);

    // Get relayer's nonce and gas price
    const relayerTxCount = await provider.getTransactionCount(relayerPkpAddress, "latest");
    const gasPrice = await provider.getGasPrice();

    // Estimate gas
    const gasLimit = await provider.estimateGas({
      from: relayerPkpAddress,
      to: creditsContract,
      data: txData
    }).catch(() => ethers.BigNumber.from(250000)); // Fallback gas limit

    console.log(`Gas estimate: ${gasLimit.toString()}`);
    console.log(`Gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);

    // ============================================================================
    // Step 5: Sign Transaction with Relayer's PKP
    // ============================================================================

    console.log("🔐 Signing transaction with relayer PKP...");

    // Construct unsigned transaction
    const unsignedTx = {
      to: creditsContract,
      data: txData,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      nonce: relayerTxCount,
      gasLimit: gasLimit,
      gasPrice: gasPrice
    };

    // Sign transaction with RELAYER's PKP
    const txHash = ethers.utils.keccak256(ethers.utils.serializeTransaction(unsignedTx));

    const txSigShare = await Lit.Actions.signAndCombineEcdsa({
      toSign: ethers.utils.arrayify(txHash),
      publicKey: relayerPkpPublicKey,
      sigName: "transactionSignature"
    });

    const txSignature = JSON.parse(txSigShare);

    // Format signature for ethers
    let txV = txSignature.v;
    if (txV === 0 || txV === 1) {
      txV = txV + 27;
    }

    const txR = "0x" + txSignature.r.substring(2);
    const txS = "0x" + txSignature.s;

    const formattedSig = {
      v: txV,
      r: txR,
      s: txS
    };

    const hexSignature = ethers.utils.joinSignature(formattedSig);

    // Serialize signed transaction
    const signedTx = ethers.utils.serializeTransaction(unsignedTx, hexSignature);

    console.log("✅ Transaction signed by relayer PKP");

    // ============================================================================
    // Step 6: Submit Transaction (runOnce to prevent duplicates)
    // ============================================================================

    console.log("📤 Submitting transaction...");

    const txResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "submitGaslessPurchase" },
      async () => {
        try {
          const tx = await provider.sendTransaction(signedTx);
          console.log("✅ Transaction submitted:", tx.hash);

          return JSON.stringify({
            success: true,
            txHash: tx.hash,
            packageId: packageId,
            creditsEarned: credits,
            packagePrice: priceFormatted,
            userAddress: userPkpAddress,
            relayerAddress: relayerPkpAddress
          });
        } catch (error) {
          console.error("❌ Transaction failed:", error.message);
          return JSON.stringify({
            success: false,
            error: error.message
          });
        }
      }
    );

    console.log("📊 Transaction result:", txResult);

    const parsedResult = JSON.parse(txResult);

    if (parsedResult.success) {
      console.log(`🎉 Credits purchased successfully!`);
      console.log(`   TX: ${parsedResult.txHash}`);
      console.log(`   User: ${parsedResult.userAddress}`);
      console.log(`   Relayer: ${parsedResult.relayerAddress}`);
      console.log(`   Credits: ${parsedResult.creditsEarned}`);
      console.log(`   Price: $${parsedResult.packagePrice} USDC`);
    }

    return Lit.Actions.setResponse({
      response: txResult
    });

  } catch (error) {
    console.error("❌ Gasless purchase error:", error);
    return Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    });
  }
})();
