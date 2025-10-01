# ClipRegistryV1 Contract Deployment

## ✅ Successfully Deployed!

**Network:** Lens Chain Testnet (Chain ID: 37111)
**Contract Address:** `0xd058b56DF96EA34214D71E19Fb05379aCF445B79`
**Transaction Hash:** `0xfadf04e8cd6284d705398b3eb6d6f396b94f886b7e5f67e2281554d91b210808`
**Deployed:** 2025-10-01
**Owner Address:** `0x0C6433789d14050aF47198B2751f6689731Ca79C`

**Explorer Link:** https://explorer.testnet.lens.xyz/address/0xd058b56DF96EA34214D71E19Fb05379aCF445B79

---

## Prerequisites

**Critical Requirements:**
- ✅ Foundry ZKsync fork v0.0.29 (installed)
- ✅ Solidity 0.8.19 (to avoid PUSH0 opcode issues on zkSync)
- ✅ NO OpenZeppelin dependencies (causes zkSync deployment failures)
- ✅ FOUNDRY_PROFILE=zksync (must use zksync profile)

**Verify installation:**
```bash
forge --version
# Should show: forge Version: 1.3.5-foundry-zksync-v0.0.29
```

## Deployment Steps

### 1. Set Private Key
```bash
export PRIVATE_KEY="your_private_key_here"
# Or use .env file (already configured with dotenvx)
```

### 2. Deploy Contract

**IMPORTANT:** Must use `FOUNDRY_PROFILE=zksync` and `--zksync` flag:

```bash
cd contract

FOUNDRY_PROFILE=zksync forge create \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  src/ClipRegistryV1.sol:ClipRegistryV1 \
  --zksync \
  --gas-limit 10000000 \
  --gas-price 300000000 \
  --broadcast
```

**Expected output:**
```
Deployer: 0x0C6433789d14050aF47198B2751f6689731Ca79C
Deployed to: 0x... (contract address)
Transaction hash: 0x...
```

### 3. Verify Deployment

```bash
# Get owner
cast call <CONTRACT_ADDRESS> "owner()" --rpc-url https://rpc.testnet.lens.xyz

# Get clip count (should be 0 initially)
cast call <CONTRACT_ADDRESS> "getClipCount()" --rpc-url https://rpc.testnet.lens.xyz
```

### 4. Update Environment

After deployment, update `.env`:
```bash
CLIP_REGISTRY_ADDRESS="0x..."  # Your deployed contract address
```

---

## Adding Clips to Contract

### Using cast send

**Example for scarlett-verse-1:**
```bash
cast send <CONTRACT_ADDRESS> \
  "addClip(string,string,string,string,uint16,uint32,string,string,string,string,uint8,uint8)" \
  "scarlett-verse-1" \
  "Scarlett" \
  "Heat of the Night" \
  "Verse 1" \
  0 \
  17 \
  "lens://audio-uri" \
  "lens://metadata-uri" \
  "lens://thumbnail-uri" \
  "en,cn,vi" \
  2 \
  22 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

**Parameter mapping:**
```solidity
addClip(
  string id,              // "scarlett-verse-1"
  string title,           // "Scarlett"
  string artist,          // "Heat of the Night"
  string sectionType,     // "Verse 1"
  uint16 sectionIndex,    // 0
  uint32 duration,        // 17
  string audioUri,        // "lens://..."
  string timestampsUri,   // "lens://..."
  string thumbnailUri,    // "lens://..."
  string languages,       // "en,cn,vi"
  uint8 difficultyLevel,  // 2
  uint8 wordsPerSecond    // 22 (2.2 wps * 10)
)
```

---

## Common Issues & Solutions

### Issue 1: PUSH0 Opcode Error
**Error:** `Transaction reverted: invalid opcode PUSH0`

**Solution:** Use Solidity 0.8.19 (not 0.8.20+)
```toml
# foundry.toml
[profile.zksync]
solc_version = "0.8.19"
```

### Issue 2: OpenZeppelin Dependency Failure
**Error:** zkSync deployment hangs or fails with OpenZeppelin contracts

**Solution:** Remove all OpenZeppelin dependencies. Use custom implementations:
```solidity
// ❌ DON'T USE
import "@openzeppelin/contracts/access/Ownable.sol";

