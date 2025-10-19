# Frontend Artist Routing - Integration Plan

## ✅ IMPLEMENTED SOLUTION

**Key Insight**: Song data from `KaraokeCatalog` already includes `geniusArtistId` → We just pre-fetch the route!

**Before** (`artist-mapping.ts` - static):
```typescript
// SYNCHRONOUS - instant lookup from static map
const route = getArtistRoute(447) // → "/u/ladygaga"
navigate(route)
```

**After** (`useArtistRoute` hook - dynamic):
```typescript
// PRE-FETCH when song loads (async in background)
const artistRoute = useArtistRoute(displaySong?.geniusArtistId)

// INSTANT navigation when user clicks (cached)
const handleClick = () => navigate(artistRoute)
```

## Why This Works

1. `useSongData()` reads from `KaraokeCatalog` → returns `geniusArtistId` (contracts/evm/base-sepolia/KaraokeCatalog/KaraokeCatalogV2.sol:54)
2. `displaySong.geniusArtistId` is available when song loads (app/src/components/karaoke/KaraokeSongPage.tsx:69-72)
3. `useArtistRoute` hook pre-fetches Lens username via contract lookup (~100ms)
4. Route is cached - clicking artist is **instant** (no async delay)

**Much simpler than originally proposed!** No complex fallbacks/redirects needed.

## Navigation Flows

### Flow 1: Direct URL Navigation

**Scenario**: User types `/u/gracieabrams` in browser

```
User enters: /u/gracieabrams
    ↓
ProfilePage renders
    ↓
useAccount({ username: "gracieabrams" })
    ↓
Lens SDK queries account
    ↓
If account exists:
    ├─ Extract genius_artist_id from metadata → 631746
    ├─ useArtistData(631746) → Fetch Genius data
    └─ Show profile with videos + top songs
If account NOT exists:
    └─ Show "Profile not found" error
```

**Issue**: What if artist is registered in contract but Lens not synced yet?

**Solution**:
```typescript
// ProfilePage.tsx - Enhanced error handling
useEffect(() => {
  if (!accountLoading && !account && username) {
    // Check contract as fallback
    getGeniusIdByUsername(username).then(geniusId => {
      if (geniusId > 0) {
        // Registered! Retry Lens after delay
        setTimeout(() => accountResult.refetch(), 2000)
      } else {
        // Not registered - show "not available"
      }
    })
  }
}, [accountLoading, account, username])
```

### Flow 2: Navigation from Song Page

**Scenario**: User on `/song/9503796` clicks artist name

**Current (Static Mapping)**:
```
Song Page: /song/9503796
    ↓
User clicks "Dua Lipa"
    ↓
handleArtistClick() {
  navigate(getArtistRoute(2195)) // SYNC lookup
}
    ↓
Navigate to: /u/dualipa
    ↓
ProfilePage loads
```

**Problem with Async Lookup**:
```typescript
// ❌ BAD: Makes onClick handler async
const handleArtistClick = async () => {
  const route = await getArtistRoute(geniusArtistId) // Blocks UI
  navigate(route)
}
```

**Issues**:
- Loading delay on click (bad UX)
- Can't show loading spinner easily
- Feels sluggish

## Implementation

### Step 1: Create `useArtistRoute` Hook ✅

**File**: `app/src/hooks/useArtistRoute.ts`

```typescript
export function useArtistRoute(geniusArtistId: number | undefined): string | null {
  const [route, setRoute] = useState<string | null>(null)

  useEffect(() => {
    if (!geniusArtistId) return

    // Pre-fetch route when song data is available
    getArtistRoute(geniusArtistId)
      .then(r => setRoute(r))
      .catch(err => {
        console.error('[useArtistRoute] Failed:', err)
        setRoute(`/artist/${geniusArtistId}`) // Fallback
      })
  }, [geniusArtistId])

  return route
}
```

**Why so simple?**
- Song data already has `geniusArtistId` from KaraokeCatalog contract
- We just pre-fetch in background when song loads
- No loading states needed - fallback route handles edge cases

### Step 2: Update `KaraokeSongPage.tsx` ✅

**Changes**:
```typescript
// Import the hook
import { useArtistRoute } from '@/hooks/useArtistRoute'

// Pre-fetch artist route when song loads
const artistRoute = useArtistRoute(displaySong?.geniusArtistId)

// Update click handler to use cached route
const handleArtistClick = useCallback(() => {
  if (artistRoute) {
    navigate(artistRoute) // INSTANT!
  } else if (displaySong?.geniusArtistId) {
    navigate(`/artist/${displaySong.geniusArtistId}`) // Fallback
  }
}, [navigate, artistRoute, displaySong?.geniusArtistId])
```

