# Avatar Pipeline Documentation

## Overview

The avatar pipeline ensures all TikTok creator profiles display proper avatars by:
1. Downloading avatars from TikTok during scraping
2. Uploading to Grove IPFS storage
3. Storing `grove://` URIs in the database
4. Passing Grove HTTPS URLs to Lens account creation

**Key Principle**: Never reference external TikTok CDN URLs in production. All avatars must be cached in Grove.

---

## Pipeline Flow

```
TikTok Scraper → Download Avatar → Upload to Grove → Store grove://CID → Lens Account Creation
     ↓              ↓                    ↓                  ↓                    ↓
scrape-tiktok   avatar-cache.ts    api.grove.storage   tiktok_creators    Lens metadata
```

---

## Components

### 1. Database Schema

**Table**: `tiktok_creators`

```sql
-- Primary avatar storage (Grove URI)
avatar_url TEXT  -- grove://8c2ca97d123b4fc2e91d2b603afac9a17d4dc5cd...

-- Source tracking (for cache invalidation)
avatar_source_url TEXT  -- https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/...
avatar_uploaded_at TIMESTAMP
```

**Rules**:
- `avatar_url` MUST always be `grove://CID` format
- `avatar_source_url` stores original TikTok URL for cache validation
- `avatar_uploaded_at` tracks when Grove upload occurred

### 2. TikTok Scraper Integration

**File**: `src/tasks/ingestion/scrape-tiktok.ts`

```typescript
// Before storing creator in DB, cache avatar to Grove
const { avatarGroveUri, avatarSourceUrl, avatarUploadedAt } =
  await ensureAvatarCached(profile.username, profile.avatar);

// Store with Grove URI
const creatorSQL = upsertCreatorSQL(profile, {
  avatarSourceUrl,
  avatarUploadedAt
});
```

**Flow**:
1. Scraper extracts `profile.avatar` from TikTok API
2. `ensureAvatarCached()` downloads image and uploads to Grove
3. Returns `grove://CID` which is stored in `tiktok_creators.avatar_url`
4. Original TikTok URL stored in `avatar_source_url` for reference

### 3. Avatar Cache Service

**File**: `src/lib/avatar-cache.ts`

```typescript
export async function ensureAvatarCached(
  username: string,
  tiktokAvatarUrl: string | null
): Promise<{
  avatarGroveUri: string | null;
  avatarSourceUrl: string | null;
  avatarUploadedAt: Date | null;
}>
```

**Features**:
- Normalizes TikTok CDN URLs (removes tokens, timestamps)
- Checks if avatar already cached in Grove
- Downloads image if needed
- Uploads to Grove via `uploadFileToGrove()`
- Returns `grove://CID` for storage

**Cache Logic**:
```typescript
// Check if avatar already uploaded
const existing = await query(`
  SELECT avatar_url, avatar_source_url
  FROM tiktok_creators
  WHERE username = $1
`, [username]);

// Only re-upload if TikTok source URL changed
if (normalizedUrl !== normalizedExisting) {
  // Download and upload new avatar
}
```

### 4. Lens Account Creation

**File**: `src/tasks/identity/create-lens-accounts.ts`

```typescript
// For TikTok creators
const lensData = await lensService.createAccount({
  handle: creator.username,
  name: creator.display_name,
  bio: `TikTok creator @${creator.username} on Karaoke School`,
  pictureUri: groveUriToHttps(creator.avatar_url) || undefined,  // ← Converts grove:// to https://
  attributes,
  pkpAddress: creator.pkp_address,
});

// For artists (Spotify)
const lensData = await lensService.createAccount({
  handle: sanitizedHandle,
  name: artist.name,
  bio: `Official Karaoke School profile for ${artist.name}`,
  pictureUri: groveUriToHttps(artist.image_url) || undefined,  // ← Also works for legacy Grove URLs
  attributes,
  pkpAddress: artist.pkp_address,
});
```

**Key Function**: `groveUriToHttps()`

```typescript
// src/utils/grove.ts
export function groveUriToHttps(uri: string | null): string | null {
  if (!uri) return null;

  // grove://CID → https://api.grove.storage/CID
  if (uri.startsWith('grove://')) {
    return uri.replace('grove://', 'https://api.grove.storage/');
  }

  // Already HTTPS Grove URL (legacy)
  if (uri.startsWith('https://api.grove.storage/')) {
    return uri;
  }

  return null;
}
```

