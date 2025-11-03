# Lens Handle Collision Handling

## Overview

When minting PKPs and creating Lens accounts for artists, handle collisions may occur on the Lens testnet. This document explains how the system handles these scenarios.

## Handle Generation

Handles are generated from artist names using the `sanitizeHandle()` function:

```typescript
sanitizeHandle("Ariana Grande") → "ariana-grande"
sanitizeHandle("50 Cent") → "50-cent"
sanitizeHandle("Macklemore & Ryan Lewis") → "macklemore-ryan-lewis"
```

**Rules:**
- Lowercase only
- Alphanumeric + dashes
- Max 30 characters
- No leading/trailing dashes

## Collision Detection

Before creating a Lens account, the system checks if the handle is available using `isHandleAvailable()`:

1. Login to Lens Protocol
2. Try to fetch account with `fetchAccount()`
3. If account exists → handle is **taken**
4. If account doesn't exist → handle is **available**

## Automatic Retry Logic

If a handle collision is detected, `findAvailableHandle()` automatically tries variations with **Karaoke School branding** (`-ks`):

### Example: "ariana-grande" is taken

```
Attempt 0: ariana-grande       → ❌ Taken
Attempt 1: ariana-grande-ks    → ✅ Available (use this!)
```

### Example: Multiple collisions

```
Attempt 0: taylor-swift        → ❌ Taken
Attempt 1: taylor-swift-ks     → ❌ Taken
Attempt 2: taylor-swift-ks-2   → ❌ Taken
Attempt 3: taylor-swift-ks-3   → ✅ Available (use this!)
```

### Suffix Strategy

1. **First attempt:** Base handle (e.g., `ariana-grande`)
2. **First fallback:** Add `-ks` for Karaoke School branding (e.g., `ariana-grande-ks`)
3. **Additional fallbacks:** Add numeric suffixes (e.g., `ariana-grande-ks-2`, `ariana-grande-ks-3`, etc.)

This ensures all Karaoke School accounts have consistent branding!

### Length Handling

Handles are truncated to ensure suffix fits within 30 chars:

```
Base: "the-notorious-big-wallace"  (25 chars)
Suffix: "-ks"  (3 chars)
Total: 25 + 3 = 28 ✅

Base: "the-notorious-big-wallace-jr"  (29 chars)
Suffix: "-ks"  (3 chars)
Truncate: "the-notorious-big-wallace"  (27 chars)
Final: "the-notorious-big-wallace-ks"  (30 chars) ✅

For numeric suffixes:
Base: "the-notorious-big-wallace"  (25 chars)
Suffix: "-ks-10"  (6 chars)
Total: 25 + 6 = 31 → Truncate base to 24 chars
Final: "the-notorious-big-walla-ks-10"  (30 chars) ✅
```

## Configuration

**Max Attempts:** 10 (default)

After 10 failed attempts, the system throws an error:
```
Could not find available handle after 10 attempts (base: ariana-grande)
```

You can adjust this in `lens-protocol.ts`:
```typescript
export async function findAvailableHandle(
  baseHandle: string,
  maxAttempts = 10  // ← Change here
): Promise<string>
```

## Database Storage

The **actual** handle used (after collision resolution) is stored in `lens_accounts.lens_handle`:

```sql
-- Example: "ariana-grande" was taken, so "ariana-grande-ks" was used
SELECT lens_handle FROM lens_accounts WHERE spotify_artist_id = '66CXWjxzNUsdJxJ2JdwvnR';
-- Returns: "ariana-grande-ks"
```

## Logging

The system logs each collision attempt:

```
📍 Ariana Grande (66CXWjxzNUsdJxJ2JdwvnR)
   🏷️  Handle: @ariana-grande
   🔍 Checking handle availability: ariana-grande
   ⚠️  Handle taken: ariana-grande
   🔍 Checking handle availability: ariana-grande-ks
   ✅ Handle available: ariana-grande-ks
   ⚠️  Using alternate handle: ariana-grande-ks (requested: ariana-grande)
   ⏳ Creating Lens account...
   ✅ Lens account created: @ariana-grande-ks
```

## Error Scenarios

### Scenario 1: Handle available on first try
```
✅ Success - uses requested handle
```

### Scenario 2: Handle taken, variation available
```
✅ Success - uses variation (e.g., "handle-ks" or "handle-ks-2")
```

### Scenario 3: All variations taken (1-10)
```
❌ Error: "Could not find available handle after 10 attempts"
→ Manual intervention required
→ Options:
   1. Increase maxAttempts
   2. Use a different base handle
   3. Clear testnet data
```

### Scenario 4: Lens API failure
```
❌ Error: "Lens login failed: [reason]"
→ Check network connection
→ Verify PRIVATE_KEY is valid
→ Check Lens testnet status
```

## Best Practices

### 1. Run in batches
```bash
# Process 20 artists at a time
bun src/processors/mint-artist-pkps.ts --limit=20
bun src/processors/create-artist-lens.ts --limit=20
```

### 2. Monitor logs
Watch for collision warnings to identify common collisions.

### 3. Handle errors gracefully
The processor continues on failure - check logs for failed artists.

### 4. Re-run safely
Both processors check for existing PKPs/Lens accounts:
```sql
WHERE pkp.pkp_address IS NULL  -- Skip artists with PKPs
WHERE lens.lens_handle IS NULL  -- Skip artists with Lens accounts
```

## Common Collisions on Testnet

These artists may have collisions if the testnet has been used before:

- Popular artists (Ariana Grande, Taylor Swift, etc.)
- Common names (Michael Jackson, David Jones, etc.)
- Generic handles (artist, musician, singer, etc.)

**Solution:** The automatic retry logic handles these transparently!

## Querying Final Handles

To see which artists got alternate handles:

```sql
-- Check for alternate handles (with -ks suffix)
SELECT
  ga.name,
  ga.spotify_artist_id,
  lens.lens_handle,
  CASE
    WHEN lens.lens_handle ~ '-ks(-[0-9]+)?$' THEN 'Karaoke School (Alternate)'
    ELSE 'Original'
  END as handle_type
FROM grc20_artists_with_accounts ga
WHERE lens.lens_handle IS NOT NULL
ORDER BY handle_type, lens.lens_handle;
```

## Architecture

```
create-artist-lens.ts
  ↓ calls
sanitizeHandle("Ariana Grande")
  ↓ returns "ariana-grande"
  ↓ calls
findAvailableHandle("ariana-grande")
  ↓ checks
isHandleAvailable("ariana-grande") → false (taken)
isHandleAvailable("ariana-grande-ks") → true (available!)
  ↓ returns "ariana-grande-ks"
  ↓ calls
createLensAccount({ handle: "ariana-grande-ks", ... })
  ↓ stores
lens_accounts.lens_handle = "ariana-grande-ks"
```

## Testing Handle Collisions

You can test collision handling manually:

```typescript
import { findAvailableHandle } from './src/lib/lens-protocol';

// Force collision testing
const handle = await findAvailableHandle('test-artist');
console.log(`Available handle: ${handle}`);

// If 'test-artist' is taken on testnet, it will try:
// test-artist → test-artist-ks → test-artist-ks-2 → test-artist-ks-3 → etc.
```

---

**Summary:** The system automatically handles handle collisions by appending `-ks` (Karaoke School branding) or `-ks-N` if needed. All alternate handles will have consistent Karaoke School branding. You don't need to do anything - just run the processors and check the logs!
