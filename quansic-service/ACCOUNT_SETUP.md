# Quansic Account Setup Guide

## Quick Start

**You need 3-5 Quansic accounts for production use.**

## Step 1: Create Accounts

1. Go to https://explorer.quansic.com/app-register
2. Fill out the form (any info works):
   - Email: Use a real email you can access (for verification if needed)
   - Password: Must be 8+ chars, have 1 digit, 1 uppercase letter
   - Name: Any name
   - Company: Any company name
   - Check terms & conditions
   - Click Register

3. **Repeat 3-5 times** to create multiple accounts

## Step 2: Test Each Account

After creating, test login:
```bash
# Visit login page
https://explorer.quansic.com/app-login

# Enter credentials and verify login works
```

## Step 3: Add to Deployment

Update `deploy-akash.yaml`:

```yaml
env:
  # Account 1
  - QUANSIC_EMAIL=your-email-1@domain.com
  - QUANSIC_PASSWORD=YourPassword1!

  # Account 2
  - QUANSIC_EMAIL_2=your-email-2@domain.com
  - QUANSIC_PASSWORD_2=YourPassword2!

  # Account 3
  - QUANSIC_EMAIL_3=your-email-3@domain.com
  - QUANSIC_PASSWORD_3=YourPassword3!
```

## Rotation Settings

Adjust rotation behavior (optional):

```yaml
env:
  # Rotate after 50 requests per account (default)
  - REQUESTS_PER_ACCOUNT=50

  # Or rotate after 30 minutes (default)
  - ROTATION_INTERVAL_MS=1800000  # 30 min in milliseconds
```

**Recommendation:**
- Start with defaults (50 requests or 30 minutes)
- Monitor `/account-pool` endpoint
- Adjust if you see accounts getting rate limited

## Monitoring

Check account pool status:
```bash
curl https://your-service/account-pool
```

Response shows:
```json
{
  "current_index": 0,
  "total_accounts": 3,
  "rotation_threshold": 50,
  "accounts": [
    {
      "email": "account1@example.com",
      "status": "active",
      "request_count": 12,
      "requests_until_rotation": 38,
      "is_current": true
    },
    {
      "email": "account2@example.com",
      "status": "active",
      "request_count": 0,
      "requests_until_rotation": 50,
      "is_current": false
    }
  ]
}
```

## Troubleshooting

**Account gets rate limited:**
- Lower `REQUESTS_PER_ACCOUNT` (try 25 or 30)
- Add more accounts to the pool

**All accounts failing:**
- Check credentials are correct
- Verify accounts work via web login
- Service auto-resets failed accounts after cooldown

**Want to add more accounts:**
- Just add `QUANSIC_EMAIL_4`, `QUANSIC_PASSWORD_4`, etc.
- No code changes needed
- Service detects them automatically
