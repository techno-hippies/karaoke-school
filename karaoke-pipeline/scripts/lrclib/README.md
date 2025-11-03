# LRCLIB Corpus Integration

Import and index 19M+ lyrics from LRCLIB with semantic search via DeepInfra embeddings.

## =Ê Dataset

**Source:** [LRCLIB Database Dump (Oct 22, 2025)](https://lrclib.net/)
- **Size:** 69 GB SQLite
- **Tracks:** 19.1 million
- **Lyrics:** 19.5 million (plain + synced)
- **Location:** `/media/t42/me/lrclib/lrclib-db-dump-20251022T074101Z.sqlite3`

## <× Architecture

```
SQLite (69GB)
    “ import-from-sqlite.ts
Neon PostgreSQL (lrclib_corpus table)
    “ generate-embeddings.ts
DeepInfra API (google/embeddinggemma-300m)
    “
Vector Embeddings (768 dims)
    “ pgvector HNSW index
Semantic Search
```

## =€ Quick Start

### 1. Apply Database Schema

```bash
# Schema already applied via migration 040-lrclib-corpus.sql
# Verify:
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon';
  const stats = await query('SELECT * FROM lrclib_corpus_stats');
  console.table(stats);
"
```

### 2. Import Lyrics (Test with 1000 rows)

```bash
# Test import
dotenvx run -f .env -- bun scripts/lrclib/import-from-sqlite.ts --limit=1000

# Check results
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon';
  const stats = await query('SELECT * FROM lrclib_corpus_stats');
  console.table(stats);
"
```

### 3. Generate Embeddings (Test with 100 rows)

```bash
# Test embedding generation
dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts --limit=100

# Verify embeddings
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon';
  const result = await query('SELECT COUNT(*) as with_embeddings FROM lrclib_corpus WHERE lyrics_embedding IS NOT NULL');
  console.log('Tracks with embeddings:', result[0].with_embeddings);
"
```

### 4. Test Semantic Search

```bash
# Find similar songs by lyrics
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon';
  import { deepInfraEmbedding } from './src/services/deepinfra-embedding';

  // Generate query embedding
  const queryLyrics = 'love and heartbreak under the moonlight';
  const queryEmbedding = await deepInfraEmbedding.embedLyrics(queryLyrics);

  // Search similar songs
  const results = await query(
    'SELECT * FROM search_similar_lyrics(\$1::vector, 10, 0.7)',
    [\`[\${queryEmbedding.join(',')}]\`]
  );

  console.log('Similar songs:', results);
"
```

## =Ë Scripts

### `import-from-sqlite.ts`

Import lyrics from SQLite to Neon PostgreSQL.

**Options:**
- `--limit=N` - Import only N rows (for testing)
- `--offset=N` - Skip first N rows (for resuming)

**Examples:**
```bash
# Test with 1,000 rows
dotenvx run -f .env -- bun scripts/lrclib/import-from-sqlite.ts --limit=1000

# Import 10,000 rows
dotenvx run -f .env -- bun scripts/lrclib/import-from-sqlite.ts --limit=10000

# Resume from row 1,000,000
dotenvx run -f .env -- bun scripts/lrclib/import-from-sqlite.ts --offset=1000000 --limit=100000

# Full import (19M+ rows, will take hours)
dotenvx run -f .env -- bun scripts/lrclib/import-from-sqlite.ts
```

**Performance:**
- Batch size: 1,000 rows per INSERT
- Rate: ~5,000-10,000 rows/min
- Full import: ~30-60 hours estimated

### `generate-embeddings.ts`

Generate vector embeddings using DeepInfra.

**Options:**
- `--limit=N` - Process only N rows (for testing)
- `--offset=N` - Skip first N rows (for resuming)

**Examples:**
```bash
# Test with 100 rows
dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts --limit=100

# Process 10,000 rows
dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts --limit=10000

# Default: process 10,000 pending at a time (safety limit)
dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts

# Resume from specific offset
dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts --offset=5000 --limit=5000
```

**Performance:**
- Batch size: 100 lyrics per API call
- Rate: ~100-200 embeddings/min (API limited)
- Cost: ~$0.03 per 1M tokens
- Full embedding: ~100-200 hours estimated

**Cost Estimate:**
- 19M tracks × 500 avg tokens = 9.5B tokens
- $0.03 per 1M tokens = **~$285 total**

## = Database Functions

### `match_lrclib_track()`

Fuzzy match tracks by name, artist, and duration.

```sql
-- Find matches for a track
SELECT * FROM match_lrclib_track(
  'Wildest Dreams',
  'Taylor Swift',
  220.0,  -- duration in seconds
  2.0     -- tolerance (±2 seconds)
);
```

### `search_similar_lyrics()`

Semantic search by lyrics embedding.

```sql
-- Find similar songs (requires embedding vector)
SELECT * FROM search_similar_lyrics(
  '[0.123, -0.456, ...]'::vector(768),  -- query embedding
  10,    -- limit
  0.7    -- min similarity (0-1)
);
```

### `lrclib_corpus_stats` (View)

Get corpus statistics.

```sql
SELECT * FROM lrclib_corpus_stats;
```

## <¯ Production Workflow

### Phase 1: Import Base Data (1-2 days)

```bash
# Import in chunks of 100K
for i in {0..190}; do
  offset=$((i * 100000))
  echo "Importing batch $i (offset: $offset)"
  dotenvx run -f .env -- bun scripts/lrclib/import-from-sqlite.ts \
    --offset=$offset --limit=100000
  sleep 60  # Brief pause between batches
done
```

### Phase 2: Generate Embeddings (4-7 days)

```bash
# Generate embeddings in chunks of 10K
# Run multiple instances in parallel if budget allows
for i in {0..1900}; do
  offset=$((i * 10000))
  echo "Generating embeddings batch $i (offset: $offset)"
  dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts \
    --offset=$offset --limit=10000
  sleep 30  # Respect rate limits
done
```

### Phase 3: Build Vector Index

```sql
-- After embeddings complete, build HNSW index
CREATE INDEX CONCURRENTLY idx_lrclib_corpus_embedding_cosine
  ON lrclib_corpus
  USING hnsw (lyrics_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

## =Ê Monitoring

### Check Import Progress

```sql
SELECT
  COUNT(*) as total_imported,
  COUNT(*) FILTER (WHERE has_plain_lyrics) as with_lyrics,
  COUNT(*) FILTER (WHERE lyrics_embedding IS NOT NULL) as with_embeddings,
  ROUND(COUNT(*) FILTER (WHERE lyrics_embedding IS NOT NULL) * 100.0 / COUNT(*), 2) as embedding_progress_pct
FROM lrclib_corpus;
```

### Check Pending Work

```sql
SELECT
  COUNT(*) FILTER (WHERE lyrics_embedding IS NULL AND has_plain_lyrics) as pending_embeddings,
  MIN(id) as next_id_to_process
FROM lrclib_corpus
WHERE lyrics_embedding IS NULL AND has_plain_lyrics = TRUE;
```

### Estimate Completion Time

```sql
SELECT
  COUNT(*) FILTER (WHERE lyrics_embedding IS NOT NULL) as completed,
  COUNT(*) FILTER (WHERE lyrics_embedding IS NULL AND has_plain_lyrics) as pending,
  ROUND(
    (COUNT(*) FILTER (WHERE lyrics_embedding IS NULL AND has_plain_lyrics) / 150.0) / 60.0,
    1
  ) as estimated_hours_remaining  -- Assuming 150 embeddings/min
FROM lrclib_corpus;
```

## >ê Testing

### Test Vector Search Quality

```bash
# Create test script
cat > scripts/lrclib/test-search.ts << 'EOF'
import { query } from '../../src/db/neon';
import { deepInfraEmbedding } from '../../src/services/deepinfra-embedding';

const testQueries = [
  "love and heartbreak under the stars",
  "dancing all night in the club",
  "missing you since you left town"
];

for (const queryText of testQueries) {
  console.log(`\n= Query: "${queryText}"`);

  const embedding = await deepInfraEmbedding.embedLyrics(queryText);
  const results = await query(
    'SELECT * FROM search_similar_lyrics($1::vector, 5, 0.6)',
    [`[${embedding.join(',')}]`]
  );

  console.log('Results:');
  results.forEach((r: any, i: number) => {
    console.log(`  ${i + 1}. ${r.track_name} - ${r.artist_name} (${r.similarity})`);
  });
}
EOF

dotenvx run -f .env -- bun scripts/lrclib/test-search.ts
```

## =¾ Storage Estimates

**Database Storage:**
- Text data: ~50 GB (19M × 2.5 KB avg)
- Vector embeddings: ~57 GB (19M × 768 × 4 bytes)
- Indexes: ~20 GB (HNSW + B-tree)
- **Total: ~130 GB**

**Neon Pricing:**
- Storage: $3.50/GB/month
- Compute: $0.16/hour (0.25 vCPU)
- **Estimated: ~$500-800/month**

## =€ Optimization Tips

1. **Batch Imports:** Use `--limit=100000` chunks
2. **Parallel Embeddings:** Run 2-3 instances if budget allows
3. **Index After:** Build HNSW index AFTER all embeddings
4. **Monitor Costs:** Check DeepInfra usage dashboard
5. **Resume Support:** All scripts support `--offset` for resuming

## = Integration

### Query from App

```typescript
import { query } from './db/neon';
import { deepInfraEmbedding } from './services/deepinfra-embedding';

export async function findSimilarSongs(lyrics: string, limit = 10) {
  const embedding = await deepInfraEmbedding.embedLyrics(lyrics);
  return query(
    'SELECT * FROM search_similar_lyrics($1::vector, $2, 0.7)',
    [`[${embedding.join(',')}]`, limit]
  );
}
```

### Match TikTok to LRCLIB

```typescript
export async function matchTikTokToLRCLIB(
  trackName: string,
  artistName: string,
  duration: number
) {
  return query(
    'SELECT * FROM match_lrclib_track($1, $2, $3, 2.0)',
    [trackName, artistName, duration]
  );
}
```

## =Ú Resources

- [LRCLIB Website](https://lrclib.net/)
- [DeepInfra Embeddings](https://deepinfra.com/google/embeddinggemma-300m)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [HNSW Algorithm](https://arxiv.org/abs/1603.09320)
