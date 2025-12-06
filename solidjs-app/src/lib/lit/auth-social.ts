/**
 * Social Authentication (Google/Discord)
 *
 * These are placeholder implementations that guide users to use passkeys instead.
 * Social auth with Lit Protocol requires OAuth 2.0 integration which is not
 * currently implemented.
 *
 * When called, these functions throw descriptive errors to inform users
 * that social auth is not yet available.
 */

import type { PKPInfo, AuthData, PKPAuthContext } from './types'

export interface SocialAuthResult {
  pkpInfo: PKPInfo
  authContext: PKPAuthContext
  authData: AuthData
}

/**
 * Authenticate with Google OAuth
 * @throws Error indicating Google auth is not implemented
 */
export async function authGoogle(
  onStatusUpdate: (status: string) => void,
  _options?: { requireExisting?: boolean }
): Promise<SocialAuthResult> {
  onStatusUpdate('Google authentication is not available yet')
  throw new Error(
    'Google authentication is not yet implemented. ' +
    'Please use passkey (recommended) or connect an external wallet.'
  )
}

/**
 * Authenticate with Discord OAuth
 * @throws Error indicating Discord auth is not implemented
 */
export async function authDiscord(
  onStatusUpdate: (status: string) => void,
  _options?: { requireExisting?: boolean }
): Promise<SocialAuthResult> {
  onStatusUpdate('Discord authentication is not available yet')
  throw new Error(
    'Discord authentication is not yet implemented. ' +
    'Please use passkey (recommended) or connect an external wallet.'
  )
}

/**
 * Legacy exports for compatibility
 */
export async function loginWithGoogle(): Promise<never> {
  throw new Error('Social auth not implemented. Use passkey or wallet flow.')
}

export async function loginWithDiscord(): Promise<never> {
  throw new Error('Social auth not implemented. Use passkey or wallet flow.')
}