### 5. App Display

**File**: `app/src/pages/CreatorPageContainer.tsx`

```typescript
const avatarUrl = account.metadata?.picture
  ? convertLensImage(account.metadata.picture)  // Handles Lens ImageSet
  : `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.address}`;
```

**File**: `app/src/lib/lens/utils.ts`

```typescript
export function convertLensImage(imageSet: any): string {
  const uri = extractImageSetUri(imageSet);  // Get optimized or raw URI
  return convertGroveUri(uri);  // Convert grove:// or lens:// to HTTPS
}
```

---

## Complete Flow Example

### Scenario: Scraping @idazeile

**Step 1: TikTok Scraper**
```bash
bun src/tasks/ingestion/scrape-tiktok.ts idazeile 1
```

Output:
```
🖼️  Ensuring creator avatar is cached in Grove...
[Storage] Uploading to Grove (temp): tiktok-avatar-idazeile-1762950540639.jpg (69.10 KB)
[Grove] ✓ Upload successful: 8c2ca97d123b4fc2e91d2b603afac9a17d4dc5cd...
   ✓ Uploaded new avatar → grove://8c2ca97d123b4fc2e91d2b603afac9a17d4dc5cd...
```

**Database State**:
```sql
avatar_url: grove://8c2ca97d123b4fc2e91d2b603afac9a17d4dc5cd65ec6578ba97d6b0ea0419ce
avatar_source_url: https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/...
avatar_uploaded_at: 2025-01-12 03:15:40.639
```

**Step 2: Lens Account Creation**
```bash
bun src/tasks/identity/create-lens-accounts.ts --type=tiktok_creator --username=idazeile
```

Internally calls:
```typescript
pictureUri: groveUriToHttps('grove://8c2ca97d...')
// → 'https://api.grove.storage/8c2ca97d...'
```

**Lens Metadata** (stored on Grove):
```json
{
  "$schema": "https://json-schemas.lens.dev/account/1.0.0.json",
  "lens": {
    "name": "Ida Zeile",
    "bio": "TikTok creator @idazeile on Karaoke School",
    "picture": "https://api.grove.storage/8c2ca97d123b4fc2e91d2b603afac9a17d4dc5cd..."
  }
}
```

**Step 3: App Display**

1. App fetches Lens account via `useLensCreator()`
2. `account.metadata.picture` = `"https://api.grove.storage/8c2ca97d..."`
3. `convertLensImage()` processes the URL
4. Avatar displays from Grove IPFS gateway

---

## First-Run Guarantee

✅ **New Lens accounts created after this implementation will have avatars automatically.**

The pipeline is integrated into the standard account creation flow:

1. **TikTok Scraper** → Automatically uploads avatars to Grove during scraping
2. **Lens Account Creation** → Automatically reads `avatar_url` from database and passes Grove HTTPS URL
3. **No manual intervention required**

### Artist Accounts (Spotify)

Artists also get avatars automatically:

```typescript
// src/tasks/identity/create-lens-accounts.ts (line 119)
pictureUri: groveUriToHttps(artist.image_url) || undefined
```

- `artist.image_url` comes from `grc20_artists` table (Spotify images)
- These are already Grove URLs from the GRC-20 minting process
- `groveUriToHttps()` handles conversion to HTTPS gateway URL

---

## Backfill Script (Legacy Accounts)

**Purpose**: Update existing Lens accounts that were created before avatar pipeline.

**File**: `src/scripts/update-lens-account-avatars.ts`

**Usage**:
```bash
# Update all creators with avatars
bun src/scripts/update-lens-account-avatars.ts

# Update specific creator
bun src/scripts/update-lens-account-avatars.ts idazeile
```

**Flow**:
1. Queries `tiktok_creators` with `avatar_url` (Grove URIs)
2. Calls `ensureAvatarCached()` to reuse cached avatar
3. Uses `lensService.updateAccountMetadata()` to update existing account
4. Updates `lens_accounts.lens_metadata_uri` with new metadata URI

**Important**: This script is for **backfilling only**. New accounts get avatars automatically.

---

## Cache Invalidation

Avatars are re-uploaded to Grove if TikTok source URL changes:

```typescript
const normalizedUrl = normalizeTikTokUrl(tiktokAvatarUrl);
const normalizedExisting = normalizeTikTokUrl(existingSourceUrl);

if (normalizedUrl !== normalizedExisting) {
  // TikTok avatar changed - download and re-upload
}
```

