# App.tsx Refactoring Plan

## Current State Analysis

### Problems
- **App.tsx is 716 lines** - way too large
- Contains 9 inline component functions acting as page components
- Mixes concerns: routing, page logic, data fetching, business logic
- Hard to maintain, test, and scale
- Inconsistent patterns

### Current App.tsx Contents
```
Lines 26-46:   HomePage (simple placeholder)
Lines 37-46:   ClassPage (simple placeholder)
Lines 48-54:   KaraokePage (wraps PostFlowContainer)
Lines 56-239:  KaraokeSongPage (184 lines! - data fetching, external links, business logic)
Lines 241-302: KaraokeSegmentPage (62 lines - data fetching, routing)
Lines 304-313: WalletPage (simple placeholder)
Lines 315-608: ProfilePage (294 lines! - but wait, this already exists in components/profile/)
Lines 611-702: AppRouter (main routing and layout logic)
Lines 704-716: App (root component)
```

## Established Project Patterns

### Component Organization
```
app/src/
├── components/              # UI components by domain
│   ├── class/              # Learning/class pages (SongPage, SongSegmentPage - presentational)
│   ├── karaoke/            # Karaoke components (SongSelectPage - presentational)
│   ├── profile/            # Profile components
│   │   ├── ProfilePage.tsx      # Container with hooks/logic
│   │   └── ProfilePageView.tsx  # Presentational view
│   └── ui/                 # Generic primitives
├── features/               # Feature modules
│   └── post-flow/
│       ├── hooks/          # Feature hooks (useCredits, useKaraokeGeneration)
│       ├── steps/          # Step components (SongSelectStep)
│       └── types.ts        # Feature types
├── hooks/                  # Shared hooks (useSongData, useContractSongs)
└── contexts/               # React contexts (AuthContext)
```

### Key Pattern: Container/View Separation
**Example:** `ProfilePage` already follows this:
- `/components/profile/ProfilePage.tsx` - Container with useParams, useNavigate, data fetching
- `/components/profile/ProfilePageView.tsx` - Pure presentational component

## Refactoring Strategy

### Option 1: Create `/pages/` directory (NEW structure)
```
app/src/
├── pages/                       # Page containers (NEW)
│   ├── HomePage.tsx
│   ├── ClassPage.tsx
│   ├── WalletPage.tsx
│   └── karaoke/
│       ├── KaraokePage.tsx
│       ├── KaraokeSongPage.tsx      # Container - 100 lines (data, links, routing)
│       └── KaraokeSegmentPage.tsx   # Container - 50 lines (data, routing)
├── components/
│   ├── class/
│   │   ├── SongPage.tsx             # Presentational (existing)
│   │   └── SongSegmentPage.tsx      # Presentational (existing)
│   └── karaoke/
│       └── SongSelectPage.tsx       # Presentational (existing)
└── App.tsx                          # ~100 lines - ONLY routing/layout
```

**Pros:**
- Clear separation: `/pages/` = route handlers, `/components/` = UI
- Easier to find page entry points
- Common React pattern (Next.js, many apps)

**Cons:**
- Introduces new top-level directory
- Breaks existing ProfilePage pattern

### Option 2: Follow ProfilePage pattern (CONSISTENT with existing)
```
app/src/
├── components/
│   ├── karaoke/
│   │   ├── KaraokePage.tsx              # NEW - Container
│   │   ├── KaraokeSongPage.tsx          # NEW - Container
│   │   ├── KaraokeSegmentPage.tsx       # NEW - Container
│   │   └── SongSelectPage.tsx           # EXISTING - Presentational
│   ├── class/
│   │   ├── SongPage.tsx                 # EXISTING - Presentational
│   │   └── SongSegmentPage.tsx          # EXISTING - Presentational
│   ├── profile/
│   │   ├── ProfilePage.tsx              # EXISTING - Container
│   │   └── ProfilePageView.tsx          # EXISTING - Presentational
│   └── layout/
│       ├── HomePage.tsx                 # NEW - Simple page
│       ├── ClassPage.tsx                # NEW - Simple page
│       └── WalletPage.tsx               # NEW - Simple page
└── App.tsx                              # ~150 lines - ONLY routing/layout/auth
```

**Pros:**
- Consistent with existing ProfilePage pattern
- No new top-level directories
- Domain-organized (karaoke pages in karaoke folder)

