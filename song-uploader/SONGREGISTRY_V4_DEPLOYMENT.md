# SongRegistryV4 Contract Deployment

## ✅ Successfully Deployed!

**Network:** Lens Chain Testnet (Chain ID: 37111)
**Contract Address:** `0xC874eAAf142dB37a9B19202E07757E89da00351B`
**Transaction Hash:** `0x26414ba2e81355e8905266c67c97de4c29513ecab9915e5353170e0dce0a2427`
**Deployed:** 2025-10-02
**Owner Address:** `0x0C6433789d14050aF47198B2751f6689731Ca79C`

**Explorer Link:** https://explorer.testnet.lens.xyz/address/0xC874eAAf142dB37a9B19202E07757E89da00351B

---

## Overview

**SongRegistryV4** is the unified registry that stores:
- ✅ **Full song metadata** (audio, karaoke timestamps, cover, thumbnail)
- ✅ **Optional music video URI**
- ✅ **References to clips** (comma-separated clip IDs)
- ✅ **Multilingual support**
- ✅ **Enable/disable toggle** (soft delete)

**Why V4?**
- V1-V2: Original song registries
- V3: Latest full-song-only registry
- **V4: Merges full songs + clip references** (this version)

---

## Prerequisites

### Critical Requirements

- ✅ **Foundry ZKsync fork v0.0.29** (installed)
- ✅ **Solidity 0.8.19** (to avoid PUSH0 opcode issues on zkSync)
- ✅ **NO OpenZeppelin dependencies** (causes zkSync deployment failures)
- ✅ **FOUNDRY_PROFILE=zksync** (must use zksync profile)
- ✅ **Private key with gas tokens** on Lens Chain Testnet

### Verify Installation

```bash
forge --version
# Should show: forge Version: 1.3.5-foundry-zksync-v0.0.29
```

### Get Gas Tokens

**Testnet:**
- Faucet: https://faucet.lens.xyz
- Request tokens for your deployer address

---

## Deployment Steps

### 1. Set Environment Variables

```bash
cd song-uploader/contract

# Check .env file has PRIVATE_KEY
cat .env | grep PRIVATE_KEY

# Or export manually
export PRIVATE_KEY="your_private_key_here"
```

### 2. Build Contract (zkSync Profile)

```bash
FOUNDRY_PROFILE=zksync forge build --zksync
```

**Expected output:**
```
[⠊] Compiling...
[⠊] Compiling 1 files with zksolc and solc 0.8.19
[⠊] Solc 0.8.19 finished in X.XXs
Compiler run successful!
```

### 3. Deploy Contract

**IMPORTANT:** Must use `FOUNDRY_PROFILE=zksync` and `--zksync` flag:

```bash
FOUNDRY_PROFILE=zksync forge create \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  src/SongRegistryV4.sol:SongRegistryV4 \
  --zksync \
  --gas-limit 10000000 \
  --gas-price 300000000 \
  --broadcast
```

**Alternative using script:**

```bash
FOUNDRY_PROFILE=zksync forge script \
  script/DeploySongRegistryV4.s.sol:DeploySongRegistryV4 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync
```

**Expected output:**
```
Deployer: 0x0C6433789d14050aF47198B2751f6689731Ca79C
Deployed to: 0x... (contract address)
Transaction hash: 0x...
```

### 4. Verify Deployment

```bash
# Get owner
cast call <CONTRACT_ADDRESS> "owner()" \
  --rpc-url https://rpc.testnet.lens.xyz

# Get song count (should be 0 initially)
cast call <CONTRACT_ADDRESS> "getSongCount()" \
  --rpc-url https://rpc.testnet.lens.xyz
```

### 5. Update Environment

Save the deployed contract address:

```bash
# Add to .env
echo 'SONG_REGISTRY_V4_ADDRESS="0x..."' >> .env
```

**Update upload script** (`src/commands/upload-full-songs.ts`):
```typescript
const CONTRACT_ADDRESS = '0x...'; // Your deployed address
```

---

## Contract Usage

### Adding a Song

```bash
cast send <CONTRACT_ADDRESS> \
  "addSong(string,string,string,uint32,string,string,string,string,string,string,string)" \
  "ethel-waters-down-home-blues" \
  "Down Home Blues" \
  "Ethel Waters" \
  180 \
  "lens://audio-uri" \
  "lens://metadata-uri" \
  "lens://cover-uri" \
  "lens://thumbnail-uri" \
  "lens://music-video-uri" \
  "verse-1,chorus-1,verse-2,chorus-2" \
  "en,cn,vi" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

**Parameters:**
1. `id` - Unique song ID
2. `title` - Song title
3. `artist` - Artist name
4. `duration` - Duration in seconds
5. `audioUri` - Grove URI for full song audio
6. `metadataUri` - Grove URI for full karaoke metadata
7. `coverUri` - Grove URI for high-res cover
8. `thumbnailUri` - Grove URI for 300x300 thumbnail
9. `musicVideoUri` - Grove URI for music video (empty string if none)
10. `clipIds` - Comma-separated clip IDs (empty string if none)
11. `languages` - Comma-separated language codes

### Query Functions

```bash
# Get all songs
cast call <CONTRACT_ADDRESS> "getAllSongs()" \
  --rpc-url https://rpc.testnet.lens.xyz

# Get enabled songs only
cast call <CONTRACT_ADDRESS> "getEnabledSongs()" \
  --rpc-url https://rpc.testnet.lens.xyz

