# One.js + Lit Protocol PoC - Findings

**Date**: 2025-11-03
**Goal**: Validate if Lit Protocol PKPs work with One.js + React Native before committing to full app migration

---

## 🚧 Current Status: BLOCKED

We encountered multiple dependency/configuration issues before being able to test Lit Protocol PKPs.

---

## ⚠️ Blockers Encountered

### 1. expo-modules-core Package Resolution
**Issue**: One.js tries to import `expo-modules-core/src/web/index.web.ts` which doesn't exist in the package

```
ERROR: Missing "./src/web/index.web.ts" specifier in "expo-modules-core" package
```

**Root Cause**: Potential version mismatch between One.js expectations and expo-modules-core exports

**Impact**: Cannot start dev server

### 2. viem Version Conflicts
**Issue**: @wagmi/core expects newer viem functions that don't exist in viem 2.21.54

```
ERROR: No matching export in "viem/_esm/actions/index.js" for import "getCallsStatus"
ERROR: No matching export for "sendCalls", "showCallsStatus", etc.
```

**Root Cause**: Lit Protocol requires viem@2.21.54, but @wagmi/core (transitive dep) expects viem@^2.22.0

**Impact**: Build failures

### 3. Missing Expo Dependencies
**Issue**: Tamagui/moti requires expo-linear-gradient

```
ERROR: Could not resolve "expo-linear-gradient"
```

**Resolution**: ✅ Fixed by installing `expo-linear-gradient` + `expo-modules-core`

---

## 📊 What We Built (But Couldn't Test)

### ✅ Completed

1. **Project Structure** (`one-poc/`)
   - Minimal One.js setup with Tamagui
   - File-system routing (`app/` directory)
   - TypeScript configuration
   - Vite + One.js + Tamagui plugins

2. **Lit Protocol Dependencies** (matching lit-actions@8.3.2)
   ```json
   "@lit-protocol/auth": "8.1.2",
   "@lit-protocol/auth-helpers": "8.1.1",
   "@lit-protocol/lit-client": "8.2.3",
   "@lit-protocol/lit-node-client": "7.3.1",
   "@lit-protocol/networks": "8.3.2",
   "ethers": "6.15.0",
   "viem": "2.21.54"
   ```

3. **PKP Test Suite** (`lib/lit-protocol-test.ts`)
   - Test 1: Lit Protocol client initialization
   - Test 2: PKP authentication (WebAuthn detection)
   - Test 3: Transaction signing
   - Comprehensive error reporting
   - Platform detection (web vs native)

4. **Test UI** (`app/index.tsx`)
   - Beautiful Tamagui UI
   - Live test execution
   - Detailed result display
   - Error categorization
   - Next steps recommendations

### ❌ Not Tested

- **Lit Protocol client initialization** in React Native
- **PKP authentication** without browser WebAuthn APIs
- **Transaction signing** with PKPs in RN environment

---

## 🔍 Analysis

### The Good
- One.js setup is conceptually simple (file-system routing, unified styling)
- Tamagui works beautifully for universal UI
- Project structure is clean and logical

### The Bad
- **Significant dependency hell** with React Native ecosystem
- Expo package version mismatches are hard to debug
- Transitive dependency conflicts (viem/wagmi)
- Can't even start dev server without manual intervention

### The Verdict
⚠️ **One.js is NOT production-ready for complex React Native projects**

The React Native ecosystem has too many fragile dependencies, and One.js doesn't provide enough guardrails or workarounds yet.

---

## 💡 Recommended Next Steps

### Option A: Use One.js Starter Template (Recommended)
**Instead of manual setup, use official One.js starter:**

```bash
bunx one
# Select: "Full Stack" or "React Native" template
```

**Reasoning**:
- Official templates have pre-configured deps that work
- Avoids manual dependency resolution
- Might already have Expo package workarounds

**Time**: 1-2 days to test Lit Protocol

**Pros**:
- Likely to work out of the box
- Can actually test PKPs

**Cons**:
- More bloat than minimal setup
- May still have Lit Protocol compatibility issues

---

### Option B: Test Lit Protocol in Isolation First
**Create minimal React Native app (no One.js) to test PKPs:**

