# Karaoke School v1 - Frontend Application

**AI-powered language learning through music with blockchain-native copyright tracking**

This is the main frontend application for Karaoke School v1, built with React, TypeScript, and Vite. It provides a decentralized karaoke experience with AI-powered pronunciation scoring, multi-language translations, and blockchain-integrated copyright tracking.

## 🎯 What This Application Provides

Karaoke School v1 is a revolutionary language learning platform that combines:

- **AI-Powered Scoring**: Pronunciation analysis using advanced AI models
- **Multi-Language Support**: Translations in 3+ languages with word-level timing
- **Blockchain Integration**: GRC-20 for music metadata, Lens Protocol for social features
- **Decentralized Storage**: Grove/IPFS for immutable audio and metadata storage
- **Smart Contracts**: Automatic royalty distribution and copyright tracking

### 🎮 Key Features

- **🎵 Interactive Karaoke Player**: Word-level timing with instrumental backing
- **📱 TikTok Integration**: Creator videos with automatic copyright tracking
- **🌍 Multi-Language Translations**: Chinese, Vietnamese, Indonesian, and more
- **👤 Social Features**: Creator profiles and follower system via Lens Protocol
- **💳 PKP Wallet Integration**: Passkey-based authentication with Lit Protocol
- **📊 Performance Analytics**: Pronunciation scores and learning progress tracking
- **🔄 Spaced Repetition**: FSRS algorithm for optimized language retention

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Application                         │
│               (React + TypeScript + Vite)                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Integrates
┌─────────────────────────────────────────────────────────────────┐
│                 Blockchain Protocols                            │
│  GRC-20 (Music Metadata) | Lens (Social) | Smart Contracts     │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Stores
┌─────────────────────────────────────────────────────────────────┐
│                Decentralized Storage                            │
│                    Grove/IPFS                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Processes
┌─────────────────────────────────────────────────────────────────┐
│                  Backend Services                               │
│  Audio Separation | AI Scoring | Translation | Webhooks         │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **Bun** installed
- **WebAuthn support** (for PKP passkey authentication)
- **Lens Protocol account** (social identity)
- **Environment variables** configured

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd app

# Install dependencies
bun install

# Set up environment
cp .env.example .env.local
# Configure environment variables (see Environment section)
```

### Development Server

```bash
# Start development server
bun run dev

# Open browser to http://localhost:5173
```

### Build for Production

```bash
# Build production bundle
bun run build

# Preview production build locally
bun run preview
```

### Storybook (Component Documentation)

```bash
# Start Storybook for component development
bun run storybook

# Open browser to http://localhost:6006
```

## 🔐 Authentication System

Karaoke School uses a **dual-layer authentication system**:

### Layer 1: PKP (Lit Protocol)
- **Purpose**: Passkey wallet identity and signing
- **Technology**: WebAuthn-based authentication
- **Usage**: Wallet operations, transaction signing, session management

### Layer 2: Lens Protocol  
- **Purpose**: Social identity and profiles
- **Features**: Username, profile picture, follower system
- **Usage**: Social features, creator profiles, content discovery

### Authentication Flow

```tsx
import { useAuth } from '@/contexts/AuthContext';