# Get song by ID
cast call <CONTRACT_ADDRESS> \
  "getSong(string)" "ethel-waters-down-home-blues" \
  --rpc-url https://rpc.testnet.lens.xyz

# Get songs by artist
cast call <CONTRACT_ADDRESS> \
  "getSongsByArtist(string)" "Ethel Waters" \
  --rpc-url https://rpc.testnet.lens.xyz

# Check if song exists
cast call <CONTRACT_ADDRESS> \
  "songExists(string)" "ethel-waters-down-home-blues" \
  --rpc-url https://rpc.testnet.lens.xyz
```

### Update Functions

```bash
# Toggle song enabled status
cast send <CONTRACT_ADDRESS> \
  "toggleSong(string,bool)" "ethel-waters-down-home-blues" false \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY

# Remove song (hard delete)
cast send <CONTRACT_ADDRESS> \
  "removeSong(string)" "ethel-waters-down-home-blues" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

---

## Common Issues & Solutions

### Issue 1: PUSH0 Opcode Error

**Error:** `Transaction reverted: invalid opcode PUSH0`

**Solution:** Ensure using Solidity 0.8.19 (not 0.8.20+)

```toml
# foundry.toml
[profile.zksync]
solc_version = "0.8.19"
```

### Issue 2: Gas Estimation Failed

**Error:** `Gas estimation failed`

**Solution:** Manually set gas parameters:
```bash
--gas-limit 10000000 --gas-price 300000000
```

### Issue 3: Not Enough Balance

**Error:** `zk vm halted: Account validation error: Not enough balance`

**Solution:** Check deployer wallet has sufficient $GRASS:
```bash
cast balance 0x0C6433789d14050aF47198B2751f6689731Ca79C \
  --rpc-url https://rpc.testnet.lens.xyz
```

Get more tokens: https://faucet.lens.xyz

### Issue 4: Forgot --zksync Flag

**Error:** Contract deploys but doesn't work on Lens Chain

**Solution:** Always use `FOUNDRY_PROFILE=zksync` and `--zksync` flag:
```bash
FOUNDRY_PROFILE=zksync forge create --zksync ...
```

---

## Integration with Upload Script

Update `src/commands/upload-full-songs.ts` to register songs:

```typescript
const CONTRACT_ADDRESS = '0x...'; // SongRegistryV4 address

async function registerSongInContract(
  songId: string,
  uploadResult: FullSongUploadResult,
  metadata: any,
  clipIds: string[],
  walletClient: any,
  publicClient: any
): Promise<boolean> {
  const contract = getContract({
    address: CONTRACT_ADDRESS,
    abi: SongRegistryV4ABI,
    client: walletClient
  });

  // Check if song already exists
  const exists = await contract.read.songExists([songId]);
  if (exists) {
    console.log(`  ⚠️  Song already exists in registry`);
    return false;
  }

  console.log(`  📝 Registering in contract...`);

  const tx = await contract.write.addSong([
    songId,
    metadata.title,
    metadata.artist,
    Math.floor(metadata.duration),
    uploadResult.audioUri,
    uploadResult.metadataUri,
    uploadResult.coverUri || '',
    uploadResult.thumbnailUri || '',
    uploadResult.musicVideoUri || '',
    clipIds.join(','),
    metadata.availableLanguages.join(',')
  ]);

  console.log(`  ⏳ Waiting for confirmation...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

  if (receipt.status === 'success') {
    console.log(`  ✅ Registered in contract`);
    return true;
  } else {
    console.error(`  ❌ Transaction failed`);
    return false;
  }
}
```

---

## Export ABI

After deployment, export ABI for frontend:

```bash
cd contract

# Build with zkSync profile
FOUNDRY_PROFILE=zksync forge build --zksync

# Copy ABI to upload script
cp zkout/SongRegistryV4.sol/SongRegistryV4.json ../src/abi/

# Copy to frontend (if needed)
cp zkout/SongRegistryV4.sol/SongRegistryV4.json ../../site/src/abi/
```

---

## Deployment Checklist

- [ ] Foundry ZKsync v0.0.29 installed
- [ ] Using Solidity 0.8.19 in zksync profile
- [ ] No OpenZeppelin dependencies
- [ ] PRIVATE_KEY set in environment
- [ ] Deployer wallet funded with gas tokens
- [ ] FOUNDRY_PROFILE=zksync in deploy command
- [ ] --zksync flag included
- [ ] Gas parameters set (10M limit, 300M price)
- [ ] Contract deployed successfully
- [ ] Owner address verified
- [ ] Contract address saved to .env
- [ ] ABI exported to upload script
- [ ] Explorer verified: https://explorer.testnet.lens.xyz/address/<CONTRACT_ADDRESS>

---

## Network Information

**Lens Chain Testnet:**
- RPC URL: `https://rpc.testnet.lens.xyz`
- Chain ID: 37111
- Explorer: https://explorer.testnet.lens.xyz
- Faucet: https://faucet.lens.xyz

**Lens Chain Mainnet:**
- RPC URL: `https://rpc.lens.xyz`
- Chain ID: 37111
- Explorer: https://explorer.lens.xyz

---

## Next Steps

1. Deploy contract to Lens Chain Testnet
2. Test with a single song upload
3. Update upload-full-songs.ts to register songs
4. Deploy ClipRegistryV1 (if not already deployed)
5. Link songs to clips via clipIds field
6. Deploy to mainnet when ready
