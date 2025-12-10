# Karaoke School Sponsorship API

Cloudflare Workers API for Lens Protocol transaction sponsorship with anti-spam protection.

## Architecture

- **Hono**: Lightweight web framework optimized for Workers
- **Neon DB**: Serverless PostgreSQL for sponsorship tracking
- **Viem**: TypeScript Ethereum library for blockchain interactions
- **Cloudflare Workers**: Edge deployment (sub-50ms global latency)

## Features

- ✅ Lens authorization endpoint (bearer token auth)
- ✅ Transaction submission proxy (admin wallet relayer)
- ✅ PKP verification (Lit Protocol integration)
- ✅ Sponsorship quota management (10 free txs per user)
- ✅ Balance checking (require self-funding after quota)
- ✅ Transaction logging and analytics
- ✅ CORS support for frontend

## Setup

### 1. Install Dependencies

```bash
cd sponsorship-api
npm install
```

### 2. Configure Secrets

Create `.dev.vars` for local development:

```bash
cp .env.example .dev.vars
# Edit .dev.vars with your actual values
```

For production, use Wrangler secrets:

```bash
wrangler secret put DATABASE_URL
wrangler secret put PRIVATE_KEY
wrangler secret put LENS_AUTH_BEARER_TOKEN
```

### 3. Generate Bearer Token

```bash
# Generate a 64-character bearer token for Lens
openssl rand -hex 32
```

### 4. Run Locally

```bash
npm run dev
# API running at http://localhost:8787
```

### 5. Deploy to Cloudflare

```bash
npm run deploy
# Deployed to: https://karaoke-school-sponsorship-api.your-name.workers.dev
```

## Endpoints

### `POST /api/lens-auth`

Lens authorization endpoint. Lens API calls this to check if user should be sponsored.

**Headers:**
```
Authorization: Bearer <LENS_AUTH_BEARER_TOKEN>
Content-Type: application/json
```

**Request:**
```json
{
  "account": "0x...",   // Lens account address
  "signedBy": "0x..."   // PKP address that signed
}
```

**Response:**
```json
{
  "allowed": true,
  "sponsored": true
}
```

### `POST /api/submit-tx`

Transaction submission endpoint. Frontend calls this when `REQUIRES_SIGNATURE` is returned.

**Request:**
```json
{
  "account": "0x...",
  "operation": "username",
  "raw": {
    "to": "0x...",
    "data": "0x...",
    "value": "0",
    "nonce": "0",
    "gasLimit": "100000",
    "maxFeePerGas": "1000000000",
    "maxPriorityFeePerGas": "1000000000"
  }
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x..."
}
```

## Database Schema

See schema definitions in Neon DB:
- `user_sponsorships`: Tracks quota and PKP verification
- `transaction_log`: Audit log of all transactions

## Sponsorship Logic

1. **PKP Verification**: Account must be created by a Lit Protocol PKP
2. **Initial Quota**: First 10 transactions are sponsored
3. **Balance Check**: After quota, require min 0.01 GRASS for self-funding
4. **POH Future**: Users with POH score ≥20 get unlimited sponsorship

## Monitoring

View logs in real-time:

```bash
npm run tail
```

## Cost

- **Cloudflare Workers**: Free tier (100k req/day)
- **Neon DB**: Free tier (0.5GB, 191 hrs/month)
- **Total**: $0/month for moderate traffic

## Integration with Lens Dashboard

1. Deploy this API to Cloudflare Workers
2. Copy the deployed URL
3. Go to Lens Developer Dashboard
4. Add authorization endpoint: `https://your-api.workers.dev/api/lens-auth`
5. Add bearer token generated in step 3 of setup

## Security

- Bearer token authentication for Lens endpoint
- Admin wallet private key stored as Cloudflare secret
- Rate limiting (TODO: enable in wrangler.toml if needed)
- Input validation on all endpoints

## Future Enhancements

- [ ] Proof of Humanity (Gitcoin Passport) integration
- [ ] Rate limiting per IP/account
- [ ] Analytics dashboard
- [ ] Webhook for transaction events
- [ ] Caching layer (Workers KV) for balance/PKP checks

## Troubleshooting

**Lens auth endpoint timing out:**
- Check Neon DB connection pooling
- Verify PKP check RPC is responsive
- Ensure response time <500ms (Lens requirement)

**Transaction submission failing:**
- Verify admin wallet has GRASS for gas fees
- Check Lens Chain RPC is accessible
- Review transaction logs in Neon DB

**PKP verification failing:**
- Confirm Chronicle Yellowstone RPC is up
- Check PKP NFT contract address is correct
- Verify signedBy address owns a PKP NFT
