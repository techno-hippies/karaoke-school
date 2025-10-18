# TikTok-Style Feed Implementation

## Overview

The app now has a fully functional TikTok-style vertical video feed on the home page (`/`). The feed shows copyright-free karaoke videos with swipe-to-scroll functionality.

## Architecture

```
HomePage
  └── FeedPage (tabs: For You / Following)
       └── ForYouFeed (fetches copyright-free posts)
            └── VerticalVideoFeed (react-vertical-feed wrapper)
                 └── VideoPost (existing component)
```

## Components

### 1. **FeedPage** (`app/src/components/feed/FeedPage.tsx`)
- Main container with tab navigation (For You / Following)
- For You tab is active and functional
- Following tab is disabled (coming soon)
- Positioned tab bar at top with safe area padding

### 2. **ForYouFeed** (`app/src/components/feed/ForYouFeed.tsx`)
- Data fetching component using `usePosts` hook
- Implements server-side tag filtering:
  ```typescript
  filter: {
    apps: [evmAddress(APP_ADDRESS)],
    feeds: [{ globalFeed: true }],
    metadata: {
      tags: { all: ['copyright-free'] }  // Only copyright-free content
    }
  }
  ```
- Transforms Lens `Post` objects to `VideoPostData` format
- Extracts metadata from post attributes (genius_id, grade, song info)
- Extracts karaoke lines from transcriptions
- Render props pattern: `children(videos, isLoading)`

### 3. **VerticalVideoFeed** (`app/src/components/feed/VerticalVideoFeed.tsx`)
- Wrapper around `react-vertical-feed` package
- Handles vertical snap scrolling
- Keyboard navigation (ArrowUp/ArrowDown)
- Auto-play/pause on scroll
- Infinite scroll preparation (onLoadMore callback)
- Loading states and empty states

### 4. **VideoPost** (existing component)
- Full-screen video player with karaoke overlay
- HLS encrypted video support
- Premium lock overlay for copyrighted content
- TikTok-style actions (like, comment, share)
- Desktop: centered 9:16 video
- Mobile: full-screen video

## Tag-Based Filtering

Posts are filtered using Lens Protocol's metadata tags:

### Required Tags
- `karaoke` - All karaoke posts
- `tiktok` - TikTok-sourced videos
- `copyrighted` OR `copyright-free` - Content licensing status
- `encrypted` OR `unencrypted` - Encryption status

### Optional Tags
- `licensed` - Has ISRC/licensing metadata
- `genius` - Has Genius API metadata

### Feed Queries

**For You Feed** (copyright-free only):
```typescript
metadata: { tags: { all: ['copyright-free'] } }
```

**Following Feed** (future - includes subscribed copyrighted content):
```typescript
// Requires subscription checking logic
metadata: { tags: { any: ['copyright-free', 'copyrighted'] } }
// + client-side filter for subscription status
```

## Data Transformation

Lens posts are transformed to VideoPostData:

```typescript
{
  id: post.id,
  videoUrl: video.video?.optimized?.uri,
  thumbnailUrl: video.video?.cover,
  username: post.author.username?.localName,
  userAvatar: post.author.metadata?.picture?.optimized?.uri,
  grade: attributes.find(a => a.key === 'grade')?.value,
  musicTitle: attributes.find(a => a.key === 'song_name')?.value,
  musicAuthor: attributes.find(a => a.key === 'artist_name')?.value,
  geniusId: Number(attributes.find(a => a.key === 'genius_id')?.value),
  karaokeLines: transcriptions.map(t => ({
    text: t.value,
    start: t.startTime / 1000,
    end: t.endTime / 1000
  })),
  isPremium: copyrightType === 'copyrighted',
  // ...engagement metrics, interaction state
}
```

## Features

✅ **Implemented**:
- Copyright-free video feed
- Vertical snap scrolling (TikTok-style)
- Keyboard navigation (arrow keys)
- Auto-play/pause on scroll
- Karaoke lyrics overlay
- Video controls (play/pause, mute)
- Loading and empty states
- Server-side tag filtering

🚧 **TODO**:
- Like/comment/share mutations
- Follow/unfollow functionality
- Navigation to profile/song pages
- Infinite scroll pagination
- Following feed (requires subscription logic)
- Subscription checking for copyrighted content

## Navigation Flow

```
/ (HomePage)
  ├── For You Feed (copyright-free videos)
  │   └── Tap video → /u/:username/video/:postId
  │   └── Tap username → /u/:username
  │   └── Tap music → /song/:geniusId
  │
  └── Following Feed (coming soon)
      └── Shows subscribed creators' content
```

## Performance Considerations

1. **Server-side filtering**: Using `metadata.tags` filters posts at the GraphQL layer, not client-side
2. **Lazy loading**: Videos only load when scrolled into view
3. **Auto-pause**: Videos pause when scrolled out of view
4. **Pagination ready**: Infrastructure in place for infinite scroll

## Testing

To verify the feed is working:

1. Navigate to `/` (home page)
2. You should see charlixcx's copyright-free videos
3. Swipe up/down or use arrow keys to scroll
4. Videos should auto-play/pause
5. Karaoke lyrics should sync with video

Check tags are correctly set:
```bash
DOTENV_PRIVATE_KEY=1dd71ccca43764a4d9b571829a6ec8be3ffdf46b8c0468880c7b821ddf17cf94 \
  dotenvx run -- bun run /media/t42/th42/Code/karaoke-school-v1/pkp-lens-flow/test/check-post-tags.ts
```

## Future Enhancements

1. **Following Feed**:
   - Fetch posts from followed accounts
   - Include copyrighted content if user has subscription
   - Implement subscription status checking

2. **Engagement Features**:
   - Like/unlike posts
   - Comment on posts
   - Share functionality
   - Follow/unfollow creators

3. **Feed Personalization**:
   - Algorithmic ranking
   - User preferences
   - Recently viewed filter

4. **Performance**:
   - Implement pagination with `usePagination`
   - Preload next videos
   - Cache feed results
