# Contracts Scripts

Scripts for emitting events to smart contracts on Lens Testnet.

## emit-segment-events.ts

Uploads karaoke segment data to Grove/IPFS and emits contract events for The Graph subgraph indexing.

### What It Does

1. **Queries Database**: Fetches 37 segments with cropped instrumentals, GRC-20 work IDs, alignments, and translations
2. **Uploads to Grove**:
   - 111 translation JSONs (37 segments × 3 languages: zh, vi, id)
   - 37 alignment JSONs (ElevenLabs word-level timing)
   - 37 metadata JSONs (links all assets together)
3. **Emits Contract Events**:
   - 37 `SegmentRegistered` events (~35k gas each)
   - 37 `SegmentProcessed` events (~42k gas each)
   - 111 `TranslationAdded` events (~25k gas each)

### Gas Estimate

- **Total Gas**: ~5.7M gas
- **Cost**: ~$1-2 on Lens Testnet (depending on gas price)

### Prerequisites

1. **TranslationEvents Contract**: Deploy to Lens Testnet first
   ```bash
   cd ../../../contracts
   forge script script/DeployTranslationEvents.s.sol \
     --zk \
     --rpc-url https://rpc.testnet.lens.xyz \
     --broadcast
   ```

2. **Update Script**: Replace placeholder address in script:
   ```typescript
   const TRANSLATION_EVENTS_ADDRESS = '0x...'; // Your deployed address
   ```

3. **Wallet with Gas**: Ensure wallet has at least 0.01 ETH on Lens Testnet

4. **Environment Variables**: Use `dotenvx` to inject `PRIVATE_KEY`

### Usage

**Dry Run (No Contract Calls)**
```bash
dotenvx run -f .env -- bun scripts/contracts/emit-segment-events.ts --dry-run
```

**Test with 2 Segments**
```bash
dotenvx run -f .env -- bun scripts/contracts/emit-segment-events.ts --limit=2
```

**Full Batch (37 Segments)**
```bash
dotenvx run -f .env -- bun scripts/contracts/emit-segment-events.ts
```

### Output Example

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Emit Segment Events to Lens Testnet                                 ║
╚═══════════════════════════════════════════════════════════════════════╝

💰 Wallet: 0x1234...5678
💰 Balance: 0.05 ETH

⏳ Querying segments from database...
✅ Found 37 segments ready for emission

🔍 Validating all segments...
✅ Valid: 37

🚀 Processing segments...

================================================================================
[1/37] 5FKnuwsKf7YFpmhA5Wnl0q
================================================================================
  🔑 Segment Hash: 0xabc123...
  🎵 GRC-20 Work: f1d7f4c7-ca47-4ba3-9875-a91720459ab4
  ⏱️  Timing: 24800ms - 190140ms
  🌍 Translations: 3 languages

  📦 Step 1: Upload Translations to Grove
    📤 Uploading zh translation to Grove...
       ✅ Uploaded: b84b690860473dc59cc9de82d56c22cbc9b921a22e618fd102ad46a18c902cde
       ✅ DB updated with Grove URL
    📤 Uploading vi translation to Grove...
       ✅ Uploaded: ...
    📤 Uploading id translation to Grove...
       ✅ Uploaded: ...

  📦 Step 2: Upload Alignment to Grove
    📤 Uploading alignment to Grove...
       ✅ Uploaded: ...

  📦 Step 3: Upload Segment Metadata to Grove
    📤 Uploading segment metadata to Grove...
       ✅ Uploaded: ...

  ⛓️  Step 4: Emit SegmentRegistered Event
    ⏳ Transaction submitted: 0x123abc...
    ✅ Confirmed in block 12345678 (gas: 35421)

  ⛓️  Step 5: Emit SegmentProcessed Event
    ⏳ Transaction submitted: 0x456def...
    ✅ Confirmed in block 12345679 (gas: 42153)

  ⛓️  Step 6: Emit TranslationAdded Events (3)
    ⏳ zh: 0x789ghi...
    ✅ zh: Block 12345680 (gas: 25234)
    ⏳ vi: 0x012jkl...
    ✅ vi: Block 12345681 (gas: 25234)
    ⏳ id: 0x345mno...
    ✅ id: Block 12345682 (gas: 25234)

  ✅ Segment 5FKnuwsKf7YFpmhA5Wnl0q completed successfully!

...

╔═══════════════════════════════════════════════════════════════════════╗
║  Summary                                                              ║
╚═══════════════════════════════════════════════════════════════════════╝
   Total segments: 37
   ✅ Success: 37
   ❌ Failed: 0

🎉 All segments processed successfully!
```

### Error Handling

The script has built-in validation at multiple levels:

1. **Database Query Validation**: Ensures all required fields are present
2. **Zod Schema Validation**: Validates data types and formats before Grove upload
3. **Metadata Validation**: Checks Grove URLs and metadata structure
4. **Event Validation**: Validates contract event parameters before emission

If a segment fails validation or processing, it's skipped and the error is logged. The script continues with remaining segments.

### Rate Limiting

The script includes a 2-second delay between segments to avoid overwhelming the RPC endpoint and Grove API.

### Database Updates

The script updates `lyrics_translations` table with `grove_url` values after successful upload. This prevents re-uploading the same translations on subsequent runs.

### Translation Flexibility

Adding new languages is simple:

1. **Generate translations** (e.g., Spanish):
   ```bash
   bun src/processors/translate-lyrics.ts --language=es
   ```

2. **Re-run this script** (it will only upload/emit new translations):
   ```bash
   dotenvx run -f .env -- bun scripts/contracts/emit-segment-events.ts
   ```

No contract changes needed! Each language gets its own `TranslationAdded` event.

### Troubleshooting

**"TranslationEvents contract not deployed"**
- Deploy `TranslationEvents.sol` first (see Prerequisites)
- Update `TRANSLATION_EVENTS_ADDRESS` in script

**"Low balance" warning**
- Fund wallet with at least 0.01 ETH on Lens Testnet
- Get testnet ETH from Lens faucet

**"Grove upload failed"**
- Check internet connection
- Grove API may be rate-limiting (wait 30s and retry)

**"PRIVATE_KEY not found"**
- Use `dotenvx run -f .env --` to inject environment variables
- Ensure `.env` file has `PRIVATE_KEY=0x...`

### Next Steps

After running this script:

1. **Deploy Subgraph**: Update `subgraph.yaml` with contract addresses and deploy
2. **Verify Events**: Check Lens Testnet block explorer for emitted events
3. **Query Subgraph**: Test GraphQL queries for segment data
4. **Update App**: Point app to new subgraph endpoint

### Architecture Notes

**Why Separate Events?**
- `SegmentRegistered`: Fired immediately when segment data is ready
- `SegmentProcessed`: Fired after audio/alignment processing completes
- `TranslationAdded`: One per language (allows incremental language additions)

**Why Grove for Storage?**
- Immutable content-addressed storage (IPFS)
- Cheaper than on-chain storage ($0.01/MB vs $200k+/MB)
- Permanent and verifiable via CID hashes

**Why Events Instead of Storage?**
- 95% cheaper gas (~35k vs 200k+ per write)
- The Graph indexes events automatically
- No contract upgrades needed for schema changes
