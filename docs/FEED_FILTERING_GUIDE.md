# Feed Filtering Guide

## Tag-Based Filtering Strategy

We use Lens Protocol's **tag-based filtering** to efficiently query content server-side.

---

## Available Tags (Set in Step 8)

All posts created via `8-create-lens-posts.ts` include these tags:

```typescript
tags: [
  'karaoke',                    // All posts are karaoke content
  'tiktok',                     // All posts sourced from TikTok
  'copyrighted' | 'copyright-free', // COPYRIGHT STATUS (for filtering)
  'encrypted' | 'unencrypted',  // Encryption status
  'licensed',                   // Has Spotify ISRC (optional)
  'genius',                     // Has Genius song ID (optional)
]
```

### **Key Tag: `copyright_type`**

- `'copyright-free'` → Unencrypted video, playable by anyone
- `'copyrighted'` → Encrypted HLS video, requires Unlock subscription

---

## Feed Query Examples

### **1. Global Feed - Copyright-Free Only** ⭐ **RECOMMENDED FOR LAUNCH**

Show only content that everyone can watch:

```typescript
import { usePosts, evmAddress } from '@lens-protocol/react'
import { APP_ADDRESS } from '@/lens/config'

const { data, loading } = usePosts({
  filter: {
    apps: [evmAddress(APP_ADDRESS)],
    feeds: [{ globalFeed: true }],
    metadata: {
      tags: { all: ['copyright-free'] } // ✅ Server-side filter
    }
  }
})
```

**Benefits:**
- ✅ Only fetches playable content
- ✅ No subscription checks needed
- ✅ Fast & efficient
- ✅ Clean UX - no locked videos

---

### **2. Global Feed - All Content** (With Client-Side Filtering)

Fetch all posts, then filter based on subscription status:

```typescript
import { usePosts, evmAddress } from '@lens-protocol/react'
import { APP_ADDRESS } from '@/lens/config'
import { useMultiSubscription } from '@/hooks/useMultiSubscription'

function ForYouFeed() {
  const { pkpAddress } = useAuth()

  // Fetch all posts
  const { data: postsData, loading } = usePosts({
    filter: {
      apps: [evmAddress(APP_ADDRESS)],
      feeds: [{ globalFeed: true }],
    }
  })

  // Extract unique lock addresses
  const lockAddresses = useMemo(() => {
    return Array.from(new Set(
      postsData?.items
        .map(post => post.metadata?.attributes?.find(a => a.key === 'unlock_lock')?.value)
        .filter(Boolean) as string[]
    ))
  }, [postsData])

  // Check subscriptions for all locks
  const { subscriptions, loading: subsLoading } = useMultiSubscription(lockAddresses)

  // Filter: Show copyright-free OR subscribed content
  const filteredVideos = useMemo(() => {
    return postsData?.items
      .map(post => {
        const lockAddress = post.metadata?.attributes?.find(a => a.key === 'unlock_lock')?.value
        const isSubscribed = lockAddress ? subscriptions[lockAddress] : false
        const copyrightType = post.metadata?.tags?.includes('copyrighted') ? 'copyrighted' : 'copyright-free'

        return {
          ...mapPostToVideoData(post),
          isSubscribed,
          isPremium: copyrightType === 'copyrighted'
        }
      })
      .filter(video => {
        // Show if: copyright-free OR user is subscribed
        return !video.isPremium || video.isSubscribed
      })
  }, [postsData, subscriptions])

  return <VerticalVideoFeed videos={filteredVideos} loading={loading || subsLoading} />
}
```

**Benefits:**
- ✅ Shows premium content to subscribers
- ✅ Great UX for paying users

**Drawbacks:**
- ⚠️ Fetches content user can't view (wasted bandwidth)
- ⚠️ Requires multiple contract calls (slower)

---

### **3. Premium Content Only**

Show only copyrighted/encrypted content (e.g., for a "Premium" tab):

```typescript
const { data } = usePosts({
  filter: {
    apps: [evmAddress(APP_ADDRESS)],
    feeds: [{ globalFeed: true }],
    metadata: {
      tags: { all: ['copyrighted', 'encrypted'] }
    }
  }
})
```

---

### **4. Licensed Content Only**

Show only content with Spotify licensing (has ISRC):

