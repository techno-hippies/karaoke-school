# Lit WebAuthn Migration Guide

## Overview

This project has been migrated from Particle Network to Lit Protocol WebAuthn for authentication. This provides a superior user experience with native biometric authentication and zero-signature Lit Action execution.

---

## ✨ Key Benefits

### 1. **Reduced Signatures**
- **New users**: 2 signatures (WebAuthn register + PKP mint)
- **Returning users**: 1 signature (WebAuthn auth)
- **Lit Actions**: 0 signatures (PKP auth context persists!)

### 2. **Native Biometric Auth**
- Face ID (iOS/macOS)
- Touch ID (iOS/macOS)
- Windows Hello (Windows)
- Android Biometric (Android)
- No wallet extensions needed!

### 3. **Session Persistence**
- 7-day session duration
- Auto-restore on page refresh
- Works across browser tabs

---

## 🏗️ Architecture

### **New Auth Stack**

```
┌─────────────────────────────────────┐
│  Layer 1: Lit WebAuthn + PKP        │
│  - WebAuthn passkey authentication  │
│  - PKP as universal wallet/signer   │
│  - Zero-sig Lit Action execution    │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Layer 2: Lens Protocol             │
│  - Social identity (username)       │
│  - Content posting                  │
│  - Gas sponsored by app             │
└─────────────────────────────────────┘
```

### **Removed**
- ❌ Particle Network (ConnectKit, WagmiProvider)
- ❌ Smart Account (not needed, using PKP directly)
- ❌ `useParticleWallet` hook
- ❌ Wallet connection dialogs

### **Added**
- ✅ `lib/lit-webauthn/` - Core WebAuthn + PKP logic
- ✅ `useLitWebAuthn` hook - WebAuthn auth flow
- ✅ `usePKPWallet` hook - PKP as viem WalletClient
- ✅ Two-button auth flow (Register / Sign In)

---

## 📁 File Structure

### **New Files**

```
app/src/
├── lib/
│   └── lit-webauthn/          # NEW: Core auth infrastructure
│       ├── config.ts           # Lit network config
│       ├── types.ts            # Type definitions
│       ├── client.ts           # Lit client + auth manager
│       ├── storage.ts          # Session persistence
│       ├── auth-webauthn.ts    # WebAuthn register/authenticate
│       ├── auth-pkp.ts         # PKP auth context
│       ├── signer-pkp.ts       # PKP as WalletClient
│       └── index.ts            # Public API
│
├── hooks/
│   ├── useLitWebAuthn.ts      # NEW: WebAuthn hook
│   └── usePKPWallet.ts         # NEW: PKP wallet hook
│
└── contexts/
    └── AuthContext.tsx         # UPDATED: Uses Lit WebAuthn
```

### **Updated Files**

```
app/src/
├── contexts/
│   └── AuthContext.tsx         # Rewritten for Lit WebAuthn
│
├── hooks/
│   ├── useLitWebAuthn.ts      # New
│   └── usePKPWallet.ts         # New (replaces useParticleWallet)
│
├── features/post-flow/hooks/
│   ├── usePostFlowAuth.ts     # Uses PKP wallet
│   ├── useCredits.ts          # Uses PKP wallet
│   └── useKaraokeGeneration.ts # Uses PKP auth context
│
├── components/layout/
│   └── AuthDialog.tsx          # Two-button flow
│
└── App.tsx                     # Removed Particle providers
```

### **Deleted (Particle Network)**

```
❌ lib/particle/              # Delete entire directory
❌ hooks/useSmartAccount.ts   # Not needed
❌ Package dependencies:
   - @particle-network/connectkit
   - @particle-network/auth-connectors
   - @particle-network/evm-connectors
   - @particle-network/aa
   - wagmi (unless needed for other reasons)
```

---

## 🔑 Authentication Flow

### **New User (Register)**

1. User clicks **"Create Account"**
2. Browser prompts for biometric authentication (Face ID, Touch ID, etc.)
3. WebAuthn credential created + PKP minted on Lit Protocol
4. PKP wallet initialized with auth context
5. User can now sign messages and execute Lit Actions (zero additional signatures!)

```typescript
// In component
const { registerWithPasskey } = useAuth()

await registerWithPasskey()
// That's it! User is authenticated.
```

### **Returning User (Sign In)**

1. User clicks **"Sign In"**
2. Browser prompts for biometric authentication
3. WebAuthn authenticates with existing passkey
4. PKP wallet initialized from stored PKP info
5. Done! (1 signature total)

```typescript
// In component
const { signInWithPasskey } = useAuth()

await signInWithPasskey()
// Authenticated!
```

### **Lit Actions (Zero Signatures!)**

Once authenticated, Lit Actions execute without additional signatures:

```typescript
const { pkpWalletClient, pkpAuthContext } = useAuth()

// Execute Lit Action - NO signature prompt!
const result = await executeMatchAndSegment(geniusId, pkpWalletClient)
```

---

## 🎯 Key API Changes

### **AuthContext**

#### **Old (Particle)**
```typescript
const {
  isWalletConnected,
  walletAddress,
  walletClient,
  connectWallet,
  disconnectWallet,
} = useAuth()
```