**Cons:**
- Simple pages (HomePage, WalletPage) don't fit cleanly in any domain folder

### Option 3: Hybrid approach
```
app/src/
├── pages/                               # NEW - Simple top-level pages
│   ├── HomePage.tsx
│   ├── ClassPage.tsx
│   └── WalletPage.tsx
├── components/
│   ├── karaoke/                         # Domain-specific pages stay in domain
│   │   ├── KaraokePage.tsx              # Container
│   │   ├── KaraokeSongPage.tsx          # Container
│   │   ├── KaraokeSegmentPage.tsx       # Container
│   │   └── SongSelectPage.tsx           # Presentational (existing)
│   ├── class/
│   │   ├── SongPage.tsx                 # Presentational (existing)
│   │   └── SongSegmentPage.tsx          # Presentational (existing)
│   └── profile/
│       ├── ProfilePage.tsx              # Container (existing)
│       └── ProfilePageView.tsx          # Presentational (existing)
└── App.tsx                              # ~150 lines
```

## Recommended Approach: **Option 3 (Hybrid)**

### Rationale:
1. Respects existing ProfilePage pattern (domain-specific pages in their domain folder)
2. Simple pages go in `/pages/` (HomePage, ClassPage, WalletPage)
3. Complex pages with domain logic stay in `/components/{domain}/`
4. Clear organization as project scales

## Implementation Steps

### Phase 1: Create pages directory and simple pages
1. Create `/app/src/pages/HomePage.tsx`
2. Create `/app/src/pages/ClassPage.tsx`
3. Create `/app/src/pages/WalletPage.tsx`

### Phase 2: Extract karaoke page containers
1. Create `/app/src/components/karaoke/KaraokePage.tsx`
   - Move PostFlowContainer wrapper logic

2. Create `/app/src/components/karaoke/KaraokeSongPage.tsx`
   - Extract from App.tsx lines 56-239
   - Includes: useSongData, external link construction, unlock logic
   - Renders: `<SongPage />` from `/components/class/`

3. Create `/app/src/components/karaoke/KaraokeSegmentPage.tsx`
   - Extract from App.tsx lines 241-302
   - Includes: useSongData, segment loading, lyrics logic
   - Renders: `<SongSegmentPage />` from `/components/class/`

### Phase 3: Extract helper utilities
1. Create `/app/src/lib/karaoke/externalLinks.ts`
   - `buildExternalSongLinks(song: Song): ExternalLink[]`
   - `buildExternalLyricsLinks(song: Song): ExternalLink[]`
   - Clean slug generation logic

2. Create `/app/src/lib/karaoke/types.ts` (if needed)
   - `ExternalLink` interface
   - Shared karaoke types

### Phase 4: Clean up App.tsx
1. Import page components
2. Keep ONLY:
   - AppRouter component (routing + layout)
   - App root component (providers)
   - Global auth/layout state
3. Target: ~150 lines max

## File Structure After Refactoring

```
app/src/
├── pages/                                    # NEW
│   ├── HomePage.tsx                          # ~20 lines
│   ├── ClassPage.tsx                         # ~20 lines
│   └── WalletPage.tsx                        # ~20 lines
├── components/
│   ├── karaoke/
│   │   ├── KaraokePage.tsx                   # NEW - ~30 lines
│   │   ├── KaraokeSongPage.tsx               # NEW - ~100 lines
│   │   ├── KaraokeSegmentPage.tsx            # NEW - ~60 lines
│   │   └── SongSelectPage.tsx                # EXISTING
│   ├── class/
│   │   ├── SongPage.tsx                      # EXISTING (presentational)
│   │   └── SongSegmentPage.tsx               # EXISTING (presentational)
│   └── profile/
│       ├── ProfilePage.tsx                   # EXISTING
│       └── ProfilePageView.tsx               # EXISTING
├── lib/
│   └── karaoke/
│       ├── externalLinks.ts                  # NEW - link generation utilities
│       └── types.ts                          # NEW - shared types (if needed)
└── App.tsx                                   # ~150 lines (routing + providers ONLY)
```

## Success Criteria
- [ ] App.tsx reduced from 716 to ~150 lines
- [ ] All page components properly extracted
- [ ] Clear separation: containers (logic) vs presentational (UI)
- [ ] No duplicate code
- [ ] All existing functionality preserved
- [ ] Easy to find and maintain page code
- [ ] Pattern established for future pages
