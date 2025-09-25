import { lensClient } from './client';
import { signMessageWith } from '@lens-protocol/client/viem';
import { fetchAccountsAvailable, createAccountWithUsername, canCreateUsername, fetchAccount } from '@lens-protocol/client/actions';
import { handleOperationWith } from '@lens-protocol/client/viem';
import { nonNullable } from '@lens-protocol/client';
import type { SessionClient } from "@lens-protocol/client";
import type { WalletClient } from 'viem';

// Session client for authenticated Lens actions
let sessionClient: SessionClient | null = null;

// Testnet app address from Lens documentation
const LENS_TESTNET_APP = "0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7";

/**
 * Create and authenticate a session client using PKP signing
 * Requires LitAuthProvider context for PKP access
 */
export async function createLensSession(
  pkpViemAccount: any,
  pkpEthAddress: string,
  lensAccountAddress?: string
): Promise<SessionClient | null> {
  try {
    console.log('[LensSession] Creating authenticated session client with PKP...');
    console.log('[LensSession] PKP address:', pkpEthAddress);
    console.log('[LensSession] Lens account address:', lensAccountAddress);

    // Use Account Manager pattern: PKP acts as manager for a Lens account owned by main wallet
    if (lensAccountAddress) {
      const authenticated = await lensClient.login({
        accountManager: {
          app: LENS_TESTNET_APP,
          account: lensAccountAddress, // Account owned by main wallet
          manager: pkpEthAddress,      // PKP is the manager
        },
        signMessage: signMessageWith(pkpViemAccount), // Use Lens SDK wrapper
      });

      if (authenticated.isErr()) {
        console.error('[LensSession] Account Manager login failed:', authenticated.error);
        return null;
      }

      sessionClient = authenticated.value;
      console.log('[LensSession] Successfully created Account Manager session client');
      return sessionClient;
    } else {
      // Fallback: Try onboarding user for initial account creation
      const authenticated = await lensClient.login({
        onboardingUser: {
          app: LENS_TESTNET_APP,
          wallet: pkpEthAddress,
        },
        signMessage: signMessageWith(pkpViemAccount), // Use Lens SDK wrapper
      });

      if (authenticated.isErr()) {
        console.error('[LensSession] Onboarding user login failed:', authenticated.error);
        return null;
      }

      sessionClient = authenticated.value;
      console.log('[LensSession] Successfully created onboarding user session client');
      return sessionClient;
    }
  } catch (error) {
    console.error('[LensSession] Failed to create session:', error);
    return null;
  }
}

/**
 * Get the current session client
 */
export function getLensSession(): SessionClient | null {
  return sessionClient;
}

/**
 * Check if user is authenticated for Lens actions
 */
export function isLensAuthenticated(): boolean {
  return sessionClient !== null;
}

/**
 * Try to resume an existing session from localStorage
 * This prevents needing to sign on every page refresh
 */
export async function resumeLensSession(): Promise<SessionClient | null> {
  try {
    console.log('[resumeLensSession] Attempting to resume session from localStorage...');

    const resumed = await lensClient.resumeSession();

    if (resumed.isErr()) {
      console.log('[resumeLensSession] No existing session found:', resumed.error);
      return null;
    }

    sessionClient = resumed.value;
    console.log('[resumeLensSession] ✅ Successfully resumed session from localStorage!');
    return sessionClient;
  } catch (error) {
    console.error('[resumeLensSession] Error resuming session:', error);
    return null;
  }
}

/**
 * Create and authenticate a session client using regular wallet signing
 * For use with RainbowKit connected wallets
 * Implements proper Lens V3 flow: check for existing accounts, create if needed
 */