```typescript
const { data } = usePosts({
  filter: {
    apps: [evmAddress(APP_ADDRESS)],
    feeds: [{ globalFeed: true }],
    metadata: {
      tags: { all: ['licensed'] }
    }
  }
})
```

---

### **5. By Specific Artist (via Genius)**

Filter to posts that have a Genius song ID:

```typescript
const { data } = usePosts({
  filter: {
    apps: [evmAddress(APP_ADDRESS)],
    feeds: [{ globalFeed: true }],
    metadata: {
      tags: { all: ['genius'] }
    }
  }
})

// Then client-side filter by specific genius_id attribute
const artistVideos = data?.items.filter(post => {
  const geniusId = post.metadata?.attributes?.find(a => a.key === 'genius_id')?.value
  return geniusId === '123456' // Specific song
})
```

---

## Recommended Implementation Plan

### **Phase 1: Copyright-Free Feed** (Launch Day)

```typescript
// app/src/components/feed/ForYouFeed.tsx
export function ForYouFeed() {
  const { data, loading, hasMore, next } = usePosts({
    filter: {
      apps: [evmAddress(APP_ADDRESS)],
      feeds: [{ globalFeed: true }],
      metadata: {
        tags: { all: ['copyright-free'] }
      }
    }
  })

  const videos = data?.items.map(post => mapPostToVideoData(post)) || []

  return <VerticalVideoFeed videos={videos} loading={loading} onLoadMore={next} />
}
```

**Why Start Here:**
- ✅ Simplest implementation (30 lines of code)
- ✅ No subscription logic needed
- ✅ Fast performance
- ✅ Gets feed working TODAY

---

### **Phase 2: Add Premium Content** (When You Have Subscribers)

1. Implement `useMultiSubscription` hook (batch check locks)
2. Remove `tags: { all: ['copyright-free'] }` filter
3. Add client-side filtering logic
4. Cache subscription status to reduce contract calls

---

## Tag-Based Filters Reference

| Tag | Description | Use Case |
|-----|-------------|----------|
| `karaoke` | All karaoke content | Filter out non-karaoke posts |
| `tiktok` | Sourced from TikTok | Filter by platform |
| `copyright-free` | ✅ **FREE CONTENT** | Public feed |
| `copyrighted` | 🔒 **PREMIUM CONTENT** | Requires subscription |
| `encrypted` | HLS encrypted video | Technical filtering |
| `unencrypted` | Standard MP4 | Technical filtering |
| `licensed` | Has Spotify ISRC | Show only licensed music |
| `genius` | Has Genius song ID | Link to song pages |

---

## Performance Notes

### **Server-Side Filtering (Recommended)**
```typescript
metadata: { tags: { all: ['copyright-free'] } }
```
- ✅ Only fetches relevant posts
- ✅ Reduces bandwidth
- ✅ Faster initial load

### **Client-Side Filtering**
```typescript
videos.filter(v => !v.isPremium || v.isSubscribed)
```
- ⚠️ Fetches all posts first
- ⚠️ More bandwidth usage
- ⚠️ Slower with large datasets

---

## Migration Notes

### **For Existing Posts**

If you've already created posts without these tags, you'll need to:

1. **Option A: Re-upload** (Recommended)
   - Run `8-create-lens-posts.ts` again
   - New posts will have proper tags
   - Old posts will be replaced

2. **Option B: Edit Existing Posts**
   - Use Lens `editPost` mutation
   - Add tags to existing metadata
   - More complex, not recommended

---

## Query Testing

Test your filters in the Lens GraphQL Playground:

```graphql
query {
  posts(
    request: {
      filter: {
        apps: ["0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0"]
        feeds: [{ globalFeed: true }]
        metadata: {
          tags: { all: ["copyright-free"] }
        }
      }
    }
  ) {
    items {
      id
      metadata {
        ... on VideoMetadata {
          tags
          content
        }
      }
    }
  }
}
```

---

## Summary

**✅ Step 8 is now optimized for feed filtering!**

The updated tag structure allows you to:
1. **Launch quickly** with copyright-free content only
2. **Easily upgrade** to include premium content later
3. **Filter efficiently** on the server side
4. **Scale** to thousands of posts without performance issues

**Next Step:** Implement `ForYouFeed.tsx` with the Phase 1 approach! 🚀
