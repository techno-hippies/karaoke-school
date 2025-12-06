/**
 * EOA Authentication
 * Register and authenticate with external wallet (Metamask, Rabby, Farcaster)
 *
 * Uses a relayer API to sponsor PKP minting (user doesn't pay gas).
 */

import type { WalletClient } from 'viem'
import { WalletClientAuthenticator } from '@lit-protocol/auth'
import { getLitClient } from './client'
import { saveSession } from './storage'
import type { PKPInfo, AuthData } from './types'

// Relayer API for sponsored PKP minting
const LIT_SPONSORSHIP_API_URL =
  import.meta.env.VITE_LIT_SPONSORSHIP_API_URL || 'https://lit-sponsorship-api.vercel.app'

/**
 * Register new PKP with EOA wallet via relayer
 * Relayer pays gas, user's EOA is added as auth method
 *
 * @param walletClient - viem WalletClient from connected wallet
 * @returns PKP info and auth data for session
 */
export async function registerWithEoa(
  walletClient: WalletClient
): Promise<{ pkpInfo: PKPInfo; authData: AuthData }> {
  console.log('[LitEoa] Starting EOA registration via relayer...')

  const address = walletClient.account?.address

  if (!address) {
    throw new Error('No account address in wallet client')
  }

  console.log('[LitEoa] Requesting PKP mint for EOA:', address)
  console.log('[LitEoa] Relayer URL:', LIT_SPONSORSHIP_API_URL)

  // Call relayer API to mint PKP (relayer pays gas)
  const response = await fetch(`${LIT_SPONSORSHIP_API_URL}/api/mint-user-pkp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAddress: address }),
  })

  console.log('[LitEoa] Relayer response status:', response.status)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('[LitEoa] Relayer API error:', errorData)
    throw new Error(errorData.error || `Failed to mint PKP: ${response.status}`)
  }

  const data = await response.json()
  console.log('[LitEoa] PKP minted via relayer:', {
    existing: data.existing,
    pkpEthAddress: data.pkpEthAddress,
  })

  const pkpInfo: PKPInfo = {
    publicKey: data.pkpPublicKey,
    ethAddress: data.pkpEthAddress as `0x${string}`,
    tokenId: data.pkpTokenId,
  }

  // Use WalletClientAuthenticator to generate proper authData with SIWE signature
  // This prompts the user to sign a message proving wallet ownership
  console.log('[LitEoa] Authenticating wallet (SIWE signature)...')
  const authData = await WalletClientAuthenticator.authenticate(walletClient)
  console.log('[LitEoa] Wallet authenticated, authMethodType:', authData.authMethodType)

  console.log('[LitEoa] ✓ PKP registration complete')

  saveSession(pkpInfo, authData as AuthData)

  return { pkpInfo, authData: authData as AuthData }
}

/**
 * Login with existing EOA wallet
 * Finds PKPs associated with the connected wallet
 *
 * @param walletClient - viem WalletClient from connected wallet
 * @returns PKP info and auth data for session
 */
export async function loginWithEoa(
  walletClient: WalletClient
): Promise<{ pkpInfo: PKPInfo; authData: AuthData }> {
  console.log('[LitEoa] Starting EOA login...')

  const litClient = await getLitClient()
  const address = walletClient.account?.address

  if (!address) {
    throw new Error('No account address in wallet client')
  }

  console.log('[LitEoa] Looking up PKPs for EOA:', address)

  // Find PKPs associated with this EOA
  const pkpsResult = await litClient.viewPKPsByAuthData({
    authData: {
      authMethodType: 1, // EthWallet
      authMethodId: address.toLowerCase(),
    },
    pagination: { limit: 5, offset: 0 },
  })

  console.log('[LitEoa] PKP query result:', pkpsResult)

  if (!pkpsResult?.pkps?.length) {
    throw new Error('No PKP found for this wallet. Please create an account first.')
  }

  const pkp = pkpsResult.pkps[0]
  console.log('[LitEoa] PKP found:', {
    ethAddress: pkp.ethAddress,
    publicKey: pkp.pubkey?.slice(0, 20) + '...',
  })

  const pkpInfo: PKPInfo = {
    publicKey: pkp.pubkey,
    ethAddress: pkp.ethAddress as `0x${string}`,
    tokenId: pkp.tokenId.toString(),
  }

  // Use WalletClientAuthenticator to generate proper authData with SIWE signature
  // This prompts the user to sign a message proving wallet ownership
  console.log('[LitEoa] Authenticating wallet (SIWE signature)...')
  const authData = await WalletClientAuthenticator.authenticate(walletClient)
  console.log('[LitEoa] Wallet authenticated, authMethodType:', authData.authMethodType)

  console.log('[LitEoa] ✓ PKP login complete')

  saveSession(pkpInfo, authData as AuthData)

  return { pkpInfo, authData: authData as AuthData }
}

/**
 * Get existing PKP for EOA (if any)
 * Returns the PKP info without requiring a signature
 *
 * @param address - EOA address to check
 * @returns PKP info if exists, null otherwise
 */
export async function getExistingPkpForEoa(address: string): Promise<{ ethAddress: string; publicKey: string } | null> {
  console.log('[LitEoa] Checking for existing PKP:', address)

  console.log('[LitEoa] Getting Lit client...')
  const litClient = await getLitClient()
  console.log('[LitEoa] Lit client ready, querying PKPs...')

  const pkpsResult = await litClient.viewPKPsByAuthData({
    authData: {
      authMethodType: 1,
      authMethodId: address.toLowerCase(),
    },
    pagination: { limit: 1, offset: 0 },
  })

  const hasExisting = (pkpsResult?.pkps?.length ?? 0) > 0

  console.log('[LitEoa] Has existing PKP:', hasExisting, pkpsResult)

  if (hasExisting && pkpsResult.pkps[0]) {
    return {
      ethAddress: pkpsResult.pkps[0].ethAddress,
      publicKey: pkpsResult.pkps[0].pubkey,
    }
  }
  return null
}
