# Testing Guide: Dual Environment Setup

## Overview

Karaoke School uses **two blockchain environments**:

1. **Lens Testnet** (zkSync Era) - For study/quiz/catalog contracts
2. **Base Sepolia** (Standard EVM) - For credit/payment contracts

This requires **different testing approaches** for each environment.

---

## 🔧 Environment Profiles

### Default Profile (Base Contracts)

**Used For**: KaraokeCreditsV1, future Base contracts
**Test Runner**: Anvil (standard EVM)
**Command**: `forge test`

```toml
[profile.default]
src = "."
out = "out"
libs = ["lib"]
solc_version = "0.8.19"
optimizer = true
optimizer_runs = 200
via_ir = true
```

### zkSync Profile (Lens Contracts)

**Used For**: SongCatalogV1, StudyProgressV1, TrendingTrackerV1, SongQuizV2
**Test Runner**: zkSync local node
**Command**: `FOUNDRY_PROFILE=zksync forge test --zksync`

```toml
[profile.zksync]
src = "."
libs = ["lib"]
fallback_oz = false
mode = "3"
solc = "0.8.19"
```

---

## 🧪 Running Tests

### Base Contracts (KaraokeCreditsV1)

```bash
# Run all tests
forge test --match-contract KaraokeCreditsV1Test -vvv

# Run specific test
forge test --match-test testPurchaseCreditsUSDC -vvv

# Run with gas report
forge test --match-contract KaraokeCreditsV1Test --gas-report

# Run with coverage
forge coverage --match-contract KaraokeCreditsV1Test
```

### Lens Contracts (SongCatalogV1, etc.)

```bash
# Set zkSync profile
export FOUNDRY_PROFILE=zksync

# Run tests
forge test --match-contract SongCatalogV1Test --zksync

# Or inline
FOUNDRY_PROFILE=zksync forge test --match-contract StudyProgressV1Test --zksync
```

---

## 📁 Test Organization

```
contracts/
├── KaraokeCredits/
│   ├── KaraokeCreditsV1.sol       # Base contract
│   └── test/
│       └── KaraokeCreditsV1.t.sol # Standard EVM tests (Anvil)
│
├── SongCatalog/
│   ├── SongCatalogV1.sol          # Lens contract
│   └── test/
│       └── SongCatalogV1.t.sol    # zkSync tests
│
├── StudyProgress/
│   ├── StudyProgressV1.sol        # Lens contract
│   └── test/
│       └── StudyProgressV1.t.sol  # zkSync tests
│
└── foundry.toml                   # Dual profiles
```

---

## ✅ KaraokeCreditsV1 Tests

### Test Coverage

| Category | Tests | Description |
|----------|-------|-------------|
| **Constructor** | 2 | Initialization, default packages |
| **USDC Purchase** | 5 | Buy credits with USDC, approvals, validations |
| **ETH Purchase** | 3 | Buy credits with ETH, excess handling |
| **Credit Usage** | 4 | Unlock segments, ownership tracking |
| **Deduplication** | 3 | Prevent charging for free songs |
| **PKP Grants** | 5 | Free credit distribution |
| **Admin Functions** | 8 | Package management, addresses, pause |
| **View Functions** | 2 | Queries, hash generation |
| **Edge Cases** | 4 | Multiple users, large IDs, long strings |

**Total**: ~36 comprehensive tests

### Running the Test Suite

```bash
# Full test run
forge test --match-contract KaraokeCreditsV1Test -vv

# Expected output:
# [PASS] testConstructor() (gas: X)
# [PASS] testDefaultPackages() (gas: X)
# [PASS] testPurchaseCreditsUSDC() (gas: X)
# ...
# Test result: ok. 36 passed; 0 failed
```

### Test Scenarios Covered

#### ✅ Happy Paths
- User purchases credits with USDC
- User purchases credits with ETH
- User unlocks segment with credits
- PKP grants free credits
- Admin updates packages

#### ✅ Error Cases
- Insufficient USDC allowance
- Insufficient ETH sent
- Trying to unlock without credits
- Trying to unlock already-owned segment
- Non-owner trying admin functions

#### ✅ Deduplication
- Song exists in SongCatalogV1 → Reject credit usage
- Song doesn't exist → Allow credit usage
- Native source (not Genius) → Skip deduplication

#### ✅ Edge Cases
- Multiple users owning same segment
- Large genius IDs (uint32 max)
- Long segment IDs
- Paused contract state

