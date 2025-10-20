# Artist Profile Generator Service

On-demand artist profile generation service that creates complete artist profiles from Genius artist IDs.

## Overview

This service generates artist profiles automatically by:

1. **Fetching Genius metadata** - Artist name, bio, image, social links
2. **Minting a PKP** - Programmable Key Pair on Lit Protocol (Chronicle Yellowstone)
3. **Creating Lens account** - Decentralized social profile on Lens Protocol (testnet)
4. **Uploading to Grove** - Stores metadata on decentralized Grove storage
5. **Registering on-chain** - Records mapping in ArtistRegistryV2 (Base Sepolia)

This eliminates the need for manual pipeline execution and enables generative artist pages.

## Architecture

```
┌─────────────┐
│  Frontend   │
│  /u/:handle │
└──────┬──────┘
       │ POST /generate-artist-profile
       │ { geniusArtistId: 447 }
       │
       v
┌──────────────────────────────────────┐
│  Artist Profile Generator Service    │
│  (This service)                       │
├──────────────────────────────────────┤
│  1. Fetch Genius API                 │
│  2. Mint PKP (Lit SDK)               │
│  3. Create Lens Account (Lens SDK)   │
│  4. Upload Grove (Storage SDK)       │
│  5. Register Contract (viem)         │
└──────┬───────────────────────────────┘
       │
       v
┌──────────────────────────────────────┐
│  Returns:                             │
│  - pkpAddress                         │
│  - lensHandle                         │
│  - lensAccountAddress                 │
│  - registryTxHash                     │
└───────────────────────────────────────┘
```

## Differences from Webhook Server

| Aspect | Webhook Server | Artist Profile Service |
|--------|---------------|----------------------|
| Purpose | Execute Lit Actions for karaoke processing | Generate artist profiles via SDK calls |
| Auth Pattern | EOA → Auth Context → Lit Action execution | EOA → Direct SDK method calls |
| Main Operations | `litClient.executeJs()` | `litClient.mintWithEoa()`, Lens SDK, viem |
| Triggered By | Modal webhook | Frontend HTTP request |
| Duration | ~20 seconds (Lit Action execution) | ~1-2 minutes (multiple chain operations + indexing) |

**Key insight**: This service does NOT execute Lit Actions. It uses the Lit SDK, Lens SDK, and viem to directly call contract methods and APIs using the master EOA.

## Prerequisites

1. **Chronicle Yellowstone test tokens**
   - Get from: https://chronicle-yellowstone-faucet.getlit.dev/
   - Needed for PKP minting

2. **Base Sepolia ETH**
   - Get from: https://www.alchemy.com/faucets/base-sepolia
   - Needed for contract registration

3. **Environment variables**
   - `PRIVATE_KEY` - Master EOA private key
   - `ARTIST_REGISTRY_ADDRESS` - ArtistRegistryV2 contract address
   - `LENS_APP_ADDRESS` - Lens app address for onboarding

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:

```env
PRIVATE_KEY=0x...
ARTIST_REGISTRY_ADDRESS=0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7
LENS_APP_ADDRESS=0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0
PORT=3000
```

## Development

Start the server in development mode with auto-reload:

```bash
npm run dev
```

Start the server in production mode:

```bash
npm start
```

## Testing

Test the generation endpoint locally:

```bash
# Test with Madonna (Genius ID 26369)
npm test

# Test with specific artist
node test-generate.mjs 16775  # Rihanna
node test-generate.mjs 447    # Lady Gaga
```

## API Endpoints

### GET /

Service info and status

### GET /health

Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-19T...",
  "environment": {
    "PRIVATE_KEY": "✅",
    "ARTIST_REGISTRY_ADDRESS": "✅",
    "LENS_APP_ADDRESS": "✅"
  }
}
```

### POST /generate-artist-profile

Generate a complete artist profile

**Request:**
```json
{
  "geniusArtistId": 26369
}
```

**Response (Success):**
```json
{
  "success": true,
  "geniusArtistId": 26369,
  "artistName": "Madonna",
  "pkpAddress": "0x...",
  "pkpTokenId": "1234567890...",
  "pkpMintTxHash": "0x...",
  "lensHandle": "@madonna",
  "lensAccountAddress": "0x...",
  "lensTxHash": "0x...",
  "registryTxHash": "0x...",
  "source": "GENERATED"
}
```

**Response (Error):**
```json
{
  "error": "Artist not found: Genius ID 99999999",
  "geniusArtistId": 99999999
}
```

## Deployment (Render)

1. Create new Web Service on Render
2. Connect to GitHub repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables:
   - `PRIVATE_KEY`
   - `ARTIST_REGISTRY_ADDRESS`
   - `LENS_APP_ADDRESS`

6. Deploy!

The service will be available at: `https://artist-profile-service.onrender.com`

## Integration with Frontend

```typescript
// app/src/lib/api/generate-artist-profile.ts
export async function generateArtistProfile(geniusArtistId: number) {
  const response = await fetch('https://artist-profile-service.onrender.com/generate-artist-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geniusArtistId })
  });

  if (!response.ok) {
    throw new Error('Profile generation failed');
  }

  return response.json();
}
```

## Monitoring

The service logs each step of the generation process:

```
[Generate] Starting profile generation for Genius artist 26369
[Generate] Using EOA: 0x...
[Generate] Step 1/5: Fetching Genius artist data...
[Generate] ✅ Found artist: Madonna
[Generate] Step 2/5: Minting PKP...
[Generate] ✅ PKP minted: 0x...
[Generate] Step 3/5: Creating Lens account...
[Generate] ✅ Authenticated with Lens
[Generate] ✅ Lens account created, tx: 0x...
[Generate] Step 4/5: Uploading metadata to Grove...
[Generate] ✅ Metadata uploaded: lens://...
[Generate] Step 5/5: Registering in contract...
[Generate] ✅ Registered in contract, tx: 0x...
[Generate] 🎉 Profile generation complete!
```

## Error Handling

The service handles common errors:

- **404**: Artist not found on Genius
- **429**: Genius API rate limit (unlikely with exposed key)
- **500**: Server errors (insufficient funds, network issues, indexing timeouts)

All errors are logged with stack traces for debugging.

## Cost Estimate

Per profile generation:

- PKP minting: ~$0.001 in Chronicle test tokens (free on testnet)
- Lens account: Free on testnet
- Grove upload: Free on testnet
- Contract registration: ~$0.001 in Base Sepolia ETH (free on testnet)

**Total**: Essentially free on testnet, ~$0.01 on mainnet

## Networks

- **Lit Protocol**: Chronicle Yellowstone (testnet)
- **Lens Protocol**: Testnet
- **Grove Storage**: Decentralized (testnet)
- **Contract**: Base Sepolia (testnet)

## License

MIT
