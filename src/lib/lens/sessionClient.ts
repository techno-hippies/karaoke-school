import { lensClient } from './client';
import { signMessageWith } from '@lens-protocol/client/viem';
import { fetchAccountsAvailable, createAccount, fetchAccount } from '@lens-protocol/client/actions';
import { handleOperationWith } from '@lens-protocol/client/viem';
import { uri } from '@lens-protocol/client';
import type { SessionClient } from "@lens-protocol/client";
import type { WalletClient } from 'viem';

// Session client for authenticated Lens actions
let sessionClient: SessionClient | null = null;

// Testnet app address (should match CLAUDE.md)
const LENS_TESTNET_APP = "0x9484206D9beA9830F27361a2F5868522a8B8Ad22";


/**
 * Get the current session client
 */
export function getLensSession(): SessionClient | null {
  const stackTrace = new Error().stack?.split('\n')[2]?.trim();
  console.log('[getLensSession] 🔍 Current session state:', {
    hasSessionClient: !!sessionClient,
    hasAccount: !!sessionClient?.account,
    accountAddress: sessionClient?.account?.address,
    accountApp: sessionClient?.account?.app,
    calledFrom: stackTrace
  });
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
    console.log('[resumeLensSession] 🔄 Starting session resume...');
    const resumed = await lensClient.resumeSession();

    if (resumed.isErr()) {
      console.log('[resumeLensSession] ❌ Resume failed:', resumed.error);
      return null;
    }

    // CRITICAL: This is where sessionClient gets overwritten from resumeSession
    const oldSessionClient = sessionClient;
    sessionClient = resumed.value;
    console.log('[resumeLensSession] 🔄 SessionClient OVERWRITTEN from resumeSession():', {
      hadPreviousSession: !!oldSessionClient,
      previousHadAccount: !!oldSessionClient?.account,
      newHasSessionClient: !!sessionClient,
      newHasAccount: !!sessionClient?.account,
      newAccountAddress: sessionClient?.account?.address
    });

    console.log('[resumeLensSession] 🔍 Session resumed with account:', {
      hasAccount: !!sessionClient.account,
      accountAddress: sessionClient.account?.address,
      accountApp: sessionClient.account?.app,
      accountUsername: sessionClient.account?.username?.value
    });

    // Check if we need to switch to an account (Lens V3 requirement)
    if (!sessionClient.account || !sessionClient.account.address || !sessionClient.account.app) {
      console.log('[resumeLensSession] Account missing or incomplete, attempting to switch account...');

      try {
        // Get the account address from the stored credentials
        const stored = localStorage.getItem('lens.testnet.credentials');
        let payload = null;
        let walletAddress = null;

        if (stored) {
          const credentials = JSON.parse(stored);
          const accessToken = credentials.data.accessToken;
          payload = JSON.parse(atob(accessToken.split('.')[1]));
          walletAddress = payload.act?.sub;

          // For ACCOUNT_OWNER role, use sub (account address); act.sub is the wallet
          const accountAddress = payload.sub || payload.act?.sub;
          console.log('[resumeLensSession] 🔍 JWT Debug:', {
            role: payload['tag:lens.dev,2024:role'],
            accountAddress: payload.sub,
            walletAddress: payload.act?.sub,
            usingAddress: accountAddress
          });

          if (accountAddress && accountAddress.startsWith('0x')) {
            const switchResult = await sessionClient.switchAccount({ account: accountAddress });
            if (switchResult.isErr()) {
              console.error('[resumeLensSession] switchAccount failed:', switchResult.error);
              console.error('[resumeLensSession] 💡 This likely means the connected wallet does not own this Lens account');
              console.error('[resumeLensSession] 🔧 Solution: Connect with the wallet that owns account:', accountAddress);
              console.error('[resumeLensSession] 📝 Current wallet:', walletAddress, '| Target account:', accountAddress);
              return sessionClient; // Return existing session even if switch fails
            }

            // CRITICAL: switchAccount returns a NEW SessionClient instance
            sessionClient = switchResult.value;
            console.log('[resumeLensSession] ✅ Account switch completed, verifying...', {
              accountAddress,
              sessionHasAccount: !!sessionClient.account,
              sessionAccountAddress: sessionClient.account?.address,
              sessionAccountApp: sessionClient.account?.app
            });
            return sessionClient;
          }
        }

        // Fallback: Use fetchAccountsAvailable to get accounts for the wallet
        if (walletAddress) {
          console.log('[resumeLensSession] JWT parse failed, falling back to fetchAccountsAvailable...');
          const accountsResult = await fetchAccountsAvailable(sessionClient, {
            managedBy: walletAddress,
            includeOwned: true
          });

          if (accountsResult.isOk() && accountsResult.value.items.length > 0) {
            const firstAccount = accountsResult.value.items[0].account.address;
            console.log('[resumeLensSession] Fetched account:', firstAccount);

            const switchResult = await sessionClient.switchAccount({ account: firstAccount });
            if (switchResult.isErr()) {
              console.error('[resumeLensSession] switchAccount (fallback) failed:', switchResult.error);
            } else {
              // CRITICAL: Use the NEW SessionClient instance returned by switchAccount
              sessionClient = switchResult.value;
              console.log('[resumeLensSession] ✅ Switched to fetched account:', firstAccount, {
                sessionHasAccount: !!sessionClient.account,
                sessionAccountAddress: sessionClient.account?.address
              });
            }
          } else {
            console.error('[resumeLensSession] No accounts found for wallet:', walletAddress);
          }
        }
      } catch (switchError) {
        console.warn('[resumeLensSession] Failed to switch account:', switchError);
        // Continue anyway - session is still valid for posting
      }
    }

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
    // Step 1: Check if wallet has existing Lens accounts
    const accountsResult = await fetchAccountsAvailable(lensClient, {
      managedBy: walletAddress,
      includeOwned: true
    });

    if (accountsResult.isErr()) {
      console.error('[LensSession] Failed to fetch accounts:', accountsResult.error);
    }

    const accounts = accountsResult.isOk() ? accountsResult.value.items : [];

    if (accounts.length > 0) {
      // Try AccountOwner pattern with existing account
      const firstAccount = accounts[0];
      const accountAddress = firstAccount.account.address;

      const authenticated = await lensClient.login({
        accountOwner: {
          app: LENS_TESTNET_APP,
          account: accountAddress,
          owner: walletAddress,
        },
        signMessage: signMessageWith(walletClient),
      });

      if (authenticated.isErr()) {
        console.error('[LensSession] AccountOwner login failed:', authenticated.error);
        return null;
      }

      sessionClient = authenticated.value;
      return sessionClient;

    } else {
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

      const onboardingSession = onboardingAuth.value;

      // Step 3: Create simple metadata for the account
      const shortAddress = walletAddress.slice(-8);
      const metadata = {
        name: `User ${shortAddress}`,
        bio: `Account for ${walletAddress}`,
        picture: `https://avatar.vercel.sh/${walletAddress}`,
        attributes: []
      };

      const metadataJson = JSON.stringify(metadata);
      const metadataUri = `data:application/json;base64,${btoa(metadataJson)}`;

      // Step 4: Create account
      const createResult = await createAccount(onboardingSession, {
        metadataUri: uri(metadataUri),
      });

      if (createResult.isErr()) {
        console.error('[LensSession] Account creation failed:', createResult.error);
        return null;
      }

      // Step 5: Handle operation with wallet client
      const operationResult = await handleOperationWith(walletClient)(createResult.value);

      if (operationResult.isErr()) {
        console.error('[LensSession] Transaction submission failed:', operationResult.error);
        return null;
      }

      const txHash = operationResult.value;

      // Step 6: Fetch the new account
      let newAccount = null;
      const maxAttempts = 8;
      const delayMs = 2000;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const fetchResult = await fetchAccount(onboardingSession, { txHash });
        if (fetchResult.isOk() && fetchResult.value) {
          newAccount = fetchResult.value;
          break;
        }

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      if (!newAccount) {
        console.error('[LensSession] Failed to fetch new account');
        return null;
      }

      // Step 7: Switch to AccountOwner with the new account
      const accountAddress = newAccount.address;

      const ownerAuth = await lensClient.login({
        accountOwner: {
          app: LENS_TESTNET_APP,
          account: accountAddress,
          owner: walletAddress,
        },
        signMessage: signMessageWith(walletClient),
      });

      if (ownerAuth.isErr()) {
        console.error('[LensSession] AccountOwner login failed:', ownerAuth.error);
        return null;
      }

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
  sessionClient = null;
}