#### **New (Lit WebAuthn)**
```typescript
const {
  isPKPReady,              // Replaces: isWalletConnected
  pkpAddress,              // Replaces: walletAddress
  pkpWalletClient,         // Replaces: walletClient
  pkpAuthContext,          // NEW: For Lit Actions
  registerWithPasskey,     // NEW: Create account
  signInWithPasskey,       // NEW: Sign in
  logout,                  // Replaces: disconnectWallet
} = useAuth()
```

### **Lens Integration**

No changes needed! PKP implements the same `WalletClient` interface:

```typescript
// This still works!
const session = await loginAsOnboardingUser(
  pkpWalletClient,  // Just use PKP wallet instead
  pkpAddress
)
```

### **Contract Interactions**

No changes needed! PKP wallet is compatible with viem:

```typescript
// This still works!
const hash = await pkpWalletClient.writeContract({
  address: contractAddress,
  abi: contractAbi,
  functionName: 'purchaseCreditsUSDC',
  args: [packageId],
})
```

---

## 🧪 Testing the Migration

### **1. Test Registration Flow**

```bash
# Start dev server
bun run dev

# Steps:
1. Open http://localhost:5173
2. Click "Profile" tab
3. Click "Create Account" button
4. Complete biometric authentication
5. Verify PKP address is shown
6. Verify "Lens Test" page shows PKP connected
```

### **2. Test Sign In Flow**

```bash
# Steps:
1. Logout (if logged in)
2. Click "Sign In" button
3. Complete biometric authentication
4. Verify PKP address matches previous session
5. Verify session restored (no Lens login needed)
```

### **3. Test Lit Action Execution**

```bash
# On Profile page:
1. Click "Buy 1 Credit" button
2. Approve transaction with PKP (1 signature)
3. Click "Test Lit Action" button
4. ✨ NO SIGNATURE PROMPT! ✨
5. Verify karaoke data returned
```

### **4. Test Session Persistence**

```bash
# Steps:
1. Sign in with passkey
2. Refresh page (Cmd+R / Ctrl+R)
3. Verify PKP wallet auto-restored
4. Verify no re-authentication needed
5. Verify Lit Actions still work (zero signatures)
```

---

## 🚀 Deployment Checklist

### **Before Deploying**

- [ ] Remove Particle Network dependencies from `package.json`
- [ ] Delete `lib/particle/` directory
- [ ] Delete `hooks/useSmartAccount.ts` (if not needed)
- [ ] Update environment variables (remove Particle keys)
- [ ] Test on multiple browsers (Chrome, Safari, Firefox)
- [ ] Test on mobile devices (iOS, Android)

### **After Deploying**

- [ ] Monitor Lit Protocol WebAuthn service status
- [ ] Check PKP minting gas costs
- [ ] Monitor session expiration behavior
- [ ] Collect user feedback on biometric auth UX

---

## 🐛 Troubleshooting

### **"No passkey found" error**

**Cause**: User clicked "Sign In" but hasn't registered yet.

**Solution**: Click "Create Account" instead.

---

### **"Failed to create PKP" error**

**Cause**: Lit Protocol service issue or network congestion.

**Solution**: Wait a few seconds and try again.

---

### **Session not restoring after refresh**

**Cause**: Session expired (7 days) or localStorage cleared.

**Solution**: Sign in again with passkey (1 signature).

---

### **Lit Action execution fails**

**Cause**: PKP auth context not created or expired.

**Solution**:
1. Check `pkpAuthContext` is not null
2. Check `isPKPReady` is true
3. Try re-authenticating with passkey

---

## 📊 Performance Comparison

### **Signatures Required**

| Action | Old (Particle) | New (Lit WebAuthn) | Improvement |
|--------|----------------|--------------------|--------------|
| New User Setup | 3+ | 2 | **33% reduction** |
| Returning User Login | 2 | 1 | **50% reduction** |
| Lit Action Execution | 2 | 0 | **100% reduction!** |

### **User Experience**

| Metric | Old (Particle) | New (Lit WebAuthn) |
|--------|----------------|-------------------|
| Wallet Extension Required | Yes | **No** |
| Mobile Support | Limited | **Native** |
| Biometric Auth | No | **Yes** |
| Session Duration | Session | **7 days** |
| Zero-sig Lit Actions | No | **Yes** |

---

## 📚 Resources

### **Lit Protocol Documentation**
- [WebAuthn Guide](https://developer.litprotocol.com/sdk/authentication/webauthn)
- [PKP Overview](https://developer.litprotocol.com/sdk/wallets/pkps)
- [Lit Actions](https://developer.litprotocol.com/sdk/serverless-signing/overview)

### **Demo Apps**
- [Lit WebAuthn + Lens Demo](https://github.com/LIT-Protocol/demo-lens-auth) (reference implementation)

---

## 🎉 Summary

You've successfully migrated from Particle Network to Lit Protocol WebAuthn! Your users now enjoy:

✅ Native biometric authentication
✅ Fewer signatures (2 → 1 for returning users)
✅ Zero-signature Lit Action execution
✅ No wallet extensions needed
✅ 7-day session persistence

**Next Steps**: Test the complete flow, gather user feedback, and enjoy the improved UX! 🚀
