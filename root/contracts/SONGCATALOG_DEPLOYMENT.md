# SongCatalogV1 Deployment Record

## ✅ Successfully Deployed!

**Network:** Lens Chain Testnet (Chain ID: 37111)
**Contract Address:** `0x88996135809cc745E6d8966e3a7A01389C774910`
**Transaction Hash:** `0x7b3052db58642f34b1cb3e9010d03eb9974dd93139b9a67a7356e25edd34aeab`
**Deployed:** 2025-10-03
**Owner Address:** `0x0C6433789d14050aF47198B2751f6689731Ca79C`

**Explorer Link:** https://explorer.testnet.lens.xyz/address/0x88996135809cc745E6d8966e3a7A01389C774910

---

## Deployment Command Used

```bash
cd /media/t42/th42/Code/site/root/contracts
FOUNDRY_PROFILE=zksync forge create \
  SongCatalog/SongCatalogV1.sol:SongCatalogV1 \
  --broadcast \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --zksync \
  --gas-limit 10000000 \
  --gas-price 300000000
```

---

## Contract Features

### Core Functionality
- **Native Song Registry**: Store full karaoke songs with word-level timestamps
- **Genius Integration**: Optional Genius IDs for cross-platform compatibility
- **Multi-language Support**: Translations stored on-chain
- **Soft Delete**: Enable/disable songs without removal
- **Batch Queries**: Efficient pagination and filtering

### Storage Structure

```solidity
struct Song {
    string id;                  // Primary: slug (e.g., "heat-of-the-night-scarlett-x")
    uint32 geniusId;           // Optional: Genius API song ID (0 = not linked)
    uint32 geniusArtistId;     // Optional: Genius API artist ID (0 = not linked)
    string title;               // Song title
    string artist;              // Artist name
    uint32 duration;            // Duration in seconds
    string audioUri;            // Grove URI: lens://...
    string metadataUri;         // Grove URI: Word timestamps
    string coverUri;            // Grove URI: High-res cover
    string thumbnailUri;        // Grove URI: 300x300 thumbnail
    string musicVideoUri;       // Grove URI: Optional video
    string segmentIds;          // CSV: "verse-1,chorus-1,verse-2"
    string languages;           // CSV: "en,cn,vi"
    bool enabled;               // Soft delete flag
    uint64 addedAt;             // Timestamp
}
```

---

## Testing

### Verify Deployment

```bash
# Check owner
cast call 0x88996135809cc745E6d8966e3a7A01389C774910 "owner()" \
  --rpc-url https://rpc.testnet.lens.xyz
# Returns: 0x0C6433789d14050aF47198B2751f6689731Ca79C

# Check song count
cast call 0x88996135809cc745E6d8966e3a7A01389C774910 "getSongCount()" \
  --rpc-url https://rpc.testnet.lens.xyz
# Returns: 0 (empty catalog)
```

### Add Test Song (Manual)

```bash
cast send 0x88996135809cc745E6d8966e3a7A01389C774910 \
  "addSong(string,uint32,uint32,string,string,uint32,string,string,string,string,string,string,string)" \
  "test-song" \
  0 \
  0 \
  "Test Song" \
  "Test Artist" \
  180 \
  "lens://audio-hash" \
  "lens://metadata-hash" \
  "lens://cover-hash" \
  "lens://thumb-hash" \
  "" \
  "verse-1,chorus-1" \
  "en" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

---

## Integration with Song Uploader

### Update .env

```bash
cd /media/t42/th42/Code/site/root/song-uploader
echo "SONG_CATALOG_ADDRESS=0x88996135809cc745E6d8966e3a7A01389C774910" >> .env
```

### Upload Songs

```bash
# Process songs with ElevenLabs + upload to catalog
bun run process
```

---

## Integration Files Updated

1. ✅ `site/src/abi/SongCatalogV1.json` - ABI exported
2. ⏳ `song-uploader/.env` - Contract address (needs manual update)
3. ⏳ Frontend services - Point to new contract

---

## Next Steps

1. ✅ Deploy SongCatalogV1
2. ✅ Export ABI
3. ⬜ Test song-uploader with sample song
4. ⬜ Verify uploaded song appears in catalog
5. ⬜ Configure KaraokeScoreboardV4 with test track
6. ⬜ Test end-to-end karaoke flow

---

## Resources

- **Contract Source:** `contracts/SongCatalog/SongCatalogV1.sol`
- **Deployment Script:** `contracts/script/DeploySongCatalogV1.s.sol`
- **Song Uploader:** `song-uploader/`
- **ABI:** `site/src/abi/SongCatalogV1.json`
