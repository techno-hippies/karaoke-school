# GRC-20 Testing Suite

## Overview

Comprehensive test suite for GRC-20 population scripts to ensure data integrity and consistency.

## Tests

### 1. `test-grc20-population-regression.ts` ✅

**Purpose**: Regression test to ensure refactored scripts produce identical results.

**What it does**:
1. Takes snapshot of current database state
2. Wipes all GRC-20 tables
3. Adds constraints
4. Runs all population scripts in order
5. Compares new data to snapshot
6. Reports any differences

**Key features**:
- **Smart comparison**: Matches by stable keys (spotify_artist_id, ISWC, spotify_track_id) not by array index
- **Ignores generated fields**: Skips comparing IDs, timestamps (auto-generated)
- **Comprehensive**: Tests all 3 tables (artists, works, recordings)

**Usage**:
```bash
# Run full regression test (DESTRUCTIVE - wipes tables!)
dotenvx run -f .env -- bun tests/test-grc20-population-regression.ts
```

**Expected output**:
```
✅ REGRESSION TEST PASSED

The refactored population scripts produce identical results!

Summary:
  - Artists: 13 (✅ matches snapshot)
  - Works: 13 (✅ matches snapshot)
  - Recordings: 13 (✅ matches snapshot)
```

---

### 2. `snapshot-grc20-data.ts` 📸

**Purpose**: Create JSON snapshot of current GRC-20 data for comparison.

**Usage**:
```bash
# Save snapshot with timestamp
dotenvx run -f .env -- bun tests/snapshot-grc20-data.ts

# Save to specific file
dotenvx run -f .env -- bun tests/snapshot-grc20-data.ts /tmp/before-refactor.json
```

**Output**:
```json
{
  "artists": [...],
  "works": [...],
  "recordings": [...],
  "timestamp": "2025-11-01T12:00:00.000Z",
  "counts": {
    "artists": 13,
    "works": 13,
    "recordings": 13
  }
}
```

---

## Running Tests

### Full Test Suite

```bash
# 1. Create snapshot BEFORE any changes
dotenvx run -f .env -- bun tests/snapshot-grc20-data.ts /tmp/before-changes.json

# 2. Make changes to population scripts...

# 3. Run regression test
dotenvx run -f .env -- bun tests/test-grc20-population-regression.ts
```

### Manual Comparison

```bash
# Create two snapshots
dotenvx run -f .env -- bun tests/snapshot-grc20-data.ts /tmp/snapshot1.json

# Make changes, repopulate...

dotenvx run -f .env -- bun tests/snapshot-grc20-data.ts /tmp/snapshot2.json

# Compare manually
diff <(jq -S . /tmp/snapshot1.json) <(jq -S . /tmp/snapshot2.json)
```

---

## Test Results (2025-11-01)

### Regression Test Status: ✅ PASSING

**Test Summary**:
- **Artists**: 13/13 matched ✅
- **Works**: 13/13 matched ✅
- **Recordings**: 13/13 matched ✅

**Key Validations**:
- No duplicate ISWCs
- No duplicate Spotify tracks
- All works have recordings (1:1 relationship)
- All works have valid artist references
- No orphaned recordings

**Performance**:
- Test duration: ~60 seconds
- Snapshot size: ~150 KB
- All scripts idempotent ✅

---

## Troubleshooting

### Test fails with "differences found"

1. **Check if IDs are the issue**: The test ignores auto-generated IDs. If it's flagging ID differences, there's a bug in the test.

2. **Check actual data differences**: Look at which fields differ. Common causes:
   - Timestamps (allowed ±5 seconds)
   - JSONB field formatting
   - NULL vs empty string

3. **Check for missing data**: If counts don't match, some data isn't being populated.

### "Extra" or "Missing" entities

- **Extra**: New data appeared during repopulation (check source tables)
- **Missing**: Data didn't get created (check population script logic)

### Comparison logic

The test uses **stable keys** for matching:
- **Artists**: `spotify_artist_id`
- **Works**: `iswc` (preferred) → `genius_song_id` → `title` (case-insensitive)
- **Recordings**: `spotify_track_id`

This ensures we compare **semantic equivalence**, not just array position.

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: GRC-20 Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: oven-sh/setup-bun@v1
      - name: Install dependencies
        run: bun install
      - name: Run regression test
        env:
          NEON_DATABASE_URL: ${{ secrets.TEST_DB_URL }}
        run: bun tests/test-grc20-population-regression.ts
```

---

## Future Tests

Potential additions:

1. **Performance benchmarks**: Track script execution time
2. **Data quality metrics**: Check completeness scores, ISRC coverage, etc.
3. **Constraint validation**: Ensure all constraints are properly enforced
4. **Idempotency test**: Run scripts multiple times, verify same results
5. **Partial population test**: Test running individual scripts out of order

---

## Related Documentation

- [Population Scripts README](../scripts/migration/README-POPULATION.md)
- [Transaction Utils](../src/db/transaction.ts)
- [Validation Script](../scripts/migration/validate-grc20-data.ts)