**URL Normalization**:
- Removes query parameters (tokens, timestamps, signatures)
- Compares base CDN path only
- Example:
  ```
  https://p16-sign-va.tiktokcdn.com/.../avatar.jpeg?token=abc&expires=123
  → https://p16-sign-va.tiktokcdn.com/.../avatar.jpeg
  ```

---

## Troubleshooting

### Avatar not displaying in app

**Check 1: Database has Grove URI**
```sql
SELECT avatar_url FROM tiktok_creators WHERE username = 'idazeile';
-- Should return: grove://8c2ca97d...
```

**Check 2: Lens metadata has HTTPS URL**
```bash
# Get metadata URI from database
SELECT lens_metadata_uri FROM lens_accounts WHERE tiktok_handle = 'idazeile';

# Fetch metadata
curl https://api.grove.storage/<metadata-hash>
# Should have: "picture": "https://api.grove.storage/8c2ca97d..."
```

**Check 3: App is fetching correct metadata**
- Open browser console
- Look for `[CreatorPage] DEBUG - Lens account.metadata.picture:`
- Should show Grove HTTPS URL, not TikTok CDN URL

### Avatar is Dicebear placeholder

- Lens API may be caching old metadata
- Wait 1-2 minutes for indexer to pick up new metadata
- Hard refresh app (Ctrl+Shift+R)

### Avatar upload failed during scraping

```
❌ Grove upload failed: [error message]
```

- Check `GROVE_API_KEY` in `.env`
- Verify network connectivity to `https://api.grove.storage`
- Check TikTok avatar URL is accessible
- Re-run scraper to retry upload

---

## API Reference

### `ensureAvatarCached(username, tiktokAvatarUrl)`

**Returns**:
```typescript
{
  avatarGroveUri: string | null;      // grove://CID or null
  avatarSourceUrl: string | null;     // Original TikTok URL
  avatarUploadedAt: Date | null;      // Upload timestamp
}
```

**Behavior**:
- Returns cached avatar if exists and source unchanged
- Downloads and uploads new avatar if source changed
- Returns `null` values if no avatar URL provided

### `groveUriToHttps(uri)`

**Converts**:
- `grove://CID` → `https://api.grove.storage/CID`
- `https://api.grove.storage/CID` → unchanged (pass-through)
- `null` → `null`
- Other URLs → `null` (filters out non-Grove URLs)

### `convertLensImage(imageSet)`

**Handles**:
- Lens ImageSet objects: `{ optimized: { uri }, raw: { uri } }`
- Direct URI strings (backwards compatibility)
- Converts `lens://` and `grove://` to HTTPS

---

## Testing Checklist

✅ **New TikTok Creator Account**
1. Run: `bun src/tasks/ingestion/scrape-tiktok.ts <username> 1`
2. Verify: `avatar_url` is `grove://` in database
3. Run: `bun src/tasks/identity/create-lens-accounts.ts --type=tiktok_creator --username=<username>`
4. Verify: Lens metadata has `https://api.grove.storage/...` picture
5. Check: App displays avatar correctly

✅ **New Artist Account**
1. Ensure artist has `image_url` in `grc20_artists` table
2. Run: `bun src/tasks/identity/create-lens-accounts.ts --type=artist --limit=1`
3. Verify: Lens metadata has Grove HTTPS picture URL
4. Check: App displays avatar correctly

✅ **Backfill Existing Account**
1. Run: `bun src/scripts/update-lens-account-avatars.ts <username>`
2. Verify: `lens_accounts.lens_metadata_uri` updated
3. Check: New metadata has correct picture URL
4. Wait 1-2 min for Lens indexer
5. Check: App displays avatar correctly

---

## Key Takeaways

1. **Always use Grove**: Never reference TikTok CDN URLs in production
2. **Scraper handles uploads**: Avatar caching happens automatically during scraping
3. **First-run works**: New Lens accounts get avatars with no manual intervention
4. **Backfill is optional**: Only needed for accounts created before this pipeline
5. **grove:// in DB, https:// in Lens**: Database stores URIs, Lens gets gateway URLs
6. **Cache is smart**: Only re-uploads if TikTok source URL changes
7. **App handles both**: `convertLensImage()` works with ImageSet and direct URLs
