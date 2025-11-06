# Unlock Protocol Integration (Archived)

This directory contains the archived Unlock Protocol subscription lock implementation that was removed from the main codebase.

## Files

### Lock Deployment
- **2.5-deploy-lock.ts** - Script to deploy Unlock Protocol subscription locks on Base Sepolia for creators/artists
  - Deploys ERC721 subscription lock with configurable price and duration
  - Updates Lens account metadata with lock address
  - Saves deployment info to JSON

### Video Encryption & Streaming
- **HLSPlayer.tsx** - React component for playing HLS-encrypted videos
  - Uses HLS.js with custom loader for segment decryption
  - Decrypts symmetric key once via Lit Protocol
  - Progressively decrypts segments on-the-fly

- **decrypt-video.ts** - HLS video decryption utilities
  - `decryptSymmetricKey()` - Decrypt key with Lit Protocol
  - `decryptSegment()` - Decrypt individual HLS segments with AES-256-GCM
  - Handles per-segment IVs and authentication tags

### Subscription Management
- **useSubscription.ts** - React hook for managing subscription state
  - Check if user has valid subscription key
  - Fetch lock pricing info
  - Handle subscription purchases

- **purchase.ts** - Subscription purchase logic
  - USDC/ETH payment flow
  - PKP wallet integration
  - Token approval handling

- **queries.ts** - Read-only lock interactions
  - Check subscription key validity
  - Fetch lock price and duration info
  - Query token address

## Architecture

### Flow
1. Creator deploys lock via `2.5-deploy-lock.ts`
2. Lock address stored in Lens metadata
3. Frontend detects locked content
4. User purchases subscription key with PKP wallet
5. HLSPlayer decrypts and streams video

### Encryption Scheme
- **Symmetric**: One AES-256 key per video
- **Key encryption**: Lit Protocol (with Unlock access control)
- **Segment encryption**: Per-segment IV and authTag
- **Access control**: Unlock NFT key ownership verified by Lit Protocol

## Removal Reason

Removed in commit `6613aff` to make all videos freely available. The subscription/lock functionality was optional premium access for copyrighted content, but decision was made to provide free access to all users.

## Reactivation

To reactivate:
1. Copy files back to appropriate locations
2. Update Lens metadata handling in artist/creator flows
3. Integrate HLSPlayer into VideoDetail component
4. Wire up useSubscription hook with video access control
5. Add lock deployment as optional step in artist onboarding

## Dependencies

- Unlock Protocol contracts (deployed on Base Sepolia)
- Lit Protocol for key encryption/decryption
- HLS.js for video streaming
- Viem for blockchain interactions