// ✅ USE CUSTOM
address public owner;
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}
```

### Issue 3: Forgot --zksync Flag
**Error:** Contract deploys but doesn't work on Lens Chain

**Solution:** Always use `FOUNDRY_PROFILE=zksync` and `--zksync` flag:
```bash
FOUNDRY_PROFILE=zksync forge create --zksync ...
```

### Issue 4: Gas Estimation Failed
**Error:** `Gas estimation failed`

**Solution:** Manually set gas parameters:
```bash
--gas-limit 10000000 --gas-price 300000000
```

---

## Contract ABI Export

After deployment, export ABI for frontend:
```bash
cd contract

# Generate ABI
forge build --zksync

# Copy ABI to site
cp out/ClipRegistryV1.sol/ClipRegistryV1.json ../site/src/abi/ClipRegistryV1.json
```

---

## Testing Deployed Contract

### Query Functions (Free)
```bash
# Get all clips
cast call <CONTRACT_ADDRESS> "getAllClips()" \
  --rpc-url https://rpc.testnet.lens.xyz

# Get clips by difficulty (1-2 = beginner)
cast call <CONTRACT_ADDRESS> "getClipsByDifficulty(uint8,uint8)" 1 2 \
  --rpc-url https://rpc.testnet.lens.xyz

# Get clips by pace (20-25 = 2.0-2.5 wps)
cast call <CONTRACT_ADDRESS> "getClipsByPace(uint8,uint8)" 20 25 \
  --rpc-url https://rpc.testnet.lens.xyz

# Check if clip exists
cast call <CONTRACT_ADDRESS> "clipExists(string)" "scarlett-verse-1" \
  --rpc-url https://rpc.testnet.lens.xyz
```

### Write Functions (Requires Private Key)
```bash
# Toggle clip enabled status
cast send <CONTRACT_ADDRESS> \
  "toggleClip(string,bool)" "scarlett-verse-1" false \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY

# Remove clip (hard delete)
cast send <CONTRACT_ADDRESS> \
  "removeClip(string)" "scarlett-verse-1" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

---

## Integration with Frontend

**1. Update contract address:**
```typescript
// site/src/lib/contracts/clip-registry.ts
export const CLIP_REGISTRY_ADDRESS = '0x...'; // Your deployed address
```

**2. Import ABI:**
```typescript
import ClipRegistryV1ABI from '../abi/ClipRegistryV1.json';
```

**3. Query clips:**
```typescript
import { useReadContract } from 'wagmi';

const { data: clips } = useReadContract({
  address: CLIP_REGISTRY_ADDRESS,
  abi: ClipRegistryV1ABI,
  functionName: 'getEnabledClips',
});
```

**4. Filter by difficulty:**
```typescript
// Get beginner clips (difficulty 1-2)
const { data: beginnerClips } = useReadContract({
  address: CLIP_REGISTRY_ADDRESS,
  abi: ClipRegistryV1ABI,
  functionName: 'getClipsByDifficulty',
  args: [1, 2], // minDifficulty, maxDifficulty
});
```

---

## Deployment Checklist

- [ ] Foundry ZKsync v0.0.29 installed
- [ ] Using Solidity 0.8.19 in zksync profile
- [ ] No OpenZeppelin dependencies
- [ ] PRIVATE_KEY set in environment
- [ ] FOUNDRY_PROFILE=zksync in deploy command
- [ ] --zksync flag included
- [ ] Gas parameters set (10M limit, 300M price)
- [ ] Contract deployed successfully
- [ ] Owner address verified
- [ ] Contract address saved to .env
- [ ] ABI exported to frontend
- [ ] First test clip added
- [ ] Explorer verified: https://explorer.testnet.lens.xyz/address/<CONTRACT_ADDRESS>
