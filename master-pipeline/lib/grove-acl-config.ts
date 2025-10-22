/**
 * Grove ACL Configuration for Segment Alignment
 *
 * Configures mutable alignment files on Grove with PKP-controlled access
 * Allows both backend and frontend (via Lit Actions) to add translations
 */

import type { StorageClient } from '@lens-chain/storage-client';

/**
 * Base Sepolia chain ID
 */
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Your PKP token ID (from Lit Protocol)
 * This PKP can execute Lit Actions that edit alignment files
 */
export const ALIGNMENT_PKP_TOKEN_ID = process.env.ALIGNMENT_PKP_TOKEN_ID || '';

/**
 * Your backend wallet address (for manual edits)
 * Will be auto-derived from PRIVATE_KEY if not set
 */
export const BACKEND_WALLET_ADDRESS = process.env.BACKEND_WALLET_ADDRESS;

/**
 * Create ACL for segment alignment metadata on Grove
 *
 * Allows:
 * 1. Backend wallet to edit directly
 * 2. PKP to edit via Lit Actions (frontend can trigger)
 *
 * @param pkpTokenId Lit PKP token ID (hex string)
 * @param backupWallet Optional backup wallet address for manual edits
 * @returns ACL configuration object for Grove
 */
export function createSegmentAlignmentACL(
  pkpTokenId: string,
  backupWallet?: string
) {
  // For now, use wallet-based ACL (simplest approach)
  // In production, you'd use a custom contract that validates PKP signatures

  if (backupWallet) {
    return {
      template: 'wallet_address',
      walletAddress: backupWallet,  // camelCase
      chainId: BASE_SEPOLIA_CHAIN_ID,  // camelCase
    };
  }

  // PKP-based ACL would require a custom contract
  // For now, we'll use the backend wallet
  throw new Error('PKP ACL not yet implemented - use backup wallet');
}

/**
 * Upload mutable segment alignment to Grove
 *
 * @param storageClient Grove storage client
 * @param alignmentData Segment alignment metadata
 * @param signer Wallet signer (viem WalletClient)
 * @returns Upload result with lens:// URI and storage key
 */
export async function uploadMutableAlignment(
  storageClient: any, // StorageClient from @lens-chain/storage-client
  alignmentData: any,
  signer: any // Viem WalletClient
): Promise<{ uri: string; storageKey: string }> {
  // Auto-derive wallet address from signer if not set in env
  const walletAddress = BACKEND_WALLET_ADDRESS || signer.account.address;

  const acl = createSegmentAlignmentACL(
    ALIGNMENT_PKP_TOKEN_ID,
    walletAddress
  );

  // Upload as JSON with ACL (using Lens storage client API)
  const result = await storageClient.uploadAsJson(alignmentData, {
    name: `segment-alignment-${Date.now()}.json`,
    acl,
  });

  return {
    uri: result.uri,
    storageKey: result.storageKey, // Save this for editing later
  };
}

/**
 * Edit existing segment alignment on Grove
 *
 * Used for adding new translations to existing alignment
 *
 * @param storageClient Grove storage client
 * @param storageKey Storage key from original upload
 * @param updatedData Updated alignment metadata
 * @param signer Wallet signer
 * @returns Updated alignment URI (same as original)
 */
export async function editAlignment(
  storageClient: any,
  storageKey: string,
  updatedData: any,
  signer: any
): Promise<{ uri: string }> {
  const acl = createSegmentAlignmentACL(
    ALIGNMENT_PKP_TOKEN_ID,
    BACKEND_WALLET_ADDRESS
  );

  // Edit the file (retains same lens:// URI)
  const result = await storageClient.updateJson(
    `lens://${storageKey}`,
    updatedData,
    signer,
    { acl }
  );

  return {
    uri: result.uri, // Same URI as original
  };
}

/**
 * Example: Add translation to existing alignment
 *
 * This can be called from:
 * 1. Backend (Node.js with wallet signer)
 * 2. Frontend (via Lit Action with PKP)
 */
export async function addTranslationToAlignment(
  storageClient: any,
  alignmentUri: string, // lens://...
  storageKey: string, // from manifest.grove.alignmentStorageKey
  languageCode: string,
  translatedLyrics: any, // SegmentLyrics
  signer: any,
  addedBy?: string,
  method: 'lit-action' | 'wallet' | 'api' = 'wallet'
): Promise<void> {
  // 1. Fetch current alignment
  const alignmentUrl = alignmentUri.replace('lens://', 'https://api.grove.storage/');
  const currentAlignment = await fetch(alignmentUrl).then(r => r.json());

  // 2. Add new language
  currentAlignment.lyrics.languages[languageCode] = translatedLyrics;

  // 3. Update translation metadata
  if (!currentAlignment.translationMeta) {
    currentAlignment.translationMeta = {};
  }
  if (!currentAlignment.translationMeta.frontend) {
    currentAlignment.translationMeta.frontend = {};
  }

  currentAlignment.translationMeta.frontend[languageCode] = {
    addedBy,
    addedAt: new Date().toISOString(),
    method,
  };

  currentAlignment.updatedAt = new Date().toISOString();

  // 4. Edit on Grove (keeps same URI)
  await editAlignment(storageClient, storageKey, currentAlignment, signer);

  console.log(`✓ Added ${languageCode} translation to ${alignmentUri}`);
}

/**
 * Lit Action code for adding translations (executed by PKP)
 *
 * Frontend calls this via Lit SDK to add translations without backend
 */
export const LIT_ACTION_ADD_TRANSLATION = `
(async () => {
  // Input params from frontend:
  // - alignmentUri: lens://...
  // - storageKey: from blockchain
  // - languageCode: 'vi', 'zh', etc.
  // - translatedLyrics: { plain, lines, words }

  // 1. Fetch current alignment
  const alignmentUrl = alignmentUri.replace('lens://', 'https://api.grove.storage/');
  const currentAlignment = await fetch(alignmentUrl).then(r => r.json());

  // 2. Add new language
  currentAlignment.lyrics.languages[languageCode] = translatedLyrics;

  // 3. Update metadata
  if (!currentAlignment.translationMeta) {
    currentAlignment.translationMeta = { frontend: {} };
  }
  if (!currentAlignment.translationMeta.frontend) {
    currentAlignment.translationMeta.frontend = {};
  }

  currentAlignment.translationMeta.frontend[languageCode] = {
    addedBy: pkpAddress, // PKP's address
    addedAt: new Date().toISOString(),
    method: 'lit-action',
  };

  currentAlignment.updatedAt = new Date().toISOString();

  // 4. Sign Grove challenge for editing
  const challengeResponse = await fetch('https://api.grove.storage/challenge/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storage_key: storageKey,
      action: 'edit'
    })
  }).then(r => r.json());

  // 5. Sign the challenge with PKP
  const signature = await Lit.Actions.signMessage({
    message: challengeResponse.message,
    pkpTokenId,
  });

  // 6. Submit signed challenge
  await fetch('https://api.grove.storage/challenge/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: challengeResponse.message,
      signature,
      secret_random: challengeResponse.secret_random
    })
  }).then(r => r.json());

  // 7. Update the alignment file
  const formData = new FormData();
  formData.append(storageKey, new Blob([JSON.stringify(currentAlignment)], { type: 'application/json' }));
  formData.append('lens-acl.json', new Blob([JSON.stringify(acl)], { type: 'application/json' }));

  await fetch(\`https://api.grove.storage/\${storageKey}?challenge_cid=\${challengeCid}&secret_random=\${challengeResponse.secret_random}\`, {
    method: 'PUT',
    body: formData
  });

  return { success: true, language: languageCode };
})();
`;
