# Genius API Lit Actions (Free Tier)

**No Authentication Required** - Uses exposed Genius API key for public operations.

## Actions

### `search.js`
Search for songs on Genius by query string.

**Params:**
- `query` (required) - Search query string
- `limit` (optional) - Results limit (default 10, max 20)
- `userAddress` (optional) - Wallet address for analytics
- Analytics params - Optional DB credentials for usage tracking

**Returns:**
```json
{
  "success": true,
  "results": [
    {
      "genius_id": 378195,
      "title": "Chandelier",
      "artist": "Sia",
      "artwork_thumbnail": "https://...",
      "url": "https://genius.com/..."
    }
  ],
  "count": 10
}
```

### `song.js`
Fetch complete song metadata by Genius ID.

**Params:**
- `songId` (required) - Genius song ID
- `userAddress` (optional) - Wallet address for analytics
- Analytics params - Optional DB credentials

**Returns:**
```json
{
  "success": true,
  "song": {
    "id": 378195,
    "title": "Chandelier",
    "artist": "Sia",
    "song_art_image_url": "https://...",
    "youtube_url": "https://...",
    "media": [...]
  }
}
```

### `referents.js`
Fetch lyric annotations (referents) for a song.

**Params:**
- `songId` (required) - Genius song ID
- `page` (optional) - Page number (default 1)
- `perPage` (optional) - Results per page (default 20, max 50)

**Returns:**
```json
{
  "success": true,
  "referents": [
    {
      "fragment": "I'm gonna swing from the chandelier",
      "annotations": [...]
    }
  ]
}
```

## API Key

All actions use the same exposed Genius API key:
```javascript
const geniusApiKey = 'z0-uHScJhlvY7rB_HwThSEZhjpmSzlWMnBhaby3tPtqJpfOeQwZ1cc5OG1bdegV7';
```

**Security Note:** This is intentionally exposed for free-tier public access. Rate limits apply.

## Deployment

No encryption or PKP permissions needed. Simply upload to IPFS:

```bash
DOTENV_PRIVATE_KEY='...' npx dotenvx run -- \
  node scripts/upload-lit-action.mjs \
  src/genius/search.js \
  "Genius Search - Free Tier"
```

## Analytics

Optional analytics tracking to ks_web_1 schema. Requires encrypted DB credentials passed as params:
- `dbUrlCiphertext`, `dbUrlDataToEncryptHash`, `dbUrlAccessControlConditions`
- `dbTokenCiphertext`, `dbTokenDataToEncryptHash`, `dbTokenAccessControlConditions`

If not provided, actions work without analytics.
