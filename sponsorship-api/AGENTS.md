# Sponsorship API - Agent Guide

## Core Commands

• **Development**: `npm run dev` (starts on port 8787)
• **Build**: `npm run build` (TypeScript compilation)
• **Deploy**: `npm run deploy` (Cloudflare Workers)
• **Test**: `curl -X POST http://localhost:8787/api/lens-auth -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"account": "0x...", "signedBy": "0x..."}'`

## Service Architecture

**Purpose**: Cloudflare Workers API for Lens Protocol transaction sponsorship with anti-spam protection

**Core Dependencies**:
- **Hono**: Lightweight web framework optimized for Workers
- **Neon DB**: Serverless PostgreSQL for sponsorship tracking
- **Viem**: TypeScript Ethereum library for blockchain interactions
- **Cloudflare Workers**: Edge deployment (sub-50ms global latency)

## Key Patterns

**Authentication Flow**:
```typescript
// 1. Lens Dashboard calls authorization endpoint
POST /api/lens-auth
{
  "account": "0x...",      // Lens account address
  "signedBy": "0x..."      // PKP address that signed
}

// Response determines sponsorship
{
  "allowed": true,
  "sponsored": true
}
```

**Transaction Submission**:
```typescript
// 2. Frontend calls when REQUIRES_SIGNATURE is returned
POST /api/submit-tx
{
  "account": "0x...",
  "operation": "username",
  "raw": {
    "to": "0x...",
    "data": "0x...",
    "value": "0",
    "nonce": "0",
    "gasLimit": "100000",
    "maxFeePerGas": "1000000000"
  }
}
```

## Development Patterns

**Environment Setup**:
```bash
# Local development
cp .env.example .dev.vars
# Edit .dev.vars with actual values

npm run dev
# API running at http://localhost:8787
```

**Secrets Management**:
```bash
# Production secrets (Cloudflare)
wrangler secret put DATABASE_URL
wrangler secret put PRIVATE_KEY
wrangler secret put LENS_AUTH_BEARER_TOKEN

# Generate bearer token
openssl rand -hex 32
```

## Critical Files

**Routes**: `src/routes.ts` - API endpoints for lens-auth and submit-tx
**Database**: `src/db.ts` - Neon DB client and sponsorship logic
**Types**: `src/types.ts` - TypeScript interfaces
**Config**: `wrangler.toml` - Cloudflare Workers configuration

## Sponsorship Logic

**Quota System**:
```typescript
interface SponsorshipRecord {
  account: string;
  pkp_address: string;
  sponsored_transactions: number;
  last_sponsored_at: Date;
  is_verified_pkp: boolean;
}

// Rules:
// 1. PKP Verification: Account must be created by Lit Protocol PKP
// 2. Initial Quota: First 10 transactions are sponsored
// 3. Balance Check: After quota, require min 0.01 GRASS for self-funding
// 4. POH Future: Users with POH score ≥20 get unlimited sponsorship
```

**PKP Verification**:
```typescript
const verifyPKP = async (pkpAddress: string): Promise<boolean> => {
  // Check if PKP NFT exists and owner matches expected minter
  const pkpBalance = await publicClient.readContract({
    address: PKP_NFT_CONTRACT,
    functionName: 'balanceOf',
    args: [pkpAddress]
  });
  
  return pkpBalance > 0n;
};
```

## Database Schema

**Neon PostgreSQL Tables**:

```sql
-- Track user sponsorship quotas
CREATE TABLE user_sponsorships (
  account TEXT PRIMARY KEY,
  pkp_address TEXT NOT NULL,
  sponsored_transactions INTEGER DEFAULT 0,
  last_sponsored_at TIMESTAMPTZ,
  is_verified_pkp BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log of all transactions
CREATE TABLE transaction_log (
  id SERIAL PRIMARY KEY,
  account TEXT NOT NULL,
  operation TEXT NOT NULL,
  tx_hash TEXT,
  sponsored BOOLEAN DEFAULT FALSE,
  gas_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Deployment

**Cloudflare Workers Deployment**:
```bash
# 1. Configure wrangler.toml
name = "karaoke-school-sponsorship-api"
main = "src/index.ts"
compatibility_date = "2023-05-18"

[vars]
DATABASE_URL = "postgresql://..."
ENVIRONMENT = "production"

