# Lens Authentication & Auto-Account Creation

## Evolution of the Fix

### Initial Problem
Users were getting the error:
```
Forbidden - You cannot access 'follow' as 'ONBOARDING_USER'
```

When attempting to follow other accounts on Lens Protocol.

### Initial Root Cause
The authentication flow in `auth-services.ts` was **always** logging users in as `ONBOARDING_USER`, regardless of whether they had an existing Lens account or not.

### Final Solution
Implemented **auto-account creation without usernames** to enable immediate social features while preventing username squatting.

### Lens Protocol Authentication Roles

According to Lens V3 Protocol, there are different authentication roles:

1. **ONBOARDING_USER** - Temporary role for new users during account setup
   - Limited to account creation operations only
   - Cannot perform social interactions (follow, post, etc.)
   - Authenticated via wallet address + app address

2. **ACCOUNT_OWNER** - Full-privilege role for established accounts
   - Required for social interactions (follow, unfollow, post, etc.)
   - Authenticated via account address + owner address + app address

3. **ACCOUNT_MANAGER** - For managing accounts (delegated access)

### The Bug

```typescript
// OLD CODE - ALWAYS logged in as ONBOARDING_USER
async function connectLensSession(...) {
  // This ALWAYS used ONBOARDING_USER role
  const session = await loginAsOnboardingUser(walletClient, address)

  // Then checked for existing accounts (but never switched roles!)
  const existingAccounts = await getExistingAccounts(address)
  const account = existingAccounts.length > 0 ? existingAccounts[0].account : null

  return { session, account }
}
```

## The Fix

### 1. Added new login function for Account Owners

In `lib/lens/auth.ts`:

```typescript
/**
 * Step 1b: Login as Account Owner (for users with existing accounts)
 */
export async function loginAsAccountOwner(
  walletClient: WalletClient,
  walletAddress: Address,
  accountAddress: Address
) {
  const authenticated = await lensClient.login({
    accountOwner: {
      account: evmAddress(accountAddress),
      app: LENS_APP_ADDRESS,
      owner: evmAddress(walletAddress),
    },
    signMessage: signMessageWith(walletClient),
  })

  if (authenticated.isErr()) {
    throw new Error(`Lens login as account owner failed: ${authenticated.error.message}`)
  }

  return authenticated.value as SessionClient
}
```

### 2. Updated auth flow to use correct role

In `lib/auth/auth-services.ts`:

```typescript
// NEW CODE - Checks for account first, then uses correct role
async function connectLensSession(...) {
  // First, check if user has existing accounts
  const existingAccounts = await getExistingAccounts(address)
  const hasAccount = existingAccounts.length > 0

  let session: SessionClient
  let account: Account | null = null

  if (hasAccount) {
    // User has an account - login as ACCOUNT_OWNER for full social features
    account = existingAccounts[0].account
    session = await loginAsAccountOwner(walletClient, address, account.address)
    console.log('[Auth] Logged in as ACCOUNT_OWNER:', account.address)
  } else {
    // User has no account - login as ONBOARDING_USER (limited to account creation)
    session = await loginAsOnboardingUser(walletClient, address)
    console.log('[Auth] Logged in as ONBOARDING_USER (no account found)')
  }

  return { session, account }
}
```

## Impact

### Before Fix
- ❌ Users with existing accounts were stuck in ONBOARDING_USER role
- ❌ Could not follow/unfollow accounts
- ❌ Could not perform any social interactions
- ❌ Follow attempts returned "Forbidden" error

### After Fix
- ✅ Users with existing accounts log in as ACCOUNT_OWNER
- ✅ Can follow/unfollow accounts
- ✅ Can perform all social interactions
- ✅ New users still get ONBOARDING_USER role for account creation

## Testing

To verify the fix works:

1. **For existing users:**
   - Sign in with your account
   - Check console logs - should see: `[Auth] Logged in as ACCOUNT_OWNER: 0x...`
   - Try following/unfollowing another account
   - Should work without "Forbidden" error

2. **For new users:**
   - Sign up for a new account
   - Check console logs - should see: `[Auth] Logged in as ONBOARDING_USER (no account found)`
   - Create a Lens account
   - After creation, sign out and sign back in
   - Should now see: `[Auth] Logged in as ACCOUNT_OWNER: 0x...`
   - Should be able to follow accounts

## Auto-Account Creation Flow (New)

To eliminate onboarding friction and prevent username squatting, we now **auto-create accounts without usernames**:

### How It Works

1. **User signs in** with PKP wallet (WebAuthn)
2. **Check for existing account** using `getExistingAccounts()`
3. **If account exists:**
   - Login as ACCOUNT_OWNER
   - Full social features enabled
4. **If no account:**
   - Login as ONBOARDING_USER
   - Create minimal metadata (name: "Anonymous User")
   - Deploy account WITHOUT username via `createAccount()`
   - Switch to ACCOUNT_OWNER role
   - Full social features enabled

### Key Changes

**In `lib/lens/auth.ts`:**
- Added `createLensAccountWithoutUsername()` function
- Uses `createAccount()` instead of `createAccountWithUsername()`
- No username required - account identified by EVM address

**In `lib/auth/auth-services.ts`:**
- Updated `connectLensSession()` to auto-create accounts
- Creates minimal metadata and uploads to Grove storage
- Switches to ACCOUNT_OWNER after creation
- **Always returns an Account** (never null)

**In `contexts/AuthContext.tsx`:**
- Updated types: `lensAccount` is now always `Account` (not `Account | null`)
- Simplified `ensureLensAccount()` - always returns true
- Updated `loginLens()` to always set account

### Username Creation (Deferred)

Usernames are now **optional** and can be added later:

- Users identified by address (e.g., `0x44f9...`)
- Username dialog in `components/profile/UsernameDialog.tsx`
- Triggered for active users (e.g., after 5+ posts/follows)
- Uses `canCreateUsername()` and `createUsername()` actions
- Can use restricted namespaces to prevent squatting

### Benefits

✅ **Immediate social features** - Follow, post, interact right away
✅ **No onboarding friction** - No username selection during signup
✅ **Prevents squatting** - Usernames gated to active users only
✅ **Always works** - Accounts function fully without usernames
✅ **Better UX** - Faster time-to-value for new users

## References

- Lens Protocol V3 Authentication: https://docs.lens.xyz/docs/authentication
- Lens Follow Guide: https://docs.lens.xyz/docs/social-graphs/follow-and-unfollow
- Account Creation: https://docs.lens.xyz/docs/accounts/create
- Username Creation: https://docs.lens.xyz/docs/accounts/usernames
