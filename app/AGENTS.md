# Karaoke School v1 - Agent Briefing

## Core Commands

• **Development**: `bun run dev` (Vite dev server)
• **Build**: `bun run build` (TypeScript + Vite production build)
• **Lint**: `bun run lint` (ESLint with strict rules)
• **Type Check**: `bun run type-check` (runs through build process)
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
- Grove/Irys for asset uploads (requires API keys)
- Lit Protocol for PKP operations (WebAuthn required)

## External Services & Environment

**Required Environment Variables**:
- `VITE_LENS_ENVIRONMENT` - Lens testnet/mainnet
- `VITE_LENS_APP_ADDRESS` - Lens app contract address
- `VITE_PKP_WALLET` - Lit Protocol configuration

**External APIs**:
- **Lens Protocol**: Social identity & profiles
- **Lit Protocol**: PKP wallet authentication
- **Grove/Irys**: Decentralized asset storage
- **Spotify API**: Track metadata & audio
- **TikTok API**: Video scraping & metadata

## Documentation Sources

- **Comprehensive Architecture**: `/media/t42/th42/Code/karaoke-school-v1/CLAUDE.md` - Complete technical specification
- **Lens Integration**: `src/lib/lens/README.md` - Detailed Lens Protocol guide
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
