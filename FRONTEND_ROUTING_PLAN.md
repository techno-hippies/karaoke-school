# Frontend Artist Routing - Integration Plan

## Current Problem

**Static Mapping** (`artist-mapping.ts`):
```typescript
// SYNCHRONOUS - instant lookup
const route = getArtistRoute(447) // → "/u/ladygaga"
navigate(route)
```

**New Contract Lookup** (`artist-lookup.ts`):
```typescript
// ASYNC - requires RPC call (~100ms)
const route = await getArtistRoute(447) // ❌ Can't use in onClick
navigate(route)
```

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

## Solution: Hybrid Routing Strategy

### Strategy 1: Pre-fetch + Cache (BEST)

**Hook**: `useArtistRoute(geniusArtistId)`

```typescript
// app/src/hooks/useArtistRoute.ts
export function useArtistRoute(geniusArtistId: number | undefined) {
  const [route, setRoute] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!geniusArtistId) return

    setIsLoading(true)
    getArtistRoute(geniusArtistId).then(r => {
      setRoute(r)
      setIsLoading(false)
    })
  }, [geniusArtistId])

  return { route, isLoading }
}
```

**Usage**:
```typescript
// KaraokeSongPage.tsx
const { route: artistRoute } = useArtistRoute(displaySong?.geniusArtistId)

const handleArtistClick = useCallback(() => {
  if (artistRoute) {
    navigate(artistRoute) // INSTANT - already cached
  } else {
    // Fallback: navigate to /artist/:id, let it redirect
    navigate(`/artist/${displaySong?.geniusArtistId}`)
  }
}, [navigate, artistRoute, displaySong?.geniusArtistId])
```

**Benefits**:
- ✅ Instant click (route pre-fetched)
- ✅ Fallback for slow loading
- ✅ Simple implementation

**Trade-off**:
- Extra RPC call on page load (~100ms)
- Negligible impact

### Strategy 2: Fallback Routing (SIMPLER)

**Always navigate to `/artist/:geniusArtistId` first**, then redirect if needed.

**Implementation**:
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

## Recommended Solution

### **Hybrid: Pre-fetch + Fallback**

Combine both strategies for best UX:

1. **Pre-fetch route** when song page loads (`useArtistRoute`)
2. **Navigate instantly** if cached
3. **Fallback** to `/artist/:id` if not cached yet
4. **Redirect** from `/artist/:id` to `/u/:username` if profile exists

---

## Implementation Plan

### Step 1: Create `useArtistRoute` Hook

**File**: `app/src/hooks/useArtistRoute.ts`

```typescript
import { useState, useEffect } from 'react'
import { getArtistRoute } from '@/lib/genius/artist-lookup'

export function useArtistRoute(geniusArtistId: number | undefined) {
  const [route, setRoute] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!geniusArtistId) {
      setRoute(null)
      return
    }

    setIsLoading(true)
    setError(null)

    getArtistRoute(geniusArtistId)
      .then(r => {
        setRoute(r)
        setIsLoading(false)
      })
      .catch(err => {
        setError(err)
        setIsLoading(false)
        // Fallback to /artist/:id
        setRoute(`/artist/${geniusArtistId}`)
      })
  }, [geniusArtistId])

  return { route, isLoading, error }
}
```

### Step 2: Update `KaraokeSongPage.tsx`

```typescript
// Replace line 11:
// import { getArtistRoute } from '@/lib/genius/artist-mapping'
import { useArtistRoute } from '@/hooks/useArtistRoute'

// Add near top of component:
const { route: artistRoute } = useArtistRoute(displaySong?.geniusArtistId)

// Update handleArtistClick (line 266-271):
const handleArtistClick = useCallback(() => {
  if (artistRoute) {
    // Route pre-fetched - navigate instantly
    navigate(artistRoute)
  } else if (displaySong?.geniusArtistId) {
    // Fallback: navigate to /artist/:id
    navigate(`/artist/${displaySong.geniusArtistId}`)
  }
}, [navigate, artistRoute, displaySong?.geniusArtistId])
```

### Step 3: Add Redirect Logic to `/artist/:id` Page

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