function App() {
  const { user, isLoading, login, logout } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  
  if (!user) {
    return (
      <AuthScreen onLogin={login} />
    );
  }
  
  return <MainApp user={user} />;
}
```

## 🧭 Application Pages

### Home Feed (`/`)
- **Purpose**: Timeline of creator videos and performances
- **Features**: Infinite scroll, video playback, performance scores
- **Data**: Fetched via Lens Protocol queries

### Search (`/search`)
- **Purpose**: Discover songs, creators, and content
- **Features**: Song search, creator search, filtering
- **Integrations**: Spotify API for track metadata

### Creator Profile (`/u/:handle`)
- **Purpose**: Creator's profile and content
- **Features**: Profile info, follower count, video grid
- **Data**: Lens Protocol profile data

### Song Overview (`/song/:id`)
- **Purpose**: Song details and creator videos
- **Features**: Track metadata, translations, segment timing
- **Data**: GRC-20 work data + creator videos

### Karaoke Player (`/song/:id/play`)
- **Purpose**: Interactive karaoke experience
- **Features**: Word-level timing, instrumental playback, scoring
- **Integrations**: Lit Actions for AI scoring

### Wallet (`/wallet`)
- **Purpose**: PKP wallet management
- **Features**: Address display, transaction history, settings
- **Technology**: Lit Protocol PKP integration

### Profile (`/profile`)
- **Purpose**: Current user profile management
- **Features**: Edit profile, view performances, settings
- **Data**: Lens Protocol profile + performance data

## 🎨 Project Structure

```
src/
├── components/         # Feature-based UI components
│   ├── audio/         # Audio player & waveform components
│   ├── karaoke/       # Lyrics & timing display
│   ├── video/         # TikTok video integration
│   ├── feed/          # Social feed & post components
│   ├── search/        # Song & creator search UI
│   ├── wallet/        # PKP & Lens wallet integration
│   └── ui/            # Reusable shadcn/ui components
├── pages/             # Route-level page containers
├── contexts/          # React Context providers
├── hooks/             # Custom React hooks
├── lib/               # Protocol integrations & utilities
│   ├── lens/          # Lens Protocol integration
│   ├── lit/           # Lit Protocol PKP authentication
│   └── auth/          # Passkey authentication flows
└── types/             # TypeScript type definitions
```

### Component Architecture

**Feature-based Organization**:
- Components organized by feature (audio, karaoke, video, etc.)
- Container components in `pages/` handle data fetching
- Custom hooks contain business logic
- Context providers manage shared state

**Example Component Structure**:
```tsx
// components/karaoke/KaraokePlayer.tsx
export function KaraokePlayer({ trackId }: { trackId: string }) {
  const { data: segments } = useTrackSegments(trackId);
  const { audioUrl } = useInstrumentalAudio(segments);
  
  return (
    <div>
      <AudioPlayer src={audioUrl} />
      <LyricsDisplay segments={segments} />
    </div>
  );
}
```

## 🎛️ State Management

The application uses a three-tier state management approach:

### 1. React Query (Server State)
- **Purpose**: API data, GraphQL queries, caching
- **Usage**: Track data, user profiles, performance history
- **Benefits**: Automatic caching, background updates, error handling

```tsx
import { useQuery } from '@tanstack/react-query';

