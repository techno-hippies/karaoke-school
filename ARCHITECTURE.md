# Karaoke School - Component Architecture

**Last Updated:** 2025-10-03
**Tech Stack:** React 19 + TypeScript + Bun + Tailwind v4 + Shadcn/ui + Storybook

---

## Table of Contents
1. [Overview](#overview)
2. [Component Hierarchy](#component-hierarchy)
3. [Design System](#design-system)
4. [Responsive Patterns](#responsive-patterns)
5. [Component Specifications](#component-specifications)
6. [Storybook Strategy](#storybook-strategy)
7. [State Management](#state-management)
8. [Integration Points](#integration-points)

---

## Overview

### Project Structure
```
root/
├── app/                    # Frontend application
│   ├── src/
│   │   ├── components/    # All React components
│   │   │   ├── ui/       # Shadcn base components
│   │   │   ├── school/   # Study & Quiz features
│   │   │   ├── feed/     # Social feed components
│   │   │   ├── post/     # Content creation
│   │   │   └── onboarding/ # User onboarding
│   │   ├── pages/        # Page-level components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # Business logic (FSRS, contracts)
│   │   ├── lib/          # Utilities
│   │   └── stories/      # Storybook stories
│   └── package.json
├── contracts/             # Smart contracts (Solidity)
├── lit-actions/          # Lit Protocol actions
└── shared/               # Shared types/utilities
```

### Core Principles
1. **Component-First**: Every UI element is a reusable component with a Storybook story
2. **Mobile-First Responsive**: TikTok-style mobile UX that scales to desktop
3. **Container/Presenter Pattern**: Separate business logic from presentation
4. **Type Safety**: Strict TypeScript with shared types
5. **Accessibility**: WCAG 2.1 AA compliance via Storybook a11y addon

---

## Component Hierarchy

### 1. UI Components (Root Shadcn/Radix)
**Location:** `src/components/ui/`
**Purpose:** Base design system components, all have Storybook stories

- `button.tsx` ✓ (already exists)
- `input.tsx` - Text input, search input
- `sheet.tsx` - Bottom sheet/drawer (mobile) + side panel (desktop)
- `progress.tsx` - Progress bars for exercises
- `tabs.tsx` - Tab navigation
- `badge.tsx` - Status badges (trending, verified, etc.)
- `dialog.tsx` - Modal dialogs
- `card.tsx` - Content cards

### 2. School Components
**Location:** `src/components/school/`
**Purpose:** Study and quiz features

#### Study Subcomponents
```typescript
// src/components/school/study/
- Shows.tsx              // Display liked songs/study queue
- SayItBackExercise.tsx  // Karaoke exercise (word-level highlighting)
- StudyStats.tsx         // FSRS states (new/learning/due)
```

#### Quiz Subcomponents
```typescript
// src/components/school/quiz/
- QuizCard.tsx           // Multiple choice question card
- QuizResults.tsx        // Score and feedback
```

**Design Notes:**
- Study exercises use word-level karaoke highlighting (reuse from site/)
- FSRS integration via `FSRSService` (TS-FSRS algorithm)
- Mobile-first layout, progress bar at top

### 3. Feed Components
**Location:** `src/components/feed/`
**Purpose:** TikTok-style social feed

```typescript
// Core feed components
- VerticalFeed.tsx       // Container: scroll logic, Intersection Observer
- VerticalFeedView.tsx   // Presenter: pure UI, receives props
- VideoPost.tsx          // Individual video post with karaoke overlay
- VideoPostContainer.tsx // Container for VideoPost (state/hooks)
- CommentSheet.tsx       // Bottom sheet with comments
- ShareSheet.tsx         // Share options sheet
```

**Responsive Pattern (Critical):**
```tsx
// Desktop: Fixed sidebar (256px) + main content
// Mobile: Full width + bottom navigation

<div className="h-screen flex">
  {/* Desktop Sidebar - hidden on mobile */}
  <DesktopSidebar className="max-md:hidden fixed left-0 w-64" />

  {/* Main Content - responsive margin */}
  <div className="flex-1 md:ml-64">
    {/* Feed scroll container */}
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory">
      {/* Video posts */}
    </div>
  </div>

  {/* Mobile Footer - hidden on desktop */}
  <MobileFooter className="md:hidden fixed bottom-0" />
</div>
```

### 4. Post Components (Content Creation)
**Location:** `src/components/post/`
**Purpose:** Video recording and posting

```typescript
// Recording flow
- CameraRecorder.tsx     // Video recorder with mode toggle
  - Toggle: Lip sync mode vs Cover mode
  - Centered pill button (TikTok-style) to open SongSheet

- SongSheet.tsx          // Bottom sheet song picker
  - Liked songs (from /school page)
  - Actively studied songs
  - Quick access for cover/lip sync

- PostEditor.tsx         // Post-recording editor
  - Add caption
  - Replay recording
  - Post to feed button
```

**Camera Flow:**
1. User taps Post button → CameraRecorder opens
2. Default mode: Lip sync (original song)
3. Toggle to Cover mode (instrumental + user voice)
4. Tap pill at top → SongSheet slides up
5. Select song → Record → PostEditor → Publish

### 5. Onboarding Components
**Location:** `src/components/onboarding/`
**Purpose:** User setup and authentication

```typescript
- UsernameModal.tsx      // Username input (7+ letters)
- WalletConnect.tsx      // Wallet connection (RainbowKit/Reown)
- LensAuth.tsx           // Lens Protocol authentication
- LitAuth.tsx            // Lit Protocol v8 signature flow
```

**Design Pattern:**
- Modal overlays (not full-page)
- Progressive disclosure (don't show all steps at once)
- Graceful authentication: Show welcoming UI if user isn't authenticated yet

---

## Pages

### Mobile Footer Accessible Pages
All pages have corresponding Storybook stories showing mobile + desktop layouts

#### 1. Feed Page (`/`)
```typescript
// src/pages/FeedPage.tsx
- TikTok-style infinite scroll feed
- Post types:
  - Lip sync videos (original song)
  - Cover videos (instrumental + user voice)
- Clicking post → opens Song page
- Like behavior → adds to /school study queue
```

**Future:** FSRS-based exercises inserted in feed (scroll 5 videos → SayItBack exercise)

#### 2. School Page (`/school`)
```typescript
// src/pages/SchoolPage.tsx
Layout:
- Search bar (top)
- Study Stats (new/learning/due)
- Liked songs list
- Trending section (from TrendingTrackerV1 contract)
- Genres, featured artists (later)
```

#### 3. Post Button
```typescript
// Triggers CameraRecorder directly
- Opens with lip sync mode by default
- Toggle to cover mode
- Pill button opens SongSheet
```

#### 4. Inbox Page (`/inbox`)
```typescript
// src/pages/InboxPage.tsx
- Messages (later)
- Notifications (later)
- Placeholder for now
```

#### 5. Profile Page (`/profile/:address`)
```typescript
// src/pages/ProfilePage.tsx
- URL structure:
  - Own profile: /profile (redirects to /profile/{user})
  - Lens username: /profile/lens/{username}
  - Address: /profile/{address}

- Layout:
  - Profile header (avatar, bio, followers/following)
  - Video grid (3 cols mobile, 6 cols desktop)
  - Shows lip sync + cover videos

- Achievements section:
  - High scores (queryable from KaraokeScoreboardV4)
  - Study activity (songs being studied)
  - FSRS data is encrypted (not shown publicly)
```

**Responsive Pattern:**
```tsx
// Mobile: 3-column grid, full width
// Desktop: 6-column grid, with sidebar margin

<div className="grid gap-2 md:gap-3"
     style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
  <style>{`
    @media (min-width: 768px) {
      [data-grid] {
        grid-template-columns: repeat(6, 1fr) !important;
      }
    }
  `}</style>
  {videos.map(...)}
</div>
```

#### 6. Song Page (`/song/:source/:id`)
```typescript
// src/pages/SongPage.tsx
// Replaces old genius/native routes

URL patterns:
- /song/genius/123456      # Genius song
- /song/native/207         # Native song

Layout:
- Study Stats (top)
- Song metadata (title, artist, artwork)
- Top 3 Leaderboard (from KaraokeScoreboardV4)
- Segment picker (referents for Genius, sections for Native)

Click artist → /artist/:source/:id (similar layout)
```

#### 7. Media Page (`/media/:source/:id`)
```typescript
// src/pages/MediaPage.tsx
// Formerly LyricsPage - plays native songs with synced lyrics

Features:
- Full-screen audio player
- Word-level karaoke highlighting
- Optional translations
- Native songs only (requires audio + timestamps)
```

#### 8. Artist Page (`/artist/:source/:id`)
```typescript
// src/pages/ArtistPage.tsx

URL patterns:
- /artist/genius/artist-id
- /artist/native/artist-slug

Layout:
- Artist header (name, avatar, bio)
- Top 3 Leaderboard (aggregated across all songs)
- Song list
```

---

## Design System

### Color Palette
```css
/* Base (TikTok-inspired dark theme) */
--background: 0 0% 0%;           /* Pure black #000000 */
--foreground: 0 0% 100%;         /* White text */

--neutral-50: 0 0% 98%;
--neutral-100: 0 0% 96%;
--neutral-200: 0 0% 90%;
--neutral-300: 0 0% 83%;
--neutral-400: 0 0% 64%;
--neutral-500: 0 0% 45%;
--neutral-600: 0 0% 32%;
--neutral-700: 0 0% 25%;
--neutral-800: 0 0% 15%;         /* Borders */
--neutral-900: 0 0% 9%;          /* Cards/headers */

/* Brand Colors */
--primary: 0 91% 64%;            /* Red #FE2C55 (TikTok red) */
--primary-dark: 0 91% 54%;       /* Darker red for hover */

--accent: 340 82% 52%;           /* Pink gradient end */
--accent-purple: 270 91% 65%;    /* Purple gradient */

/* Gradients */
--gradient-brand: linear-gradient(135deg, #FE2C55 0%, #F43E7C 100%);
--gradient-purple: linear-gradient(135deg, #A855F7 0%, #EC4899 100%);
```

### Typography
```typescript
// Font Stack
Primary: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif

// Sizes (Tailwind classes)
xs:   text-xs    (0.75rem)
sm:   text-sm    (0.875rem)
base: text-base  (1rem)
lg:   text-lg    (1.125rem)
xl:   text-xl    (1.25rem)
2xl:  text-2xl   (1.5rem)
3xl:  text-3xl   (1.875rem)
```

### Spacing System
```typescript
// Based on 4px grid
1: 0.25rem  (4px)
2: 0.5rem   (8px)
3: 0.75rem  (12px)
4: 1rem     (16px)
6: 1.5rem   (24px)
8: 2rem     (32px)
12: 3rem    (48px)
16: 4rem    (64px)
```

### Component Variants (CVA)
```typescript
// Example: Button variants
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-dark",
        ghost: "hover:bg-neutral-800",
        outline: "border border-neutral-700 hover:bg-neutral-800"
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-lg"
      }
    }
  }
)
```

---

## Responsive Patterns

### Critical Learnings from site/ (Feed & Profile)

#### Pattern 1: Fixed Sidebar + Responsive Margin
```tsx
// ✅ CORRECT (from VerticalFeedView.tsx)
<div className="h-screen flex">
  <DesktopSidebar className="max-md:hidden fixed left-0 w-64" />
  <div className="flex-1 md:ml-64">
    {/* Content automatically adjusts */}
  </div>
  <MobileFooter className="md:hidden" />
</div>
```

#### Pattern 2: Responsive Grid (Mobile 3-col → Desktop 6-col)
```tsx
// ✅ CORRECT (from ProfilePageView.tsx)
<div
  className="grid gap-2 md:gap-3"
  style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
  data-grid="mobile-3-desktop-6"
>
  <style>{`
    @media (min-width: 768px) {
      [data-grid="mobile-3-desktop-6"] {
        grid-template-columns: repeat(6, 1fr) !important;
      }
    }
  `}</style>
</div>
```

**Why inline style + CSS override?**
- Tailwind's `grid-cols-3 md:grid-cols-6` fights with inline styles
- This pattern ensures consistent behavior across devices

#### Pattern 3: Conditional Mobile/Desktop Headers
```tsx
// Mobile: Back button + Title + Action
<div className="md:hidden flex items-center p-4">
  {!isOwnProfile && <BackButton />}
  <h1 className="flex-1 text-center">{title}</h1>
  {isOwnProfile && <LogoutButton />}
</div>

// Desktop: Top-right action only
<div className="hidden md:block absolute top-4 right-4">
  <LogoutButton />
</div>
```

#### Pattern 4: Safe Area Insets (Mobile)
```tsx
// Bottom navigation needs safe area padding (iOS notch)
<div
  className="fixed bottom-0 left-0 right-0"
  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
>
  {/* Mobile footer content */}
</div>
```

#### Pattern 5: Scroll Container with Snap
```tsx
// TikTok-style scroll (from VerticalFeedView)
<div
  ref={scrollContainerRef}
  className="h-screen overflow-y-scroll snap-y snap-mandatory"
  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
>
  <style>{`
    div::-webkit-scrollbar { display: none; }
  `}</style>

  {/* Each post snaps to viewport */}
  <div className="h-screen snap-start">
    <VideoPost />
  </div>
</div>
```

---

## Component Specifications

### UI Components

#### Input
```typescript
// src/components/ui/input.tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'search'
  error?: string
}

// Variants:
// - default: Standard text input
// - search: With magnifying glass icon
```

#### Sheet
```typescript
// src/components/ui/sheet.tsx
// Uses Radix Dialog with bottom drawer on mobile, side panel on desktop

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: 'bottom' | 'right' | 'left'  // 'bottom' for mobile, 'right' for desktop
  children: React.ReactNode
}

// Mobile: Slides up from bottom
// Desktop: Slides in from right/left
```

#### Progress
```typescript
// src/components/ui/progress.tsx
interface ProgressProps {
  value: number        // 0-100
  variant?: 'default' | 'gradient'
  showLabel?: boolean
}

// Used in: Exercise progress, study stats
```

### School Components

#### SayItBackExercise
```typescript
// src/components/school/study/SayItBackExercise.tsx

interface SayItBackProps {
  segment: Segment      // From unified Segment type
  onComplete: (score: number) => void
  onSkip: () => void
}

// Layout:
// - Progress bar (top)
// - Song info (title, artist, artwork)
// - Karaoke display (word-level highlighting)
// - Record button (center bottom)
// - Navigation controls (skip, back)

// Flow:
// 1. Show lyrics with highlighting (audio plays)
// 2. User records their attempt
// 3. Submit to karaoke-scorer Lit Action
// 4. Get score from KaraokeScoreboardV4
// 5. Update FSRS card via FSRSService
```

#### StudyStats
```typescript
// src/components/school/study/StudyStats.tsx

interface StudyStatsProps {
  stats: {
    new: number         // New cards
    learning: number    // Cards in learning phase
    due: number        // Cards due for review
  }
}

// Display:
// - Three pill badges with counts
// - Color-coded (blue/yellow/red)
// -Clickable to filter study queue
```

### Feed Components

#### VideoPost
```typescript
// src/components/feed/VideoPost.tsx (Presenter)
// src/components/feed/VideoPostContainer.tsx (Container)

interface VideoPostProps {
  videoUrl: string
  username: string
  description: string
  likes: number
  comments: number
  shares: number

  // Karaoke data (optional)
  karaokeSegment?: {
    lines: Array<{
      text: string
      originalText?: string
      translatedText?: string
      start?: number
      end?: number
      words?: Array<{ text: string, start: number, end: number }>
    }>
  }

  // Callbacks
  onLike: () => void
  onComment: () => void
  onShare: () => void
  onProfileClick: () => void
}

// Layout:
// - Full-screen video
// - Overlay UI:
//   - Username + description (left bottom)
//   - Action buttons (right side): Like, Comment, Share
//   - Optional karaoke lyrics (center, word-level sync)
```

### Post Components

#### CameraRecorder
```typescript
// src/components/post/CameraRecorder.tsx

interface CameraRecorderProps {
  mode: 'lipsync' | 'cover'
  selectedSong?: Song
  onModeToggle: () => void
  onSongSelect: () => void  // Opens SongSheet
  onRecordingComplete: (videoBlob: Blob) => void
}

// Layout:
// - Camera preview (full screen)
// - Mode toggle (top left): Lip sync ↔ Cover
// - Song pill (top center): Tap to open SongSheet
// - Record button (bottom center): Red circle
// - Timer (top right): Shows recording duration

// Behavior:
// - Lip sync mode: Plays original song audio
// - Cover mode: Plays instrumental track
// - Word-level karaoke overlay during recording
```

#### SongSheet
```typescript
// src/components/post/SongSheet.tsx

interface SongSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSongSelect: (song: Song) => void

  // Data sources
  likedSongs: Song[]
  studiedSongs: Song[]
}

// Layout (bottom sheet):
// - Tabs: "Liked" | "Studied"
// - Song list with artwork, title, artist
// - Search bar (sticky top)
// - Pull-to-close gesture
```

---

## Storybook Strategy

### Story Organization
```
src/stories/
├── ui/
│   ├── Button.stories.tsx
│   ├── Input.stories.tsx
│   ├── Sheet.stories.tsx
│   ├── Progress.stories.tsx
│   └── ...
├── school/
│   ├── SayItBackExercise.stories.tsx
│   ├── StudyStats.stories.tsx
│   └── QuizCard.stories.tsx
├── feed/
│   ├── VideoPost.stories.tsx
│   ├── CommentSheet.stories.tsx
│   └── ShareSheet.stories.tsx
├── post/
│   ├── CameraRecorder.stories.tsx
│   ├── SongSheet.stories.tsx
│   └── PostEditor.stories.tsx
├── pages/
│   ├── FeedPage.stories.tsx
│   ├── SchoolPage.stories.tsx
│   └── ProfilePage.stories.tsx
└── navigation/
    ├── DesktopSidebar.stories.tsx
    └── MobileFooter.stories.tsx
```

### Story Template
```typescript
// Example: src/stories/school/SayItBackExercise.stories.tsx

import type { Meta, StoryObj } from '@storybook/react'
import { SayItBackExercise } from '../../components/school/study/SayItBackExercise'

const meta: Meta<typeof SayItBackExercise> = {
  title: 'School/Study/SayItBackExercise',
  component: SayItBackExercise,
  parameters: {
    layout: 'fullscreen',  // For page-level components
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#000000' }]
    }
  },
  tags: ['autodocs'],
  argTypes: {
    onComplete: { action: 'completed' },
    onSkip: { action: 'skipped' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// Default story
export const Default: Story = {
  args: {
    segment: {
      id: 'verse-1',
      source: 0,  // Native
      title: 'Verse 1',
      artist: 'Scarlett X',
      sectionType: 'Verse',
      lyrics: {
        type: 'timestamped',
        lines: [
          {
            start: 0,
            end: 3.5,
            text: 'In the heat of the night',
            words: [
              { text: 'In', start: 0, end: 0.3 },
              { text: 'the', start: 0.3, end: 0.5 },
              // ...
            ]
          }
        ]
      }
    }
  }
}

// Mobile variant
export const Mobile: Story = {
  args: Default.args,
  parameters: {
    viewport: {
      defaultViewport: 'iphone14'
    }
  }
}

// Desktop variant
export const Desktop: Story = {
  args: Default.args,
  parameters: {
    viewport: {
      defaultViewport: 'desktop'
    }
  }
}
```

### Viewport Configurations
```typescript
// .storybook/preview.ts
export const parameters = {
  viewport: {
    viewports: {
      iphone14: {
        name: 'iPhone 14',
        styles: { width: '390px', height: '844px' }
      },
      iphone14pro: {
        name: 'iPhone 14 Pro Max',
        styles: { width: '430px', height: '932px' }
      },
      desktop: {
        name: 'Desktop',
        styles: { width: '1440px', height: '900px' }
      }
    }
  }
}
```

---

## State Management

### Local State (useState)
- UI-only state (modals, sheets, toggles)
- Form inputs
- Animation states

### FSRS Service (Study State)
```typescript
// src/services/FSRSService.ts
// Manages spaced repetition algorithm

- createCardsFromLike()    // Convert liked video → FSRS cards
- getNextCard()            // Get next card to review
- submitReview()           // Update card after review
- getStudyStats()          // Get new/learning/due counts
```

### TinyBase (Local Storage)
```typescript
// src/services/database/tinybase.ts
// Persistent local storage for FSRS data

Tables:
- exercise_cards: FSRS card state
- study_sessions: Session history
- user_preferences: Settings
```

### Smart Contract Queries (React Query)
```typescript
// src/hooks/contracts/useScoreboard.ts
// Query KaraokeScoreboardV4

- useTopScorers(source, trackId)
- useUserScore(source, trackId, address)
- useLeaderboard(source, segmentId)
```

### Lit Actions (Background)
```typescript
// Triggered by user actions, run in PKP

- karaoke-scorer-v3.js     // Score SayItBack attempts
- search/referents.js      // Fetch Genius data
- trending-tracker-v1.js   // Update trending data
```

---

## Integration Points

### 1. Content Sources
```typescript
// Unified ContentSource enum (matches contract)
enum ContentSource {
  Native = 0,  // From SongRegistryV4 (audio + timestamps)
  Genius = 1,  // From Genius API (lyrics only)
}

// All song/segment IDs are prefixed with source
// Contract uses keccak256(source, id) for hashing
```

### 2. Smart Contracts (Lens Chain Testnet)
```typescript
// src/lib/contracts.ts

const CONTRACTS = {
  KaraokeScoreboardV4: '0x...',  // Leaderboards
  TrendingTrackerV1: '0x...',    // Trending songs
  SongRegistryV4: '0x...',       // Native song catalog
}

// All contracts use same ContentSource enum
// All use PKP for trusted writes
```

### 3. Authentication Flow
```typescript
// Progressive authentication (don't block user)

1. Wallet Connect (RainbowKit/Reown)
   - User can browse feed without wallet
   - Show "Sign In" prompt on actions (like, comment)

2. Lens Protocol (Optional)
   - For social features (follow, post)
   - Not required for study

3. Lit Protocol v8 (Background)
   - Triggered on first study action
   - Show welcoming modal: "Sign to unlock study features"
   - PKP signature for Lit Actions
```

### 4. Hooks Architecture
```typescript
// src/hooks/

// Authentication
- useLensAuth()            // Lens Protocol auth state
- useLitAuth()             // Lit Protocol signatures
- useWalletAuth()          // Wallet connection

// Data fetching
- useGeniusSearch()        // Search Genius songs
- useGeniusSong()          // Get song metadata
- useTrendingSongs()       // Get trending from contract

// Study
- useStudyQueue()          // Get FSRS review queue
- useStudySession()        // Manage active study session

// Media
- useKaraokePlayer()       // Audio player with sync
- useWordHighlight()       // Word-level highlighting
```

---

## Key Design Decisions

### 1. Why Native + Genius?
- **Native songs**: Full karaoke experience (audio, word-level sync, covers)
- **Genius songs**: Vast catalog for discovery (lyrics only, no audio)
- **Bridge**: Native songs have Genius IDs for metadata enrichment

### 2. Why Segment-based Architecture?
- **Flexibility**: Genius referents (character ranges) vs Native sections (time ranges)
- **Unified practice**: User doesn't care about source, just practices segments
- **Contract efficiency**: Hash-based storage (keccak256) saves gas

### 3. Why Container/Presenter Pattern?
- **Storybook testing**: Presenters have no hooks, easy to test
- **Type safety**: Clear prop interfaces
- **Reusability**: Same presenter, different containers

### 4. Responsive Strategy
- **Mobile-first**: Design for 390px (iPhone 14) then scale up
- **TikTok UX**: Full-screen immersive on mobile
- **Desktop enhancement**: Sidebar navigation, larger grid

---

## Next Steps

### Phase 1: Foundation (Current)
- [x] Setup Bun + TypeScript + Tailwind v4
- [x] Setup Storybook 9
- [ ] Create base shadcn/ui components
- [ ] Document component hierarchy

### Phase 2: Core Components
- [ ] UI components (Input, Sheet, Progress, Tabs, Badge)
- [ ] Navigation (DesktopSidebar, MobileFooter)
- [ ] Layout (PageLayout, responsive patterns)

### Phase 3: Feature Components
- [ ] School (SayItBackExercise, StudyStats, QuizCard)
- [ ] Feed (VideoPost, CommentSheet, ShareSheet)
- [ ] Post (CameraRecorder, SongSheet, PostEditor)

### Phase 4: Pages
- [ ] FeedPage
- [ ] SchoolPage
- [ ] ProfilePage
- [ ] SongPage
- [ ] MediaPage

### Phase 5: Integration
- [ ] Connect to contracts (KaraokeScoreboardV4, TrendingTrackerV1)
- [ ] Implement authentication flows
- [ ] Connect FSRS service
- [ ] Test all responsive breakpoints

---

## Resources

### Design References
- TikTok mobile app (feed UX, navigation)
- Duolingo (study stats, progress)
- Genius.com (lyrics annotations)

### Technical Docs
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Shadcn/ui](https://ui.shadcn.com)
- [Radix UI](https://www.radix-ui.com)
- [Storybook](https://storybook.js.org)
- [TS-FSRS](https://github.com/open-spaced-repetition/ts-fsrs)

### Internal Docs
- `contracts/DEPLOYMENT_V4.md` - Smart contract architecture
- `lit-actions/DEPLOYMENT.md` - Lit Action specs
- `TRENDING.md` - Trending system design

---

**Created by:** Claude Code
**Version:** 1.0.0
