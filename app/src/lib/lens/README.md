# Lens Protocol Integration

This module provides integration with Lens Protocol for social identity and account management in the Karaoke School app.

## Architecture

### Core Modules

#### `config.ts`
- Lens Protocol configuration (environment, app address, custom namespace)
- Public client initialization
- Exports: `lensClient`, `LENS_APP_ADDRESS`, `LENS_CUSTOM_NAMESPACE`, `isLensConfigured()`

#### `auth.ts`
- Authentication flows (onboarding user, account owner)
- Account fetching and session management
- Exports: `loginAsOnboardingUser()`, `loginAsAccountOwner()`, `getExistingAccounts()`, `switchToAccountOwner()`, `resumeLensSession()`

#### `account-creation.ts`
- Account creation in custom namespace (kschool1/*)
- 2-step flow: create account → switch role → create username
- Payment rules support for short usernames
- Username validation and availability checking
- Exports: `createAccountInCustomNamespace()`, `checkUsernameAvailability()`, `validateUsernameFormat()`

#### `mutations.ts`
- Raw GraphQL mutations for Lens Protocol
- Used for operations not covered by SDK helpers
- Exports mutation strings and TypeScript types

#### `graphql-client.ts`
- GraphQL client wrapper for authenticated requests
- Error handling and logging
- Exports: `createLensGraphQLClient()`, `executeMutation()`, `executeQuery()`

### Legacy Modules

#### `client.ts`
- Re-exports from `config.ts` for backward compatibility
- New code should import from `config.ts` directly

#### `account.ts`
- Contains only authentication functions (deprecated creation functions removed)
- Most functionality moved to `auth.ts` and `account-creation.ts`

## Usage

### Creating an Account in Custom Namespace

```typescript
import { createAccountInCustomNamespace } from '@/lib/lens/account-creation'
import { loginAsOnboardingUser } from '@/lib/lens/auth'
import { StorageClient } from '@lens-chain/storage-client'
import { account as accountMetadata } from '@lens-protocol/metadata'

// 1. Login as onboarding user
const session = await loginAsOnboardingUser(walletClient, walletAddress)

// 2. Create and upload metadata
const metadata = accountMetadata({
  name: 'My Username',
  bio: 'K-School User',
})
const storage = StorageClient.create()
const uploadResult = await storage.uploadAsJson(metadata)

// 3. Create account in custom namespace (kschool1/*)
const account = await createAccountInCustomNamespace(
  session,
  walletClient,
  'myusername', // Must be 6+ chars, lowercase, alphanumeric + underscores
  uploadResult.uri
)

console.log('Account created:', account.address)
console.log('Username:', account.username?.localName) // "myusername"
```

### Validating Usernames

```typescript
import { validateUsernameFormat, checkUsernameAvailability } from '@/lib/lens/account-creation'

// Check format (client-side validation)
const formatError = validateUsernameFormat('myusername')
if (formatError) {
  console.error(formatError) // e.g., "Username must be at least 6 characters"
}

// Check availability (async Lens query)
const availability = await checkUsernameAvailability('myusername')
if (availability.available) {
  console.log('Username available!')
  if (availability.paymentRequired) {
    console.log('Payment required:', availability.paymentAmount, 'wei')
  }
} else {
  console.log('Username unavailable:', availability.reason)
}
```

### Logging In with Existing Account

```typescript
import { getExistingAccounts, loginAsAccountOwner } from '@/lib/lens/auth'

// 1. Check for existing accounts
const accounts = await getExistingAccounts(walletAddress)

if (accounts.length > 0) {
  // 2. Login as account owner
  const session = await loginAsAccountOwner(
    walletClient,
    walletAddress,
    accounts[0].account.address
  )

  console.log('Logged in as:', accounts[0].account.username?.localName)
}
```

## Custom Namespace: kschool1/*

All accounts in Karaoke School are created in the `kschool1` namespace with custom rules:

- **Namespace Address**: `0xA5882f62feDC936276ef2e7166723A04Ee12501B`
- **Payment Rules**: Short usernames (<6 chars) may require payment
- **Username Format**: Lowercase letters, numbers, underscores only
- **URL Format**: `/u/{username}` → queries `kschool1/{username}`

## 2-Step Account Creation Flow

The custom namespace requires a 2-step flow to support payment rules:

### Step 1: Create Account (No Username)
```graphql
mutation CreateAccount($request: CreateAccountRequest!) {
  createAccount(request: $request) {
    ... on CreateAccountResponse {
      hash
    }
    ... on SelfFundedTransactionRequest {
      # Payment required - user signs transaction
      raw { ... }
    }
  }
}
```

### Step 2: Switch to Account Owner
```typescript
await sessionClient.switchAccount({
  account: evmAddress(accountAddress),
})
```

### Step 3: Create Username in Custom Namespace
```graphql
mutation CreateUsername($request: CreateUsernameRequest!) {
  createUsername(request: $request) {
    ... on CreateUsernameResponse {
      hash
    }
    ... on SelfFundedTransactionRequest {
      # Payment required for short usernames
      raw {
        value # Payment amount in wei
        ...
      }
    }
    ... on SponsoredTransactionRequest {
      # Gas sponsored by protocol
      sponsoredReason
      ...
    }
  }
}
```

## Payment Rules

Usernames in the `kschool1` namespace follow a length-based pricing model:

- **6+ characters**: Free
- **<6 characters**: Payment required (amount varies by length)

The `checkUsernameAvailability()` function returns payment info:

```typescript
const result = await checkUsernameAvailability('short')
if (result.paymentRequired) {
  console.log('Payment amount:', result.paymentAmount) // bigint (wei)
}
```

## Error Handling

All functions throw descriptive errors:

```typescript
try {
  const account = await createAccountInCustomNamespace(...)
} catch (error) {
  if (error.message.includes('Username validation failed')) {
    // Handle validation error
  } else if (error.message.includes('payment')) {
    // Handle payment required
  } else {
    // Handle other errors
  }
}
```

## Testing

To test the custom namespace flow:

1. **Testnet**: Use Lens testnet with test tokens
2. **6+ char username**: Should be free (no payment)
3. **<6 char username**: Should require payment
4. **Invalid format**: Should fail validation before network call

## Migration Guide

If you're using old account creation functions:

### Before
```typescript
import { createLensAccount } from '@/lib/lens/account'
const account = await createLensAccount(session, wallet, username, uri)
```

### After
```typescript
import { createAccountInCustomNamespace } from '@/lib/lens/account-creation'
const account = await createAccountInCustomNamespace(session, wallet, username, uri)
```

## Environment Variables

Required in `.env.local`:

```bash
VITE_LENS_ENVIRONMENT=testnet
VITE_LENS_APP_ADDRESS=0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7
VITE_LENS_CUSTOM_NAMESPACE=0xA5882f62feDC936276ef2e7166723A04Ee12501B
```

## See Also

- [Lens V3 Docs](https://lens.xyz/docs)
- [Namespace Rules](https://lens.xyz/docs/protocol/usernames/namespace-rules)
- [Create Account](https://lens.xyz/docs/protocol/accounts/create)
- Master-pipeline: `master-pipeline/modules/accounts/01-create-account.ts` (reference implementation)