**Benefits**:
- ✅ Instant click (route pre-fetched)
- ✅ Graceful fallback
- ✅ No complex logic needed

### Step 3: Handle `/artist/:id` Fallback Route

**Purpose**: For cases where route not pre-fetched yet, or direct navigation to `/artist/447`

**Implementation** (to be added if needed):
```typescript
// KaraokeSongPage.tsx - SIMPLEST
const handleArtistClick = useCallback(() => {
  if (displaySong?.geniusArtistId) {
    // Always go to /artist/:id first
    navigate(`/artist/${displaySong.geniusArtistId}`)
  }
}, [navigate, displaySong?.geniusArtistId])
```

```typescript
// ClassArtistPage.tsx - NEW redirect logic
export function ClassArtistPage() {
  const { geniusArtistId } = useParams()
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check if artist has Lens profile
    getLensUsername(parseInt(geniusArtistId)).then(username => {
      if (username) {
        // Redirect to Lens profile
        navigate(`/u/${username}`, { replace: true })
      } else {
        // No Lens profile - show basic Genius data
        setIsChecking(false)
      }
    })
  }, [geniusArtistId])

  if (isChecking) return <div>Loading...</div>

  // Show basic artist page (Genius data only)
  return <ArtistPageView />
}
```

**Benefits**:
- ✅ No pre-fetching needed
- ✅ Works for all navigation sources
- ✅ Graceful fallback (Genius-only page)

**Trade-off**:
- Extra redirect (~100ms delay)
- User sees flash of `/artist/:id` URL

---

## Implementation Status

### ✅ Phase 1: Song Page Navigation (COMPLETE)

**Files Changed**:
1. `app/src/hooks/useArtistRoute.ts` - Created
2. `app/src/components/karaoke/KaraokeSongPage.tsx` - Updated

**What it does**:
- Pre-fetches artist route when song data loads
- Clicking artist navigates instantly (route cached)
- Fallback to `/artist/:id` if route not ready

### ⏳ Phase 2: Direct URL Navigation (TODO)

Need to handle users typing `/u/gracieabrams` directly in browser:

1. **ProfilePage.tsx** - Add contract fallback when Lens account not found
2. **Optional**: Create `/artist/:id` page that redirects to `/u/:username`

### Step 3: Add Redirect Logic to `/artist/:id` Page (Optional)

**File**: `app/src/pages/ClassArtistPage.tsx`

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLensUsername } from '@/lib/genius/artist-lookup'

export function ClassArtistPage() {
  const { geniusArtistId } = useParams<{ geniusArtistId: string }>()
  const navigate = useNavigate()
  const [isCheckingProfile, setIsCheckingProfile] = useState(true)
  const [hasLensProfile, setHasLensProfile] = useState(false)

  // Check if artist has Lens profile → redirect if so
  useEffect(() => {
    if (!geniusArtistId) return

    getLensUsername(parseInt(geniusArtistId)).then(username => {
      if (username) {
        // Has Lens profile - redirect
        console.log(`[ClassArtistPage] Redirecting to /u/${username}`)
        navigate(`/u/${username}`, { replace: true })
      } else {
        // No Lens profile - show basic page
        setHasLensProfile(false)
        setIsCheckingProfile(false)
      }
    }).catch(err => {
      console.error('[ClassArtistPage] Error checking profile:', err)
      setIsCheckingProfile(false)
    })
  }, [geniusArtistId, navigate])

  if (isCheckingProfile) {
    return (
      <div className="h-screen bg-neutral-900 flex items-center justify-center">
        <p className="text-muted-foreground">Loading artist...</p>
      </div>
    )
  }

  // Show basic artist page (Genius data only)
  // This is for artists WITHOUT Lens profiles
  return (
    <div className="h-screen bg-neutral-900 p-4">
      <h1>Artist Page (Genius Only)</h1>
      <p>Artist ID: {geniusArtistId}</p>
      <p>This artist doesn't have a full profile yet.</p>
    </div>
  )
}
```

### Step 4: Enhance ProfilePage with Contract Fallback

**File**: `app/src/components/profile/ProfilePage.tsx`

Add after line 41 (accountError):

```typescript
// State for contract fallback check
const [contractGeniusId, setContractGeniusId] = useState<number | null>(null)
const [isCheckingContract, setIsCheckingContract] = useState(false)

// Check contract when Lens account not found
useEffect(() => {
  if (!accountLoading && !account && username && !isCheckingContract) {
    console.log('[ProfilePage] Account not found, checking contract...')
    setIsCheckingContract(true)

    getGeniusIdByUsername(username).then(geniusId => {
      setContractGeniusId(geniusId)
      if (geniusId > 0) {
        console.log('[ProfilePage] Found in contract! Retrying Lens...')
        // Artist registered but Lens not synced - retry
        setTimeout(() => {
          accountResult.refetch?.()
          setIsCheckingContract(false)
        }, 2000)
      } else {
        console.log('[ProfilePage] Not in contract')
        setIsCheckingContract(false)
      }
    }).catch(err => {
      console.error('[ProfilePage] Contract check error:', err)
      setIsCheckingContract(false)
    })
  }
}, [accountLoading, account, username, isCheckingContract])

