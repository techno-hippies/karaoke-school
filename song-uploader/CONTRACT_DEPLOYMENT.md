# Song Registry Contract Deployment

## Current Version: SongRegistryV3

### Deployment Details

**Network:** Lens Chain Testnet (Chain ID: 37111)
**Contract Address:** `0x183f6Ac8eff12a642F996b67B404993c385F46Fb`
**Transaction Hash:** `0x24f980528faa100aa34f2bf2376043dd76610c01eb9e51205dd534b4a5b1df49`
**Deployed:** 2025-09-30
**Owner Address:** `0x0C6433789d14050aF47198B2751f6689731Ca79C`

**Explorer Link:** https://explorer.testnet.lens.xyz/address/0x183f6Ac8eff12a642F996b67B404993c385F46Fb

### Contract Features

- ✅ Song registry with all metadata fields (title, artist, duration)
- ✅ Grove URIs for audio, timestamps, and thumbnails
- ✅ Multi-language support
- ✅ Timestamp tracking
- ✅ Ownership management (custom implementation, no OpenZeppelin)
- ✅ Event emissions for song additions, updates, and removals
- ✅ Batch query functions
- ✅ **Update song metadata** (new in V3)
- ✅ **Remove songs** (new in V3)

### Key Changes from V2

**Added:**
- `updateSong()` function to modify existing song metadata
- `removeSong()` function to delete songs (uses swap-and-pop for gas efficiency)
- `SongUpdated` event
- `SongRemoved` event

**Why V3:**
V2 had immutable song data - once added, songs could not be updated or removed. V3 adds full CRUD functionality to support fixing metadata errors and managing the song catalog.

### Current Songs in Registry

✅ **2 songs total:**
1. `song-1` - Down Home Blues by Ethel Waters - 168s - language: en
2. `song-2` - Heat of the Night by Scarlett - 195s - languages: en,cn,vi

## Testing

### Add Song
```bash
cast send 0x183f6Ac8eff12a642F996b67B404993c385F46Fb \
  "addSong(string,string,string,uint32,string,string,string,string)" \
  "song-id" "Title" "Artist" 180 \
  "lens://audio" "lens://timestamps" "lens://thumbnail" "en" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

### Update Song
```bash
cast send 0x183f6Ac8eff12a642F996b67B404993c385F46Fb \
  "updateSong(string,string,string,uint32,string,string,string,string)" \
  "song-id" "New Title" "New Artist" 200 \
  "lens://new-audio" "lens://new-timestamps" "lens://new-thumbnail" "en,ko" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

### Remove Song
```bash
cast send 0x183f6Ac8eff12a642F996b67B404993c385F46Fb \
  "removeSong(string)" "song-id" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

### Get Song
```bash
cast call 0x183f6Ac8eff12a642F996b67B404993c385F46Fb \
  "getSong(string)" "song-id" \
  --rpc-url https://rpc.testnet.lens.xyz
```

### Get Count
```bash
cast call 0x183f6Ac8eff12a642F996b67B404993c385F46Fb \
  "getSongCount()" \
  --rpc-url https://rpc.testnet.lens.xyz
```

## Songs Added (V3 Contract)

### Song 1
- ID: `song-1`
- Title: "Down Home Blues"
- Artist: "Ethel Waters"
- Duration: 168 seconds
- Languages: en
- Audio URI: `lens://2d1c4262fb39eddc674141f858f7648e182ef837f22e97137efa7507a0ff84d0`
- Timestamps URI: `lens://89234acca9f8d1fc35a61d8e7988f9df629476f032b43f2076ecfff22ddbe4b0`
- Thumbnail URI: `lens://774ee8fbaf925bdaaaedc0c9b004d4075375040b039734f6f91b68629c88dc3f`
- TX Hash: `0x040495ed3cfc8b3d1ad4c71e44b2fb25057958917c4358843a163b6a62da84b8`

### Song 2
- ID: `song-2`
- Title: "Heat of the Night"
- Artist: "Scarlett"
- Duration: 195 seconds
- Languages: en,cn,vi (with Chinese and Vietnamese translations)
- Audio URI: `lens://909c43d79a1eeb6a5f03344ef649860f91f3403f13a847b1b58ac3ef3f715e4e`
- Timestamps URI: `lens://2a0df07229a2b59ac1a733b4d8eebbb7cf359e850cca4e4a04b64bdd72819a9e`
- Thumbnail URI: `lens://9dabbf7930ac4cf2e6a765b5f9927fe494fd662e07a8688a907daf94445bd648`
- TX Hash: `0x0fd9283a55e151542375a6611dbd0659e43873c5f7ca2f0d6a3fbcc84b629ab5`

## Integration

Update your TypeScript frontend:
1. Use contract address: `0x183f6Ac8eff12a642F996b67B404993c385F46Fb`
2. Import ABI from: `./abi/SongRegistryV3.json`
3. Update ownership checks to use custom `owner()` instead of OpenZeppelin's Ownable
4. Network: Lens Chain Testnet (https://rpc.testnet.lens.xyz)
5. New functions available: `updateSong()`, `removeSong()`

## Deployment Process

Built with:
- Foundry ZKsync fork v0.0.29
- Solidity 0.8.19 (to avoid PUSH0 opcode issues)
- zksolc compiler
- No external dependencies beyond forge-std

Deployment command:
```bash
FOUNDRY_PROFILE=zksync forge create \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  src/SongRegistryV3.sol:SongRegistryV3 \
  --zksync --gas-limit 10000000 --gas-price 300000000 --broadcast
```

---

## Previous Versions

### SongRegistryV2 (Deprecated)
- **Address:** `0x3a5d4bEe102C865f91d086AD82E79b3F17617046`
- **Issue:** Immutable song data - no update or remove functions
- **Status:** Superseded by V3

### SongRegistryV1 (Failed)
- **Issue:** OpenZeppelin dependencies caused zkSync deployment failures
- **Status:** Never successfully deployed