# 2. Deploy
npm run deploy
# URL: https://karaoke-school-sponsorship-api.your-name.workers.dev

# 3. Configure Lens Dashboard
# Add authorization endpoint: https://your-api.workers.dev/api/lens-auth
# Add bearer token generated in setup
```

**Monitoring**:
```bash
# View logs in real-time
npm run tail

# Check Worker metrics
# https://dash.cloudflare.com
```

## Security Model

**Bearer Token Authentication**:
```typescript
const authenticateBearer = async (request: Request): Promise<boolean> => {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  return token === LENS_AUTH_BEARER_TOKEN;
};
```

**Admin Wallet**:
- Private key stored as Cloudflare secret
- Used to submit sponsored transactions
- Requires GRASS balance for gas fees

**Input Validation**:
- All endpoints validate input schemas
- Rate limiting (configurable in wrangler.toml)
- CORS support for frontend integration

## Integration with Lens Dashboard

**Setup Steps**:
1. Deploy API to Cloudflare Workers
2. Copy deployed URL: `https://karaoke-school-sponsorship-api.your-name.workers.dev`
3. Go to Lens Developer Dashboard
4. Add authorization endpoint: `https://your-api.workers.dev/api/lens-auth`
5. Generate and add bearer token

**Flow**:
```
Frontend → Lens API → Authorization Endpoint → Sponsorship Decision
                    ↓
If REQUIRES_SIGNATURE:
Frontend → Submit Transaction Endpoint → Admin Wallet Relayer
```

## Environment Configuration

**Required Variables**:
```bash
# .dev.vars (local)
DATABASE_URL="postgresql://user:pass@host/db"
PRIVATE_KEY="0x..."
LENS_AUTH_BEARER_TOKEN="64-char-hex-token"

# wrangler.toml (production)
[vars]
ENVIRONMENT="production"
DATABASE_URL="postgresql://..."
```

**Database Connection**:
```typescript
const db = new Neon(DATABASE_URL);
// Connection pooling handled automatically
// Environment-specific connection strings
```

## Performance & Cost

**Metrics**:
- **Response Time**: <500ms (Lens requirement)
- **Cold Start**: ~100ms (Workers)
- **Database Query**: <50ms (Neon serverless)

**Cost**:
- **Cloudflare Workers**: Free tier (100k req/day)
- **Neon DB**: Free tier (0.5GB, 191 hrs/month)
- **Total**: $0/month for moderate traffic

**Scaling**:
- Workers auto-scale globally
- Database connection pooling
- Edge cache for PKP verification (future enhancement)

## Gotchas

**Lens Requirements**:
- Authorization endpoint must respond <500ms
- Bearer token must match exactly
- CORS headers required for frontend

**Database Performance**:
- Neon connection pooling prevents exhaustion
- Queries must be optimized for serverless environment
- Index on account addresses for fast lookups

**PKP Verification**:
- Chronicle Yellowstone RPC must be responsive
- Contract address must match environment
- Balance check may return 0 for valid PKPs (use ownerOf instead)

**Transaction Submission**:
- Admin wallet must have GRASS for gas fees
- Transaction must be signed by account owner
- Nonce management critical for reliability

## Troubleshooting

**Lens auth endpoint timing out**:
```typescript
// Check Neon DB connection
const testConnection = await db.query('SELECT 1');

// Verify PKP check RPC responsiveness
const rpcResponse = await publicClient.readContract({...});

// Ensure response time <500ms
console.time('lens-auth');
const result = await processAuth(request);
console.timeEnd('lens-auth');
```

**Transaction submission failing**:
```bash
# Check admin wallet balance
curl -X POST https://your-rpc-endpoint \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x...", "latest"]}'

# Monitor transaction logs
npm run tail
```

**PKP verification failing**:
```typescript
// Debug PKP contract interaction
const pkpInfo = await publicClient.readContract({
  address: PKP_NFT_CONTRACT,
  functionName: 'getApproved',
  args: [pkpTokenId] // Use token ID instead of address
});
```

## Future Enhancements

- **Proof of Humanity**: Gitcoin Passport integration
- **Rate Limiting**: Per IP/account limits in KV storage
- **Analytics Dashboard**: Real-time sponsorship metrics
- **Webhook Integration**: Transaction event notifications
- **Caching Layer**: KV storage for PKP/balance checks
- **Multiple Networks**: Support for mainnet and testnet