export async function createLensSessionWithWallet(
  walletClient: WalletClient,
  walletAddress: string
): Promise<SessionClient | null> {
  try {
    console.log('[LensSession] Creating authenticated session client with regular wallet...');
    console.log('[LensSession] Wallet address:', walletAddress);

    // Step 1: Check if wallet has existing Lens accounts
    console.log('[LensSession] Checking for existing accounts...');
    const accountsResult = await fetchAccountsAvailable(lensClient, {
      managedBy: walletAddress,
      includeOwned: true
    });

    if (accountsResult.isErr()) {
      console.error('[LensSession] Failed to fetch accounts:', accountsResult.error);
      console.log('[LensSession] Proceeding with onboarding flow...');
    }

    const accounts = accountsResult.isOk() ? accountsResult.value.items : [];
    console.log(`[LensSession] Found ${accounts.length} account(s) for wallet ${walletAddress}`);
    if (accounts.length > 0) {
      console.log('[LensSession] Available accounts:', accounts);
      console.log(`[LensSession] Found ${accounts.length} existing account(s):`, accounts);

      // Try AccountOwner pattern with existing account
      const firstAccount = accounts[0];
      const accountAddress = firstAccount.account.address; // Extract address from nested account object
      console.log(`[LensSession] Using existing account: ${accountAddress}`);

      const authenticated = await lensClient.login({
        accountOwner: {
          app: LENS_TESTNET_APP,
          account: accountAddress, // Use existing account address
          owner: walletAddress,         // Wallet is the owner
        },
        signMessage: signMessageWith(walletClient),
      });

      if (authenticated.isErr()) {
        console.error('[LensSession] AccountOwner login failed even with existing account:', authenticated.error);
        return null;
      }

      sessionClient = authenticated.value;
      console.log('[LensSession] Successfully authenticated as AccountOwner with existing account');
      return sessionClient;

    } else {
      console.log('[LensSession] No existing accounts found. Starting onboarding flow...');

      // Step 2: Authenticate as onboarding user for account creation
      const onboardingAuth = await lensClient.login({
        onboardingUser: {
          app: LENS_TESTNET_APP,
          wallet: walletAddress,
        },
        signMessage: signMessageWith(walletClient),
      });

      if (onboardingAuth.isErr()) {
        console.error('[LensSession] Onboarding user login failed:', onboardingAuth.error);
        return null;
      }

      console.log('[LensSession] Authenticated as onboarding user. Creating Lens account...');

      // Step 3: Create a Lens account automatically
      const onboardingSession = onboardingAuth.value;

      // Generate a simple username based on wallet address
      // Lens requirements: min 5 chars, start with letter/number, only a-z, 0-9, -, _
      const shortAddress = walletAddress.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, ''); // Clean non-alphanumeric
      // Add random 4-digit suffix for uniqueness during testing
      const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const username = `user${shortAddress}${randomSuffix}`; // Will be at least 'user' + 6 chars + 4 = 14 chars total

      console.log(`[LensSession] Attempting to create username: lens/${username}`);

      // Check if username is available
      const usernameCheck = await canCreateUsername(onboardingSession, {
        localName: username,
      });

      if (usernameCheck.isErr()) {
        console.error('[LensSession] Username check failed:', usernameCheck.error);
        console.warn('[LensSession] ⚠️ Account creation failed - falling back to onboarding user');
        sessionClient = onboardingSession;
        return sessionClient;
      }

      const canCreateResult = usernameCheck.value;

      if (canCreateResult.__typename !== 'NamespaceOperationValidationPassed') {
        console.error(`[LensSession] Username lens/${username} not available:`, canCreateResult.__typename);

        // Log detailed validation failure reasons
        if (canCreateResult.__typename === 'NamespaceOperationValidationFailed') {
          console.error('[LensSession] Validation failed:', canCreateResult.reason);
          if (canCreateResult.unsatisfiedRules?.required) {
            console.error('[LensSession] Failed rules:');
            canCreateResult.unsatisfiedRules.required.forEach((rule: any) => {
              console.error(`- Rule: ${rule.type}, Reason: ${rule.reason}, Message: ${rule.message}`);
            });
          }
        } else if (canCreateResult.__typename === 'UsernameTaken') {
          console.error('[LensSession] Username is already taken');
        } else if (canCreateResult.__typename === 'NamespaceOperationValidationUnknown') {
          console.error('[LensSession] Unknown validation rules - extra checks required:', canCreateResult.extraChecksRequired);
        }

        console.warn('[LensSession] ⚠️ Username unavailable - falling back to onboarding user');
        sessionClient = onboardingSession;
        return sessionClient;
      }

      console.log(`[LensSession] ✅ Username lens/${username} is available`);

      // Create the account with username
      // Create simple metadata for the account
      const metadata = {
        name: `User ${username}`,
        bio: `Auto-generated Lens account for ${username}`,
        picture: "https://avatar.vercel.sh/" + username, // Generate a simple avatar
        attributes: []
      };

      // For now, use a simple data URI for metadata (could be uploaded to IPFS/Arweave later)
      const metadataJson = JSON.stringify(metadata);
      const metadataUri = `data:application/json;base64,${btoa(metadataJson)}`;

      // Step 1: Create account operation
      const createResult = await createAccountWithUsername(onboardingSession, {
        username: {
          localName: username,
        },
        metadataUri: metadataUri,
      });

      if (createResult.isErr()) {
        console.error('[LensSession] Account creation operation failed:', createResult.error);
        console.warn('[LensSession] ⚠️ Account creation failed - falling back to onboarding user');
        sessionClient = onboardingSession;
        return sessionClient;
      }

      console.log('[LensSession] Account creation operation successful, submitting transaction...');

      // Step 2: Handle operation with wallet client
      const operationResult = await handleOperationWith(walletClient)(createResult.value);

      if (operationResult.isErr()) {
        console.error('[LensSession] Transaction submission failed:', operationResult.error);
        console.warn('[LensSession] ⚠️ Transaction submission failed - falling back to onboarding user');
        sessionClient = onboardingSession;
        return sessionClient;
      }

      console.log('[LensSession] Transaction submitted successfully');

      // For account creation, we don't need to wait for confirmation explicitly
      // The operation result contains enough info to proceed
      const txHash = operationResult.value;
      console.log(`[LensSession] 🎉 Account creation transaction: ${txHash}`);

      // Skip transaction indexing wait for now - just continue with account fetching
      console.log('[LensSession] Skipping transaction indexing wait, proceeding with account fetching...');

      console.log(`[LensSession] 🎉 Successfully created Lens account: lens/${username}`);
      console.log('[LensSession] Fetching new account using txHash:', txHash);

      // Poll fetchAccount until available (handle indexing delay)
      let newAccount = null;
      const maxAttempts = 10;
      const delayMs = 3000; // 3 seconds between polls
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const fetchResult = await fetchAccount(onboardingSession, { txHash });
        if (fetchResult.isErr()) {
          console.error(`[LensSession] Fetch account error on attempt ${attempt}:`, fetchResult.error);
        } else if (fetchResult.value) {
          newAccount = fetchResult.value;
          console.log('[LensSession] Fetched new account:', newAccount);
          break;
        } else {
          console.log(`[LensSession] Account not indexed yet (attempt ${attempt}/${maxAttempts}) - waiting...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      if (!newAccount) {
        console.error('[LensSession] Failed to fetch new account after polling');
        console.warn('[LensSession] ⚠️ Falling back to onboarding user');
        sessionClient = onboardingSession;
        return sessionClient;
      }

      const accountAddress = newAccount.address;
      console.log(`[LensSession] New account address: ${accountAddress}`);

      // Step 4: Switch to AccountOwner authentication with the new account
      console.log('[LensSession] Switching to AccountOwner authentication...');

      const ownerAuth = await lensClient.login({
        accountOwner: {
          app: LENS_TESTNET_APP,
          account: accountAddress,
          owner: walletAddress,
        },
        signMessage: signMessageWith(walletClient),
      });

      if (ownerAuth.isErr()) {
        console.error('[LensSession] Failed to authenticate as AccountOwner after creation:', ownerAuth.error);
        console.warn('[LensSession] ⚠️ Using onboarding session instead');
        sessionClient = onboardingSession;
        return sessionClient;
      }

      console.log('[LensSession] ✅ Successfully authenticated as AccountOwner - reactions enabled!');
      sessionClient = ownerAuth.value;
      return sessionClient;
    }

  } catch (error) {
    console.error('[LensSession] Failed to create wallet session:', error);
    return null;
  }
}

/**
 * Clear the session (logout)
 */
export function clearLensSession(): void {
  sessionClient = null;
}

/**
 * Force refresh the session (clears cached session)
 * Useful when we want to re-authenticate with new permissions
 */
export function refreshLensSession(): void {
  console.log('[LensSession] Clearing cached session to force re-authentication');
  sessionClient = null;
}