```bash
bunx create-expo-app lit-protocol-test
cd lit-protocol-test
bun add @lit-protocol/lit-client @lit-protocol/auth-helpers ethers@6.15.0
# Test PKP auth in bare Expo app
```

**Reasoning**:
- Isolates the core question: **Do PKPs work in React Native?**
- Avoids One.js complexity
- Faster to validate

**Time**: 1-2 days

**Pros**:
- Direct answer to critical blocker
- Standard Expo setup (fewer unknowns)

**Cons**:
- Doesn't test One.js viability
- Need separate test for universal app approach

---

### Option C: Simplify to Web-Only Test
**Remove all native deps, test Lit Protocol on web first:**

Remove from `package.json`:
- `react-native`
- `react-native-screens`
- `react-native-safe-area-context`
- `expo-modules-core`
- `expo-linear-gradient`

Use Tamagui without React Native base.

**Reasoning**:
- We know Lit Protocol works on web
- Tests One.js web-only setup
- Validates Tamagui approach

**Time**: 1 day

**Pros**:
- Should "just work"
- Confirms One.js + Tamagui + Lit Protocol compatibility

**Cons**:
- Doesn't answer the native question
- Defeats the purpose of the PoC

---

### Option D: Abandon One.js, Build Separate Native App
**Accept that One.js isn't ready and build native app separately:**

```bash
cd app/
bunx create-expo-app android-karaoke-app
# Use existing web app for web
# Share business logic via npm packages
```

**Reasoning**:
- Most conservative approach
- Standard tooling (Expo, React Native)
- Separate concerns = less complexity

**Time**: 6-8 weeks for full native app

**Pros**:
- Proven, stable toolchain
- Can use platform-specific UX
- No dependency hell

**Cons**:
- Duplicate UI work
- No code sharing for components
- Longer development time

---

## 📈 Effort Estimates (Updated)

| Approach | Time to Test PKPs | Time to Full App | Risk Level |
|----------|-------------------|------------------|------------|
| Option A: One.js Starter | 1-2 days | 4-5 weeks | Medium |
| Option B: Bare Expo Test | 1-2 days | N/A (test only) | Low |
| Option C: Web-Only Test | 1 day | 3-4 weeks (web) | Low |
| Option D: Separate Native App | 3-4 days | 6-8 weeks | Low |

---

## 🎯 My Recommendation

**Do Option B First (Bare Expo Test), Then Decide**

1. **This Week**: Spend 1-2 days testing Lit Protocol PKPs in bare Expo app
   - If PKPs work: Consider Option A (One.js starter)
   - If PKPs don't work: Must do Option D (separate app with WebView/biometric fallback)

2. **Why This Matters**:
   - One.js viability is secondary to PKP compatibility
   - You already have a working web app
   - The critical unknown is: **Can you auth users in RN with PKPs?**

3. **If PKPs Work in Bare Expo**:
   - Try Option A (One.js starter template)
   - If One.js starter also has issues, just use Expo + React Navigation
   - File-system routing is nice, but not worth weeks of dependency hell

4. **If PKPs Don't Work**:
   - Build WebView bridge for PKP auth
   - Or use biometric auth with Lit Protocol session keys
   - Or build separate native app with traditional auth

---

## 📝 Technical Debt Identified

1. **Expo Package Management**: Need better version pinning strategy
2. **Vite + Metro Integration**: One.js uses Vite for dev but Metro for builds (complexity)
3. **Transitive Dependency Hell**: No good solution for viem/wagmi version conflicts
4. **One.js Maturity**: Beta software with edge cases not well documented

---

## 🔗 Resources

- [One.js Docs](https://onestack.dev)
- [Lit Protocol Docs](https://developer.litprotocol.com)
- [Expo Docs](https://docs.expo.dev)
- [Tamagui Docs](https://tamagui.dev)

---

## 💬 Questions to Ask One.js Community

1. How to resolve `expo-modules-core/src/web/index.web.ts` import error?
2. Best practices for handling viem version conflicts with Lit Protocol?
3. Any existing examples of Lit Protocol + One.js integration?
4. Is there a recommended dependency version matrix?

---

**This PoC revealed more about One.js limitations than Lit Protocol compatibility. Need to pivot strategy to answer the core question: Do PKPs work in React Native?**