function useTrackSegments(trackId: string) {
  return useQuery({
    queryKey: ['segments', trackId],
    queryFn: () => fetchTrackSegments(trackId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### 2. Context (Shared State)
- **Purpose**: Authentication, playback state, global settings
- **Usage**: User session, audio player state, theme

```tsx
// contexts/AuthContext.tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(null);
  const [pkpSession, setPkpSession] = useState(null);
  
  // PKP + Lens integration logic
  // ...
  
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### 3. Local State (UI State)
- **Purpose**: Component-specific UI state
- **Usage**: Modal visibility, form inputs, UI interactions
- **Tools**: `useState`, `useReducer`

## 🎨 Styling System

The application uses a modern, utility-first styling approach:

### Tailwind CSS
- **Purpose**: Utility-first CSS framework
- **Usage**: Responsive design, consistent spacing, rapid prototyping

### shadcn/ui Components
- **Purpose**: High-quality React component library
- **Technology**: Built on Radix UI primitives with Tailwind CSS
- **Benefits**: Accessible, customizable, themeable

### CSS Variables
- **Purpose**: Theme consistency and dark mode support
- **Usage**: Colors, spacing, typography, component themes

```css
/* CSS Variables for Theme */
:root {
  --primary: 222.2 84% 4.9%;
  --primary-foreground: 210 40% 98%;
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

[data-theme="dark"] {
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 84% 4.9%;
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

## 🔗 Protocol Integrations

### GRC-20 (Music Metadata)
- **Purpose**: Immutable artist and work identifiers
- **Usage**: Music industry metadata, cross-platform references
- **Benefits**: Permanent identifiers, public good infrastructure

### Lens Protocol (Social Features)
- **Purpose**: Decentralized social identity and profiles
- **Usage**: User profiles, follower system, content discovery
- **Integration**: `@lens-protocol/react` hooks and components

```tsx
import { useProfile, usePublications } from '@lens-protocol/react';

function CreatorProfile({ handle }: { handle: string }) {
  const { data: profile } = useProfile({ handle });
  const { data: publications } = usePublications({
    where: { from: profile?.id },
  });
  
  return (
    <div>
      <ProfileHeader profile={profile} />
      <PublicationsGrid publications={publications} />
    </div>
  );
}
```

### Grove/IPFS (Decentralized Storage)
- **Purpose**: Immutable storage for audio, metadata, translations
- **Usage**: Instrumental audio, word alignments, translation JSON
- **Access**: `grove://` URIs with CDN access

### Smart Contracts (Event Emission)
- **Purpose**: Karaoke segments, translations, performances
- **Usage**: Real-time updates via The Graph subgraphs
- **Benefits**: Fast queries, leaderboards, analytics

## 🔧 Development Guidelines

### TypeScript Conventions
- **Strict Mode**: Enabled for type safety
- **Interface Over Type**: Use interfaces for public APIs
- **No @ts-ignore**: Solve type issues properly
- **Domain Types**: Defined in `src/types/` for consistency

```tsx
// types/track.ts
export interface TrackSegment {
  id: string;
  spotifyTrackId: string;
  startMs: number;
  endMs: number;
  instrumentalUrl: string;
  alignmentUrl: string;
  translations: Translation[];
}
```

### Component Patterns

**Feature Components**:
```tsx
// Feature-specific component
export function KaraokeLyrics({ segments }: { segments: TrackSegment[] }) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  
  return (
    <div className="lyrics-container">
      {segments.map(segment => (
        <LyricsLine
          key={segment.id}
          words={segment.words}
          isActive={segment.id === currentSegment?.id}
        />
      ))}
    </div>
  );
}
```

**Container Components**:
```tsx
// Page-level container with data fetching
export default function SongPage({ params }: { params: { id: string } }) {
  const { data: track, isLoading } = useQuery({
    queryKey: ['track', params.id],
    queryFn: () => fetchTrack(params.id),
  });
  
  if (isLoading) return <TrackPageSkeleton />;
  
  return (
    <TrackPage track={track}>
      <TrackHeader track={track} />
      <KaraokePlayer trackId={params.id} />
    </TrackPage>
  );
}
```

### Custom Hooks Pattern

**Business Logic Isolation**:
```tsx
// hooks/useKaraokeScoring.ts
export function useKaraokeScoring(trackId: string) {
  const { user } = useAuth();
  const [isScoring, setIsScoring] = useState(false);
  
  const submitRecording = async (audioBlob: Blob) => {
    setIsScoring(true);
    
    try {
      // Convert to base64
      const audioBase64 = await blobToBase64(audioBlob);
      
      // Execute Lit Action for scoring
      const result = await executeLitAction('karaoke-scorer-v4', {
        audioDataBase64: audioBase64,
        trackId,
        userAddress: user.pkpAddress,
      });
      
      return result;
    } finally {
      setIsScoring(false);
    }
  };
  
  return { submitRecording, isScoring };
}
```

## 🌍 Environment Configuration

### Required Environment Variables

```bash
# .env.local

# Lens Protocol Configuration
VITE_LENS_ENVIRONMENT=testnet
VITE_LENS_APP_ADDRESS=0x1234567890123456789012345678901234567890

# Lit Protocol Configuration  
VITE_PKP_WALLET=0xabcdefabcdefabcdefabcdefabcdefabcdefabcd

# Grove/IPFS Configuration
VITE_GROVE_API_KEY=your_grove_api_key

# Development
VITE_API_BASE_URL=http://localhost:3000
VITE_ENABLE_MOCK_DATA=false
```

### Environment Setup Guide

1. **Lens Protocol**:
   - Sign up at [Lens Protocol](https://lens.xyz)
   - Create an app and get contract address
   - Configure for testnet during development

2. **Lit Protocol**:
   - Set up PKP (Programmable Key Pair)
   - Configure WebAuthn for passkey authentication
   - Get PKP address for environment variables

3. **Grove Storage**:
   - Sign up for Grove account
   - Get API key for asset uploads
   - Configure chain ID (Base Sepolia: 37111)

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
```

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bun run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npx", "serve", "-s", "dist", "-l", "3000"]
```

### Static Deployment

```bash
# Build static files
bun run build

# Deploy dist/ folder to any static hosting
# (Netlify, GitHub Pages, Cloudflare Pages, etc.)
```

## 🧪 Testing & Quality

### Storybook (Component Development)

```bash
# Start Storybook
bun run storybook

# Build static Storybook
bun run build-storybook
```

**Component Stories**:
```tsx
// components/karaoke/KaraokeLyrics.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { KaraokeLyrics } from './KaraokeLyrics';

const meta: Meta<typeof KaraokeLyrics> = {
  title: 'Karaoke/KaraokeLyrics',
  component: KaraokeLyrics,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    segments: sampleSegments,
  },
};
```

### Linting

```bash
# Run ESLint
bun run lint

# Fix auto-fixable issues
bun run lint:fix
```

### Type Checking

```bash
# TypeScript type checking
tsc --noEmit
```

## 🐛 Troubleshooting

### Authentication Issues

**PKP Not Working**:
- Check WebAuthn browser support
- Clear browser storage and restart authentication flow
- Verify PKP configuration in environment variables

**Lens Session Problems**:
- Clear Lens session and re-authenticate
- Check Lens environment (testnet vs mainnet)
- Verify contract address configuration

### Build Issues

**TypeScript Errors**:
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
rm -rf dist

# Reinstall dependencies
bun install
bun run build
```

**Missing Dependencies**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules
bun install
```

### Protocol Integration Issues

**Lens Protocol**:
- Check network connectivity to Lens endpoints
- Verify contract addresses match environment
- Review browser console for protocol errors

**Grove Storage**:
- Verify API key configuration
- Check chain ID matches network
- Ensure sufficient Grove credits

### Performance Issues

**Slow Loading**:
- Enable React Query caching
- Optimize bundle size with code splitting
- Use lazy loading for routes

**Audio Playback Issues**:
- Check Web Audio API support
- Verify audio format compatibility
- Test with different browsers

## 🔧 Advanced Features

### Offline Support
The application supports basic offline functionality:
- Service worker for asset caching
- React Query offline persistence
- Graceful degradation for protocol features

### Real-time Updates
- WebSocket connections for live scores
- The Graph subscriptions for contract events
- Lens Protocol real-time updates

### Performance Optimization
- Code splitting by routes
- Lazy loading of heavy components
- Image optimization and lazy loading
- Audio preloading for smooth playback

## 📚 Additional Resources

### Technical Documentation
- **[Main Architecture](./CLAUDE.md)**: Complete technical specification
- **[Lens Integration](./src/lib/lens/README.md)**: Detailed Lens Protocol guide
- **[Component Stories](./components/)**: Storybook documentation

### External Documentation
- **[React Documentation](https://react.dev/)**
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)**
- **[Vite Documentation](https://vitejs.dev/)**
- **[Tailwind CSS](https://tailwindcss.com/)**
- **[shadcn/ui](https://ui.shadcn.com/)**
- **[Lens Protocol](https://docs.lens.xyz/)**
- **[Lit Protocol](https://lit-protocol.medium.com/)**

## 🤝 Contributing

### Development Workflow

1. **Setup Environment**: Install dependencies and configure environment
2. **Choose Feature**: Pick a feature component or page to work on
3. **Create Component**: Follow established patterns and conventions
4. **Add Tests**: Create Storybook stories for new components
5. **Type Safety**: Ensure TypeScript strict mode compliance
6. **Performance**: Optimize for loading speed and responsiveness
7. **Documentation**: Update README or add component stories

### Code Standards

- **TypeScript**: Strict mode, interfaces for public APIs
- **Components**: Functional components with hooks
- **Styling**: Tailwind CSS classes, consistent design tokens
- **State**: React Query for server state, Context for global state
- **Performance**: Code splitting, lazy loading, optimization

### Pull Request Process

1. Create feature branch from main
2. Implement changes with tests and documentation
3. Run linting and type checking
4. Create pull request with description
5. Address code review feedback
6. Merge after approval

---

**Built with ❤️ using React, TypeScript, and modern web technologies for decentralized language learning**
