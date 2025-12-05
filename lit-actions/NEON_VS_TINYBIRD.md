# Neon DB vs Tinybird for Rate Limiting

## Yes! Neon Works as Pure HTTP ✅

You're already using `@neondatabase/serverless` which uses **HTTP fetch()** under the hood. This works in lit-actions!

```javascript
// Your current pipeline code
import { neon } from '@neondatabase/serverless';
const sql = neon(DATABASE_URL);
const result = await sql`SELECT * FROM users`;
```

Under the hood, this makes an HTTP POST to:
```
POST https://[your-project].neon.tech/sql
Authorization: Bearer [token-from-connection-string]
Content-Type: application/json

{
  "query": "SELECT * FROM users",
  "params": []
}
```

## Neon HTTP in Lit-Actions

```javascript
// In multi-personality-chat-v1.js

// Parse connection string: postgresql://user:pass@host/dbname
const dbUrl = 'postgresql://user:pass@ep-cool-name-123.us-east-2.aws.neon.tech/neondb';
const [_, auth, hostAndDb] = dbUrl.match(/postgresql:\/\/([^@]+)@([^\/]+)\/(.+)/);
const [user, pass] = auth.split(':');
const [host] = hostAndDb.split('/');

// 1. Check usage
const checkResponse = await fetch(`https://${host}/sql`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${pass}`,  // Password is the API token
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: `
      SELECT COUNT(*) as calls_today
      FROM usage_tracking
      WHERE user_address = $1
        AND created_at > NOW() - INTERVAL '1 day'
    `,
    params: [userAddress]
  })
});

const { calls_today } = await checkResponse.json();

if (calls_today >= 100) {
  throw new Error('Daily limit reached');
}

// 2. Log usage (after chat completes)
await fetch(`https://${host}/sql`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${pass}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: `
      INSERT INTO usage_tracking (user_address, action, tokens_used, cost_estimate, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `,
    params: [userAddress, 'chat', tokensUsed, cost]
  })
});
```

## Side-by-Side Comparison

| Feature | Neon (HTTP) | Tinybird |
|---------|-------------|----------|
| **You Already Have It** | ✅ Yes | ❌ Need to add |
| **HTTP-Based** | ✅ Yes | ✅ Yes |
| **Cost** | $0 (already paying) | $49/mo after 1K events/day |
| **Query Speed** | 🟡 150-300ms | 🟢 50-100ms |
| **Optimized for Analytics** | ❌ OLTP database | ✅ OLAP columnar storage |
| **Real-Time Dashboards** | 🟡 Harder (need Grafana/Metabase) | 🟢 Built-in |
| **Schema** | ✅ Full SQL, JOINs, etc. | 🟡 ClickHouse SQL (different) |
| **Impact on Prod DB** | 🟡 Adds load | ✅ Separate service |
| **Security** | 🟡 Need to secure DB URL | 🟡 Need to secure API token |
| **Latency Overhead** | ~200-400ms (2 HTTP calls) | ~100-200ms (2 HTTP calls) |

## Database Schema Comparison

### Neon Schema (SQL)
```sql
-- Add to your existing pipeline DB
CREATE TABLE usage_tracking (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'chat', 'translate', 'tts'
  tokens_used INTEGER,
  cost_estimate NUMERIC(10, 6),
  personality TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_date (user_address, created_at DESC)
);

-- Query for rate limiting
SELECT COUNT(*) as calls_today
FROM usage_tracking
WHERE user_address = $1
  AND created_at > NOW() - INTERVAL '1 day';

-- Query for analytics (slower on Postgres)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as calls,
  SUM(tokens_used) as tokens,
  SUM(cost_estimate) as cost
FROM usage_tracking
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour;
```

### Tinybird Schema (ClickHouse)
```sql
-- Data source
CREATE TABLE chat_usage
(
  user_address String,
  timestamp DateTime64(3),
  action String,
  tokens_used Int32,
  cost_estimate Float32,
  personality String
)
ENGINE = MergeTree()
ORDER BY (user_address, timestamp);

-- Pipe: check_limit (optimized for speed)
SELECT COUNT(*) as calls_today
FROM chat_usage
WHERE user_address = {{String(user, '')}}
  AND timestamp >= now() - INTERVAL 1 DAY;

-- Pipe: hourly_usage (fast aggregations)
SELECT
  toStartOfHour(timestamp) as hour,
  COUNT(*) as calls,
  SUM(tokens_used) as tokens,
  SUM(cost_estimate) as cost