---

## 🏗️ Mock Contracts

Tests use lightweight mocks to avoid external dependencies:

### MockUSDC
```solidity
contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
```

### MockSongCatalog
```solidity
contract MockSongCatalog {
    mapping(uint32 => bool) private songs;

    function addSong(uint32 geniusId) external;
    function songExistsByGeniusId(uint32 geniusId) external view returns (bool);
}
```

---

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: Contracts CI

on: [push, pull_request]

jobs:
  test-base:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1

      - name: Run Base tests
        run: |
          cd contracts
          forge test --match-contract KaraokeCreditsV1Test

  test-lens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Foundry zkSync
        run: foundryup-zksync

      - name: Run Lens tests
        run: |
          cd contracts
          FOUNDRY_PROFILE=zksync forge test --match-contract SongCatalogV1Test --zksync
```

---

## 🐛 Troubleshooting

### Issue: "Compilation taking too long"

**Cause**: First-time compilation of all contracts
**Solution**: Compile specific test file

```bash
# Build just the test contract
forge build --contracts KaraokeCredits/test/KaraokeCreditsV1.t.sol

# Then run tests
forge test --match-contract KaraokeCreditsV1Test
```

### Issue: "Cannot find imported file"

**Cause**: Missing remappings in foundry.toml
**Solution**: Add remapping

```toml
remappings = [
    "forge-std/=lib/forge-std/src/",
    "KaraokeCredits/=KaraokeCredits/"
]
```

### Issue: "zkSync tests failing"

**Cause**: Using wrong profile
**Solution**: Always set `FOUNDRY_PROFILE=zksync` for Lens contracts

```bash
FOUNDRY_PROFILE=zksync forge test --zksync
```

### Issue: "Mock contract errors"

**Cause**: Mocks defined in test file instead of separate file
**Solution**: Mocks in same file are fine for Foundry tests (it's a feature)

---

## 📊 Gas Reporting

### Base Contracts

```bash
forge test --match-contract KaraokeCreditsV1Test --gas-report

# Output:
# | Function              | Gas     |
# |-----------------------|---------|
# | purchaseCreditsUSDC   | 85,432  |
# | purchaseCreditsETH    | 78,123  |
# | useCredit             | 92,345  |
# | grantCredits          | 45,678  |
```

### Optimization Tips

1. **Batch Operations**: Use `addPackage` once vs multiple times
2. **Storage Packing**: Already optimized (uint8, uint16, uint32)
3. **View Functions**: Free (no gas for reads)

---

## 🔐 Security Testing

### Fuzzing Example

```solidity
function testFuzzPurchaseCredits(uint8 packageId) public {
    vm.assume(packageId < credits.packageCount());

    // Fuzz test: any valid package should work
    vm.startPrank(user1);
    // ... test purchase logic
    vm.stopPrank();
}
```

### Invariant Testing

```solidity
contract InvariantKaraokeCredits is Test {
    function invariant_TotalCreditsMatchPurchases() public {
        // Total credits minted should match USDC received
    }

    function invariant_OwnedSegmentsNeverRevoked() public {
        // Once owned, always owned
    }
}
```

---

## 📝 Test Checklist

Before deploying to testnet:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Gas costs under acceptable limits
- [ ] Deduplication logic verified
- [ ] PKP grant logic verified
- [ ] Admin functions access-controlled
- [ ] Events emitted correctly
- [ ] Mock contracts replaced with real addresses

Before deploying to mainnet:

- [ ] Security audit completed
- [ ] Testnet deployment successful
- [ ] Real USDC contract tested
- [ ] Treasury address confirmed (multisig)
- [ ] PKP address confirmed
- [ ] Price packages reviewed
- [ ] All tests pass on mainnet fork

---

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| Build all | `forge build` |
| Test Base | `forge test --match-contract KaraokeCreditsV1Test` |
| Test Lens | `FOUNDRY_PROFILE=zksync forge test --zksync` |
| Gas report | `forge test --gas-report` |
| Coverage | `forge coverage` |
| Clean | `forge clean` |

---

## 📚 Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Foundry zkSync](https://github.com/matter-labs/foundry-zksync)
- [Writing Tests](https://book.getfoundry.sh/forge/writing-tests)
- [Cheatcodes](https://book.getfoundry.sh/cheatcodes/)
- [Gas Snapshots](https://book.getfoundry.sh/forge/gas-snapshots)

---

## License

MIT
