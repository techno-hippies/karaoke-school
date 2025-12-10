# Lit Sponsorship API

Vercel serverless API for sponsored PKP minting. The relayer wallet pays gas on Chronicle chain, so users can create PKPs without holding tstLPX tokens.

## How It Works

1. User connects wallet (Metamask, Rabby, Farcaster)
2. Frontend calls `/api/mint-user-pkp` with user's address
3. Relayer mints PKP and adds user's EOA as auth method
4. User can now authenticate with their PKP using their EOA

## Endpoints

### POST /api/mint-user-pkp

Mint a PKP for a user (or return existing one).

**Request:**
```json
{
  "userAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "existing": false,
  "pkpTokenId": "123...",
  "pkpPublicKey": "0x04...",
  "pkpEthAddress": "0x..."
}
```

## Setup

1. Install dependencies:
   ```bash
   cd lit-sponsorship-api
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```

3. Fund relayer wallet:
   - Get tstLPX from [Chronicle Yellowstone Faucet](https://chronicle-yellowstone-faucet.getlit.dev/)
   - Add private key to `LIT_RELAYER_PRIVATE_KEY`

4. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LIT_RELAYER_PRIVATE_KEY` | Relayer wallet private key (funded with tstLPX) |
| `LIT_NETWORK` | `naga-dev` or `naga-test` |
| `API_KEY` | Optional API key for rate limiting |

## Security Notes

- The relayer owns the PKP NFT, but the user is the auth method
- Users can authenticate and sign with their PKP using their EOA
- Consider adding rate limiting and API key validation for production
