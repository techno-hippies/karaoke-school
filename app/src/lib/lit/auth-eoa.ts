/**
 * EOA Authentication
 * Register and authenticate with external wallet (Metamask, Rabby, Farcaster)
 */

import type { WalletClient } from 'viem'
import { getLitClient } from './client'
import { saveSession } from './storage'
import type { PKPInfo, AuthData } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Register new PKP with EOA wallet
 * Mints a new PKP owned by the connected wallet
 *
 * @param walletClient - viem WalletClient from connected wallet
 * @returns PKP info and auth data for session
 */
export async function registerWithEoa(
  walletClient: WalletClient
): Promise<{ pkpInfo: PKPInfo; authData: AuthData }> {
  if (IS_DEV) console.log('[LitEoa] Starting EOA registration...')

  const litClient = await getLitClient()
  const address = walletClient.account?.address

  if (!address) {
    throw new Error('No account address in wallet client')
  }

  if (IS_DEV) console.log('[LitEoa] Minting PKP for EOA:', address)

  // Mint PKP with EOA
  // The wallet will prompt user to sign a message to prove ownership
  // Note: Lit SDK expects the full wallet client, not just walletClient.account
  const mintResult = await litClient.mintWithEoa({
    account: walletClient,
  })

  // The GenericTxRes type wraps the actual PKP data
  // Extract the PKP info from the result (may be nested in different ways depending on SDK version)
  const pkpData = (mintResult as any).pkp ?? (mintResult as any).result ?? mintResult

  if (IS_DEV) {
    console.log('[LitEoa] PKP minted:', {
      rawResult: mintResult,
      pkpData,
    })
  }

  // Extract fields - handle both direct and nested structures
  const pubkey = pkpData.pubkey ?? pkpData.publicKey
  const ethAddr = pkpData.ethAddress
  const tokenId = pkpData.tokenId

  if (!pubkey || !ethAddr || tokenId === undefined) {
    console.error('[LitEoa] Invalid mint result structure:', mintResult)
    throw new Error('Failed to extract PKP info from mint result')
  }

  const pkpInfo: PKPInfo = {
    publicKey: pubkey,
    ethAddress: ethAddr as `0x${string}`,
    tokenId: tokenId.toString(),
  }

  // For EOA auth, authData uses the wallet address as the auth method ID
  // authMethodType 1 = EthWallet
  const authData: AuthData = {
    authMethodType: 1,
    authMethodId: address.toLowerCase(),
    accessToken: '', // EOA doesn't use access token - uses wallet signatures
  }

  if (IS_DEV) console.log('[LitEoa] ✓ PKP registration complete')

  saveSession(pkpInfo, authData)

  return { pkpInfo, authData }
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
  if (IS_DEV) console.log('[LitEoa] Starting EOA login...')

  const litClient = await getLitClient()
  const address = walletClient.account?.address

  if (!address) {
    throw new Error('No account address in wallet client')
  }

  if (IS_DEV) console.log('[LitEoa] Looking up PKPs for EOA:', address)

  // Find PKPs associated with this EOA
  const pkpsResult = await litClient.viewPKPsByAuthData({
    authData: {
      authMethodType: 1, // EthWallet
      authMethodId: address.toLowerCase(),
    },
    pagination: { limit: 5, offset: 0 },
  })

  if (!pkpsResult?.pkps?.length) {
    throw new Error('No PKP found for this wallet. Please create an account first.')
  }

  const pkp = pkpsResult.pkps[0]

  if (IS_DEV) {
    console.log('[LitEoa] PKP found:', {
      ethAddress: pkp.ethAddress,
      publicKey: pkp.pubkey?.slice(0, 20) + '...',
    })
  }

  const pkpInfo: PKPInfo = {
    publicKey: pkp.pubkey,
    ethAddress: pkp.ethAddress as `0x${string}`,
    tokenId: pkp.tokenId.toString(),
  }

  const authData: AuthData = {
    authMethodType: 1,
    authMethodId: address.toLowerCase(),
    accessToken: '',
  }

  if (IS_DEV) console.log('[LitEoa] ✓ PKP login complete')

  saveSession(pkpInfo, authData)

  return { pkpInfo, authData }
}

/**
 * Check if EOA has existing PKP
 * Useful for determining whether to show "Create Account" or "Sign In"
 *
 * @param address - EOA address to check
 * @returns true if PKP exists for this address
 */
export async function hasExistingPkpForEoa(address: string): Promise<boolean> {
  if (IS_DEV) console.log('[LitEoa] Checking for existing PKP:', address)

  const litClient = await getLitClient()

  const pkpsResult = await litClient.viewPKPsByAuthData({
    authData: {
      authMethodType: 1,
      authMethodId: address.toLowerCase(),
    },
    pagination: { limit: 1, offset: 0 },
  })

  const hasExisting = (pkpsResult?.pkps?.length ?? 0) > 0

  if (IS_DEV) console.log('[LitEoa] Has existing PKP:', hasExisting)

  return hasExisting
}