FROM chat_usage
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY hour
ORDER BY hour;
```

## Performance Benchmarks

**Check Rate Limit Query:**
- **Neon:** ~150-250ms (OLTP, row-by-row count)
- **Tinybird:** ~50-100ms (OLAP, columnar scan)

**Insert Log:**
- **Neon:** ~50-100ms
- **Tinybird:** ~30-50ms (batched)

**Total Overhead per Request:**
- **Neon:** ~250-400ms
- **Tinybird:** ~100-200ms

**Analytics Queries (7 days):**
- **Neon:** ~500ms-2s (full table scan)
- **Tinybird:** ~100-300ms (columnar aggregation)

## Use Cases

### Use Neon If:
- ✅ You want zero additional services
- ✅ You need complex JOINs with user data (e.g., filter by subscription tier)
- ✅ Budget is tight ($0 vs $49/mo)
- ✅ You're OK with slightly higher latency (~250ms overhead)
- ✅ Low-medium traffic (<10K requests/day)

### Use Tinybird If:
- ✅ You want fastest possible enforcement (<100ms overhead)
- ✅ You need real-time analytics dashboards
- ✅ High traffic (>100K requests/day) - Postgres won't scale
- ✅ You want separation from production DB
- ✅ Budget allows ($49/mo is acceptable)

## Hybrid Approach (Best of Both Worlds)

**Phase 1:** Frontend soft limits (localStorage) - Free, instant
**Phase 2:** Neon logging (write-only) - $0, monitors abuse
**Phase 3a:** If low abuse → Keep soft limits
**Phase 3b:** If high abuse → Add Neon enforcement OR switch to Tinybird

### Phase 2 Implementation (Neon Logging)

```javascript
// In multi-personality-chat-v1.js

async function logUsage(userAddress, action, tokensUsed, cost) {
  // Don't fail the request if logging fails
  try {
    const neonUrl = await Lit.Actions.decryptAndCombine({
      accessControlConditions: neonEncryptedUrl.accessControlConditions,
      ciphertext: neonEncryptedUrl.ciphertext,
      dataToEncryptHash: neonEncryptedUrl.dataToEncryptHash,
      authSig: null,
      chain: 'ethereum'
    });

    await fetch(neonUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          INSERT INTO usage_tracking (user_address, action, tokens_used, cost_estimate)
          VALUES ($1, $2, $3, $4)
        `,
        params: [userAddress, action, tokensUsed, cost]
      })
    });
  } catch (err) {
    console.log('Usage logging failed (non-fatal):', err);
  }
}

// Call after Venice API succeeds
await logUsage(userAddress, 'chat', data.usage.total_tokens, estimatedCost);
```

## Security Considerations

### Neon
**Problem:** Exposing `DATABASE_URL` to lit-action gives read/write access to entire DB
**Solutions:**
1. Create separate **read-only user** for rate checking:
   ```sql
   CREATE USER rate_limiter WITH PASSWORD 'xxx';
   GRANT SELECT ON usage_tracking TO rate_limiter;
   ```
2. Use **separate Neon database** for usage tracking (not your prod data)
3. Encrypt the connection string with Lit (same as Venice API key)

### Tinybird
**Problem:** API token has full access to Tinybird workspace
**Solutions:**
1. Use **restricted tokens** (Tinybird lets you scope tokens to specific pipes)
2. Create write-only token for events, read-only token for dashboards
3. Encrypt token with Lit

## Cost Analysis

### Scenario: 100 Users × 50 Calls/Day = 5K Calls/Day

**Neon:**
- Database storage: ~1MB/month (tiny table)
- Compute: Included in base plan
- **Total:** $0 (already covered by base Neon plan)

**Tinybird:**
- Events: 5K/day × 30 = 150K/month
- Free tier: 1K events/day = 30K/month
- **Overage:** 120K events = need paid plan
- **Total:** $49/month

### Scenario: 10 Users × 20 Calls/Day = 200 Calls/Day (Testing)

**Neon:** $0
**Tinybird:** $0 (within free tier)

## My Recommendation

**For Your Use Case (Early Stage):**

1. **Now:** Frontend soft limits (localStorage)
   - 100 free calls/day shown in UI
   - Stops 95% of users
   - Zero cost, zero latency

2. **Week 2:** Add Neon logging (write-only, non-blocking)
   ```sql
   CREATE TABLE usage_tracking (...);
   -- Insert after each chat call
   ```
   - Monitor who's using it
   - Identify any bypass abuse
   - $0 cost

3. **Month 2:** Analyze & decide
   - If abuse is rare → Keep soft limits
   - If abuse is high → Add Neon enforcement (SELECT before INSERT)
   - If analytics needed → Migrate to Tinybird

**Start with Neon because:**
- ✅ You already have it
- ✅ Zero additional cost
- ✅ Good enough for early stage (<10K calls/day)
- ✅ Can always migrate to Tinybird later

**Only switch to Tinybird if:**
- You need real-time dashboards for investors/metrics
- Traffic exceeds 50K calls/day
- Latency matters (need <100ms overhead)
- You raise funding and can afford $49/mo

## Implementation Code

Want me to implement **Phase 1 (Frontend) + Phase 2 (Neon Logging)**?

I can add:
1. `src/lib/chat/rateLimiter.ts` - Frontend localStorage limits
2. Migration: `pipeline/migrations/add_usage_tracking.sql`
3. Neon logging in `multi-personality-chat-v1.js` (non-blocking writes)
4. UI component showing "45/100 messages today"

Would take ~1 hour. Ready to proceed?
