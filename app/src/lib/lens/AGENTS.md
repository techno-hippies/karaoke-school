# Lens Integration - Agent Guide

## Core Commands

• **Lens Testnet**: `0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7`
• **Lens Mainnet**: `0x8A5Cc31180c37078e1EbA2A23c861Acf351a97cE`

## Authentication Architecture

**Dual-Layer Auth System**:
1. **PKP (Lit)**: Passkey wallet identity - handles transactions
2. **Lens**: Social username & profile - handles social features

**Current Implementation**:
- **Global namespace** (not custom `kschool1/*`) due to sponsorship issues
- **2-step account creation**: Create account → Switch to owner → Create username
- **WebAuthn required** for PKP authentication flows

## Key Patterns

**Account Creation Flow**:
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

**Authentication State**:
- **Auto-resume** on mount if session exists
- **Storage**: Browser localStorage for persistence
- **Error handling**: Network errors don't clear PKP session

## Required Environment

```bash
VITE_LENS_ENVIRONMENT=testnet
VITE_LENS_APP_ADDRESS=0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7
```

## Critical Files

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

## Common Issues

**WebAuthn Requirements**:
- Must be triggered by user gesture
- Only works over HTTPS (except localhost)
- Requires compatible browser

**Session Persistence**:
- PKP sessions auto-restore
- Lens sessions require explicit login
- Check `useAuth()` context before assuming connection

**Namespace Issues**:
- Currently using global namespace
- Custom namespaces need sponsorship setup
- Username validation format: lowercase, alphanumeric, underscores, 6+ chars

## Data Flow

**New User Registration**:
```
WebAuthn Passkey → PKP Wallet → Lens Onboarding → Lens Account → Username Creation
```

**Existing User Login**:
```
WebAuthn Passkey → PKP Wallet → Lens Session Resume → Account Owner Role
```

## Architecture Notes

**Storage Integration**:
- Grove uploads for account metadata
- ACL: Lens account ownership for metadata editing
- Indexed folders for profile pictures

**Error Patterns**:
- Network errors during auto-init → Keep PKP session, skip Lens
- Invalid blockhash → Clear stale session data
- CORS errors → Check origin configuration

## Testing

**Test Credentials**:
- Use Lens testnet (`37111` chain)
- Global namespace usernames (free)
- Test PKP wallets for authentication

**Debug Steps**:
1. Check browser WebAuthn support
2. Verify environment variables (`npm run lint`)
3. Test with 6+ character username
4. Monitor Lens API responses
5. Run tests: `npm run test`
