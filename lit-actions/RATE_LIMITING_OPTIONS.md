# Rate Limiting Options for Lit Actions

## The Challenge
Lit actions are **stateless** - they don't remember previous calls. To enforce usage limits, we need external state.

## Option 1: Tinybird Analytics (Your Suggestion)

### How It Works
```javascript
// In multi-personality-chat-v1.js

// 1. Check usage BEFORE expensive operation
const checkUrl = `https://api.tinybird.co/v0/pipes/check_user_limit.json?user=${userAddress}`;
const usageCheck = await fetch(checkUrl, {
  headers: { 'Authorization': `Bearer ${tinybirdToken}` }
});
const { calls_today } = await usageCheck.json();

if (calls_today >= 100) {  // Free tier limit
  throw new Error('Daily limit reached (100 calls). Upgrade to premium or try again tomorrow.');
}

// 2. Execute chat/translate
const result = await callVeniceAPI(...);

// 3. Log usage AFTER
await fetch('https://api.tinybird.co/v0/events?name=chat_usage', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${tinybirdToken}` },
  body: JSON.stringify({
    user_address: userAddress,
    timestamp: Date.now(),
    action: 'chat',
    tokens_used: result.usage.total_tokens,
    cost_estimate: result.usage.total_tokens * 0.000001  // rough cost
  })
});
```

### Tinybird Schema
```sql
-- chat_usage data source
CREATE TABLE chat_usage
(
  user_address String,
  timestamp DateTime64(3),
  action String,  -- 'chat', 'translate', 'tts'
  tokens_used Int32,
  cost_estimate Float32
)
ENGINE = MergeTree()
ORDER BY (user_address, timestamp);

-- Pipe: check_user_limit
SELECT
  COUNT(*) as calls_today
FROM chat_usage
WHERE user_address = {{String(user, '')}}
  AND timestamp >= now() - INTERVAL 1 DAY
```

### Pros
- ✅ Real-time enforcement (can block before API call)
- ✅ Rich analytics dashboard (track spending, popular features, abuse)
- ✅ HTTP-based (simple integration)
- ✅ Fast queries (<100ms)
- ✅ Can query usage back for user dashboards ("You've used 45/100 today")
- ✅ Scales well (handles millions of events)

### Cons
- ❌ 2 HTTP calls per lit-action (read + write = +100-200ms latency)
- ❌ Another service to manage
- ❌ Cost: ~$50/mo for 1M events (but they have free tier: 1K events/day)
- ❌ Single point of failure (what if Tinybird is down?)
  - Could fail open (allow) for availability
  - Or fail closed (block) for security
- ❌ Need to encrypt Tinybird token in lit-action

### Cost
- **Free tier:** 1,000 events/day (good for testing)
- **Paid:** $49/mo for 1M events (assuming 100 users × 100 calls/day = 10K events/day = 300K/mo)

---

## Option 2: Neon Database (You Already Have)

### How It Works
```javascript
// Same pattern but using your existing Neon Postgres

// 1. Check usage
const result = await fetch(`${DATABASE_URL}/sql`, {
  method: 'POST',
  body: `
    SELECT COUNT(*) as calls_today
    FROM usage_tracking
    WHERE user_address = $1
      AND created_at > NOW() - INTERVAL '1 day'
  `,
  params: [userAddress]
});

// 2. Insert log
await fetch(`${DATABASE_URL}/sql`, {
  method: 'POST',
  body: `
    INSERT INTO usage_tracking (user_address, action, tokens_used, created_at)
    VALUES ($1, $2, $3, NOW())
  `,
  params: [userAddress, 'chat', tokensUsed]
});
```

### Pros
- ✅ No new service (already paying for Neon)
- ✅ SQL is powerful (complex queries, joins with user data)
- ✅ Can combine with existing tables (user profiles, subscriptions)
- ✅ Cheaper than Tinybird for low volume

### Cons
- ❌ Slower than Tinybird (Postgres not optimized for real-time analytics)
- ❌ Need to expose DATABASE_URL to lit-action (security concern)
- ❌ Adds load to production DB
- ❌ Harder to build analytics dashboards

---

## Option 3: Smart Contract Counters

### How It Works
```solidity
// UsageTracker.sol
mapping(address => mapping(uint256 => uint256)) public dailyCalls;  // user => day => count

function checkAndIncrement() external {
  uint256 today = block.timestamp / 1 days;
  require(dailyCalls[msg.sender][today] < 100, "Daily limit reached");
  dailyCalls[msg.sender][today]++;
}
```

```javascript
// In lit-action
await Lit.Actions.signAndCombineEcdsa({
  toAddress: USAGE_TRACKER_CONTRACT,
  functionName: 'checkAndIncrement',
  params: []
});
```

### Pros
- ✅ Decentralized (no single point of failure)
- ✅ Transparent (users can verify their usage on-chain)
- ✅ Permanent record

### Cons
- ❌ Gas costs (each check costs ~50K gas = $0.01 on Lens testnet, more on mainnet)
- ❌ Slower (1-2 second block times)
- ❌ Complex to implement
- ❌ Hard to do analytics (need subgraph)
- ❌ **Makes free tier expensive** (defeats the purpose)

---

## Option 4: Frontend Soft Limits (Easiest)

### How It Works
```typescript
// In frontend: src/lib/chat/rateLimiter.ts

interface UsageRecord {
  date: string;  // YYYY-MM-DD
  count: number;
}

export function checkDailyLimit(limit: number = 100): boolean {
  const today = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem('chat_usage');
  const usage: UsageRecord = stored ? JSON.parse(stored) : { date: today, count: 0 };

  // Reset if new day
  if (usage.date !== today) {
    usage.date = today;
    usage.count = 0;
  }

  if (usage.count >= limit) {
    return false;  // Limit reached
  }

  usage.count++;
  localStorage.setItem('chat_usage', JSON.stringify(usage));
  return true;
}
```

### Pros
- ✅ Free
- ✅ Zero latency
- ✅ Good UX (instant feedback)
- ✅ Easy to implement

### Cons
- ❌ Easily bypassed (clear localStorage, incognito mode, or call lit-action directly)
- ❌ No analytics/monitoring
- ❌ Only stops honest users

---

## Option 5: Hybrid (Frontend + Backend Monitoring)

### Phase 1: Soft Limits (Now)
Frontend localStorage tracking - stops honest users, good UX

### Phase 2: Monitoring (Next)
Add Tinybird **logging only** (no enforcement):
```javascript
// In lit-action - just log, don't check
await fetch('https://api.tinybird.co/v0/events?name=chat_usage', {
  method: 'POST',
  body: JSON.stringify({ user_address, action, timestamp })
});
```

Get visibility into:
- Who's using it most?
- Are people bypassing frontend limits?
- What features are popular?
- Cost per user

### Phase 3: Hard Enforcement (If Needed)
Only if Phase 2 shows abuse:
- Add Tinybird read queries to lit-action
- Or manually revoke PKP access for abusers
- Or require payment for heavy users

---

## My Recommendation

**Start with Option 5 (Hybrid):**

### Week 1: Frontend Soft Limits
```typescript
// src/lib/chat/rateLimiter.ts
export const DAILY_LIMITS = {
  free: 100,
  premium: 1000
};

export function canSendMessage(isPremium: boolean): { allowed: boolean; remaining: number; reason?: string } {
  const limit = isPremium ? DAILY_LIMITS.premium : DAILY_LIMITS.free;
  const usage = getUsageToday();

  if (usage >= limit) {
    return {
      allowed: false,
      remaining: 0,
      reason: isPremium
        ? 'Daily limit reached. Contact support for enterprise plan.'
        : 'Daily limit reached. Upgrade to premium for 1000 calls/day.'
    };
  }

  return { allowed: true, remaining: limit - usage };
}
```

Show in UI: "45/100 free messages today" (like GitHub Actions minutes)

### Week 2: Add Tinybird Logging (Monitoring Only)

Add to lit-action (write-only, non-blocking):
```javascript
// Don't fail the request if logging fails
try {
  await fetch('https://api.tinybird.co/v0/events?name=chat_usage', {
    method: 'POST',
    body: JSON.stringify({
      user_address: userAddress,
      action: mode,
      timestamp: Date.now(),
      personality: username,
      tokens_used: data.usage?.total_tokens || 0
    })
  });
} catch (err) {
  console.log('Tinybird logging failed (non-fatal):', err);
}
```

### Week 3+: Analyze & Decide

Look at Tinybird dashboard:
- Is anyone bypassing frontend limits?
- What's the 95th percentile usage?
- Do we need hard enforcement?

If yes → Add read queries to lit-action (Option 1)
If no → Keep soft limits, save the latency

---

## Tinybird Alternative: Posthog

If you want simpler analytics without rate limiting:
- **Posthog**: Free for <1M events/mo, built-in dashboards
- Just log events, no enforcement
- Better for product analytics than rate limiting

---

## Questions for You

1. **What's your expected usage?**
   - 10 users × 50 calls/day = 500 calls/day?
   - 1000 users × 10 calls/day = 10K calls/day?

2. **How critical is enforcement?**
   - Is this a nice-to-have (prevent accidental abuse)?
   - Or must-have (prevent malicious attacks)?

3. **Budget for analytics?**
   - $0/mo → Frontend only
   - $50/mo → Tinybird or Posthog
   - $100+/mo → Full rate limiting + analytics

4. **Fail open or closed?**
   - If Tinybird is down, allow requests (availability) or block (security)?

Would you like me to implement the **hybrid approach** (frontend + Tinybird logging)? I can add the localStorage rate limiter to the frontend and Tinybird logging to the lit-action as a non-blocking write.
