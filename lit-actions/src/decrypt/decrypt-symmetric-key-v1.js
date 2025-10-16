/**
 * Decrypt Symmetric Key v1
 *
 * Decrypts a video's encrypted symmetric key using Unlock Protocol access control.
 * The decrypted key is returned to the client for local video decryption.
 *
 * PHILOSOPHY: Decrypt small keys in TEE, return to client for local decryption
 * - Efficient: Only decrypt 32-byte key via Lit (not 50MB video)
 * - Secure: Access control validated by Lit nodes in TEE
 * - Fast: Client decrypts large video locally with AES-GCM
 *
 * Flow:
 * 1. Receive encrypted symmetric key metadata
 * 2. Use Lit.Actions.decryptAndCombine() to decrypt (happens in TEE)
 * 3. Lit nodes check: "Does this user own an Unlock NFT?"
 * 4. If yes → decrypt key → return to client
 * 5. Client uses key to decrypt video locally
 *
 * Input:
 * - encryptedSymmetricKey: Base64 Lit-encrypted symmetric key
 * - dataToEncryptHash: Hash for Lit decrypt verification
 * - unifiedAccessControlConditions: Unlock lock access control
 * - chain: Blockchain chain (baseSepolia)
 *
 * Output:
 * - success: true/false
 * - symmetricKey: Decrypted AES-256 key (Uint8Array as array)
 * - error: Error message if decryption failed
 *
 * Time: ~2-5s (Lit Protocol decryption)
 * Cost: Free (no external API calls)
 */

console.log('=== DECRYPT SYMMETRIC KEY v1 LOADED ===');
console.log('Lit Actions API available:', typeof Lit !== 'undefined');

const go = async () => {
  console.log('=== STARTING DECRYPTION ===');

  const {
    encryptedSymmetricKey,
    dataToEncryptHash,
    unifiedAccessControlConditions,
    chain = 'baseSepolia',
  } = jsParams || {};

  console.log('jsParams received:', {
    hasEncryptedKey: !!encryptedSymmetricKey,
    hasHash: !!dataToEncryptHash,
    hasConditions: !!unifiedAccessControlConditions,
    chain,
  });

  try {
    // Validate required params
    if (!encryptedSymmetricKey) {
      throw new Error('encryptedSymmetricKey is required');
    }
    if (!dataToEncryptHash) {
      throw new Error('dataToEncryptHash is required');
    }
    if (!unifiedAccessControlConditions) {
      throw new Error('unifiedAccessControlConditions is required');
    }

    console.log('[Decrypt] Type check:', {
      isArray: Array.isArray(unifiedAccessControlConditions),
      length: unifiedAccessControlConditions?.length,
      firstItem: unifiedAccessControlConditions?.[0]
    });

    console.log('[Decrypt] Access control conditions:', {
      contract: unifiedAccessControlConditions[0]?.contractAddress,
      chain: unifiedAccessControlConditions[0]?.chain,
      functionName: unifiedAccessControlConditions[0]?.functionName,
    });

    console.log('[Decrypt] Full conditions:', JSON.stringify(unifiedAccessControlConditions, null, 2));
    console.log('[Decrypt] Ciphertext type:', typeof encryptedSymmetricKey, 'length:', encryptedSymmetricKey?.length);
    console.log('[Decrypt] Hash type:', typeof dataToEncryptHash, 'length:', dataToEncryptHash?.length);

    // Decrypt symmetric key using Lit Protocol
    // This checks if the authenticated user owns an Unlock key
    console.log('[Decrypt] Decrypting symmetric key with Lit Protocol...');
    console.log('[Decrypt] This will check if user has valid Unlock NFT');

    console.log('[Decrypt] Calling decryptAndCombine with:', {
      hasUACC: !!unifiedAccessControlConditions,
      hasCiphertext: !!encryptedSymmetricKey,
      hasHash: !!dataToEncryptHash,
      chain,
    });

    // When called via executeJs with PKP auth context, auth is automatic
    // DO NOT pass authSig - it will override the auth context
    const symmetricKey = await Lit.Actions.decryptAndCombine({
      unifiedAccessControlConditions: unifiedAccessControlConditions,
      ciphertext: encryptedSymmetricKey,
      dataToEncryptHash: dataToEncryptHash,
      chain: chain,
    });

    console.log('[Decrypt] decryptAndCombine returned, type:', typeof symmetricKey);

    console.log('[Decrypt] ✅ Symmetric key decrypted successfully');
    console.log('[Decrypt] Key length:', symmetricKey.length, 'bytes (should be 32 for AES-256)');

    // Return the decrypted key to the client
    // The key is a Uint8Array that can be used for AES-GCM decryption
    // We convert to array for JSON serialization
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        symmetricKey: Array.from(symmetricKey),  // Convert Uint8Array to array for JSON
      })
    });

  } catch (error) {
    console.error('[Decrypt] ❌ Decryption failed:', error);
    console.error('[Decrypt] Error details:', {
      message: error.message,
      name: error.name,
    });

    // Return error to client
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
      })
    });
  }
};

go();
