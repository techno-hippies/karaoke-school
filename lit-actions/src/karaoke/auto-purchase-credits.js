/**
 * Auto-Purchase Credits Lit Action
 *
 * Automatically purchases credits when PKP wallet receives USDC funding
 * Uses ERC-2612 permit for single-transaction approval + purchase
 *
 * Flow:
 * 1. Check PKP's USDC balance on Base
 * 2. Query optimal package from KaraokeCreditsV1
 * 3. If balance >= $0.50, sign EIP-2612 permit
 * 4. Submit purchaseCreditsWithPermit transaction
 *
 * Triggered by:
 * - Backend webhook on USDC Transfer event
 * - Manual invocation via API
 *
 * @param {string} pkpAddress - PKP wallet address (from jsParams)
 * @param {string} creditsContract - KaraokeCreditsV1 address on Base Sepolia
 * @param {string} usdcContract - USDC token address on Base Sepolia
 * @param {number} minCreditThreshold - Only purchase if current credits < threshold (default: 5)
 */

(async () => {
  try {
    console.log("🤖 Auto-Purchase Credits Lit Action");
    console.log("PKP Address:", jsParams.pkpAddress);

    // ============================================================================
    // Configuration
    // ============================================================================

    const BASE_SEPOLIA_CHAIN_ID = 84532;
    const pkpAddress = jsParams.pkpAddress;
    const creditsContract = jsParams.creditsContract || "0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6";
    const usdcContract = jsParams.usdcContract || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const minCreditThreshold = jsParams.minCreditThreshold || 5;

    // Get RPC for Base Sepolia
    const rpcUrl = await Lit.Actions.getRpcUrl({ chain: "baseSepolia" });
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // ============================================================================
    // Step 1: Check Current Credit Balance
    // ============================================================================

    console.log("📊 Checking current credit balance...");

    const creditsAbi = [{
      name: "getCredits",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "user", type: "address" }],
      outputs: [{ name: "", type: "uint256" }]
    }];

    const creditsInterface = new ethers.utils.Interface(creditsAbi);
    const getCreditsData = creditsInterface.encodeFunctionData("getCredits", [pkpAddress]);

    const creditsResult = await provider.call({
      to: creditsContract,
      data: getCreditsData
    });

    const currentCredits = ethers.BigNumber.from(creditsResult).toNumber();
    console.log(`Current credits: ${currentCredits}`);

    if (currentCredits >= minCreditThreshold) {
      console.log(`✅ User has ${currentCredits} credits (>= ${minCreditThreshold}). No purchase needed.`);
      return Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          action: "none",
          message: `User already has ${currentCredits} credits`,
          currentCredits
        })
      });
    }

    // ============================================================================
    // Step 2: Check USDC Balance
    // ============================================================================

    console.log("💰 Checking PKP USDC balance...");

    const balanceOfAbi = [{
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }]
    }];

    const usdcInterface = new ethers.utils.Interface(balanceOfAbi);
    const balanceOfData = usdcInterface.encodeFunctionData("balanceOf", [pkpAddress]);

    const balanceResult = await provider.call({
      to: usdcContract,
      data: balanceOfData
    });

    const usdcBalance = ethers.BigNumber.from(balanceResult);
    const usdcBalanceFormatted = ethers.utils.formatUnits(usdcBalance, 6);
    console.log(`USDC Balance: ${usdcBalanceFormatted} USDC`);

    // Minimum balance check ($0.50)
    const minBalance = ethers.utils.parseUnits("0.5", 6);
    if (usdcBalance.lt(minBalance)) {
      console.log("⚠️ Insufficient USDC balance for purchase (< $0.50)");
      return Lit.Actions.setResponse({
        response: JSON.stringify({
          success: false,
          action: "none",
          message: "Insufficient USDC balance",
          usdcBalance: usdcBalanceFormatted,
          currentCredits
        })
      });
    }

    // ============================================================================
    // Step 3: Get Optimal Package
    // ============================================================================

    console.log("📦 Calculating optimal package...");

    const getOptimalPackageAbi = [{
      name: "getOptimalPackage",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "usdcBalance", type: "uint256" }],
      outputs: [
        { name: "packageId", type: "uint8" },
        { name: "packagePrice", type: "uint256" },
        { name: "creditsEarned", type: "uint16" }
      ]
    }];

    const optimalInterface = new ethers.utils.Interface(getOptimalPackageAbi);
    const optimalData = optimalInterface.encodeFunctionData("getOptimalPackage", [usdcBalance]);

    const optimalResult = await provider.call({
      to: creditsContract,
      data: optimalData
    });

    const [packageId, packagePrice, creditsEarned] = ethers.utils.defaultAbiCoder.decode(
      ["uint8", "uint256", "uint16"],
      optimalResult
    );

    if (packageId === 255) {
      console.log("⚠️ No affordable package found");
      return Lit.Actions.setResponse({
        response: JSON.stringify({
          success: false,
          action: "none",
          message: "No affordable package",
          usdcBalance: usdcBalanceFormatted
        })
      });
    }

    const packagePriceFormatted = ethers.utils.formatUnits(packagePrice, 6);
    console.log(`Optimal Package: ${packageId} (${creditsEarned} credits for $${packagePriceFormatted})`);

    // ============================================================================
    // Step 4: Get USDC Nonce for Permit
    // ============================================================================

    console.log("🔐 Fetching USDC nonce for permit...");

    const noncesAbi = [{
      name: "nonces",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "owner", type: "address" }],
      outputs: [{ name: "", type: "uint256" }]
    }];

    const noncesInterface = new ethers.utils.Interface(noncesAbi);
    const noncesData = noncesInterface.encodeFunctionData("nonces", [pkpAddress]);

    const nonceResult = await provider.call({
      to: usdcContract,
      data: noncesData
    });

    const nonce = ethers.BigNumber.from(nonceResult);
    console.log(`USDC Nonce: ${nonce.toString()}`);

    // ============================================================================
    // Step 5: Sign EIP-2612 Permit
    // ============================================================================

    console.log("✍️ Signing EIP-2612 permit...");

    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // EIP-2612 Permit TypedData
    const domain = {
      name: "USD Coin",
      version: "2",
      chainId: BASE_SEPOLIA_CHAIN_ID,
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
      value: packagePrice.toString(),
      nonce: nonce.toString(),
      deadline: deadline
    };

    // Construct EIP-712 hash
    const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain(domain);
    const structHash = ethers.utils._TypedDataEncoder.hashStruct("Permit", types, value);
    const digest = ethers.utils.keccak256(
      ethers.utils.concat([
        ethers.utils.toUtf8Bytes("\x19\x01"),
        domainSeparator,
        structHash
      ])
    );

    console.log("Permit digest:", digest);

    // Sign with PKP
    const sigShare = await Lit.Actions.signAndCombineEcdsa({
      toSign: ethers.utils.arrayify(digest),
      publicKey: jsParams.publicKey || ethers.utils.computePublicKey(pkpAddress, true),
      sigName: "permitSignature"
    });

    const signature = JSON.parse(sigShare);

    // Extract v, r, s from signature
    let v = signature.v;
    const r = "0x" + signature.r.substring(2);
    const s = "0x" + signature.s;

    // Ensure v is 27 or 28
    if (v === 0 || v === 1) {
      v = v + 27;
    }

    console.log(`Permit signature: v=${v}, r=${r.substring(0, 10)}..., s=${s.substring(0, 10)}...`);

    // ============================================================================
    // Step 6: Submit purchaseCreditsWithPermit Transaction
    // ============================================================================

    console.log("📤 Submitting purchaseCreditsWithPermit transaction...");

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
    const txData = purchaseInterface.encodeFunctionData("purchaseCreditsWithPermit", [
      packageId,
      deadline,
      v,
      r,
      s
    ]);

    // Get nonce and gas price
    const txCount = await provider.getTransactionCount(pkpAddress, "latest");
    const gasPrice = await provider.getGasPrice();

    // Estimate gas
    const gasLimit = await provider.estimateGas({
      from: pkpAddress,
      to: creditsContract,
      data: txData
    }).catch(() => ethers.BigNumber.from(200000)); // Fallback gas limit

    // Construct unsigned transaction
    const unsignedTx = {
      to: creditsContract,
      from: pkpAddress,
      data: txData,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      nonce: txCount,
      gasLimit: gasLimit,
      gasPrice: gasPrice
    };

    console.log("Unsigned TX:", JSON.stringify(unsignedTx, null, 2));

    // Sign transaction with PKP
    const txHash = ethers.utils.keccak256(ethers.utils.serializeTransaction(unsignedTx));

    const txSigShare = await Lit.Actions.signAndCombineEcdsa({
      toSign: ethers.utils.arrayify(txHash),
      publicKey: jsParams.publicKey || ethers.utils.computePublicKey(pkpAddress, true),
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

    // Submit transaction using runOnce to avoid duplicates
    const txResult = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "submitPurchaseTx" },
      async () => {
        try {
          const tx = await provider.sendTransaction(signedTx);
          console.log("✅ Transaction submitted:", tx.hash);
          return {
            success: true,
            txHash: tx.hash,
            packageId: packageId,
            creditsEarned: creditsEarned,
            packagePrice: packagePriceFormatted
          };
        } catch (error) {
          console.error("❌ Transaction failed:", error.message);
          return {
            success: false,
            error: error.message
          };
        }
      }
    );

    console.log("Transaction result:", txResult);

    return Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        action: "purchased",
        ...JSON.parse(txResult),
        usdcBalance: usdcBalanceFormatted,
        previousCredits: currentCredits
      })
    });

  } catch (error) {
    console.error("❌ Auto-purchase error:", error);
    return Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    });
  }
})();