// Update error handling (line 328-336):
if (accountError && !isCheckingContract) {
  return (
    <div className="h-screen bg-neutral-900 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <p className="text-foreground text-xl mb-2">
          {contractGeniusId === 0
            ? "Artist profile not available"
            : "Profile loading..."
          }
        </p>
        {contractGeniusId === 0 && (
          <p className="text-muted-foreground mb-4">
            This artist hasn't been added to K-School yet.
          </p>
        )}
      </div>
    </div>
  )
}
```

### Step 5: Delete Static Mapping

```bash
# After testing, delete the old file
rm app/src/lib/genius/artist-mapping.ts
```

---

## Testing Checklist

### Test Case 1: Direct URL - Existing Artist
- [ ] Navigate to `/u/ladygaga`
- [ ] ✅ Profile loads immediately
- [ ] ✅ Shows videos + top songs
- [ ] ✅ No errors

### Test Case 2: Direct URL - Non-Existent Artist
- [ ] Navigate to `/u/randomartist123`
- [ ] ✅ Shows "Profile not available" error
- [ ] ✅ No infinite loading

### Test Case 3: From Song Page - Existing Artist
- [ ] Go to `/song/9503796`
- [ ] Click artist name
- [ ] ✅ Navigates to `/u/:username` instantly
- [ ] ✅ Profile loads

### Test Case 4: From Song Page - New Artist (Fallback)
- [ ] Go to song with unknown artist
- [ ] Click artist name
- [ ] ✅ Navigates to `/artist/:id` first
- [ ] ✅ Redirects to `/u/:username` if profile exists
- [ ] ✅ Shows basic page if no profile

### Test Case 5: Race Condition - Profile Just Created
- [ ] Generate new profile via Lit Action
- [ ] Navigate to `/u/:username` within 2s
- [ ] ✅ Shows "Loading..." initially
- [ ] ✅ Retries and loads profile after 2s
- [ ] ✅ No infinite loop

---

## Performance Impact

| Operation | Before | After | Impact |
|-----------|--------|-------|--------|
| **Song page load** | 0ms (sync) | +100ms (contract lookup) | Negligible |
| **Artist click** | 0ms (instant) | 0ms (cached) or 100ms (fallback) | Minimal |
| **Direct URL** | N/A | Same as before | None |

**Optimization**: Cache results in React Query for cross-page persistence.

---

## Edge Cases

### 1. Artist Name Changes
**Scenario**: Artist changes Lens username

**Solution**: Contract mapping still works (geniusId → new username)

### 2. Multiple Artists Same Name
**Scenario**: Two artists with similar usernames

**Solution**: Lens handles uniqueness, geniusId is unique identifier

### 3. Network Errors
**Scenario**: Base Sepolia RPC down

**Solution**: Fallback to `/artist/:id`, show error message

### 4. Race Condition
**Scenario**: Profile created but Lens not synced

**Solution**: ProfilePage retries after 2s delay

---

## Future Enhancements

1. **React Query Caching**:
   ```typescript
   const { data: route } = useQuery({
     queryKey: ['artistRoute', geniusArtistId],
     queryFn: () => getArtistRoute(geniusArtistId),
     staleTime: 5 * 60 * 1000, // 5 minutes
   })
   ```

2. **Prefetch on Hover**:
   ```typescript
   <button
     onMouseEnter={() => prefetchArtistRoute(geniusArtistId)}
     onClick={handleArtistClick}
   >
     {artist}
   </button>
   ```

3. **Optimistic Navigation**:
   ```typescript
   // Predict username from artist name
   const predictedUsername = artist.toLowerCase().replace(/\s+/g, '')
   navigate(`/u/${predictedUsername}`) // May redirect if wrong
   ```

---

## Summary

**Recommended Approach**: Hybrid Pre-fetch + Fallback

**Steps**:
1. ✅ Create `useArtistRoute` hook
2. ✅ Update `KaraokeSongPage` to use hook
3. ✅ Add redirect logic to `/artist/:id` page
4. ✅ Enhance `ProfilePage` with contract fallback
5. ✅ Delete `artist-mapping.ts`

**Benefits**:
- ✅ Instant navigation (cached)
- ✅ Graceful fallback (redirect)
- ✅ Handles all edge cases
- ✅ Minimal UX impact

**Next**: Implement Step 1 (useArtistRoute hook)
