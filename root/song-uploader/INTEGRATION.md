# Song Uploader Integration with SongCatalogV1

**Date**: 2025-10-03
**Status**: ✅ Integration Complete - Ready for Testing

## Summary

The song-uploader has been successfully migrated from the old Grove-registry-based system to integrate directly with the SongCatalogV1 smart contract on Lens Testnet.

## What Changed

### Old Architecture (site/song-uploader)
```
Local Songs → ElevenLabs → Grove → Registry JSON on Grove
```
- Used immutable Grove registry (JSON file)
- Each upload created a new registry URI
- Required manual .env updates with new registry URI
- No on-chain verification

### New Architecture (root/song-uploader)
```
Local Songs → ElevenLabs → Grove → SongCatalogV1 Contract
```
- Uses SongCatalogV1 smart contract on Lens Testnet
- Songs registered on-chain with transaction confirmation
- Single contract address (never changes)
- On-chain song existence checking

## Files Created/Updated

### New Files
1. **src/contract.ts** - SongCatalogV1 integration
   - `initializeSongCatalog()` - Initialize contract clients
   - `songExistsInCatalog()` - Check if song exists on-chain
   - `addSongToCatalog()` - Add song to contract
   - `getSongCount()` - Get total song count

2. **src/chains.ts** - Lens Testnet chain configuration
   - Chain ID: 37111
   - RPC: https://rpc.testnet.lens.xyz
   - Explorer: https://explorer.testnet.lens.xyz

3. **src/types.ts** - TypeScript type definitions
   - `SongConfig` - Song metadata configuration
   - `EnhancedSongMetadata` - ElevenLabs-enhanced metadata
   - `UploadResult` - Grove upload results

4. **src/upload.ts** - Main upload script (completely rewritten)
   - Direct contract integration
   - Transaction confirmation waiting
   - On-chain verification

### Copied from Old System
1. **src/processors/elevenlabs.ts** - ElevenLabs API integration (unchanged)
2. **src/processors/metadata.ts** - Metadata generation (unchanged)
3. **src/wallet.ts** - Viem wallet setup (unchanged)

### Updated Files
1. **.env.example** - Updated with SongCatalogV1 address
2. **README.md** - Complete rewrite for SongCatalogV1 integration
3. **package.json** - Removed obsolete scripts (sync, create-registry)

## Contract Integration

### SongCatalogV1 Address
```
0x88996135809cc745E6d8966e3a7A01389C774910
```

### Required Environment Variables
```bash
PRIVATE_KEY=0x...                # Wallet with contract owner permissions
ELEVENLABS_API_KEY=...           # For word-level timestamp generation
SONG_CATALOG_ADDRESS=0x88996135809cc745E6d8966e3a7A01389C774910
```

### Contract Methods Used
```solidity
// Add song to catalog
function addSong(
    string calldata id,
    uint32 geniusId,
    uint32 geniusArtistId,
    string calldata title,
    string calldata artist,
    uint32 duration,
    string calldata audioUri,
    string calldata metadataUri,
    string calldata coverUri,
    string calldata thumbnailUri,
    string calldata musicVideoUri,
    string calldata segmentIds,
    string calldata languages
) external onlyOwner;

// Check if song exists
function songExists(string calldata id) external view returns (bool);

// Get song count
function getSongCount() external view returns (uint256);
```

## Usage Changes

### Before (Old System)
```bash
bun run process        # Process songs
# ⚠️ WARNING: Update .env with new registry URI!
# REGISTRY_URI="lens://new-uri-here"
```

### After (New System)
```bash
bun run process        # Process and upload to contract
# ✅ Done! Transaction confirmed on-chain.
```

No manual .env updates needed - contract address never changes.

## Data Flow

1. **Process**: Load song files (audio, lyrics, translations, metadata.json)
2. **ElevenLabs**: Generate word-level timestamps (cached locally)
3. **Metadata**: Build enhanced metadata with word+line structure
4. **Grove Upload**: Upload audio, metadata, thumbnail to Grove (immutable)
5. **Contract Call**: Register song in SongCatalogV1 with Grove URIs
6. **Confirmation**: Wait for transaction confirmation (1 block)
7. **Verification**: Query contract to verify song was added

## Testing Status

### ✅ Completed
- Contract integration module
- Upload script rewrite
- Documentation updates
- Type definitions
- Chain configuration

### ⏳ Pending (Requires External Resources)
- ElevenLabs API key for testing
- Test wallet funding on Lens Testnet
- End-to-end upload test with sample song
- On-chain verification of uploaded song

## Migration Notes

### For Existing Songs
Songs in the old Grove registry are **not** automatically migrated. To add them to SongCatalogV1:

1. Keep song folders in `./songs/`
2. Run `bun run process` - will check contract and only upload new songs
3. Songs with existing `karaoke-alignment.json` skip ElevenLabs API call

### Breaking Changes
- No more registry URI management
- No more `--sync` or `--init` modes (not needed with contract)
- Requires wallet to be contract owner
- Transactions cost gas (small amount on Lens Testnet)

## Next Steps

1. **Fund Test Wallet** - Add ETH to wallet on Lens Testnet
2. **Get ElevenLabs API Key** - For word timestamp generation
3. **Test Upload** - Try uploading a sample song
4. **Verify On-Chain** - Check song appears in SongCatalogV1
5. **Configure Track** - Add song to KaraokeScoreboardV4 as test track

## Benefits of New System

1. **On-Chain Verification** - Songs exist on-chain, verifiable by anyone
2. **No Manual Updates** - Contract address never changes
3. **Transaction Confirmation** - Know immediately if upload succeeded
4. **Gas Efficiency** - Hash-based storage in SongCatalogV1
5. **Integration Ready** - Other contracts can query SongCatalogV1
6. **Owner Control** - Only contract owner can add songs (security)

## References

- [SongCatalogV1 Deployment](/contracts/SONGCATALOG_DEPLOYMENT.md)
- [Song Uploader README](/song-uploader/README.md)
- [Foundation Status](/FOUNDATION_STATUS.md)
