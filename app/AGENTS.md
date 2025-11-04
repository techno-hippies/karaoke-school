# Karaoke School v1 - React Development Guide

## Core Commands

• **Development**: `bun run dev` (Vite dev server)
• **Build**: `bun run build` (TypeScript + Vite production build)
• **Lint**: `bun run lint` (ESLint with strict rules)
• **Storybook**: `bun run storybook` (component documentation)
• **Preview**: `bun run preview` (preview production build)

## Project Layout

```
src/
├── components/     # Feature-based UI components
│   ├── audio/     # Audio player & waveform
│   ├── karaoke/   # Lyrics & timing display
│   ├── video/     # TikTok video integration
│   ├── feed/      # Social feed & posts
│   ├── search/    # Song & creator search
│   ├── wallet/    # PKP & Lens wallet integration
│   └── ui/        # Reusable shadcn/ui components
├── pages/         # Route-level page containers
├── contexts/      # React Context providers
├── hooks/         # Custom React hooks
├── lib/           # Protocol integrations & utilities
│   ├── lens/      # Lens Protocol social features
│   ├── lit/       # Lit Protocol PKP authentication
│   └── auth/      # Passkey authentication flows
└── types/         # TypeScript type definitions
```

## Key Architectural Concepts

**Dual-Layer Authentication**:
- **Layer 1**: PKP (Lit Protocol) - Passkey wallet identity
- **Layer 2**: Lens Protocol - Social username & profile
- **Context**: `AuthContext` manages both layers

**Multi-Protocol Integration**:
- **GRC-20**: Immutable artist/work identifiers (music industry metadata)
- **Lens Chain**: Social features (profiles, posts, discovery)
- **Grove/IPFS**: Decentralized storage (audio, metadata, translations)
- **Smart Contracts**: Event emission for karaoke segments & translations

**Routing Structure**:
- `/` - Home feed (all creator videos chronologically)
- `/search` - Song & creator search
- `/u/:handle` - Creator profile (Lens integration)
- `/song/:id` - Song overview + creator videos
- `/song/:id/play` - Karaoke player with instrumental
- `/wallet` - PKP wallet & address management
- `/profile` - Current user profile

## Development Patterns

**Component Architecture**:
- Feature-based folders in `components/`
- Container components in `pages/` with data fetching
- Custom hooks for business logic
- Context providers for shared state

**State Management**:
- **React Query**: Server state (GraphQL, REST APIs)
- **Context**: Authentication & playback state
- **Local state**: Component-specific UI state

**Styling**:
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Component library (Radix UI + Tailwind)
- **CSS variables**: Theme consistency

## ⚡ Performance Optimization Patterns

### Critical Performance Issues & Solutions

#### 1. VideoPlayer Media Loading Loop
**Problem**: Continuous retry loop causing fan spinning  
**Solution**: Add debouncing and error state persistence

```tsx
const lastLoadRef = useRef<string>('')
const timeoutRef = useRef<NodeJS.Timeout>()

useEffect(() => {
  if (!videoUrl) return
  
  // Debounce video loading to prevent rapid-fire attempts
  const loadVideo = () => {
    if (videoUrl !== lastLoadRef.current) {
      console.log('[VideoPlayer] Loading video:', videoUrl)
      lastLoadRef.current = videoUrl
      send({ type: 'LOAD', videoUrl, thumbnailUrl })
    }
  }
  
  // Clear existing timeout
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current)
  }
  
  // Debounce by 500ms
  timeoutRef.current = setTimeout(loadVideo, 500)
  
  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }
}, [videoUrl, thumbnailUrl, send])

// Add error state persistence to prevent immediate retries
useEffect(() => {
  if (state.matches('error') && state.context.error) {
    // Don't retry immediately - wait for explicit user action
    console.log('[VideoPlayer] Video error:', state.context.error)
  }
}, [state])
```

#### 2. Mass Re-rendering in News Feed
**Problem**: All feed components re-render on every parent update  
**Solution**: Add React.memo, useMemo, useCallback optimizations

