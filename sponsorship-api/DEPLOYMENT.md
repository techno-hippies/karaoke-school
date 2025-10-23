# Sponsorship API Deployment Summary

## ✅ Deployment Complete

The Karaoke School Sponsorship API has been successfully deployed to Cloudflare Workers!

### 🌐 Production URL
```
https://karaoke-school-sponsorship-api.deletion-backup782.workers.dev
```

### 📊 Deployment Details

- **Platform**: Cloudflare Workers
- **Bundle Size**: 201.21 KiB (gzipped)
- **Worker Startup Time**: 22ms
- **Version ID**: 70dbd663-0a57-499a-b248-134830a70d0f
- **Deployment Date**: 2025-10-23

### 🔐 Configured Secrets

- ✅ `DATABASE_URL` - Neon PostgreSQL connection string
- ✅ `PRIVATE_KEY` - Funded admin wallet for transaction submission
- ✅ `LENS_AUTH_BEARER_TOKEN` - Bearer token for Lens API authentication

### 🌍 Environment Variables

- `LENS_APP_ADDRESS`: 0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0
- `LENS_CUSTOM_NAMESPACE`: 0xA5882f62feDC936276ef2e7166723A04Ee12501B
- `LENS_CHAIN_ID`: 37111
- `LENS_RPC_URL`: https://rpc.testnet.lens.xyz
- `MAX_SPONSORED_TXS`: 10
- `MIN_BALANCE_WEI`: 10000000000000000 (0.01 GRASS)

### 🔗 API Endpoints

#### 1. Health Check
```bash
GET https://karaoke-school-sponsorship-api.deletion-backup782.workers.dev/
```

Response:
```json
{
  "name": "Karaoke School Sponsorship API",
  "status": "healthy",
  "version": "1.0.0"
}
```

#### 2. Lens Authorization Endpoint
```bash
POST https://karaoke-school-sponsorship-api.deletion-backup782.workers.dev/api/lens-auth
Authorization: Bearer ddbdb4ae7abbd5673daa140e83b15b6acef510464a2c44031f18623053b1cb5f
Content-Type: application/json

{
  "account": "0x...",
  "signedBy": "0x..."
}
```

#### 3. Transaction Submission Endpoint
```bash
POST https://karaoke-school-sponsorship-api.deletion-backup782.workers.dev/api/submit-tx
Content-Type: application/json

{
  "account": "0x...",
  "operation": "username",
  "raw": { ... }
}
```

## 📝 Next Steps

### 1. Register with Lens Dashboard

Go to the Lens Developer Dashboard and configure your app:

1. Navigate to: https://dashboard.lens.xyz
2. Find your app: `0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0`
3. Add authorization endpoint:
   ```
   https://karaoke-school-sponsorship-api.deletion-backup782.workers.dev/api/lens-auth
   ```
4. Add bearer token:
   ```
   ddbdb4ae7abbd5673daa140e83b15b6acef510464a2c44031f18623053b1cb5f
   ```

### 2. Test the Integration

1. Restart your frontend app to pick up the new env var
2. Try creating a Lens account with username
3. Monitor logs:
   ```bash
   wrangler tail
   ```

### 3. Monitor Performance

View analytics in Cloudflare Dashboard:
- https://dash.cloudflare.com/
- Select "Workers & Pages"
- Click "karaoke-school-sponsorship-api"

## 🗄️ Database

**Provider**: Neon PostgreSQL
**Project**: KS1 (plain-wave-99802895)
**Database**: neondb
**Region**: ap-southeast-1 (Singapore)

### Tables Created

- `user_sponsorships`: Tracks quota and PKP verification
- `transaction_log`: Audit log of all transactions

## 💰 Cost Breakdown

- **Cloudflare Workers**: $0/month (free tier: 100k req/day)
- **Neon DB**: $0/month (free tier: 0.5GB storage, 191 hrs/month)
- **Total**: **$0/month** 🎉

## 🔧 Maintenance

### Update Secrets
```bash
echo "new_value" | wrangler secret put SECRET_NAME --env=""
```

### Redeploy
```bash
cd sponsorship-api
wrangler deploy --env=""
```

### View Logs
```bash
wrangler tail
```

### Local Development
```bash
cd sponsorship-api
npm run dev
# API runs at http://localhost:8787
```

## 🐛 Troubleshooting

### API not responding
- Check Cloudflare status: https://www.cloudflarestatus.com/
- View logs: `wrangler tail`
- Verify secrets are set: `wrangler secret list`

### Database connection issues
- Check Neon status: https://neon.tech/status
- Verify DATABASE_URL secret is correct
- Test connection: Query DB directly via Neon console

### Frontend can't reach API
- Check CORS configuration in src/index.ts
- Verify VITE_SPONSORSHIP_API_URL in frontend .env.local
- Hard refresh browser (Ctrl+Shift+R)

## 📚 Architecture

```
Frontend (IPFS/Fleek)
  ↓ fetch (CORS)
API (Cloudflare Workers)
  ↓ SQL queries
Database (Neon PostgreSQL)
  ↓ RPC calls
Lens Chain (testnet)
```

### Authorization Flow

**Frontend Users (PKP-based)**:
1. User creates Lens account with PKP
2. PKP signs transactions
3. API verifies PKP ownership via Chronicle Yellowstone
4. Sponsorship granted if quota available or balance sufficient

**Backend Pipeline (Whitelisted)**:
1. Master pipeline uses admin EOA wallet (`0x0C6433789d14050aF47198B2751f6689731Ca79C`)
2. Wallet is whitelisted in `src/routes/lens-auth.ts`
3. Bypasses PKP verification (backend pays own gas)
4. Creates Lens accounts for TikTok creators with PKP metadata

## 🎯 Features Implemented

- ✅ PKP verification (Lit Protocol integration)
- ✅ Backend wallet whitelist (allows master pipeline operations)
- ✅ Sponsorship quota management (10 free txs)
- ✅ Balance checking (require 0.01 GRASS after quota)
- ✅ Transaction submission proxy
- ✅ Lens authorization endpoint
- ✅ Database logging and analytics
- ✅ CORS support for frontend
- ✅ Bearer token authentication
- ✅ Error handling and logging

## 🚀 Future Enhancements

- [ ] Proof of Humanity (Gitcoin Passport) integration
- [ ] Rate limiting per IP/account
- [ ] Analytics dashboard
- [ ] Webhook notifications
- [ ] Workers KV caching layer
- [ ] Custom domain (api.karaoke-school.xyz)

---

**Deployment Complete! 🎉**

The API is now live and ready to sponsor user transactions. Test it by creating a new Lens account in your frontend app.
