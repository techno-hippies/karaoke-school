# One.js + Lit Protocol PoC

**Goal**: Validate if Lit Protocol PKPs work with One.js + React Native before committing to full migration.

**Status**: 🚧 **BLOCKED** - See [FINDINGS.md](./FINDINGS.md) for details

## What We Attempted

1. ✅ One.js basic setup (web + native)
2. ✅ Tamagui styling (cross-platform UI)
3. ✅ Lit Protocol dependencies installed (v8.3.2)
4. ✅ PKP test suite implemented
5. ❌ Dev server blocked by expo-modules-core errors

## ⚠️ Critical Issues

We encountered dependency hell before testing Lit Protocol:
- `expo-modules-core` package resolution errors
- `viem` version conflicts with @wagmi/core
- Cannot start dev server

**Read [FINDINGS.md](./FINDINGS.md) for full analysis and recommendations.**

## Quick Start (If Issues Are Resolved)

### 1. Install Dependencies

```bash
cd one-poc
bun install --save-exact
```

### 2. Run Web (Development)

```bash
bun run dev
```

Open http://localhost:8081

### 3. Run Android

```bash
# First, ensure you have Android emulator running or device connected
bun run android
```

Or use Expo Go:
```bash
bun run dev
# Scan QR code with Expo Go app
```

## Critical Test: Lit Protocol PKPs

The main blocker for using One.js is whether Lit Protocol's PKP authentication works in React Native.

### What to Test

1. **WebAuthn Support**: Does `@lit-protocol/auth-helpers` work without browser WebAuthn API?
2. **Passkey Auth**: Can we use biometric auth as fallback?
3. **PKP Session**: Can we maintain PKP sessions across native app lifecycle?

### Expected Issues

- `window` object not available
- `navigator.credentials` (WebAuthn) not available
- Crypto APIs might differ between web/native

### Fallback Options if PKP Fails

1. **WebView Bridge**: Embed web view for PKP auth, bridge to native
2. **Biometric Fallback**: Use `expo-local-authentication` for device auth
3. **Email/SMS OTP**: Less secure, but works everywhere

## Next Steps

If Lit Protocol PKPs work:
- ✅ Migrate main app to One.js
- ✅ Use Tamagui for all UI components
- ✅ Estimated migration: 4-5 weeks

If Lit Protocol PKPs don't work:
- ⚠️ Build separate React Native app
- ⚠️ Share business logic only (not UI)
- ⚠️ Estimated: 6-8 weeks

## Project Structure

```
one-poc/
├── app/
│   ├── _layout.tsx       # Root layout with Tamagui provider
│   └── index.tsx         # PKP test page
├── config/
│   └── tamagui.config.ts # Tamagui configuration
├── package.json
├── vite.config.ts        # One.js + Tamagui plugins
└── README.md
```

## Dependencies

- **one**: Universal React framework (Vite-based)
- **tamagui**: Cross-platform UI primitives
- **@lit-protocol/lit-node-client**: (To be added) PKP client
- **@lit-protocol/auth-helpers**: (To be added) PKP auth

## Resources

- [One.js Docs](https://onestack.dev)
- [Tamagui Docs](https://tamagui.dev)
- [Lit Protocol Docs](https://developer.litprotocol.com)
