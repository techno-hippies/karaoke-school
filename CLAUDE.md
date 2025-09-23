# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Start development server with environment variables
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Start development server with production env
npm run dev:prod
```

### Code Quality
```bash
# Lint code
npm run lint

# Type checking is done via tsc during build
npm run build
```

### Testing
```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once (CI mode)
npm run test:run
```

### Storybook
```bash
# Start Storybook development server
npm run storybook

# Build Storybook
npm run build-storybook
```

## Architecture

### Core Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: TailwindCSS v4 with shadcn/ui components
- **Routing**: React Router DOM with hash routing for IPFS compatibility
- **State Management**: XState state machines for complex flows
- **Blockchain**: Wagmi + Viem for Ethereum interaction
- **Authentication**: LIT Protocol PKP + SIWE integration

### Key Features
This is a decentralized video platform with blockchain-verified view tracking:

1. **View Tracking SDK**: Blockchain-verified view tracking using LIT Protocol PKPs and smart contracts
2. **Lens Protocol Integration**: Social features and profile management via Lens v3
3. **Wallet Integration**: Multi-wallet support via RainbowKit and Reown AppKit
4. **Video Processing**: Livepeer integration for video streaming and thumbnails
5. **IPFS Deployment**: Static site optimized for IPFS hosting

### Directory Structure

**State Management (`src/machines/`)**
- XState machines for complex application flows
- `feedMachine.ts` - Video feed state management
- `videoMachine.ts` - Individual video player state
- `viewTrackingMachine.ts` - View verification workflow
- `feedCoordinatorMachine.ts` - Coordinates multiple feed instances

**Blockchain Integration (`src/lib/`)**
- `lens-feed.ts` - Lens Protocol API integration and content fetching
- `pkp-lens-mapping.ts` - Maps PKP wallets to Lens profiles
- `tiktok-api.ts` - Legacy TikTok API integration (deprecated)
- `livepeer-thumbnails.ts` - Video thumbnail generation
- `creator-mappings.ts` - Creator profile mappings

**Components (`src/components/`)**
- `feed/` - Video feed and player components
- `auth/` - Authentication flows and wallet connection
- `profile/` - User profile management (Lens integration)
- `navigation/` - App navigation components

**Providers (`src/providers/`)**
- `WalletProvider.tsx` - Wallet connection and configuration
- `LitAuthProvider.tsx` - LIT Protocol authentication setup

**SDK (`src/sdk/`)**
- Self-contained view tracking SDK with React hooks
- Can be extracted and used in other applications
- Handles LIT Protocol integration and smart contract interaction

### Configuration

**Environment Variables**
```env
ELEVENLABS_API_KEY=          # Voice generation (encrypted with dotenvx)
LIT_NETWORK=datil-dev        # LIT Protocol network
BASE_RPC_URL=                # Base network RPC endpoint
```

**Vite Configuration**
- IPFS-compatible build with relative paths
- Node.js polyfills for blockchain libraries
- Local subgraph proxy for development
- Optimized for Web3 dependencies

### Development Patterns

**State Machines**
- Use XState for complex async workflows
- Centralized state management for video and authentication flows
- Type-safe state transitions and event handling

**Component Architecture**
- shadcn/ui base components in `components/ui/`
- Feature-specific components organized by domain
- React hooks for blockchain integration

**Blockchain Integration**
- Wagmi hooks for Ethereum interaction
- LIT Protocol for decentralized authentication
- Smart contract ABIs in `src/abi/`

### Key Dependencies
- `@lens-protocol/client` - Lens Protocol v3 integration
- `@lit-protocol/*` - Decentralized authentication and PKP management
- `@reown/appkit` + `@rainbow-me/rainbowkit` - Multi-wallet support
- `xstate` - State machine management
- `viem` + `wagmi` - Ethereum interaction
- `react-vertical-feed` - TikTok-style video feed component

### Testing
- Vitest for unit testing
- Browser testing with Playwright
- Storybook for component development and testing
- Coverage reporting with v8

### Deployment
Optimized for IPFS deployment with:
- Hash-based routing
- Relative asset paths
- Bundled dependencies for offline access
- Sourcemap generation for debugging