```tsx
// Memoize the entire component
export const VerticalVideoFeed = memo(function VerticalVideoFeed({
  videos, isLoading = false, onLoadMore, hasMore = false, initialVideoId,
  updateUrlOnScroll = false, baseUrl, hasMobileFooter = false,
}: VerticalVideoFeedProps) {
  
  // Memoize event handlers
  const handleLoadMore = useCallback(() => {
    if (hasMore && onLoadMore) {
      onLoadMore()
    }
  }, [hasMore, onLoadMore])
  
  // Memoize navigation handlers
  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    const container = containerRef.current
    if (!container) return
    
    const newIndex = direction === 'down' ? activeIndex + 1 : activeIndex - 1
    if (newIndex >= 0 && newIndex < videos.length) {
      container.scrollTo({
        top: newIndex * container.clientHeight,
        behavior: 'smooth'
      })
    }
  }, [activeIndex, videos.length])
  
  // Memoize scroll handler
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    
    const scrollTop = container.scrollTop
    const viewportHeight = container.clientHeight
    const newIndex = Math.round(scrollTop / viewportHeight)
    
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < videos.length) {
      setActiveIndex(newIndex)
      
      // Preload next videos
      if (newIndex >= videos.length - 2 && hasMore) {
        handleLoadMore()
      }
    }
  }, [activeIndex, videos.length, hasMore, handleLoadMore])
  
  // Memoize video data to prevent recreation
  const memoizedVideos = useMemo(() => {
    return videos.map((video, index) => ({
      ...video,
      key: video.id, // Ensure stable keys
      index
    }))
  }, [videos])
  
  // ... rest of component
})

// Wrap VideoPost with React.memo
export const VideoPost = memo(function VideoPost({ /* props */ }) {
  // ... component code
})
```

#### 3. State Management Optimization
```tsx
// Use cache refs to prevent full re-renders
const followStateCache = useRef<Record<string, boolean>>({})
const likeStateCache = useRef<Record<string, { isLiked: boolean; count: number }>>({})

// Update cache without triggering component re-renders
```

#### 4. Video Element Optimization
```tsx
// Prevent video element recreation
const videoRef = useRef<HTMLVideoElement>(null)
const lastVideoUrlRef = useRef<string>('')

// Only update video src if it actually changed
useEffect(() => {
  const video = videoRef.current
  if (!video || videoUrl === lastVideoUrlRef.current) return
  
  lastVideoUrlRef.current = videoUrl || ''
  video.src = videoUrl || ''
}, [videoUrl]) // Remove other dependencies
```

## 🔗 Lens Integration Details

### Authentication Architecture

**Global Namespace (Current Implementation)**:
- **Testnet**: `0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7`
- **Mainnet**: `0x8A5Cc31180c37078e1EbA2A23c861Acf351a97cE`
- **Benefit**: Gasless operations via typedData relay
- **Username**: Global namespace (not custom `kschool1/*`)

### Account Creation Flow

```typescript
// 1. Login as onboarding user
const session = await loginAsOnboardingUser(walletClient, walletAddress)

// 2. Create account metadata (upload to Grove)
const metadata = accountMetadata({ name, bio, picture })
const uploadResult = await storageClient.uploadAsJson(metadata, { acl })

// 3. Create account
const account = await createAccount(session, walletClient, uploadResult.uri)

// 4. Switch to account owner
await session.switchAccount({ account: account.address })

// 5. Create username (if using custom namespace)
await createUsername(session, walletClient, username, uploadResult.uri)
```

### Critical Files

**Authentication Context**: `src/contexts/AuthContext.tsx`
- Manages both PKP + Lens state
- Handles WebAuthn flows
- Auto-initializes sessions

**Lens Client**: `src/lib/lens/config.ts`
- Public client setup
- Environment configuration

**Auth Flows**: `src/lib/auth/flows.ts`
- PKP → Lens registration
- PKP → Lens login
- Username validation

### Data Flow

**New User Registration**:
```
WebAuthn Passkey → PKP Wallet → Lens Onboarding → Lens Account → Username Creation
```

**Existing User Login**:
```
WebAuthn Passkey → PKP Wallet → Lens Session Resume → Account Owner Role
```

### Common Integration Issues

**WebAuthn Requirements**:
- Must be triggered by user gesture
- Only works over HTTPS (except localhost)
- Requires compatible browser

**Session Persistence**:
- PKP sessions auto-restore
- Lens sessions require explicit login
- Check `useAuth()` context before assuming connection

**Namespace Issues**:
- Currently using global namespace (not custom `kschool2/*`)
- Custom namespaces only return `raw` transactions, requiring PKP wallet gas funds
- Global namespace supports typedData relay for gasless operations
- Username validation format: lowercase, alphanumeric, underscores, 6+ chars

### Technical Implementation Details

