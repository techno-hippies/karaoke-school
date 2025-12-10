# Multi-Layer Storage Implementation

## Overview

Port censorship-resistant storage from `decentralised-storage-sandbox/dapp-storage-layers/` into the pipeline. Grove remains primary, Arweave + Lighthouse added as redundancy layers.

## Storage Hierarchy

| Layer | Use Case | Cost | Limit |
|-------|----------|------|-------|
| **Grove** | Primary (backwards compat) | Free | None |
| **Arweave** | Metadata, small files | Free <100KB | 100KB until funded |
| **Lighthouse** | Audio, video, large files | Pay-once | None |

## Current Limitations

- **Arweave**: 100KB free limit until wallet funded with $AR (tomorrow)
- **Consequence**: Only metadata JSONs go to Arweave for now
- **Audio/video**: Grove + Lighthouse only until Arweave funded

## Files to Create

```
pipeline/src/services/
├── arweave.ts      # Turbo SDK uploads
├── lighthouse.ts   # IPFS + Filecoin uploads
└── storage.ts      # Unified orchestrator
```

## Database Changes

```sql
-- JSONB for flexible storage tracking
ALTER TABLE songs ADD COLUMN IF NOT EXISTS storage_manifest JSONB;

-- Arweave/Lighthouse URIs for clips
ALTER TABLE clips ADD COLUMN IF NOT EXISTS metadata_arweave_uri TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS metadata_lighthouse_uri TEXT;
```

### storage_manifest Structure

```json
{
  "clip_instrumental": {
    "grove": { "cid": "...", "url": "https://api.grove.storage/..." },
    "lighthouse": { "cid": "...", "url": "https://ipfs.io/ipfs/..." }
  },
  "clip_metadata": {
    "grove": { "cid": "...", "url": "..." },
    "arweave": { "txId": "...", "url": "https://arweave.net/..." }
  },
  "status": "dual",
  "updatedAt": "2024-..."
}
```

## Environment Variables

```bash
# Add to .env
ARWEAVE_WALLET=./arweave-key.json
LIGHTHOUSE_API_KEY=your-key-here
```

## Upload Strategy by Asset Type

| Asset | Size | Layers | Notes |
|-------|------|--------|-------|
| Clip metadata JSON | ~10-50KB | Grove + Arweave | Free on Arweave |
| Encryption manifest | ~5KB | Grove + Arweave | Free on Arweave |
| Exercise metadata | ~2KB | Grove + Arweave | Free on Arweave |
| Cover images | ~100KB-2MB | Grove + Lighthouse | Too big for free Arweave |
| Clip audio | ~5MB | Grove + Lighthouse | Too big for free Arweave |
| Encrypted full audio | ~10-50MB | Grove + Lighthouse | Too big for free Arweave |
| Video | ~10-50MB | Grove + Lighthouse | Too big for free Arweave |

## Implementation Order

1. [x] Create services (arweave.ts, lighthouse.ts, storage.ts)
2. [x] Add types to types/index.ts
3. [x] Run DB migration (storage_manifest JSONB, metadata_arweave_uri, metadata_lighthouse_uri)
4. [x] Update emit-clip-full.ts (metadata → Grove + Arweave)
5. [ ] Update create-clip.ts (audio → Grove + Lighthouse)
6. [ ] Update encrypt-audio.ts
7. [ ] Update add-song.ts (images → Grove + Lighthouse)

## Key Principle

**Grove URLs remain primary.** All existing `*_url` columns continue to work. Arweave/Lighthouse URLs stored in `storage_manifest` JSONB for redundancy/fallback.

## Gateway Speed Benchmarks

Tested with ~80KB metadata JSON (Dec 2024):

| Rank | Gateway | Latency | Notes |
|------|---------|---------|-------|
| 1 | arweave.dev | 599ms | Fastest Arweave |
| 2 | gateway.lighthouse.storage | 647ms | Only reliable IPFS |
| 3 | api.grove.storage | 883ms | Highest throughput for large files |
| 4 | ar-io.net | 1486ms | |
| 5 | ar-io.dev | 1840ms | |
| 6 | arweave.net | 1847ms | |
| 7 | g8way.io | 2128ms | |

**IPFS public gateways** (ipfs.io, dweb.link, cloudflare-ipfs, w3s.link) returned 504s - content not propagated to public DHT.

### Recommended Fallback Order

1. **Grove** (primary - fast CDN)
2. **Lighthouse gateway** (for IPFS content)
3. **arweave.dev** (fastest Arweave)
4. **ar-io.net** (backup Arweave)

### Gateway URLs

**Arweave:**
- https://arweave.dev/{txId} (fastest)
- https://ar-io.net/{txId}
- https://arweave.net/{txId}
- https://g8way.io/{txId}

**IPFS (Lighthouse):**
- https://gateway.lighthouse.storage/ipfs/{cid} (only reliable)

## Testing

```bash
# Speed comparison across all gateways
bun src/scripts/test-storage-speeds.ts

# Backfill missing storage layers
bun src/scripts/backfill-storage.ts --type=metadata --dry-run
bun src/scripts/backfill-storage.ts --type=audio --dry-run
```