**Transaction Flow Analysis**:

1. **Create Account** (✅ Fully sponsored)
   - User role: ONBOARDING_USER
   - Returns `hash` (no signature needed)
   - Works perfectly with sponsorship

2. **Switch to Account Owner** (✅ Works after DB optimization)
   - User role: Switch ONBOARDING_USER → ACCOUNT_OWNER
   - Returns `hash` (fully sponsored)
   - Previously failed due to 820ms DB queries exceeding 1000ms timeout

3. **Create Username** (❌ Requires PKP funds in custom namespace)
   - User role: ACCOUNT_OWNER
   - Custom namespace: Returns `raw` only (needs PKP gas)
   - Global namespace: Returns `typedData` + `id` (gasless relay)

**Transaction Type Comparison**:

| Type | Signature | PKP Funds | Use Case |
|------|-----------|-----------|----------|
| `hash` | ❌ No | ❌ No | Simple operations (account creation) |
| `typedData` + `id` | ✅ Yes | ❌ No | Gasless relay (global namespace) |
| `raw` | ✅ Yes | ✅ **YES** | Direct RPC submission (custom namespace) |

### Testing Lens Integration

**Test Credentials**:
- Use Lens testnet (`37111` chain)
- Global namespace usernames (free)
- Test PKP wallets for authentication

**Debug Steps**:
1. Check browser WebAuthn support
2. Verify environment variables (`bun run lint`)
3. Test with 6+ character username
4. Monitor Lens API responses

## Critical Conventions

**Authentication**:
- Always check `useAuth()` context before assuming wallet connection
- PKP initialization is automatic on mount if session exists
- Lens account creation requires username input flow

**Protocol Integration**:
- Use `@lens-protocol/react` for Lens features
- Use `@lit-protocol/*` packages for PKP operations
- Grove assets accessed via `grove://` URIs

**TypeScript**:
- Strict mode enabled
- Avoid `@ts-ignore`
- Use interfaces for public APIs
- Types defined in `src/types/` for domain models

**Testing**:
- Storybook for component documentation
- Visual testing for UI components
- No unit test framework currently configured

## Gotchas & Common Issues

**Authentication State**:
- PKP session persists across page reloads
- Lens session requires explicit login
- Auth flows use WebAuthn (passkeys) - requires user gesture

**Build Issues**:
- `buffer` polyfill required for some dependencies
- Vite config includes Tailwind CSS plugin
- TypeScript strict mode may catch new issues

**Protocol Dependencies**:
- Lens Protocol on testnet (environment variable configurable)
- Grove for asset uploads (requires API keys)
- Lit Protocol for PKP operations (WebAuthn required)

**Performance Issues**:
- VideoPlayer media loading loops causing fan spinning
- Mass re-rendering in news feed components
- No React.memo, useMemo, or useCallback optimizations

## External Services & Environment

**Required Environment Variables**:
- `VITE_LENS_ENVIRONMENT` - Lens testnet/mainnet
- `VITE_LENS_APP_ADDRESS` - Lens app contract address
- `VITE_PKP_WALLET` - Lit Protocol configuration

**External APIs**:
- **Lens Protocol**: Social identity & profiles
- **Lit Protocol**: PKP wallet authentication
- **Grove**: Decentralized asset storage
- **Spotify API**: Track metadata & audio
- **TikTok API**: Video scraping & metadata

## Documentation Sources

- **Comprehensive Architecture**: `/media/t42/th42/Code/karaoke-school-v1/CLAUDE.md` - Complete technical specification
- **Root README.md**: Project overview and current system state
- **Root AGENTS.md**: Service integration guide
- **Component Stories**: Storybook stories in component directories

## When Things Go Wrong

**Authentication Issues**:
- Clear browser storage and restart flow
- Check WebAuthn support (required for PKP)
- Verify Lens environment configuration

**Build Failures**:
- Clear `node_modules` and reinstall: `bun install`
- Check TypeScript errors: `bun run build`
- Verify environment variables

**Protocol Integration**:
- Check network connectivity to Lens/Lit endpoints
- Verify contract addresses match environment
- Review browser console for protocol errors

**Performance Issues**:
- Enable React Scan: Add `REACT_SCAN_ENABLED=true` to `.env.local`
- Implement memoization patterns (React.memo, useMemo, useCallback)
- Optimize state management to prevent full re-renders
- Debounce video loading to prevent rapid-fire attempts
